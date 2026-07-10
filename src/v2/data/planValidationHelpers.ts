import {
  isGrowingStructure,
  PLANTING_WATERING_STAGES,
  PLANTING_WATERING_STAGE_SOURCES,
  wateringStageForLifecycle,
  type GardenCoordinates,
  type GardenPlan,
  type GardenStructure,
  type PlantingGroup,
} from '../domain';
import { structureContainsPlanting, structureFitsPlot } from './planGeometry';

export interface PlanValidationIssue {
  field: string;
  message: string;
}

export function validateCoordinates(
  issues: PlanValidationIssue[],
  coordinates: GardenCoordinates | null,
) {
  if (!coordinates) return;
  validateRange(
    issues,
    'plot.location.latitude',
    coordinates.latitude,
    -90,
    90,
  );
  validateRange(
    issues,
    'plot.location.longitude',
    coordinates.longitude,
    -180,
    180,
  );
}

export function validateStructure(
  issues: PlanValidationIssue[],
  plan: GardenPlan,
  structure: GardenStructure,
) {
  const path = `structures.${structure.id}`;
  validateRequiredText(issues, `${path}.id`, structure.id, 128);
  validateRequiredText(issues, `${path}.label`, structure.label, 200);
  validateRange(issues, `${path}.xFt`, structure.xFt, 0, plan.plot.widthFt);
  validateRange(issues, `${path}.yFt`, structure.yFt, 0, plan.plot.depthFt);
  validateRange(
    issues,
    `${path}.widthFt`,
    structure.widthFt,
    0.25,
    plan.plot.widthFt,
  );
  validateRange(
    issues,
    `${path}.depthFt`,
    structure.depthFt,
    0.25,
    plan.plot.depthFt,
  );
  validateRange(
    issues,
    `${path}.rotationDegrees`,
    structure.rotationDegrees,
    0,
    359.999,
  );
  if (
    [
      structure.xFt,
      structure.yFt,
      structure.widthFt,
      structure.depthFt,
      structure.rotationDegrees,
    ].every(Number.isFinite) &&
    !structureFitsPlot(structure, plan.plot)
  ) {
    issues.push({
      field: path,
      message: 'Full rotated structure footprint must stay inside the plot.',
    });
  }
  if (structure.soilDepthInches !== null) {
    validateRange(
      issues,
      `${path}.soilDepthInches`,
      structure.soilDepthInches,
      1,
      120,
    );
  }
}

export function validatePlanting(
  issues: PlanValidationIssue[],
  plan: GardenPlan,
  structures: Map<string, GardenStructure>,
  planting: PlantingGroup,
) {
  const path = `plantings.${planting.id}`;
  validateRequiredText(issues, `${path}.id`, planting.id, 128);
  if (
    typeof planting.cropId !== 'string' ||
    !planting.cropId.trim() ||
    typeof planting.cropName !== 'string' ||
    !planting.cropName.trim()
  ) {
    issues.push({
      field: `${path}.cropId`,
      message: 'A deliberate crop selection is required.',
    });
  }
  validateRange(issues, `${path}.xFt`, planting.xFt, 0, plan.plot.widthFt);
  validateRange(issues, `${path}.yFt`, planting.yFt, 0, plan.plot.depthFt);
  validateRange(
    issues,
    `${path}.widthFt`,
    planting.widthFt,
    0.1,
    plan.plot.widthFt,
  );
  validateRange(
    issues,
    `${path}.depthFt`,
    planting.depthFt,
    0.1,
    plan.plot.depthFt,
  );
  validateRange(
    issues,
    `${path}.spacingInches`,
    planting.spacingInches,
    0.25,
    240,
  );
  validateWateringStage(issues, planting, path);
  validatePlantingFootprint(issues, plan, planting, path);
  validateWaterProfile(issues, planting, path);
  validateGrowingArea(issues, structures, planting, path);
  validateInstances(issues, plan, planting, path);
}

function validateWateringStage(
  issues: PlanValidationIssue[],
  planting: PlantingGroup,
  path: string,
) {
  if (!PLANTING_WATERING_STAGES.includes(planting.wateringStage)) {
    issues.push({
      field: `${path}.wateringStage`,
      message: 'Watering stage is invalid.',
    });
  }
  if (!PLANTING_WATERING_STAGE_SOURCES.includes(planting.wateringStageSource)) {
    issues.push({
      field: `${path}.wateringStageSource`,
      message: 'Watering stage source is invalid.',
    });
  } else if (
    planting.wateringStageSource === 'lifecycleFallback' &&
    planting.wateringStage !== wateringStageForLifecycle(planting.lifecycle)
  ) {
    issues.push({
      field: `${path}.wateringStage`,
      message: 'Lifecycle-derived watering stage does not match lifecycle.',
    });
  }
}

function validateGrowingArea(
  issues: PlanValidationIssue[],
  structures: Map<string, GardenStructure>,
  planting: PlantingGroup,
  path: string,
) {
  const growingArea = planting.growingAreaStructureId
    ? structures.get(planting.growingAreaStructureId)
    : undefined;
  if (!planting.growingAreaStructureId) {
    issues.push({
      field: `${path}.growingAreaStructureId`,
      message: 'A saved growing area is required.',
    });
  } else if (!growingArea) {
    issues.push({
      field: `${path}.growingAreaStructureId`,
      message: 'Growing area does not exist.',
    });
  } else if (!isGrowingStructure(growingArea)) {
    issues.push({
      field: `${path}.growingAreaStructureId`,
      message: 'Assigned structure is not a bed or container.',
    });
  } else if (!structureContainsPlanting(growingArea, planting)) {
    issues.push({
      field: `${path}.growingAreaStructureId`,
      message: 'Full planting footprint must fit inside its growing area.',
    });
  }
}

function validateInstances(
  issues: PlanValidationIssue[],
  plan: GardenPlan,
  planting: PlantingGroup,
  path: string,
) {
  if (planting.instances.length === 0) {
    issues.push({
      field: `${path}.instances`,
      message: 'At least one plant instance is required.',
    });
  }
  const instanceIds = new Set<string>();
  for (const instance of planting.instances) {
    const instancePath = `${path}.instances.${instance.id}`;
    validateRequiredText(issues, `${instancePath}.id`, instance.id, 128);
    validateRequiredText(issues, `${instancePath}.label`, instance.label, 200);
    if (instanceIds.has(instance.id)) {
      issues.push({
        field: `${path}.instances`,
        message: 'Duplicate plant instance id.',
      });
    }
    instanceIds.add(instance.id);
    validateRange(
      issues,
      `${instancePath}.xFt`,
      instance.xFt,
      0,
      plan.plot.widthFt,
    );
    validateRange(
      issues,
      `${instancePath}.yFt`,
      instance.yFt,
      0,
      plan.plot.depthFt,
    );
    if (!containsPoint(planting, instance.xFt, instance.yFt)) {
      issues.push({
        field: instancePath,
        message: 'Plant instance must stay inside its group footprint.',
      });
    }
  }
}

function validatePlantingFootprint(
  issues: PlanValidationIssue[],
  plan: GardenPlan,
  planting: PlantingGroup,
  path: string,
) {
  if (
    planting.xFt - planting.widthFt / 2 < -0.001 ||
    planting.xFt + planting.widthFt / 2 > plan.plot.widthFt + 0.001
  ) {
    issues.push({
      field: `${path}.xFt`,
      message: 'Full planting footprint must stay inside the plot width.',
    });
  }
  if (
    planting.yFt - planting.depthFt / 2 < -0.001 ||
    planting.yFt + planting.depthFt / 2 > plan.plot.depthFt + 0.001
  ) {
    issues.push({
      field: `${path}.yFt`,
      message: 'Full planting footprint must stay inside the plot depth.',
    });
  }
}

function validateWaterProfile(
  issues: PlanValidationIssue[],
  planting: PlantingGroup,
  path: string,
) {
  const profile = planting.waterProfile;
  validateRange(
    issues,
    `${path}.waterProfile.baseWeeklyInches`,
    profile.baseWeeklyInches,
    0.05,
    5,
  );
  validateRange(
    issues,
    `${path}.waterProfile.rootDepthInches`,
    profile.rootDepthInches,
    1,
    120,
  );
  validateRange(
    issues,
    `${path}.waterProfile.depletionFraction`,
    profile.depletionFraction,
    0.05,
    0.95,
  );
  for (const stage of [
    'establishing',
    'flowering',
    'fruiting',
    'mature',
  ] as const) {
    validateRange(
      issues,
      `${path}.waterProfile.stageCoefficients.${stage}`,
      profile.stageCoefficients[stage],
      0.1,
      3,
    );
  }
  if (!['high', 'low', 'medium'].includes(profile.confidence)) {
    issues.push({
      field: `${path}.waterProfile.confidence`,
      message: 'Water profile confidence is invalid.',
    });
  }
  if (!['catalog', 'curated', 'estimated', 'manual'].includes(profile.source)) {
    issues.push({
      field: `${path}.waterProfile.source`,
      message: 'Water profile source is invalid.',
    });
  }
  validateRequiredText(
    issues,
    `${path}.waterProfile.sourceVersion`,
    profile.sourceVersion,
    100,
  );
}

function containsPoint(planting: PlantingGroup, xFt: number, yFt: number) {
  const tolerance = 0.001;
  return (
    xFt >= planting.xFt - planting.widthFt / 2 - tolerance &&
    xFt <= planting.xFt + planting.widthFt / 2 + tolerance &&
    yFt >= planting.yFt - planting.depthFt / 2 - tolerance &&
    yFt <= planting.yFt + planting.depthFt / 2 + tolerance
  );
}

export function validateRequiredText(
  issues: PlanValidationIssue[],
  field: string,
  value: string,
  maximum: number,
) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    issues.push({
      field,
      message: `Required and limited to ${maximum} characters.`,
    });
  }
}

export function validateRange(
  issues: PlanValidationIssue[],
  field: string,
  value: number,
  minimum: number,
  maximum: number,
) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    issues.push({
      field,
      message: `Must be between ${minimum} and ${maximum}.`,
    });
  }
}

export function validateTimezone(
  issues: PlanValidationIssue[],
  timezone: string,
) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(
      new Date(0),
    );
  } catch {
    issues.push({
      field: 'plot.location.timezone',
      message: 'Invalid IANA timezone.',
    });
  }
}
