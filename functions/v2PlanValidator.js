'use strict';

const { validatePlantingOverlaps } = require('./v2PlantingOverlapValidator');
const { validatePlanting } = require('./v2PlantingValidator');
const {
  validatePlot,
  validateReviewDecisions,
  validateStructure,
  validationPlotBounds,
} = require('./v2PlanPartsValidator');
const {
  addIssue,
  validateArray,
  validateBoolean,
  validateExactObject,
  validateIso,
  validateText,
} = require('./v2PlanValidationSupport');

const planKeys = [
  'createdAtIso',
  'id',
  'name',
  'plantings',
  'plot',
  'reviewDecisions',
  'schemaVersion',
  'setupCompleted',
  'structures',
  'updatedAtIso',
];

class V2PlanValidationError extends Error {
  constructor(issues) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'V2PlanValidationError';
    this.issues = issues;
  }
}

function validateV2Plan(plan) {
  const issues = [];
  if (!validateExactObject(plan, 'plan', planKeys, issues)) return issues;

  if (plan.schemaVersion !== 9) {
    addIssue(
      issues,
      'plan.schemaVersion',
      'schema-version',
      'Must be schema 9.',
    );
  }
  validateBoolean(plan.setupCompleted, 'plan.setupCompleted', issues);
  validateText(plan.id, 'plan.id', 1, 128, issues);
  validateText(plan.name, 'plan.name', 1, 200, issues);
  const createdValid = validateIso(
    plan.createdAtIso,
    'plan.createdAtIso',
    issues,
  );
  const updatedValid = validateIso(
    plan.updatedAtIso,
    'plan.updatedAtIso',
    issues,
  );
  if (
    createdValid &&
    updatedValid &&
    Date.parse(plan.updatedAtIso) < Date.parse(plan.createdAtIso)
  ) {
    addIssue(
      issues,
      'plan.updatedAtIso',
      'time-order',
      'Updated time cannot precede created time.',
    );
  }

  validatePlot(plan.plot, issues);
  const plotBounds = validationPlotBounds(plan.plot);
  const structures = new Map();
  const structureIds = new Set();
  if (validateArray(plan.structures, 'plan.structures', 0, 128, issues)) {
    plan.structures.forEach((structure, index) => {
      validateStructure(
        structure,
        index,
        plotBounds,
        structureIds,
        structures,
        issues,
      );
    });
  }

  if (validateArray(plan.plantings, 'plan.plantings', 0, 512, issues)) {
    const context = {
      instanceIds: new Set(),
      issues,
      plantingIds: new Set(),
      plot: plotBounds,
      structures,
    };
    plan.plantings.forEach((planting, index) =>
      validatePlanting(planting, index, context),
    );
    validatePlantingOverlaps(plan.plantings, issues);
  }

  validateReviewDecisions(plan.reviewDecisions, issues);
  return issues;
}

function assertValidV2Plan(plan) {
  const issues = validateV2Plan(plan);
  if (issues.length > 0) throw new V2PlanValidationError(issues);
  return plan;
}

module.exports = {
  V2PlanValidationError,
  assertValidV2Plan,
  validateV2Plan,
};
