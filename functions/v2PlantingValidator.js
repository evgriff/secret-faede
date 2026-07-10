'use strict';

const {
  addIssue,
  validateArray,
  validateBoolean,
  validateEnum,
  validateExactObject,
  validateNullableLocalDate,
  validateNullableText,
  validateNumber,
  validateText,
} = require('./v2PlanValidationSupport');

const plantingKeys = [
  'arrangement',
  'cropId',
  'cropName',
  'depthFt',
  'growingAreaStructureId',
  'id',
  'instances',
  'irrigationZoneId',
  'lifecycle',
  'locked',
  'mulched',
  'notes',
  'plantedOn',
  'plannedFor',
  'spacingInches',
  'sun',
  'waterProfile',
  'wateringStage',
  'wateringStageSource',
  'widthFt',
  'xFt',
  'yFt',
];
const waterProfileKeys = [
  'baseWeeklyInches',
  'confidence',
  'depletionFraction',
  'rootDepthInches',
  'source',
  'sourceVersion',
  'stageCoefficients',
];
const stages = ['establishing', 'flowering', 'fruiting', 'mature'];
const growingTypes = new Set(['bed', 'container', 'raisedBed']);
const tolerance = 0.001;

function validatePlanting(planting, index, context) {
  const path = `plan.plantings[${index}]`;
  const { instanceIds, issues, plantingIds, plot, structures } = context;
  if (!validateExactObject(planting, path, plantingKeys, issues)) return;

  validateText(planting.id, `${path}.id`, 1, 128, issues);
  if (typeof planting.id === 'string') {
    if (plantingIds.has(planting.id)) {
      addIssue(
        issues,
        `${path}.id`,
        'duplicate-id',
        'Planting id is duplicated.',
      );
    }
    plantingIds.add(planting.id);
  }
  validateText(planting.cropId, `${path}.cropId`, 1, 128, issues);
  validateText(planting.cropName, `${path}.cropName`, 1, 200, issues);
  validateEnum(
    planting.arrangement,
    `${path}.arrangement`,
    ['block', 'cluster', 'row', 'single', 'trellisLine'],
    issues,
  );
  validateEnum(
    planting.lifecycle,
    `${path}.lifecycle`,
    ['planned', 'planted', 'growing', 'harvestReady', 'harvested', 'removed'],
    issues,
  );
  validateEnum(
    planting.sun,
    `${path}.sun`,
    ['fullSun', 'partShade', 'shade'],
    issues,
  );
  validateEnum(planting.wateringStage, `${path}.wateringStage`, stages, issues);
  validateEnum(
    planting.wateringStageSource,
    `${path}.wateringStageSource`,
    ['manual', 'plantingEvent', 'lifecycleFallback'],
    issues,
  );
  if (
    planting.wateringStageSource === 'lifecycleFallback' &&
    planting.wateringStage !== wateringStageForLifecycle(planting.lifecycle)
  ) {
    addIssue(
      issues,
      `${path}.wateringStage`,
      'stage-provenance',
      'Lifecycle-fallback stage must match the saved planting lifecycle.',
    );
  }
  validateBoolean(planting.locked, `${path}.locked`, issues);
  validateBoolean(planting.mulched, `${path}.mulched`, issues);
  validateText(planting.notes, `${path}.notes`, 0, 5000, issues);
  validateNullableText(
    planting.irrigationZoneId,
    `${path}.irrigationZoneId`,
    128,
    issues,
  );
  validateNullableLocalDate(planting.plantedOn, `${path}.plantedOn`, issues);
  validateNullableLocalDate(planting.plannedFor, `${path}.plannedFor`, issues);

  const xValid = validateNumber(
    planting.xFt,
    `${path}.xFt`,
    0,
    plot.widthFt,
    issues,
  );
  const yValid = validateNumber(
    planting.yFt,
    `${path}.yFt`,
    0,
    plot.depthFt,
    issues,
  );
  const widthValid = validateNumber(
    planting.widthFt,
    `${path}.widthFt`,
    0.1,
    plot.widthFt,
    issues,
  );
  const depthValid = validateNumber(
    planting.depthFt,
    `${path}.depthFt`,
    0.1,
    plot.depthFt,
    issues,
  );
  validateNumber(
    planting.spacingInches,
    `${path}.spacingInches`,
    0.25,
    240,
    issues,
  );
  if (xValid && yValid && widthValid && depthValid) {
    validatePlantingBounds(planting, plot, path, issues);
  }

  validateGrowingArea(planting, structures, path, issues);
  validateWaterProfile(planting.waterProfile, `${path}.waterProfile`, issues);
  validateInstances(planting, path, plot, instanceIds, issues);
}

function validateGrowingArea(planting, structures, path, issues) {
  if (
    !validateText(
      planting.growingAreaStructureId,
      `${path}.growingAreaStructureId`,
      1,
      128,
      issues,
    )
  ) {
    return;
  }
  const structure = structures.get(planting.growingAreaStructureId);
  if (!structure) {
    addIssue(
      issues,
      `${path}.growingAreaStructureId`,
      'missing-link',
      'Growing area does not exist.',
    );
    return;
  }
  if (!growingTypes.has(structure.type)) {
    addIssue(
      issues,
      `${path}.growingAreaStructureId`,
      'invalid-link',
      'Growing area must be a bed, raised bed, or container.',
    );
    return;
  }
  if (
    !plantingCorners(planting).every((point) =>
      structureContainsPoint(structure, point),
    )
  ) {
    addIssue(
      issues,
      `${path}.growingAreaStructureId`,
      'geometry',
      'The full crop-group footprint must fit inside its growing area.',
    );
  }
}

function validateWaterProfile(profile, path, issues) {
  if (!validateExactObject(profile, path, waterProfileKeys, issues)) return;
  validateNumber(
    profile.baseWeeklyInches,
    `${path}.baseWeeklyInches`,
    0.05,
    5,
    issues,
  );
  validateNumber(
    profile.rootDepthInches,
    `${path}.rootDepthInches`,
    1,
    120,
    issues,
  );
  validateNumber(
    profile.depletionFraction,
    `${path}.depletionFraction`,
    0.05,
    0.95,
    issues,
  );
  validateEnum(
    profile.confidence,
    `${path}.confidence`,
    ['high', 'low', 'medium'],
    issues,
  );
  validateEnum(
    profile.source,
    `${path}.source`,
    ['catalog', 'curated', 'estimated', 'manual'],
    issues,
  );
  validateText(profile.sourceVersion, `${path}.sourceVersion`, 1, 100, issues);
  const coefficientPath = `${path}.stageCoefficients`;
  if (
    !validateExactObject(
      profile.stageCoefficients,
      coefficientPath,
      stages,
      issues,
    )
  )
    return;
  for (const stage of stages) {
    validateNumber(
      profile.stageCoefficients[stage],
      `${coefficientPath}.${stage}`,
      0.1,
      3,
      issues,
    );
  }
}

function validateInstances(planting, path, plot, instanceIds, issues) {
  const instancesPath = `${path}.instances`;
  if (!validateArray(planting.instances, instancesPath, 1, 500, issues)) return;
  planting.instances.forEach((instance, index) => {
    const instancePath = `${instancesPath}[${index}]`;
    if (
      !validateExactObject(
        instance,
        instancePath,
        ['id', 'label', 'xFt', 'yFt'],
        issues,
      )
    )
      return;
    validateText(instance.id, `${instancePath}.id`, 1, 128, issues);
    if (typeof instance.id === 'string') {
      if (instanceIds.has(instance.id)) {
        addIssue(
          issues,
          `${instancePath}.id`,
          'duplicate-id',
          'Plant-instance id is duplicated.',
        );
      }
      instanceIds.add(instance.id);
    }
    validateText(instance.label, `${instancePath}.label`, 1, 200, issues);
    const xValid = validateNumber(
      instance.xFt,
      `${instancePath}.xFt`,
      0,
      plot.widthFt,
      issues,
    );
    const yValid = validateNumber(
      instance.yFt,
      `${instancePath}.yFt`,
      0,
      plot.depthFt,
      issues,
    );
    if (xValid && yValid && !plantingContainsPoint(planting, instance)) {
      addIssue(
        issues,
        instancePath,
        'geometry',
        'Plant instance must stay inside its crop-group footprint.',
      );
    }
  });
}

function validatePlantingBounds(planting, plot, path, issues) {
  if (!plantingCorners(planting).every((point) => pointInPlot(point, plot))) {
    addIssue(
      issues,
      path,
      'geometry',
      'The full crop-group footprint must stay inside the plot.',
    );
  }
}

function plantingCorners(planting) {
  const halfWidth = planting.widthFt / 2;
  const halfDepth = planting.depthFt / 2;
  return [
    { xFt: planting.xFt - halfWidth, yFt: planting.yFt - halfDepth },
    { xFt: planting.xFt + halfWidth, yFt: planting.yFt - halfDepth },
    { xFt: planting.xFt - halfWidth, yFt: planting.yFt + halfDepth },
    { xFt: planting.xFt + halfWidth, yFt: planting.yFt + halfDepth },
  ];
}

function pointInPlot(point, plot) {
  return (
    point.xFt >= -tolerance &&
    point.yFt >= -tolerance &&
    point.xFt <= plot.widthFt + tolerance &&
    point.yFt <= plot.depthFt + tolerance
  );
}

function plantingContainsPoint(planting, point) {
  return plantingCorners(planting).every((corner, index) =>
    index === 0
      ? point.xFt >= corner.xFt - tolerance &&
        point.yFt >= corner.yFt - tolerance
      : index === 3
        ? point.xFt <= corner.xFt + tolerance &&
          point.yFt <= corner.yFt + tolerance
        : true,
  );
}

function structureContainsPoint(structure, point) {
  const centerX = structure.xFt + structure.widthFt / 2;
  const centerY = structure.yFt + structure.depthFt / 2;
  const radians = (-structure.rotationDegrees * Math.PI) / 180;
  const deltaX = point.xFt - centerX;
  const deltaY = point.yFt - centerY;
  const localX = deltaX * Math.cos(radians) - deltaY * Math.sin(radians);
  const localY = deltaX * Math.sin(radians) + deltaY * Math.cos(radians);
  return (
    Math.abs(localX) <= structure.widthFt / 2 + tolerance &&
    Math.abs(localY) <= structure.depthFt / 2 + tolerance
  );
}

function wateringStageForLifecycle(lifecycle) {
  if (lifecycle === 'planned' || lifecycle === 'planted') {
    return 'establishing';
  }
  if (lifecycle === 'harvestReady') return 'fruiting';
  return 'mature';
}

module.exports = { validatePlanting };
