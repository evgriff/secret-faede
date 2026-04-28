import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const summaryPath = 'output/bundle-analysis/bundle-summary.json';
const indexPath = 'dist/index.html';

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
const indexHtml = await readFile(indexPath, 'utf8');
const assetsByPath = new Map(
  summary.assets.map((asset) => [asset.path, asset]),
);
const referencedJsAssets = getReferencedJsAssets(indexHtml);
const entryJsAsset = getEntryJsAsset(indexHtml);
const initialJsGzipBytes = sumGzip(referencedJsAssets, assetsByPath);
const entryJsGzipBytes = getGzip(entryJsAsset, assetsByPath);
const planRouteGzipBytes = summary.assets
  .filter((asset) => /^dist\/assets\/PlanPage-.*\.js$/.test(asset.path))
  .reduce((total, asset) => total + asset.gzipBytes, 0);

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

if (forbiddenInitialChunks.length > 0) {
  failures.push(
    `heavy chunks are preloaded by index.html: ${forbiddenInitialChunks.join(
      ', ',
    )}`,
  );
}

if (failures.length > 0) {
  console.error('\nBundle budget check failed:');

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exitCode = 1;
}

function getReferencedJsAssets(html) {
  const paths = new Set();
  const jsReferencePattern =
    /(?:src|href)="\/(assets\/[^"]+\.js)(?:\?[^"]*)?"/g;

  for (const match of html.matchAll(jsReferencePattern)) {
    paths.add(join('dist', match[1]));
  }

  return [...paths];
}

function getEntryJsAsset(html) {
  const match = html.match(/<script[^>]+type="module"[^>]+src="\/([^"]+\.js)"/);

  if (!match) {
    throw new Error(
      'Could not find the module entry script in dist/index.html',
    );
  }

  return join('dist', match[1]);
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
