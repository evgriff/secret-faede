import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const TREFLE_SEARCH_URL = 'https://trefle.io/api/v1/plants/search';
const CATALOG_INPUT_PATH =
  'src/domain/crops/homeGardenCropCatalog.generated.json';
const DEFAULT_OUTPUT_PATH =
  'src/domain/crops/homeGardenCropCatalog.generated.json';

loadEnvFile('.env.local');

const args = parseArgs(process.argv.slice(2));
const token = process.env.TREFLE_API_TOKEN;

if (!token) {
  throw new Error(
    'Set TREFLE_API_TOKEN before running catalog ingestion. The app remains usable from the checked-in curated crop catalog without this token.',
  );
}

const curatedCrops = JSON.parse(readFileSync(CATALOG_INPUT_PATH, 'utf8'));
const cropsToIngest = args.limit
  ? curatedCrops.slice(0, args.limit)
  : curatedCrops;

const normalizedCrops = [];
let matchedCount = 0;

for (const [index, crop] of cropsToIngest.entries()) {
  const treflePlant = await searchTreflePlant(crop);

  if (treflePlant) {
    matchedCount += 1;
  }

  normalizedCrops.push(normalizeCropProfile(crop, treflePlant));

  if (index < cropsToIngest.length - 1) {
    await wait(150);
  }
}

if (args.write) {
  const outputPath = resolve(args.out || DEFAULT_OUTPUT_PATH);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(normalizedCrops, null, 2)}\n`,
    'utf8',
  );
}

console.log(
  JSON.stringify(
    {
      matchedCount,
      mode: args.write ? 'write' : 'dry-run',
      output: args.write ? args.out || DEFAULT_OUTPUT_PATH : null,
      requestedCount: cropsToIngest.length,
      source: TREFLE_SEARCH_URL,
    },
    null,
    2,
  ),
);

async function searchTreflePlant(crop) {
  const query = crop.trefleQuery || crop.scientificName || crop.commonName;
  const url = new URL(TREFLE_SEARCH_URL);
  url.searchParams.set('token', token);
  url.searchParams.set('q', query);

  const payload = await fetchJson(url);
  const results = Array.isArray(payload.data) ? payload.data : [];

  return chooseBestMatch(crop, results);
}

function chooseBestMatch(crop, results) {
  if (results.length === 0) {
    return null;
  }

  const expectedScientificName = crop.scientificName.toLowerCase();
  const expectedCommonName = crop.commonName.toLowerCase();

  return (
    results.find(
      (result) =>
        typeof result.scientific_name === 'string' &&
        result.scientific_name.toLowerCase() === expectedScientificName,
    ) ||
    results.find(
      (result) =>
        typeof result.common_name === 'string' &&
        result.common_name.toLowerCase() === expectedCommonName,
    ) ||
    results[0]
  );
}

function normalizeCropProfile(crop, treflePlant) {
  const commonName =
    crop.commonName || titleCase(treflePlant?.common_name || crop.id);
  const scientificName =
    crop.scientificName || treflePlant?.scientific_name || '';
  const family = crop.family || treflePlant?.family || '';
  const { trefleQuery, ...curatedFields } = crop;
  const sourceTags = new Set([
    ...(Array.isArray(crop.sourceTags) ? crop.sourceTags : []),
    'trefle-refreshed',
  ]);

  if (treflePlant?.id) {
    sourceTags.add(`trefle-id:${treflePlant.id}`);
  }

  return {
    ...curatedFields,
    commonName,
    family,
    frostSensitive: crop.hardiness.toLowerCase().includes('frost sensitive'),
    lastRefreshedIso: new Date().toISOString(),
    manualOverride: crop.manualOverride ?? true,
    name: commonName,
    scientificName,
    source: treflePlant ? 'trefle+curated-overlay' : crop.source,
    sourceTags: [...sourceTags],
    sunExposure: crop.sunRequirement,
    trellisRequired: crop.trellisRecommended,
    waterNeeds: toWaterNeed(crop.weeklyWaterNeedInches),
  };
}

function toWaterNeed(weeklyWaterNeedInches) {
  if (weeklyWaterNeedInches === null) {
    return 'medium';
  }

  if (weeklyWaterNeedInches < 0.75) {
    return 'low';
  }

  return weeklyWaterNeedInches > 1.15 ? 'high' : 'medium';
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Trefle request failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

function parseArgs(argv) {
  const parsed = {
    limit: null,
    out: '',
    write: false,
  };

  for (const arg of argv) {
    if (arg === '--write') {
      parsed.write = true;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      parsed.limit = Number(arg.slice('--limit='.length));
      continue;
    }

    if (arg.startsWith('--out=')) {
      parsed.out = arg.slice('--out='.length);
    }
  }

  if (
    parsed.limit !== null &&
    (!Number.isInteger(parsed.limit) || parsed.limit < 1)
  ) {
    throw new Error('--limit must be a positive integer.');
  }

  return parsed;
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));
}

function wait(ms) {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, ms);
  });
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}
