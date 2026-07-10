import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import { mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const distDir = 'dist';
const outputDir = 'output/bundle-analysis';
const jsonOutput = join(outputDir, 'bundle-summary.json');
const markdownOutput = join(outputDir, 'bundle-summary.md');

const assets = await collectAssets(distDir);

if (assets.length === 0) {
  throw new Error('No build assets found. Run npm run build first.');
}

const rows = await Promise.all(
  assets.map(async (assetPath) => {
    const details = await stat(assetPath);
    const gzipBytes = await getGzipSize(assetPath);

    return {
      bytes: details.size,
      gzipBytes,
      path: relative(process.cwd(), assetPath),
      type: getAssetType(assetPath),
    };
  }),
);

rows.sort((left, right) => right.bytes - left.bytes);

const moduleGraph = await analyzeBuiltModuleGraph(rows);

const summary = {
  generatedAtIso: new Date().toISOString(),
  moduleGraph,
  totalBytes: rows.reduce((total, row) => total + row.bytes, 0),
  totalGzipBytes: rows.reduce((total, row) => total + row.gzipBytes, 0),
  assets: rows,
};

await mkdir(outputDir, { recursive: true });
await writeFile(jsonOutput, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await writeFile(markdownOutput, toMarkdown(summary), 'utf8');

console.log(`Bundle analysis written to ${markdownOutput}`);

async function collectAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error) => {
      if (error && error.code === 'ENOENT') {
        return [];
      }

      throw error;
    },
  );
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectAssets(path);
      }

      return entry.isFile() ? [path] : [];
    }),
  );

  return nested.flat();
}

async function getGzipSize(path) {
  const tempPath = join(tmpdir(), `secret-faeries-${randomUUID()}.gz`);

  try {
    await pipeline(
      createReadStream(path),
      createGzip(),
      createWriteStream(tempPath),
    );
    const details = await stat(tempPath);

    return details.size;
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

async function analyzeBuiltModuleGraph(assetRows) {
  const indexPath = join(distDir, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf8');
  const entryJsAsset = getEntryJsAsset(indexHtml);
  const initialJsAssets = getReferencedJsAssets(indexHtml);
  const jsAssetPaths = new Set(
    assetRows.filter((asset) => asset.type === 'js').map((asset) => asset.path),
  );
  const sources = new Map(
    await Promise.all(
      [...jsAssetPaths].map(async (assetPath) => [
        assetPath,
        await readFile(assetPath, 'utf8'),
      ]),
    ),
  );
  const importsByAsset = new Map(
    [...sources].map(([assetPath, source]) => [
      assetPath,
      {
        dynamic: resolveImports(assetPath, readDynamicImports(source)),
        static: resolveImports(assetPath, readStaticImports(source)),
      },
    ]),
  );

  return {
    contentMarkers: {
      cropCatalogInitialJsAssets: initialJsAssets.filter((assetPath) =>
        (sources.get(assetPath) ?? '').includes(
          'secret-faeries-home-garden-v2',
        ),
      ),
    },
    entryJsAsset,
    initialJsAssets,
    routes: {
      plan: findLazyRoute({
        entryJsAsset,
        exportName: 'PlanPage',
        importsByAsset,
        initialJsAssets,
        sources,
      }),
    },
  };
}

function findLazyRoute({
  entryJsAsset,
  exportName,
  importsByAsset,
  initialJsAssets,
  sources,
}) {
  const dynamicImports = importsByAsset.get(entryJsAsset)?.dynamic ?? [];
  const routeEntries = dynamicImports.filter((assetPath) =>
    exportsName(sources.get(assetPath) ?? '', exportName),
  );

  if (routeEntries.length !== 1) {
    throw new Error(
      `Expected exactly one lazy module exporting ${exportName}; found ${routeEntries.length}.`,
    );
  }

  const entryAsset = routeEntries[0];
  const initialAssets = new Set(initialJsAssets);
  const jsAssets = collectStaticImportClosure(
    entryAsset,
    importsByAsset,
  ).filter((assetPath) => !initialAssets.has(assetPath));

  if (jsAssets.length === 0) {
    throw new Error(`The ${exportName} lazy route resolved to no JavaScript.`);
  }

  return {
    entryAsset,
    exportName,
    jsAssets,
  };
}

function collectStaticImportClosure(entryAsset, importsByAsset) {
  const visited = new Set();
  const pending = [entryAsset];

  while (pending.length > 0) {
    const assetPath = pending.pop();

    if (!assetPath || visited.has(assetPath)) {
      continue;
    }

    visited.add(assetPath);

    for (const dependency of importsByAsset.get(assetPath)?.static ?? []) {
      pending.push(dependency);
    }
  }

  return [...visited].sort();
}

function exportsName(source, exportName) {
  const escapedName = exportName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    new RegExp(`\\bas\\s+${escapedName}\\b`).test(source) ||
    new RegExp(`\\bexport\\s*\\{[^}]*\\b${escapedName}\\b`).test(source)
  );
}

function readDynamicImports(source) {
  return [...source.matchAll(/\bimport\(\s*(["'])([^"']+\.js)\1\s*\)/g)].map(
    (match) => match[2],
  );
}

function readStaticImports(source) {
  const references = new Set();
  const patterns = [
    /\bimport\s*(["'])([^"']+\.js)\1/g,
    /\b(?:import|export)[^;"']*?\bfrom\s*(["'])([^"']+\.js)\1/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      references.add(match[2]);
    }
  }

  return [...references];
}

function resolveImports(importerPath, references) {
  return references
    .filter((reference) => reference.startsWith('.'))
    .map((reference) =>
      relative(process.cwd(), resolve(dirname(importerPath), reference)),
    );
}

function getReferencedJsAssets(html) {
  const paths = new Set();
  const referencePattern = /<(?:script|link)\b[^>]*>/g;

  for (const tag of html.match(referencePattern) ?? []) {
    const reference = readHtmlAttribute(
      tag,
      tag.startsWith('<script') ? 'src' : 'href',
    );

    if (reference && reference.split('?', 1)[0].endsWith('.js')) {
      paths.add(toDistPath(reference));
    }
  }

  return [...paths];
}

function getEntryJsAsset(html) {
  for (const tag of html.match(/<script\b[^>]*>/g) ?? []) {
    if (readHtmlAttribute(tag, 'type') !== 'module') {
      continue;
    }

    const source = readHtmlAttribute(tag, 'src');

    if (source?.split('?', 1)[0].endsWith('.js')) {
      return toDistPath(source);
    }
  }

  throw new Error('Could not find the module entry script in dist/index.html.');
}

function readHtmlAttribute(tag, name) {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'),
  );
  return match?.[1] ?? null;
}

function toDistPath(reference) {
  const withoutQuery = reference.split('?', 1)[0];
  return join(distDir, withoutQuery.replace(/^\.?\//, ''));
}

function getAssetType(path) {
  if (path.endsWith('.js')) {
    return 'js';
  }

  if (path.endsWith('.css')) {
    return 'css';
  }

  if (path.endsWith('.html')) {
    return 'html';
  }

  if (path.endsWith('.png') || path.endsWith('.svg') || path.endsWith('.ico')) {
    return 'image';
  }

  return 'other';
}

function toMarkdown(summary) {
  const assetsByPath = new Map(
    summary.assets.map((asset) => [asset.path, asset]),
  );
  const initialJsGzipBytes = sumAssetGzip(
    summary.moduleGraph.initialJsAssets,
    assetsByPath,
  );
  const planRoute = summary.moduleGraph.routes.plan;
  const planRouteGzipBytes = sumAssetGzip(planRoute.jsAssets, assetsByPath);
  const lines = [
    '# Bundle Summary',
    '',
    `Generated: ${summary.generatedAtIso}`,
    '',
    `Total: ${formatBytes(summary.totalBytes)} (${formatBytes(
      summary.totalGzipBytes,
    )} gzip)`,
    '',
    `Initial JavaScript: ${formatBytes(initialJsGzipBytes)} gzip`,
    '',
    `Plan route JavaScript: ${formatBytes(planRouteGzipBytes)} gzip (${planRoute.entryAsset})`,
    '',
    '| Asset | Type | Size | Gzip |',
    '| --- | --- | ---: | ---: |',
  ];

  for (const row of summary.assets) {
    lines.push(
      `| \`${row.path}\` | ${row.type} | ${formatBytes(
        row.bytes,
      )} | ${formatBytes(row.gzipBytes)} |`,
    );
  }

  lines.push('');

  return `${lines.join('\n')}\n`;
}

function sumAssetGzip(assetPaths, assetsByPath) {
  return assetPaths.reduce((total, assetPath) => {
    const asset = assetsByPath.get(assetPath);

    if (!asset) {
      throw new Error(`Asset ${assetPath} was not analyzed.`);
    }

    return total + asset.gzipBytes;
  }, 0);
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(2)} kB`;
}
