'use strict';

const {
  addIssue,
  validateArray,
  validateBoolean,
  validateEnum,
  validateExactObject,
  validateIso,
  validateMonthDay,
  validateNullableText,
  validateNumber,
  validateText,
  validateTimezone,
} = require('./v2PlanValidationSupport');

const plotKeys = [
  'climate',
  'depthFt',
  'location',
  'northDegrees',
  'snapFt',
  'widthFt',
];
const structureKeys = [
  'depthFt',
  'drainage',
  'id',
  'irrigationZoneId',
  'label',
  'locked',
  'mulched',
  'notes',
  'rotationDegrees',
  'soilDepthInches',
  'soilType',
  'type',
  'widthFt',
  'xFt',
  'yFt',
];
const tolerance = 0.001;

function validatePlot(plot, issues) {
  if (!validateExactObject(plot, 'plan.plot', plotKeys, issues)) return;
  validateNumber(plot.widthFt, 'plan.plot.widthFt', 1, 500, issues);
  validateNumber(plot.depthFt, 'plan.plot.depthFt', 1, 500, issues);
  validateNumber(plot.northDegrees, 'plan.plot.northDegrees', 0, 360, issues, {
    maximumExclusive: true,
  });
  validateNumber(plot.snapFt, 'plan.plot.snapFt', 0.0625, 1, issues);
  validateClimate(plot.climate, issues);
  validateLocation(plot.location, issues);
}

function validationPlotBounds(plot) {
  return {
    depthFt:
      typeof plot?.depthFt === 'number' && Number.isFinite(plot.depthFt)
        ? Math.max(plot.depthFt, 0)
        : 500,
    widthFt:
      typeof plot?.widthFt === 'number' && Number.isFinite(plot.widthFt)
        ? Math.max(plot.widthFt, 0)
        : 500,
  };
}

function validateClimate(climate, issues) {
  const path = 'plan.plot.climate';
  if (
    !validateExactObject(
      climate,
      path,
      ['firstFrost', 'hardinessZone', 'lastFrost'],
      issues,
    )
  ) {
    return;
  }
  validateMonthDay(climate.firstFrost, `${path}.firstFrost`, issues);
  validateMonthDay(climate.lastFrost, `${path}.lastFrost`, issues);
  if (
    typeof climate.hardinessZone !== 'string' ||
    !/^(?:[1-9]|1[0-3])[ab]$/i.test(climate.hardinessZone)
  ) {
    addIssue(
      issues,
      `${path}.hardinessZone`,
      'hardiness-zone',
      'Must be a USDA hardiness zone from 1a through 13b.',
    );
  }
}

function validateLocation(location, issues) {
  const path = 'plan.plot.location';
  if (
    !validateExactObject(
      location,
      path,
      ['coordinates', 'label', 'query', 'timezone'],
      issues,
    )
  ) {
    return;
  }
  validateText(location.label, `${path}.label`, 0, 200, issues);
  validateText(location.query, `${path}.query`, 0, 500, issues);
  validateTimezone(location.timezone, `${path}.timezone`, issues);
  if (location.coordinates === null) return;
  if (
    !validateExactObject(
      location.coordinates,
      `${path}.coordinates`,
      ['latitude', 'longitude'],
      issues,
    )
  ) {
    return;
  }
  validateNumber(
    location.coordinates.latitude,
    `${path}.coordinates.latitude`,
    -90,
    90,
    issues,
  );
  validateNumber(
    location.coordinates.longitude,
    `${path}.coordinates.longitude`,
    -180,
    180,
    issues,
  );
}

function validateStructure(
  structure,
  index,
  plot,
  structureIds,
  structures,
  issues,
) {
  const path = `plan.structures[${index}]`;
  if (!validateExactObject(structure, path, structureKeys, issues)) return;
  validateText(structure.id, `${path}.id`, 1, 128, issues);
  if (typeof structure.id === 'string') {
    if (structureIds.has(structure.id)) {
      addIssue(
        issues,
        `${path}.id`,
        'duplicate-id',
        'Structure id is duplicated.',
      );
    }
    structureIds.add(structure.id);
    if (!structures.has(structure.id)) structures.set(structure.id, structure);
  }
  validateText(structure.label, `${path}.label`, 1, 200, issues);
  validateText(structure.notes, `${path}.notes`, 0, 5000, issues);
  validateNullableText(
    structure.irrigationZoneId,
    `${path}.irrigationZoneId`,
    128,
    issues,
  );
  validateBoolean(structure.locked, `${path}.locked`, issues);
  validateBoolean(structure.mulched, `${path}.mulched`, issues);
  validateEnum(
    structure.drainage,
    `${path}.drainage`,
    ['fast', 'moderate', 'slow', 'unknown'],
    issues,
  );
  validateEnum(
    structure.soilType,
    `${path}.soilType`,
    ['clay', 'loam', 'sandy', 'unknown'],
    issues,
  );
  validateEnum(
    structure.type,
    `${path}.type`,
    ['bed', 'container', 'path', 'raisedBed', 'trellis'],
    issues,
  );
  if (structure.soilDepthInches !== null) {
    validateNumber(
      structure.soilDepthInches,
      `${path}.soilDepthInches`,
      1,
      120,
      issues,
    );
  }
  const rotationValid = validateNumber(
    structure.rotationDegrees,
    `${path}.rotationDegrees`,
    0,
    360,
    issues,
    { maximumExclusive: true },
  );
  const xValid = validateNumber(
    structure.xFt,
    `${path}.xFt`,
    0,
    plot.widthFt,
    issues,
  );
  const yValid = validateNumber(
    structure.yFt,
    `${path}.yFt`,
    0,
    plot.depthFt,
    issues,
  );
  const widthValid = validateNumber(
    structure.widthFt,
    `${path}.widthFt`,
    0.25,
    plot.widthFt,
    issues,
  );
  const depthValid = validateNumber(
    structure.depthFt,
    `${path}.depthFt`,
    0.25,
    plot.depthFt,
    issues,
  );
  if (
    xValid &&
    yValid &&
    widthValid &&
    depthValid &&
    rotationValid &&
    !rotatedStructureCorners(structure).every((point) =>
      pointInPlot(point, plot),
    )
  ) {
    addIssue(
      issues,
      path,
      'geometry',
      'The full rotated structure footprint must stay inside the plot.',
    );
  }
}

function validateReviewDecisions(decisions, issues) {
  const path = 'plan.reviewDecisions';
  if (!validateArray(decisions, path, 0, 1000, issues)) return;
  const issueIds = new Set();
  decisions.forEach((decision, index) => {
    const decisionPath = `${path}[${index}]`;
    if (
      !validateExactObject(
        decision,
        decisionPath,
        ['decision', 'issueId', 'updatedAtIso'],
        issues,
      )
    ) {
      return;
    }
    validateEnum(
      decision.decision,
      `${decisionPath}.decision`,
      ['accepted', 'ignored', 'snoozed'],
      issues,
    );
    validateText(decision.issueId, `${decisionPath}.issueId`, 1, 500, issues);
    if (typeof decision.issueId === 'string') {
      if (issueIds.has(decision.issueId)) {
        addIssue(
          issues,
          `${decisionPath}.issueId`,
          'duplicate-id',
          'Review decision issue id is duplicated.',
        );
      }
      issueIds.add(decision.issueId);
    }
    validateIso(decision.updatedAtIso, `${decisionPath}.updatedAtIso`, issues);
  });
}

function rotatedStructureCorners(structure) {
  const centerX = structure.xFt + structure.widthFt / 2;
  const centerY = structure.yFt + structure.depthFt / 2;
  const radians = (structure.rotationDegrees * Math.PI) / 180;
  return [
    [-structure.widthFt / 2, -structure.depthFt / 2],
    [structure.widthFt / 2, -structure.depthFt / 2],
    [-structure.widthFt / 2, structure.depthFt / 2],
    [structure.widthFt / 2, structure.depthFt / 2],
  ].map(([x, y]) => ({
    xFt: centerX + x * Math.cos(radians) - y * Math.sin(radians),
    yFt: centerY + x * Math.sin(radians) + y * Math.cos(radians),
  }));
}

function pointInPlot(point, plot) {
  return (
    point.xFt >= -tolerance &&
    point.yFt >= -tolerance &&
    point.xFt <= plot.widthFt + tolerance &&
    point.yFt <= plot.depthFt + tolerance
  );
}

module.exports = {
  validatePlot,
  validateReviewDecisions,
  validateStructure,
  validationPlotBounds,
};
