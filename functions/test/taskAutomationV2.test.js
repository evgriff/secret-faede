'use strict';

const assert = require('node:assert/strict');
const {
  buildAutomatedTasks,
  mergeAutomatedTasks,
} = require('../taskAutomationV2');
const { createCropGroupTargets } = require('../wateringModelV2');
const { now, plan } = require('./v2Fixtures');

function group(template, input) {
  return {
    ...structuredClone(template),
    ...input,
    instances: input.instances || [
      {
        id: `${input.id}-1`,
        label: input.cropName,
        xFt: input.xFt || 1,
        yFt: input.yFt || 1,
      },
    ],
    waterProfile: structuredClone(template.waterProfile),
  };
}

const tomatoTemplate = plan.plantings[0];
const lettuceTemplate = plan.plantings[1];
const bedB = {
  ...structuredClone(plan.structures[0]),
  id: 'bed-b',
  label: 'Bed B',
  mulched: false,
  xFt: 8,
};
const taskPlan = {
  ...structuredClone(plan),
  plantings: [
    group(tomatoTemplate, {
      arrangement: 'trellisLine',
      cropId: 'tomato',
      cropName: 'Tomato',
      id: 'tomato-a',
      lifecycle: 'growing',
      mulched: false,
      plantedOn: '2026-05-20',
      xFt: 2,
    }),
    group(tomatoTemplate, {
      arrangement: 'trellisLine',
      cropId: 'tomato',
      cropName: 'Tomato',
      growingAreaStructureId: 'bed-b',
      id: 'tomato-b',
      lifecycle: 'growing',
      mulched: false,
      plantedOn: '2026-05-20',
      xFt: 10,
    }),
    group(lettuceTemplate, {
      arrangement: 'row',
      cropId: 'beet',
      cropName: 'Beet',
      growingAreaStructureId: 'bed-b',
      id: 'beet-planted',
      lifecycle: 'planted',
      mulched: false,
      plantedOn: '2026-06-10',
      xFt: 11,
    }),
    group(lettuceTemplate, {
      cropId: 'carrot',
      cropName: 'Carrot',
      id: 'carrot-planned',
      lifecycle: 'planned',
      plannedFor: '2026-07-01',
      plantedOn: null,
      xFt: 5,
    }),
    group(lettuceTemplate, {
      cropId: 'radish',
      cropName: 'Radish',
      id: 'radish-undated',
      lifecycle: 'planned',
      plannedFor: null,
      plantedOn: null,
      xFt: 6,
    }),
    group(tomatoTemplate, {
      cropId: 'pepper',
      cropName: 'Pepper',
      growingAreaStructureId: 'bed-b',
      id: 'pepper-undated',
      lifecycle: 'growing',
      mulched: false,
      plantedOn: null,
      xFt: 12,
    }),
    group(lettuceTemplate, {
      cropId: 'lettuce',
      cropName: 'Lettuce',
      id: 'lettuce-ready',
      lifecycle: 'harvestReady',
      plantedOn: '2026-05-20',
      xFt: 7,
    }),
  ],
  structures: [...structuredClone(plan.structures), bedB],
};
const recommendations = [
  {
    actionable: true,
    confidence: 'high',
    id: 'watering:tomato-b:2026-06-21:r1',
    reasonDetails: [{ message: 'Measured deficit reached the threshold.' }],
    recommendedDepthInches: 0.8,
    status: 'due',
    target: {
      cropGroupId: 'tomato-b',
      cropGroupLabel: 'Tomato group 2 in Bed B',
      cropName: 'Tomato',
    },
  },
  {
    actionable: true,
    confidence: 'low',
    id: 'watering:lettuce-ready:2026-06-21:r1',
    reasonDetails: [{ message: 'Recent precipitation is incomplete.' }],
    recommendedDepthInches: null,
    status: 'checkSoil',
    target: {
      cropGroupId: 'lettuce-ready',
      cropGroupLabel: 'Lettuce in Bed A',
      cropName: 'Lettuce',
    },
  },
];
const snapshot = {
  frostRisk: 'warning',
  heatRisk: 'watch',
  id: 'weather:2026-06-21',
};

const tasks = buildAutomatedTasks(taskPlan, recommendations, snapshot, now);
const repeated = buildAutomatedTasks(taskPlan, recommendations, snapshot, now);

assert.deepEqual(
  repeated,
  tasks,
  'identical plan/time evidence is deterministic',
);
assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);
assert.ok(
  tasks.every(
    (task) =>
      task.reason.trim() && task.target.kind && task.target.label.trim(),
  ),
  'every task explains its saved evidence and target',
);

const targets = createCropGroupTargets(taskPlan, []);
assert.equal(
  targets.find((target) => target.planting.id === 'tomato-a').label,
  'Tomato group 1 in Bed A',
);
assert.equal(
  targets.find((target) => target.planting.id === 'tomato-b').label,
  'Tomato group 2 in Bed B',
);

function task(category, plantingId) {
  return tasks.find((candidate) =>
    candidate.id.startsWith(`auto:${category}:${plantingId}:`),
  );
}

assert.equal(task('plant', 'carrot-planned').dueOn, '2026-07-01');
assert.equal(task('establishment', 'beet-planted').dueOn, '2026-06-17');
assert.equal(task('thin', 'beet-planted').dueOn, '2026-06-24');
assert.equal(task('support', 'tomato-b').kind, 'support');
assert.equal(task('train', 'tomato-b').kind, 'prune');
assert.equal(task('fertilize', 'tomato-b').kind, 'fertilize');
assert.equal(task('mulch', 'tomato-b').kind, 'mulch');
assert.equal(task('harvest', 'lettuce-ready').kind, 'harvest');
assert.equal(task('succession', 'lettuce-ready').kind, 'plant');
assert.equal(task('confirm-plannedFor', 'radish-undated').dueOn, '2026-06-21');
assert.equal(task('confirm-plantedOn', 'pepper-undated').dueOn, '2026-06-21');
assert.equal(task('support', 'pepper-undated'), undefined);
assert.equal(task('fertilize', 'pepper-undated'), undefined);
assert.equal(
  tasks.some((candidate) =>
    candidate.id.startsWith('auto:plant:radish-undated:'),
  ),
  false,
  'a missing plan date never becomes an invented planting date',
);

const wateringTask = tasks.find(
  (candidate) => candidate.sourceId === recommendations[0].id,
);
assert.equal(wateringTask.title, 'Water Tomato group 2 in Bed B');
assert.equal(wateringTask.target.label, 'Tomato group 2 in Bed B');
assert.equal(
  tasks.find((candidate) => candidate.sourceId === recommendations[1].id).title,
  'Check soil for Lettuce in Bed A',
);
assert.ok(
  tasks.some((candidate) => candidate.id === 'weather:frost:2026-06-21'),
);
assert.ok(
  tasks.some((candidate) => candidate.id === 'weather:heat:2026-06-21'),
);

const support = task('support', 'tomato-b');
const fertilizer = task('fertilize', 'tomato-b');
const harvest = task('harvest', 'lettuce-ready');
const thinning = task('thin', 'beet-planted');
const oldCreatedAtIso = '2026-06-01T12:00:00.000Z';
const existing = [
  {
    ...support,
    completedAtIso: '2026-06-18T12:00:00.000Z',
    status: 'done',
  },
  { ...fertilizer, dueOn: '2026-07-01', status: 'deferred' },
  { ...harvest, dueOn: '2026-06-22', status: 'snoozed' },
  { ...thinning, createdAtIso: oldCreatedAtIso, title: 'Stale title' },
  {
    ...thinning,
    id: 'auto:obsolete:old-group:2026-05-01',
    sourceId: 'plan:garden-main:old-group:obsolete:2026-05-01',
  },
  {
    ...thinning,
    id: 'auto:obsolete-deferred:old-group:2026-05-01',
    sourceId: 'plan:garden-main:old-group:obsolete-deferred:2026-05-01',
    status: 'deferred',
  },
  {
    ...thinning,
    id: 'manual-task',
    sourceId: null,
    title: 'Manual task',
  },
];
const merged = mergeAutomatedTasks(existing, tasks, now);

assert.equal(merged.find((item) => item.id === support.id).status, 'done');
assert.equal(
  merged.find((item) => item.id === fertilizer.id).status,
  'deferred',
);
assert.equal(
  merged.find((item) => item.id === fertilizer.id).dueOn,
  '2026-07-01',
);
assert.equal(merged.find((item) => item.id === harvest.id).status, 'snoozed');
assert.equal(
  merged.find((item) => item.id === thinning.id).title,
  thinning.title,
);
assert.equal(
  merged.find((item) => item.id === thinning.id).createdAtIso,
  oldCreatedAtIso,
);
const retired = merged.find(
  (item) => item.id === 'auto:obsolete:old-group:2026-05-01',
);
assert.equal(retired.status, 'done');
assert.equal(retired.completedAtIso, null, 'retirement is not user completion');
assert.match(retired.reason, /Retired/);
assert.equal(
  merged.find(
    (item) => item.id === 'auto:obsolete-deferred:old-group:2026-05-01',
  ).status,
  'deferred',
);
assert.equal(merged.find((item) => item.id === 'manual-task').status, 'open');

console.log('taskAutomationV2 tests passed');
