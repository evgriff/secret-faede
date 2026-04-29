import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  formatRequiredMemories,
  hasRequiredMemoryChange,
  memoryChangeRules,
  policyScanPaths,
  staleBranchPatterns,
} from './check-serena-catalog-rules.mjs';

const memoryRoot = '.serena/memories';
const catalogMemory = 'serena/memory-catalog';
const catalogPath = `${memoryRoot}/${catalogMemory}.md`;
const projectConfigPath = '.serena/project.yml';
const archivePrefix = '_archive/';
const staleRepoPath = '<repo-path>';

const failures = [];
const catalog = readRequiredFile(catalogPath);
const listedMemories = parseCatalogMemories(catalog);
const activeMemories = listActiveMemories();
const activeMemorySet = new Set(activeMemories);
const listedMemorySet = new Set(listedMemories);

for (const memory of listedMemories) {
  if (!existsSync(memoryPath(memory))) {
    failures.push(`Catalog lists missing memory: ${memory}`);
  }
}

for (const memory of activeMemories) {
  if (!listedMemorySet.has(memory)) {
    failures.push(`Active memory is not listed in ${catalogPath}: ${memory}`);
  }
}

for (const memory of listedMemories) {
  if (!activeMemorySet.has(memory)) {
    failures.push(`Listed memory is not active or readable: ${memory}`);
  }
}

const rootFlatMemories = readdirSync(memoryRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => entry.name);

if (rootFlatMemories.length > 0) {
  failures.push(
    `Root-level Serena memories are not allowed: ${rootFlatMemories.join(', ')}`,
  );
}

verifyProjectConfig();
verifyPolicyText();
verifyActiveMemorySources();
verifyActiveMemorySecrets();
verifyChangedFilesCovered();

if (failures.length > 0) {
  console.error('Serena catalog check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Serena catalog check passed: ${activeMemories.length} active topic memories verified.`,
);

function readRequiredFile(filePath) {
  try {
    return readFileSync(filePath, 'utf8');
  } catch (error) {
    failures.push(`Unable to read ${filePath}: ${error.message}`);
    return '';
  }
}

function parseCatalogMemories(markdown) {
  const entries = [];
  const seen = new Set();

  for (const line of markdown.split('\n')) {
    const match = line.match(/^- `([^`]+)`: /);
    if (!match) {
      continue;
    }

    const memory = match[1].trim();
    if (memory.startsWith(archivePrefix)) {
      failures.push(
        `Archived memory must not appear in active catalog: ${memory}`,
      );
      continue;
    }

    if (!memory.includes('/')) {
      failures.push(`Active memory must use a topic path: ${memory}`);
    }

    if (seen.has(memory)) {
      failures.push(`Duplicate active memory in catalog: ${memory}`);
      continue;
    }

    seen.add(memory);
    entries.push(memory);
  }

  if (entries.length === 0) {
    failures.push(`No active memories found in ${catalogPath}`);
  }

  return entries;
}

function listActiveMemories() {
  if (!existsSync(memoryRoot)) {
    failures.push(`Missing memory root: ${memoryRoot}`);
    return [];
  }

  return listMarkdownFiles(memoryRoot)
    .map((filePath) => path.relative(memoryRoot, filePath).replace(/\\/g, '/'))
    .filter((relativePath) => !relativePath.startsWith(archivePrefix))
    .map((relativePath) => relativePath.replace(/\.md$/, ''))
    .sort();
}

function listMarkdownFiles(directory) {
  const entries = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      entries.push(...listMarkdownFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      entries.push(entryPath);
    }
  }

  return entries;
}

function memoryPath(memory) {
  return `${memoryRoot}/${memory}.md`;
}

function verifyProjectConfig() {
  const projectConfig = readRequiredFile(projectConfigPath);

  if (
    !projectConfig.includes("- '_archive/.*'") &&
    !projectConfig.includes('- "_archive/.*"') &&
    !projectConfig.includes('- _archive/.*')
  ) {
    failures.push(
      `${projectConfigPath} must ignore archived memories with _archive/.*`,
    );
  }
}

function verifyPolicyText() {
  for (const filePath of [
    ...policyScanPaths,
    ...activeMemories.map(memoryPath),
  ]) {
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readRequiredFile(filePath);
    if (content.includes(staleRepoPath)) {
      failures.push(`${filePath} references stale repo path ${staleRepoPath}`);
    }

    for (const pattern of staleBranchPatterns) {
      if (pattern.test(content)) {
        failures.push(`${filePath} contains stale branch protocol text`);
        break;
      }
    }
  }
}

function verifyActiveMemorySources() {
  for (const memory of activeMemories) {
    const filePath = memoryPath(memory);
    const content = readRequiredFile(filePath);
    const sources = extractPrimarySources(content);

    for (const source of sources) {
      if (!existsSync(source)) {
        failures.push(`${filePath} references missing local source: ${source}`);
      }
    }
  }
}

function extractPrimarySources(content) {
  const lines = content.split('\n');
  const sources = [];
  let inPrimarySources = false;

  for (const line of lines) {
    if (/^Primary local sources:/.test(line.trim())) {
      inPrimarySources = true;
      continue;
    }

    if (
      inPrimarySources &&
      (/^#+\s/.test(line) ||
        (/^[A-Z][A-Za-z ]+:$/.test(line.trim()) &&
          line.trim() !== 'Primary local sources:'))
    ) {
      break;
    }

    if (!inPrimarySources) {
      continue;
    }

    const sourceMatch = line.match(/^- `?([^`\n]+?)`?$/);
    if (!sourceMatch) {
      continue;
    }

    const source = sourceMatch[1].trim();
    if (!source || /^https?:\/\//.test(source)) {
      continue;
    }

    sources.push(source);
  }

  return sources;
}

function verifyActiveMemorySecrets() {
  const secretPatterns = [
    /AIza[0-9A-Za-z_-]{20,}/,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
    /\b[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY)\s*=\s*\S+/,
  ];

  for (const memory of activeMemories) {
    const filePath = memoryPath(memory);
    const content = readRequiredFile(filePath);

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        failures.push(`${filePath} appears to contain secret-like content`);
        break;
      }
    }
  }
}

function verifyChangedFilesCovered() {
  const changedFiles = getChangedFiles();
  if (changedFiles.length === 0) {
    return;
  }

  const changedMemorySet = new Set(
    changedFiles
      .filter(
        (filePath) =>
          existsSync(filePath) &&
          filePath.startsWith(`${memoryRoot}/`) &&
          !filePath.startsWith(`${memoryRoot}/${archivePrefix}`) &&
          filePath.endsWith('.md'),
      )
      .map((filePath) =>
        filePath
          .slice(memoryRoot.length + 1)
          .replace(/\.md$/, '')
          .replace(/\\/g, '/'),
      ),
  );

  for (const memory of changedMemorySet) {
    if (!listedMemorySet.has(memory)) {
      failures.push(
        `Changed active memory is not listed in catalog: ${memory}`,
      );
    }
  }

  for (const rule of memoryChangeRules) {
    const matchedFiles = changedFiles.filter((filePath) =>
      rule.patterns.some((pattern) => pattern.test(filePath)),
    );

    if (matchedFiles.length === 0) {
      continue;
    }

    if (!hasRequiredMemoryChange(rule, changedMemorySet)) {
      failures.push(
        `${rule.label} require updating ${formatRequiredMemories(rule)}. Matched files: ${matchedFiles.join(', ')}`,
      );
    }
  }
}

function getChangedFiles() {
  const comparisonRef = resolveComparisonRef();
  const committed = comparisonRef
    ? runGitLines(['diff', '--name-only', comparisonRef, 'HEAD'])
    : [];
  const workingTree = runGitLines([
    'diff',
    '--name-only',
    '--diff-filter=ACMRD',
    'HEAD',
  ]);
  const staged = runGitLines([
    'diff',
    '--cached',
    '--name-only',
    '--diff-filter=ACMRD',
    'HEAD',
  ]);
  const untracked = runGitLines(['ls-files', '--others', '--exclude-standard']);

  return [...new Set([...committed, ...workingTree, ...staged, ...untracked])]
    .filter((filePath) => filePath && existsOrDeletedInGit(filePath))
    .sort();
}

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

  return null;
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

function existsOrDeletedInGit(filePath) {
  if (existsSync(filePath)) {
    return true;
  }

  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${filePath}`], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
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
