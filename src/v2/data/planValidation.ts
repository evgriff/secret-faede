import {
  PLAN_SCHEMA_VERSION,
  type GardenPlan,
  type GardenStructure,
} from '../domain';
import {
  validateCoordinates,
  validatePlanting,
  validateRange,
  validateRequiredText,
  validateStructure,
  validateTimezone,
  type PlanValidationIssue,
} from './planValidationHelpers';

export type { PlanValidationIssue } from './planValidationHelpers';

export class InvalidGardenPlanError extends Error {
  readonly issues: PlanValidationIssue[];

  constructor(issues: PlanValidationIssue[]) {
    super(issues.map((issue) => `${issue.field}: ${issue.message}`).join('; '));
    this.name = 'InvalidGardenPlanError';
    this.issues = issues;
  }
}

export function validateGardenPlan(plan: GardenPlan): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];

  if (plan.schemaVersion !== PLAN_SCHEMA_VERSION) {
    issues.push({
      field: 'schemaVersion',
      message: 'Unsupported plan schema.',
    });
  }
  if (typeof plan.setupCompleted !== 'boolean') {
    issues.push({
      field: 'setupCompleted',
      message: 'Setup state must be true or false.',
    });
  }
  validateRequiredText(issues, 'id', plan.id, 128);
  if (typeof plan.name !== 'string' || !plan.name.trim()) {
    issues.push({ field: 'name', message: 'Garden name is required.' });
  }

  validateRange(issues, 'plot.widthFt', plan.plot.widthFt, 1, 500);
  validateRange(issues, 'plot.depthFt', plan.plot.depthFt, 1, 500);
  validateRange(
    issues,
    'plot.northDegrees',
    plan.plot.northDegrees,
    0,
    359.999,
  );
  validateRange(issues, 'plot.snapFt', plan.plot.snapFt, 0.0625, 1);
  validateTimezone(issues, plan.plot.location.timezone);
  validateCoordinates(issues, plan.plot.location.coordinates);

  const structures = new Map<string, GardenStructure>();
  for (const structure of plan.structures) {
    if (structures.has(structure.id)) {
      issues.push({
        field: `structures.${structure.id}`,
        message: 'Duplicate id.',
      });
    }
    structures.set(structure.id, structure);
    validateStructure(issues, plan, structure);
  }

  const plantingIds = new Set<string>();
  for (const planting of plan.plantings) {
    if (plantingIds.has(planting.id)) {
      issues.push({
        field: `plantings.${planting.id}`,
        message: 'Duplicate id.',
      });
    }
    plantingIds.add(planting.id);
    validatePlanting(issues, plan, structures, planting);
  }

  return issues;
}

export function assertValidGardenPlan(plan: GardenPlan) {
  const issues = validateGardenPlan(plan);
  if (issues.length > 0) throw new InvalidGardenPlanError(issues);
}
