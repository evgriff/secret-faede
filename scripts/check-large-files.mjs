import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const maxLines = 400;
const documentedPath = 'docs/adr/0003-large-file-refactor-targets.md';
const sourceExtensions = new Set(['css', 'js', 'mjs', 'ts', 'tsx']);
const ignoredPrefixes = [
  'coverage/',
  'dist/',
  'functions/node_modules/',
  'node_modules/',
  'output/',
  'playwright-report/',
  'test-results/',
];

const trackedFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)
  .filter((path) => !ignoredPrefixes.some((prefix) => path.startsWith(prefix)))
  .filter((path) => existsSync(path))
  .filter((path) => sourceExtensions.has(path.split('.').at(-1) ?? ''));
const documented = readFileSync(documentedPath, 'utf8');
const oversized = trackedFiles
  .map((path) => ({ lines: countLines(path), path }))
  .filter((entry) => entry.lines > maxLines)
  .sort((left, right) => right.lines - left.lines);
const undocumented = oversized.filter(
  (entry) => !documented.includes(`\`${entry.path}\``),
);

if (undocumented.length > 0) {
  console.error(
    `Files over ${maxLines} LOC need an architecture note in ${documentedPath}:`,
  );

  for (const entry of undocumented) {
    console.error(`- ${entry.path} (${entry.lines} LOC)`);
  }

  process.exit(1);
}

console.log(
  `Large-file check passed: ${oversized.length} file(s) over ${maxLines} LOC are documented.`,
);

function countLines(path) {
  return readFileSync(path, 'utf8').split('\n').length;
}
