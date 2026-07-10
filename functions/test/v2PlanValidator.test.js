'use strict';

const assert = require('node:assert/strict');
const {
  V2PlanValidationError,
  assertValidV2Plan,
  validateV2Plan,
} = require('../v2PlanValidator');
const {
  createBed,
  createPlanting,
  createV2Plan,
} = require('./v2PublishFixtures');

assert.deepEqual(validateV2Plan(createV2Plan()), []);
assert.equal(assertValidV2Plan(createV2Plan()).schemaVersion, 9);

const separateCropGroups = createV2Plan();
separateCropGroups.plantings.push(
  createPlanting({
    id: 'tomato-group-2',
    instances: [
      { id: 'tomato-3', label: 'Tomato 3', xFt: 6.5, yFt: 3 },
      { id: 'tomato-4', label: 'Tomato 4', xFt: 7.5, yFt: 3 },
    ],
    xFt: 7,
  }),
);
assert.deepEqual(
  validateV2Plan(separateCropGroups),
  [],
  'multiple independently identified crop groups may use the same crop',
);

const exactKeyCases = [
  ['plan.extra', (plan) => (plan.extra = true)],
  ['plan.plot.extra', (plan) => (plan.plot.extra = true)],
  ['plan.plot.climate.extra', (plan) => (plan.plot.climate.extra = true)],
  ['plan.plot.location.extra', (plan) => (plan.plot.location.extra = true)],
  [
    'plan.plot.location.coordinates.extra',
    (plan) => (plan.plot.location.coordinates.extra = true),
  ],
  ['plan.structures[0].extra', (plan) => (plan.structures[0].extra = true)],
  ['plan.plantings[0].extra', (plan) => (plan.plantings[0].extra = true)],
  [
    'plan.plantings[0].instances[0].extra',
    (plan) => (plan.plantings[0].instances[0].extra = true),
  ],
  [
    'plan.plantings[0].waterProfile.extra',
    (plan) => (plan.plantings[0].waterProfile.extra = true),
  ],
  [
    'plan.plantings[0].waterProfile.stageCoefficients.extra',
    (plan) => (plan.plantings[0].waterProfile.stageCoefficients.extra = true),
  ],
  [
    'plan.reviewDecisions[0].extra',
    (plan) => (plan.reviewDecisions[0].extra = true),
  ],
];
for (const [path, mutate] of exactKeyCases) {
  const plan = createV2Plan();
  mutate(plan);
  expectIssue(plan, path, 'unexpected-key');
}

const missingStages = createV2Plan();
delete missingStages.plantings[0].wateringStage;
delete missingStages.plantings[0].wateringStageSource;
expectIssue(missingStages, 'plan.plantings[0].wateringStage', 'missing-key');
expectIssue(
  missingStages,
  'plan.plantings[0].wateringStageSource',
  'missing-key',
);

const falseFallback = createV2Plan();
falseFallback.plantings[0].wateringStage = 'flowering';
falseFallback.plantings[0].wateringStageSource = 'lifecycleFallback';
expectIssue(
  falseFallback,
  'plan.plantings[0].wateringStage',
  'stage-provenance',
);

const invalidEnums = createV2Plan();
Object.assign(invalidEnums.structures[0], {
  drainage: 'wet',
  soilType: 'peat',
  type: 'shed',
});
Object.assign(invalidEnums.plantings[0], {
  arrangement: 'grid',
  lifecycle: 'dead',
  sun: 'indoors',
  wateringStage: 'seedling',
  wateringStageSource: 'guessed',
});
Object.assign(invalidEnums.plantings[0].waterProfile, {
  confidence: 'certain',
  source: 'api',
});
invalidEnums.reviewDecisions[0].decision = 'dismissed';
for (const path of [
  'plan.structures[0].drainage',
  'plan.structures[0].soilType',
  'plan.structures[0].type',
  'plan.plantings[0].arrangement',
  'plan.plantings[0].lifecycle',
  'plan.plantings[0].sun',
  'plan.plantings[0].wateringStage',
  'plan.plantings[0].wateringStageSource',
  'plan.plantings[0].waterProfile.confidence',
  'plan.plantings[0].waterProfile.source',
  'plan.reviewDecisions[0].decision',
]) {
  expectIssue(invalidEnums, path, 'enum');
}

const invalidRanges = createV2Plan();
Object.assign(invalidRanges.plot, {
  depthFt: 501,
  northDegrees: 360,
  snapFt: 0,
  widthFt: Number.NaN,
});
Object.assign(invalidRanges.structures[0], {
  depthFt: 0,
  rotationDegrees: -1,
  soilDepthInches: 121,
  widthFt: Infinity,
  xFt: -1,
});
Object.assign(invalidRanges.plantings[0], {
  depthFt: 0,
  spacingInches: 241,
  widthFt: 0,
  xFt: -1,
});
Object.assign(invalidRanges.plantings[0].waterProfile, {
  baseWeeklyInches: 0,
  depletionFraction: 1,
  rootDepthInches: 0,
});
invalidRanges.plantings[0].waterProfile.stageCoefficients.flowering = 4;
for (const path of [
  'plan.plot.depthFt',
  'plan.plot.northDegrees',
  'plan.plot.snapFt',
  'plan.plot.widthFt',
  'plan.structures[0].rotationDegrees',
  'plan.structures[0].soilDepthInches',
  'plan.plantings[0].spacingInches',
  'plan.plantings[0].waterProfile.baseWeeklyInches',
  'plan.plantings[0].waterProfile.depletionFraction',
  'plan.plantings[0].waterProfile.rootDepthInches',
  'plan.plantings[0].waterProfile.stageCoefficients.flowering',
]) {
  expectIssue(invalidRanges, path, 'range');
}

const everyItem = createV2Plan();
everyItem.structures.push(createBed({ id: '', label: '' }));
everyItem.plantings.push(
  createPlanting({
    cropId: '',
    id: 'second-group',
    instances: [{ id: '', label: '', xFt: 3, yFt: 3 }],
  }),
);
everyItem.reviewDecisions.push({
  decision: 'wrong',
  issueId: '',
  updatedAtIso: 'not-an-instant',
});
for (const path of [
  'plan.structures[1].id',
  'plan.structures[1].label',
  'plan.plantings[1].cropId',
  'plan.plantings[1].instances[0].id',
  'plan.plantings[1].instances[0].label',
  'plan.reviewDecisions[1].decision',
  'plan.reviewDecisions[1].issueId',
  'plan.reviewDecisions[1].updatedAtIso',
]) {
  expectIssue(everyItem, path);
}

const duplicates = createV2Plan();
duplicates.structures.push(createBed());
duplicates.plantings.push(
  createPlanting({
    id: 'other-group',
    instances: [{ id: 'tomato-1', label: 'Duplicate id', xFt: 3, yFt: 3 }],
  }),
);
duplicates.reviewDecisions.push({ ...duplicates.reviewDecisions[0] });
for (const path of [
  'plan.structures[1].id',
  'plan.plantings[1].instances[0].id',
  'plan.reviewDecisions[1].issueId',
]) {
  expectIssue(duplicates, path, 'duplicate-id');
}
const duplicatePlanting = createV2Plan();
duplicatePlanting.plantings.push(
  createPlanting({
    instances: [{ id: 'unique-instance', label: 'Unique', xFt: 3, yFt: 3 }],
  }),
);
expectIssue(duplicatePlanting, 'plan.plantings[1].id', 'duplicate-id');

const invalidClimate = createV2Plan();
Object.assign(invalidClimate.plot.climate, {
  firstFrost: '02-30',
  hardinessZone: '14c',
  lastFrost: '13-01',
});
Object.assign(invalidClimate.plot.location, {
  coordinates: { latitude: 91, longitude: -181 },
  timezone: 'Mars/Olympus',
});
invalidClimate.plantings[0].plannedFor = '2026-02-30';
for (const path of [
  'plan.plot.climate.firstFrost',
  'plan.plot.climate.hardinessZone',
  'plan.plot.climate.lastFrost',
  'plan.plot.location.coordinates.latitude',
  'plan.plot.location.coordinates.longitude',
  'plan.plot.location.timezone',
  'plan.plantings[0].plannedFor',
]) {
  expectIssue(invalidClimate, path);
}

const structureOutOfBounds = createV2Plan();
Object.assign(structureOutOfBounds.structures[0], {
  rotationDegrees: 45,
  xFt: 0,
  yFt: 0,
});
expectIssue(structureOutOfBounds, 'plan.structures[0]', 'geometry');

const plantingOutOfBounds = createV2Plan();
plantingOutOfBounds.plantings[0].xFt = 0.25;
expectIssue(plantingOutOfBounds, 'plan.plantings[0]', 'geometry');

const missingGrowingArea = createV2Plan();
missingGrowingArea.plantings[0].growingAreaStructureId = 'missing-bed';
expectIssue(
  missingGrowingArea,
  'plan.plantings[0].growingAreaStructureId',
  'missing-link',
);

const nonGrowingArea = createV2Plan();
nonGrowingArea.structures[0].type = 'path';
expectIssue(
  nonGrowingArea,
  'plan.plantings[0].growingAreaStructureId',
  'invalid-link',
);

const groupOutsideBed = createV2Plan();
groupOutsideBed.plantings[0].xFt = 8.5;
expectIssue(
  groupOutsideBed,
  'plan.plantings[0].growingAreaStructureId',
  'geometry',
);

const instanceOutsideGroup = createV2Plan();
instanceOutsideGroup.plantings[0].instances[1].xFt = 6;
expectIssue(instanceOutsideGroup, 'plan.plantings[0].instances[1]', 'geometry');

const overlappingGroups = createV2Plan();
overlappingGroups.plantings.push(
  createPlanting({
    id: 'overlapping-group',
    instances: [
      { id: 'overlapping-instance', label: 'Overlap', xFt: 3, yFt: 3 },
    ],
  }),
);
expectIssue(overlappingGroups, 'plan.plantings[1]', 'geometry');

const incompleteProfile = createV2Plan();
delete incompleteProfile.plantings[0].waterProfile.stageCoefficients.mature;
expectIssue(
  incompleteProfile,
  'plan.plantings[0].waterProfile.stageCoefficients.mature',
  'missing-key',
);

const wrongTimes = createV2Plan();
wrongTimes.createdAtIso = '2026-06-01T12:00:00Z';
wrongTimes.updatedAtIso = '2025-06-01T12:00:00.000Z';
expectIssue(wrongTimes, 'plan.createdAtIso', 'iso-instant');

assert.throws(
  () => assertValidV2Plan({ ...createV2Plan(), schemaVersion: 8 }),
  (error) =>
    error instanceof V2PlanValidationError &&
    error.issues.some((issue) => issue.path === 'plan.schemaVersion'),
);

console.log('v2 plan validator tests passed');

function expectIssue(plan, path, code) {
  const issue = validateV2Plan(plan).find(
    (candidate) =>
      candidate.path === path &&
      (code === undefined || candidate.code === code),
  );
  assert.ok(
    issue,
    `Expected ${path}${code ? ` (${code})` : ''}; got ${JSON.stringify(
      validateV2Plan(plan),
    )}`,
  );
}
