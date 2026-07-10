import { readFile } from 'node:fs/promises';
import process from 'node:process';

const summaryPath = 'output/bundle-analysis/bundle-summary.json';

const budgets = [
  {
    label: 'total built asset gzip',
    limitBytes: 656 * 1024,
    value: (context) => context.summary.totalGzipBytes,
  },
  {
    label: 'initial JavaScript gzip',
    limitBytes: 128 * 1024,
    value: (context) => context.initialJsGzipBytes,
  },
  {
    label: 'app entry JavaScript gzip',
    limitBytes: 32 * 1024,
    value: (context) => context.entryJsGzipBytes,
  },
  {
    label: 'Plan route JavaScript gzip',
    limitBytes: 73 * 1024,
    value: (context) => context.planRouteGzipBytes,
  },
];

const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
const assetsByPath = new Map(
  summary.assets.map((asset) => [asset.path, asset]),
);
const referencedJsAssets = requireAssetList(
  summary.moduleGraph?.initialJsAssets,
  'initial JavaScript assets',
);
const entryJsAsset = requireAssetPath(
  summary.moduleGraph?.entryJsAsset,
  'app entry JavaScript asset',
);
const planRouteAssets = requireAssetList(
  summary.moduleGraph?.routes?.plan?.jsAssets,
  'Plan route JavaScript assets',
);
const initialJsGzipBytes = sumGzip(referencedJsAssets, assetsByPath);
const entryJsGzipBytes = getGzip(entryJsAsset, assetsByPath);
const planRouteGzipBytes = sumGzip(planRouteAssets, assetsByPath);

const context = {
  entryJsGzipBytes,
  initialJsGzipBytes,
  planRouteGzipBytes,
  summary,
};

const failures = [];

for (const budget of budgets) {
  const actualBytes = budget.value(context);
  const passed = actualBytes <= budget.limitBytes;
  const prefix = passed ? 'ok' : 'fail';

  console.log(
    `${prefix}: ${budget.label} ${formatBytes(actualBytes)} / ${formatBytes(
      budget.limitBytes,
    )}`,
  );

  if (!passed) {
    failures.push(
      `${budget.label} is ${formatBytes(actualBytes)}; budget is ${formatBytes(
        budget.limitBytes,
      )}`,
    );
  }
}

const forbiddenInitialChunks = referencedJsAssets.filter(
  (assetPath) =>
    assetPath.includes('firebase-vendor') ||
    assetPath.includes('capacitor-vendor') ||
    assetPath.includes('cropCatalog'),
);
const cropCatalogInitialChunks =
  summary.moduleGraph?.contentMarkers?.cropCatalogInitialJsAssets ?? [];

if (forbiddenInitialChunks.length > 0) {
  failures.push(
    `heavy chunks are preloaded by index.html: ${forbiddenInitialChunks.join(
      ', ',
    )}`,
  );
}

if (cropCatalogInitialChunks.length > 0) {
  failures.push(
    `crop catalog data is present in initial JavaScript: ${cropCatalogInitialChunks.join(
      ', ',
    )}`,
  );
}

if (planRouteGzipBytes === 0) {
  failures.push('Plan route JavaScript resolved to 0 B');
}

if (failures.length > 0) {
  console.error('\nBundle budget check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exitCode = 1;
}

function requireAssetList(value, label) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      'Bundle analysis did not identify ' +
        label +
        '. Run npm run quality:bundle.',
    );
  }

  return value.map((assetPath) => requireAssetPath(assetPath, label));
}

function requireAssetPath(value, label) {
  if (typeof value !== 'string' || !value.endsWith('.js')) {
    throw new Error('Bundle analysis did not identify ' + label + '.');
  }

  return value;
}

function getGzip(assetPath, assetsByPath) {
  const asset = assetsByPath.get(assetPath);

  if (!asset) {
    throw new Error(`Asset ${assetPath} was referenced but not analyzed.`);
  }

  return asset.gzipBytes;
}

function sumGzip(assetPaths, assetsByPath) {
  return assetPaths.reduce(
    (total, assetPath) => total + getGzip(assetPath, assetsByPath),
    0,
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(2)} kB`;
}
