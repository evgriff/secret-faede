import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  decodeCollection,
  decodeDocument,
  FirestoreRestClient,
} from './migrate-workspace-v2-firestore.mjs';
import { buildMigrationPlan } from './migrate-workspace-v2-plan.mjs';
import { buildMigrationReport } from './migrate-workspace-v2-report.mjs';

export { buildMigrationPlan } from './migrate-workspace-v2-plan.mjs';
export { migrateLegacyProfile } from './migrate-workspace-v2-plan-shapes.mjs';

export const migrationCollectionPaths = {
  alerts: 'gardenWorkspaces/main/alerts',
  drafts: 'gardenWorkspaces/main/drafts',
  gardens: 'gardens',
  harvests: 'gardenWorkspaces/main/harvests',
  journal: 'gardenWorkspaces/main/journal',
  legacyOperationArchive: 'gardenWorkspaces/main/legacyOperationArchive',
  legacyRevisionArchive: 'gardenWorkspaces/main/legacyRevisionArchive',
  notifications: 'gardenWorkspaces/main/notifications',
  profiles: 'users',
  revisions: 'gardenWorkspaces/main/revisions',
  tasks: 'gardenWorkspaces/main/tasks',
  waterApplications: 'gardenWorkspaces/main/waterApplications',
  waterBalances: 'gardenWorkspaces/main/waterBalances',
  wateringRecommendations: 'gardenWorkspaces/main/wateringRecommendations',
  wateringSchedule: 'gardenWorkspaces/main/wateringSchedule',
  weatherSnapshots: 'gardenWorkspaces/main/weatherSnapshots',
};

export function parseMigrationOptions(argv, environment = process.env) {
  const apply = argv.includes('--apply');
  const projectFlag = argv.find((value) => value.startsWith('--project='));
  const projectIndex = argv.indexOf('--project');
  const projectId =
    projectFlag?.slice('--project='.length) ||
    (projectIndex >= 0 ? argv[projectIndex + 1] : '') ||
    environment.FIREBASE_PROJECT_ID ||
    environment.GCLOUD_PROJECT ||
    environment.GOOGLE_CLOUD_PROJECT ||
    environment.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Pass --project <id> or set FIREBASE_PROJECT_ID.');
  }
  return { apply, dryRun: !apply, projectId };
}

async function main() {
  loadEnv('.env.local');
  const options = parseMigrationOptions(process.argv.slice(2));
  const accessToken = await getFirebaseCliAccessToken();
  const firestore = new FirestoreRestClient(options.projectId, accessToken);
  const [workspaceRaw, publishedRaw, ...rawCollections] = await Promise.all([
    firestore.getOptional('gardenWorkspaces/main'),
    firestore.getOptional('gardenWorkspaces/main/plans/published'),
    ...Object.values(migrationCollectionPaths).map((collection) =>
      firestore.list(collection),
    ),
  ]);
  const rawByKey = Object.fromEntries(
    Object.keys(migrationCollectionPaths).map((key, index) => [
      key,
      rawCollections[index],
    ]),
  );
  const backup = {
    collections: Object.fromEntries(
      Object.entries(migrationCollectionPaths).map(([key, collection]) => [
        collection,
        rawByKey[key],
      ]),
    ),
    createdAtIso: new Date().toISOString(),
    projectId: options.projectId,
    roots: {
      'gardenWorkspaces/main': workspaceRaw,
      'gardenWorkspaces/main/plans/published': publishedRaw,
    },
  };
  const backupPath = writeBackup(backup);
  const { migrateGarden, migrateOperations } = await loadGardenMigrators();
  const plan = await buildMigrationPlan({
    collections: Object.fromEntries(
      Object.entries(rawByKey).map(([key, documents]) => [
        key,
        decodeCollection(documents),
      ]),
    ),
    migrateGarden,
    migrateOperations,
    nowIso: new Date().toISOString(),
    publishedDocument: decodeDocument(publishedRaw),
    workspace: decodeDocument(workspaceRaw),
  });
  const applyStatus = await executeMigrationPlan({
    firestore,
    options,
    plan,
  });
  const report = buildMigrationReport({
    applyStatus,
    backupPath,
    options,
    plan,
  });
  console.log(JSON.stringify(report, null, 2));
  if (applyStatus === 'refused') {
    console.error(
      'Apply refused because the migration plan has unresolved blockers. No migration actions were written.',
    );
    process.exitCode = 1;
    return;
  }
  if (options.dryRun && !plan.alreadyCurrent && report.canApply) {
    console.log(
      'Dry run only. Review the backup and action plan, then rerun with --apply.',
    );
  } else if (options.dryRun && !report.canApply) {
    console.log(
      'Dry run only. Resolve every blocker and rerun; this plan cannot be applied.',
    );
  }
}

export async function executeMigrationPlan({ firestore, options, plan }) {
  if (!options.apply) return 'dry-run';
  if (plan.canApply === false || (plan.blockers ?? []).length > 0) {
    return 'refused';
  }
  if (plan.alreadyCurrent) return 'already-current';
  for (const [index, action] of plan.actions.entries()) {
    try {
      if (action.kind === 'delete') await firestore.delete(action.path);
      else await firestore.write(action.path, action.data);
    } catch {
      throw new Error(
        `Migration apply failed at action ${index + 1}; inspect provider logs before retrying.`,
      );
    }
  }
  return 'applied';
}

async function loadGardenMigrators() {
  const { createServer } = await import('vite');
  const server = await createServer({
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });
  try {
    const module = await server.ssrLoadModule(
      '/src/v2/data/legacyMigration.ts',
    );
    return {
      migrateGarden: module.migrateLegacyGarden,
      migrateOperations: module.migrateLegacyOperations,
    };
  } finally {
    await server.close();
  }
}

async function getFirebaseCliAccessToken() {
  const require = createRequire(new URL('../package.json', import.meta.url));
  const firebaseAuth = require('firebase-tools/lib/auth');
  const account = firebaseAuth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error('Run firebase login before running the migration.');
  }
  const token = await firebaseAuth.getAccessToken(
    account.tokens.refresh_token,
    [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase',
    ],
  );
  if (!token?.access_token) {
    throw new Error('Firebase CLI access token is unavailable.');
  }
  return token.access_token;
}

function writeBackup(backup) {
  const directory = path.join('output', 'production-backups');
  const timestamp = backup.createdAtIso.replace(/[:.]/g, '-');
  const outputPath = path.join(directory, `workspace-v2-${timestamp}.json`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(backup, null, 2), { mode: 0o600 });
  return outputPath;
}

function loadEnv(filename) {
  if (!existsSync(filename)) return;
  for (const line of readFileSync(filename, 'utf8').split('\n')) {
    const match = /^([^#=]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
