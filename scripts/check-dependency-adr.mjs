import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const manifestPaths = ['package.json', 'functions/package.json'];
const dependencySections = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'overrides',
];

const comparisonRef = resolveComparisonRef();
const addedDependencies = manifestPaths.flatMap((manifestPath) =>
  findAddedDependencies(manifestPath, comparisonRef),
);

if (addedDependencies.length === 0) {
  console.log('Dependency ADR check passed: no new dependencies detected.');
  process.exit(0);
}

const changedFiles = getChangedFiles(comparisonRef);
const hasAdrChange = changedFiles.some((file) =>
  /^docs\/adr\/.+\.md$/.test(file),
);

if (!hasAdrChange) {
  console.error('New dependencies require a docs/adr/*.md decision record.');
  console.error('Detected additions:');

  for (const entry of addedDependencies) {
    console.error(`- ${entry.manifest}: ${entry.section}.${entry.name}`);
  }

  process.exit(1);
}

console.log(
  `Dependency ADR check passed: ${addedDependencies.length} dependency addition(s) are covered by an ADR change.`,
);

function resolveComparisonRef() {
  const baseRef = process.env.GITHUB_BASE_REF
    ? `origin/${process.env.GITHUB_BASE_REF}`
    : null;

  if (baseRef && canResolveRef(baseRef)) {
    return baseRef;
  }

  if (process.env.CI && canResolveRef('HEAD~1')) {
    return 'HEAD~1';
  }

  return 'HEAD';
}

function canResolveRef(ref) {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function findAddedDependencies(manifestPath, ref) {
  const current = readJsonFile(manifestPath);
  const previous = readJsonFromGit(ref, manifestPath);

  if (!current || !previous) {
    return [];
  }

  return dependencySections.flatMap((section) => {
    const currentNames = new Set(Object.keys(current[section] ?? {}));
    const previousNames = new Set(Object.keys(previous[section] ?? {}));

    return [...currentNames]
      .filter((name) => !previousNames.has(name))
      .map((name) => ({
        manifest: manifestPath,
        name,
        section,
      }));
  });
}

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readJsonFromGit(ref, path) {
  try {
    return JSON.parse(
      execFileSync('git', ['show', `${ref}:${path}`], {
        encoding: 'utf8',
      }),
    );
  } catch {
    return null;
  }
}

function getChangedFiles(ref) {
  const committed = runGitLines(['diff', '--name-only', ref, 'HEAD']);
  const workingTree = runGitLines([
    'diff',
    '--name-only',
    '--diff-filter=ACMR',
    'HEAD',
  ]);
  const untracked = runGitLines(['ls-files', '--others', '--exclude-standard']);

  return [...new Set([...committed, ...workingTree, ...untracked])];
}

function runGitLines(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
