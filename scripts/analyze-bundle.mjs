import { createReadStream, createWriteStream } from 'node:fs';
import { readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import { mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
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

const summary = {
  generatedAtIso: new Date().toISOString(),
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
  const tempPath = join(tmpdir(), `secret-faede-${randomUUID()}.gz`);

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
  const lines = [
    '# Bundle Summary',
    '',
    `Generated: ${summary.generatedAtIso}`,
    '',
    `Total: ${formatBytes(summary.totalBytes)} (${formatBytes(
      summary.totalGzipBytes,
    )} gzip)`,
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

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(2)} kB`;
}
