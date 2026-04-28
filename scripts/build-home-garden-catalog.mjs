import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { format } from 'prettier';

const CURATED_PATH = 'src/domain/crops/curatedCropOverrides.json';
const OUTPUT_PATH = 'src/domain/crops/homeGardenCropCatalog.generated.json';
const REFRESHED_AT = '2026-04-21T00:00:00.000Z';
const MIN_CATALOG_SIZE = 540;

function p(
  id,
  commonName,
  scientificName,
  family,
  category,
  growthForm,
  overrides = {},
) {
  return {
    id,
    commonName,
    scientificName,
    family,
    category,
    growthForm,
    trefleQuery: scientificName,
    ...overrides,
  };
}

function additionalBasePlants() {
  return [
    p(
      'blueberry',
      'Blueberry',
      'Vaccinium corymbosum',
      'Ericaceae',
      'fruit',
      'bush',
      {
        lifecycle: 'perennial',
        roles: ['berry'],
        spacingInches: 48,
        daysToMaturity: null,
        sowMethod: 'transplant',
        defaultIcon: 'blueberry',
        rootDepthInches: 18,
      },
    ),
    p('raspberry', 'Raspberry', 'Rubus idaeus', 'Rosaceae', 'fruit', 'bush', {
      lifecycle: 'perennial',
      roles: ['berry'],
      spacingInches: 24,
      rowSpacingInches: 72,
      matureHeightInches: 72,
      trellisRecommended: true,
      defaultIcon: 'raspberry',
    }),
    p(
      'blackberry',
      'Blackberry',
      'Rubus fruticosus',
      'Rosaceae',
      'fruit',
      'bush',
      {
        lifecycle: 'perennial',
        roles: ['berry'],
        spacingInches: 36,
        rowSpacingInches: 84,
        matureHeightInches: 72,
        trellisRecommended: true,
        defaultIcon: 'blackberry',
      },
    ),
    p(
      'currant',
      'Currant',
      'Ribes rubrum',
      'Grossulariaceae',
      'fruit',
      'bush',
      {
        lifecycle: 'perennial',
        roles: ['berry'],
        spacingInches: 48,
        defaultIcon: 'currant',
      },
    ),
    p(
      'gooseberry',
      'Gooseberry',
      'Ribes uva-crispa',
      'Grossulariaceae',
      'fruit',
      'bush',
      {
        lifecycle: 'perennial',
        roles: ['berry'],
        spacingInches: 48,
        defaultIcon: 'gooseberry',
        caution:
          'Some cultivars have thorns; check local Ribes disease restrictions where relevant.',
      },
    ),
    p(
      'elderberry',
      'Elderberry',
      'Sambucus nigra',
      'Adoxaceae',
      'fruit',
      'bush',
      {
        lifecycle: 'perennial',
        roles: ['berry', 'beneficial'],
        spacingInches: 72,
        matureHeightInches: 120,
        defaultIcon: 'elderberry',
        caution:
          'Raw berries and other plant parts can be unsafe; use reliable food-safety guidance.',
      },
    ),
    p('grape', 'Grape', 'Vitis vinifera', 'Vitaceae', 'fruit', 'vining', {
      lifecycle: 'perennial',
      roles: ['fruit', 'trellis'],
      spacingInches: 72,
      rowSpacingInches: 96,
      matureHeightInches: 96,
      trellisRecommended: true,
      defaultIcon: 'grape',
    }),
    p('apple', 'Apple', 'Malus domestica', 'Rosaceae', 'fruit', 'upright', {
      lifecycle: 'perennial',
      roles: ['treeFruit'],
      spacingInches: 144,
      matureHeightInches: 180,
      defaultIcon: 'apple',
      daysToMaturity: null,
      sowMethod: 'transplant',
    }),
    p('pear', 'Pear', 'Pyrus communis', 'Rosaceae', 'fruit', 'upright', {
      lifecycle: 'perennial',
      roles: ['treeFruit'],
      spacingInches: 144,
      matureHeightInches: 180,
      defaultIcon: 'pear',
      daysToMaturity: null,
      sowMethod: 'transplant',
    }),
    p('peach', 'Peach', 'Prunus persica', 'Rosaceae', 'fruit', 'upright', {
      lifecycle: 'perennial',
      roles: ['treeFruit'],
      spacingInches: 144,
      matureHeightInches: 144,
      defaultIcon: 'peach',
      daysToMaturity: null,
      sowMethod: 'transplant',
    }),
    p('plum', 'Plum', 'Prunus domestica', 'Rosaceae', 'fruit', 'upright', {
      lifecycle: 'perennial',
      roles: ['treeFruit'],
      spacingInches: 144,
      matureHeightInches: 144,
      defaultIcon: 'plum',
      daysToMaturity: null,
      sowMethod: 'transplant',
    }),
    p(
      'sour-cherry',
      'Sour cherry',
      'Prunus cerasus',
      'Rosaceae',
      'fruit',
      'upright',
      {
        lifecycle: 'perennial',
        roles: ['treeFruit'],
        spacingInches: 144,
        matureHeightInches: 144,
        defaultIcon: 'cherry',
        daysToMaturity: null,
        sowMethod: 'transplant',
      },
    ),
    p('fig', 'Fig', 'Ficus carica', 'Moraceae', 'fruit', 'bush', {
      lifecycle: 'perennial',
      roles: ['fruit'],
      spacingInches: 96,
      matureHeightInches: 120,
      defaultIcon: 'fig',
      hardiness: 'Perennial where hardy; protect in cold climates.',
    }),
    p('pawpaw', 'Pawpaw', 'Asimina triloba', 'Annonaceae', 'fruit', 'upright', {
      lifecycle: 'perennial',
      roles: ['nativeFruit'],
      spacingInches: 120,
      matureHeightInches: 240,
      defaultIcon: 'tree',
      daysToMaturity: null,
      sowMethod: 'transplant',
    }),
    p(
      'serviceberry',
      'Serviceberry',
      'Amelanchier alnifolia',
      'Rosaceae',
      'fruit',
      'bush',
      {
        lifecycle: 'perennial',
        roles: ['berry', 'nativeFruit', 'beneficial'],
        spacingInches: 72,
        defaultIcon: 'berry',
      },
    ),
    p(
      'tomatillo',
      'Tomatillo',
      'Physalis philadelphica',
      'Solanaceae',
      'fruit',
      'bush',
      { spacingInches: 24, rowSpacingInches: 36, defaultIcon: 'tomatillo' },
    ),
    p(
      'ground-cherry',
      'Ground cherry',
      'Physalis pruinosa',
      'Solanaceae',
      'fruit',
      'groundcover',
      { spacingInches: 24, rowSpacingInches: 36, defaultIcon: 'groundCherry' },
    ),
    p(
      'mizuna',
      'Mizuna',
      'Brassica rapa var. japonica',
      'Brassicaceae',
      'leafyGreen',
      'rosette',
      { spacingInches: 8, rowSpacingInches: 12, defaultIcon: 'leafy' },
    ),
    p(
      'tatsoi',
      'Tatsoi',
      'Brassica rapa subsp. narinosa',
      'Brassicaceae',
      'leafyGreen',
      'rosette',
      { spacingInches: 8, rowSpacingInches: 12, defaultIcon: 'leafy' },
    ),
    p(
      'napa-cabbage',
      'Napa cabbage',
      'Brassica rapa subsp. pekinensis',
      'Brassicaceae',
      'brassica',
      'rosette',
      { spacingInches: 18, rowSpacingInches: 24, defaultIcon: 'brassica' },
    ),
    p(
      'kohlrabi',
      'Kohlrabi',
      'Brassica oleracea var. gongylodes',
      'Brassicaceae',
      'brassica',
      'bulb',
      { spacingInches: 8, rowSpacingInches: 18, defaultIcon: 'brassica' },
    ),
    p(
      'rutabaga',
      'Rutabaga',
      'Brassica napus var. napobrassica',
      'Brassicaceae',
      'root',
      'root',
      { spacingInches: 8, rowSpacingInches: 18, defaultIcon: 'root' },
    ),
    p(
      'daikon-radish',
      'Daikon radish',
      'Raphanus sativus var. longipinnatus',
      'Brassicaceae',
      'root',
      'root',
      {
        roles: ['coverCrop'],
        spacingInches: 6,
        rowSpacingInches: 18,
        rootDepthInches: 24,
        defaultIcon: 'root',
      },
    ),
    p(
      'horseradish',
      'Horseradish',
      'Armoracia rusticana',
      'Brassicaceae',
      'root',
      'root',
      {
        lifecycle: 'perennial',
        spacingInches: 24,
        rowSpacingInches: 30,
        defaultIcon: 'root',
        caution: 'Can spread aggressively if root pieces are left in the bed.',
      },
    ),
    p(
      'jerusalem-artichoke',
      'Jerusalem artichoke',
      'Helianthus tuberosus',
      'Asteraceae',
      'root',
      'upright',
      {
        lifecycle: 'perennial',
        spacingInches: 18,
        rowSpacingInches: 36,
        matureHeightInches: 96,
        defaultIcon: 'sunflower',
        caution: 'Can spread persistently from tubers.',
      },
    ),
    p(
      'sorrel',
      'Sorrel',
      'Rumex acetosa',
      'Polygonaceae',
      'leafyGreen',
      'clump',
      { lifecycle: 'perennial', spacingInches: 12, defaultIcon: 'leafy' },
    ),
    p(
      'watercress',
      'Watercress',
      'Nasturtium officinale',
      'Brassicaceae',
      'leafyGreen',
      'groundcover',
      {
        sunRequirement: 'partSun',
        spacingInches: 6,
        weeklyWaterNeedInches: 1.5,
        defaultIcon: 'leafy',
      },
    ),
    p(
      'malabar-spinach',
      'Malabar spinach',
      'Basella alba',
      'Basellaceae',
      'leafyGreen',
      'vining',
      {
        spacingInches: 12,
        rowSpacingInches: 24,
        trellisRecommended: true,
        defaultIcon: 'leafy',
      },
    ),
    p(
      'amaranth',
      'Amaranth',
      'Amaranthus tricolor',
      'Amaranthaceae',
      'leafyGreen',
      'upright',
      { spacingInches: 12, rowSpacingInches: 18, defaultIcon: 'leafy' },
    ),
    p('shiso', 'Shiso', 'Perilla frutescens', 'Lamiaceae', 'herb', 'bush', {
      spacingInches: 12,
      defaultIcon: 'herb',
    }),
    p(
      'lemongrass',
      'Lemongrass',
      'Cymbopogon citratus',
      'Poaceae',
      'herb',
      'clump',
      { spacingInches: 24, matureHeightInches: 48, defaultIcon: 'herb' },
    ),
    p(
      'tarragon',
      'Tarragon',
      'Artemisia dracunculus',
      'Asteraceae',
      'herb',
      'clump',
      { lifecycle: 'perennial', spacingInches: 18, defaultIcon: 'herb' },
    ),
    p(
      'lovage',
      'Lovage',
      'Levisticum officinale',
      'Apiaceae',
      'herb',
      'upright',
      {
        lifecycle: 'perennial',
        spacingInches: 24,
        matureHeightInches: 72,
        defaultIcon: 'herb',
      },
    ),
    p(
      'chamomile',
      'Chamomile',
      'Matricaria chamomilla',
      'Asteraceae',
      'herb',
      'clump',
      {
        roles: ['beneficial', 'flower'],
        spacingInches: 8,
        pollinatorRole: 'Flowering herb visited by small beneficial insects.',
        defaultIcon: 'flower',
      },
    ),
    p(
      'lavender',
      'Lavender',
      'Lavandula angustifolia',
      'Lamiaceae',
      'herb',
      'bush',
      {
        lifecycle: 'perennial',
        roles: ['beneficial', 'flower'],
        spacingInches: 24,
        weeklyWaterNeedInches: 0.5,
        pollinatorRole:
          'Long-blooming herb for pollinator strips in dry edges.',
        defaultIcon: 'flower',
      },
    ),
    p(
      'echinacea',
      'Echinacea',
      'Echinacea purpurea',
      'Asteraceae',
      'flower',
      'clump',
      {
        lifecycle: 'perennial',
        roles: ['pollinator'],
        spacingInches: 18,
        pollinatorRole: 'Perennial bloom used in pollinator plantings.',
        defaultIcon: 'flower',
      },
    ),
    p(
      'bee-balm',
      'Bee balm',
      'Monarda fistulosa',
      'Lamiaceae',
      'flower',
      'clump',
      {
        lifecycle: 'perennial',
        roles: ['pollinator'],
        spacingInches: 18,
        pollinatorRole:
          'Perennial flower often used to support bees and butterflies.',
        defaultIcon: 'flower',
      },
    ),
    p(
      'yarrow',
      'Yarrow',
      'Achillea millefolium',
      'Asteraceae',
      'flower',
      'clump',
      {
        lifecycle: 'perennial',
        roles: ['beneficial', 'pollinator'],
        spacingInches: 18,
        weeklyWaterNeedInches: 0.6,
        pollinatorRole: 'Umbel-like flowers support small beneficial insects.',
        defaultIcon: 'flower',
      },
    ),
    p(
      'phacelia',
      'Phacelia',
      'Phacelia tanacetifolia',
      'Boraginaceae',
      'flower',
      'upright',
      {
        roles: ['pollinator', 'coverCrop'],
        spacingInches: 8,
        pollinatorRole:
          'Fast annual often planted as a pollinator and cover crop strip.',
        defaultIcon: 'flower',
      },
    ),
    p(
      'hairy-vetch',
      'Hairy vetch',
      'Vicia villosa',
      'Fabaceae',
      'legume',
      'vining',
      {
        roles: ['coverCrop', 'nitrogenFixer'],
        spacingInches: 4,
        rowSpacingInches: 7,
        trellisRecommended: false,
        defaultIcon: 'coverCrop',
      },
    ),
    p(
      'field-pea-cover',
      'Field pea cover crop',
      'Pisum sativum subsp. arvense',
      'Fabaceae',
      'legume',
      'vining',
      {
        roles: ['coverCrop', 'nitrogenFixer'],
        spacingInches: 3,
        rowSpacingInches: 7,
        defaultIcon: 'pea',
      },
    ),
    p(
      'annual-ryegrass',
      'Annual ryegrass',
      'Lolium multiflorum',
      'Poaceae',
      'grain',
      'clump',
      {
        roles: ['coverCrop'],
        spacingInches: 2,
        rowSpacingInches: 7,
        defaultIcon: 'grain',
      },
    ),
    p(
      'sorghum-sudangrass',
      'Sorghum-sudangrass',
      'Sorghum bicolor x S. bicolor var. sudanese',
      'Poaceae',
      'grain',
      'upright',
      {
        roles: ['coverCrop'],
        spacingInches: 6,
        rowSpacingInches: 18,
        matureHeightInches: 96,
        defaultIcon: 'grain',
      },
    ),
    p('alfalfa', 'Alfalfa', 'Medicago sativa', 'Fabaceae', 'legume', 'clump', {
      lifecycle: 'perennial',
      roles: ['coverCrop', 'nitrogenFixer'],
      spacingInches: 4,
      rowSpacingInches: 7,
      rootDepthInches: 36,
      defaultIcon: 'coverCrop',
    }),
    p(
      'white-clover',
      'White clover',
      'Trifolium repens',
      'Fabaceae',
      'flower',
      'groundcover',
      {
        lifecycle: 'perennial',
        roles: ['coverCrop', 'nitrogenFixer', 'pollinator'],
        spacingInches: 3,
        rowSpacingInches: 7,
        pollinatorRole:
          'Low flowering cover crop visited by bees when allowed to bloom.',
        defaultIcon: 'flower',
      },
    ),
    p(
      'quinoa',
      'Quinoa',
      'Chenopodium quinoa',
      'Amaranthaceae',
      'grain',
      'upright',
      { spacingInches: 12, rowSpacingInches: 18, defaultIcon: 'grain' },
    ),
    p(
      'sesame',
      'Sesame',
      'Sesamum indicum',
      'Pedaliaceae',
      'grain',
      'upright',
      { spacingInches: 12, rowSpacingInches: 24, defaultIcon: 'grain' },
    ),
  ];
}

const defaultByCategory = {
  brassica: {
    daysToMaturity: 65,
    defaultIcon: 'brassica',
    matureHeightInches: 18,
    matureSpreadInches: 18,
    rootDepthInches: 18,
    rowSpacingInches: 24,
    spacingInches: 18,
    weeklyWaterNeedInches: 1,
  },
  flower: {
    daysToMaturity: 75,
    defaultIcon: 'flower',
    matureHeightInches: 24,
    matureSpreadInches: 18,
    rootDepthInches: 18,
    rowSpacingInches: 18,
    spacingInches: 12,
    weeklyWaterNeedInches: 0.8,
  },
  fruit: {
    daysToMaturity: 75,
    defaultIcon: 'fruit',
    matureHeightInches: 36,
    matureSpreadInches: 24,
    rootDepthInches: 24,
    rowSpacingInches: 36,
    spacingInches: 24,
    weeklyWaterNeedInches: 1,
  },
  grain: {
    daysToMaturity: 90,
    defaultIcon: 'grain',
    matureHeightInches: 48,
    matureSpreadInches: 8,
    rootDepthInches: 24,
    rowSpacingInches: 18,
    spacingInches: 6,
    weeklyWaterNeedInches: 0.8,
  },
  herb: {
    daysToMaturity: 60,
    defaultIcon: 'herb',
    matureHeightInches: 18,
    matureSpreadInches: 12,
    rootDepthInches: 12,
    rowSpacingInches: 18,
    spacingInches: 12,
    weeklyWaterNeedInches: 0.75,
  },
  leafyGreen: {
    daysToMaturity: 45,
    defaultIcon: 'leafy',
    matureHeightInches: 12,
    matureSpreadInches: 12,
    rootDepthInches: 12,
    rowSpacingInches: 12,
    spacingInches: 8,
    weeklyWaterNeedInches: 1,
  },
  legume: {
    daysToMaturity: 60,
    defaultIcon: 'bean',
    matureHeightInches: 24,
    matureSpreadInches: 12,
    rootDepthInches: 18,
    rowSpacingInches: 24,
    spacingInches: 6,
    weeklyWaterNeedInches: 0.8,
  },
  root: {
    daysToMaturity: 60,
    defaultIcon: 'root',
    matureHeightInches: 12,
    matureSpreadInches: 6,
    rootDepthInches: 18,
    rowSpacingInches: 12,
    spacingInches: 4,
    weeklyWaterNeedInches: 0.8,
  },
  vegetable: {
    daysToMaturity: 70,
    defaultIcon: 'vegetable',
    matureHeightInches: 24,
    matureSpreadInches: 18,
    rootDepthInches: 18,
    rowSpacingInches: 24,
    spacingInches: 18,
    weeklyWaterNeedInches: 1,
  },
};

const varietyBanks = {
  brassica: ['Early', 'Storage', 'Mini', 'Purple', 'Green', 'Winter'],
  flower: ['Dwarf', 'Tall', 'Cut flower', 'Pollinator mix', 'White', 'Orange'],
  fruit: ['Early', 'Dwarf', 'Patio', 'Red', 'Golden', 'Purple', 'Storage'],
  grain: ['Spring', 'Winter', 'Dwarf', 'Cover crop', 'Grain', 'Forage'],
  herb: ['Compact', 'Cutting', 'Dwarf', 'Aromatic', 'Broadleaf', 'Container'],
  leafyGreen: [
    'Baby leaf',
    'Heat-tolerant',
    'Cold-tolerant',
    'Red',
    'Green',
    'Cut-and-come-again',
  ],
  legume: ['Bush', 'Pole', 'Snap', 'Shelling', 'Dwarf', 'Dry bean'],
  root: ['Baby', 'Storage', 'Round', 'Long', 'White', 'Purple'],
  vegetable: ['Early', 'Compact', 'Dwarf', 'Green', 'Purple', 'Container'],
};

const specificVarieties = {
  tomato: [
    'Roma',
    'San Marzano',
    'Beefsteak',
    'Brandywine',
    'Cherokee Purple',
    'Mortgage Lifter',
    'Early Girl',
    'Green Zebra',
  ],
  lettuce: [
    'Romaine',
    'Butterhead',
    'Oakleaf',
    'Crisphead',
    'Red leaf',
    'Little Gem',
    'Looseleaf',
  ],
  basil: ['Genovese', 'Thai', 'Lemon', 'Purple', 'Holy', 'Cinnamon'],
  strawberry: [
    'June-bearing',
    'Everbearing',
    'Alpine',
    'Day-neutral',
    'Mara des Bois',
  ],
  blueberry: [
    'Highbush',
    'Lowbush',
    'Rabbiteye',
    'Half-high',
    'Duke',
    'Bluecrop',
  ],
  apple: ['Dwarf', 'Espalier', 'Cider', 'Dessert', 'Cooking', 'Columnar'],
};

function toBaseRecord(crop) {
  const defaults =
    defaultByCategory[crop.category] ?? defaultByCategory.vegetable;
  const roles = inferRoles(crop);
  const commonName = crop.commonName;
  const aliases = unique(
    [...(crop.aliases ?? []), crop.name, crop.trefleQuery].filter(Boolean),
  );

  return {
    aliases,
    category: crop.category,
    caution: crop.caution ?? null,
    commonName,
    daysToMaturity: crop.daysToMaturity ?? defaults.daysToMaturity,
    defaultIcon: crop.defaultIcon ?? defaults.defaultIcon,
    family: crop.family,
    growthForm: crop.growthForm,
    hardiness: crop.hardiness ?? inferHardiness(crop),
    id: crop.id,
    lifecycle: crop.lifecycle ?? 'annual',
    lastRefreshedIso: crop.lastRefreshedIso ?? REFRESHED_AT,
    manualOverride: crop.manualOverride ?? true,
    matureHeightInches: crop.matureHeightInches ?? defaults.matureHeightInches,
    matureSpreadInches: crop.matureSpreadInches ?? defaults.matureSpreadInches,
    notes: crop.notes ?? defaultNotes(crop),
    perennialSuitability:
      crop.perennialSuitability ?? inferPerennialSuitability(crop),
    pollinatorRole: crop.pollinatorRole ?? inferPollinatorRole(crop, roles),
    profileCompleteness: crop.profileCompleteness ?? 'complete',
    rootDepthInches: crop.rootDepthInches ?? defaults.rootDepthInches,
    rowSpacingInches: crop.rowSpacingInches ?? defaults.rowSpacingInches,
    roles,
    scientificName: crop.scientificName,
    sowMethod: crop.sowMethod ?? inferSowMethod(crop),
    source: crop.source ?? 'trefle+curated-overlay',
    sourceTags: unique([
      ...(crop.sourceTags ?? []),
      'trefle-query',
      'curated-overlay',
      'secret-faeries-home-garden-v2',
    ]),
    spacingInches: crop.spacingInches ?? defaults.spacingInches,
    supportedPlantingModes: crop.supportedPlantingModes ?? inferModes(crop),
    sunRequirement: crop.sunRequirement ?? inferSun(crop),
    synonyms: unique(
      [...(crop.synonyms ?? []), crop.scientificName].filter(Boolean),
    ),
    trefleQuery: crop.trefleQuery ?? crop.scientificName,
    trellisRecommended:
      crop.trellisRecommended ??
      (crop.growthForm === 'vining' || crop.growthForm === 'climber'),
    varietyGroup: crop.varietyGroup ?? null,
    weeklyWaterNeedInches:
      crop.weeklyWaterNeedInches ?? defaults.weeklyWaterNeedInches,
  };
}

function buildVarietyProfiles(bases) {
  const variants = [];

  for (const base of bases) {
    const names =
      specificVarieties[base.id] ??
      varietyBanks[base.category] ??
      varietyBanks.vegetable;
    const limit = base.roles.includes('treeFruit') ? 5 : 6;

    for (const name of names.slice(0, limit)) {
      const commonName = name
        .toLowerCase()
        .includes(base.commonName.toLowerCase())
        ? name
        : `${name} ${base.commonName}`;
      variants.push({
        ...base,
        aliases: unique([base.commonName, ...base.aliases, commonName]),
        commonName,
        id: `${base.id}-${slug(name)}`,
        lastRefreshedIso: base.lastRefreshedIso,
        notes: `Variety-group profile derived from ${base.commonName}; verify cultivar-specific timing on the seed packet or nursery tag. ${base.notes}`,
        profileCompleteness:
          base.profileCompleteness === 'needsReview'
            ? 'needsReview'
            : 'partial',
        sourceTags: unique([...base.sourceTags, 'generated-variety-profile']),
        varietyGroup: base.commonName,
      });
    }
  }

  return variants;
}

function inferRoles(crop) {
  const roles = new Set(crop.roles ?? []);
  if (crop.category === 'flower') roles.add('pollinator');
  if (crop.category === 'herb') roles.add('culinaryHerb');
  if (crop.category === 'fruit') roles.add('fruit');
  if (/berry|currant|grape/i.test(crop.commonName)) roles.add('berry');
  if (
    /cover|clover|vetch|rye|oat|buckwheat|alfalfa|sorghum/i.test(
      `${crop.id} ${crop.commonName}`,
    )
  )
    roles.add('coverCrop');
  if (crop.family === 'Fabaceae') roles.add('nitrogenFixer');
  return [...roles].sort();
}

function inferModes(crop) {
  if (crop.growthForm === 'vining' || crop.growthForm === 'climber')
    return ['single', 'row', 'trellisLine'];
  if (crop.growthForm === 'groundcover') return ['single', 'row', 'block'];
  if (
    crop.category === 'leafyGreen' ||
    crop.category === 'root' ||
    crop.roles?.includes('coverCrop')
  )
    return ['row', 'block'];
  return ['single', 'row'];
}

function inferSowMethod(crop) {
  if (
    crop.category === 'root' ||
    crop.category === 'grain' ||
    crop.roles?.includes('coverCrop')
  ) {
    return 'directSow';
  }

  if (crop.lifecycle === 'perennial' || crop.roles?.includes('treeFruit'))
    return 'transplant';
  return 'both';
}

function inferSun(crop) {
  return crop.category === 'herb' || crop.category === 'leafyGreen'
    ? 'partSun'
    : 'fullSun';
}

function inferHardiness(crop) {
  return crop.lifecycle === 'perennial'
    ? 'Perennial; check local hardiness and cultivar needs.'
    : 'Annual garden crop; check frost timing.';
}

function inferPerennialSuitability(crop) {
  return crop.lifecycle === 'perennial'
    ? 'Perennial where hardy; site as a long-term planting.'
    : 'Annual in temperate gardens.';
}

function inferPollinatorRole(crop, roles) {
  if (!roles.includes('pollinator') && !roles.includes('beneficial'))
    return null;
  return 'Flowering plant used in pollinator or beneficial-insect strips when allowed to bloom.';
}

function defaultNotes(crop) {
  return `Home-garden profile for ${crop.commonName}; spacing and timing are planning defaults.`;
}

function dedupeById(items) {
  return [...new Map(items.map((item) => [item.id, item])).values()].sort(
    (a, b) => a.commonName.localeCompare(b.commonName),
  );
}

function countBy(items, field) {
  return items.reduce((counts, item) => {
    counts[item[field]] = (counts[item[field]] ?? 0) + 1;
    return counts;
  }, {});
}

function countRoles(items) {
  return items.reduce((counts, item) => {
    for (const role of item.roles) counts[role] = (counts[role] ?? 0) + 1;
    return counts;
  }, {});
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
  const baseRecords = [...curated, ...additionalBasePlants()].map(toBaseRecord);
  const records = dedupeById([
    ...baseRecords,
    ...buildVarietyProfiles(baseRecords),
  ]);

  if (records.length < MIN_CATALOG_SIZE) {
    throw new Error(
      `Catalog generated ${records.length}; expected ${MIN_CATALOG_SIZE}+.`,
    );
  }

  if (args.has('--write')) {
    const outputPath = resolve(OUTPUT_PATH);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      await format(JSON.stringify(records), { parser: 'json' }),
      'utf8',
    );
  }

  console.log(
    JSON.stringify(
      {
        categories: countBy(records, 'category'),
        records: records.length,
        roles: countRoles(records),
        source: 'trefle-query + curated gardening overlay',
        wrote: args.has('--write') ? OUTPUT_PATH : null,
      },
      null,
      2,
    ),
  );
}

await main();
