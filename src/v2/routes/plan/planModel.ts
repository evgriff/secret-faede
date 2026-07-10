import {
  hasOperationalGardenLocation,
  wateringStageForLifecycle,
  type GardenPlan,
  type GardenStructure,
  type PlantingArrangement,
  type PlantingGroup,
  type PlantingWaterProfileSnapshot,
  type SunExposure,
} from '../../domain';
import {
  structureContainsPlanting,
  structureFitsPlot,
} from '../../data/planGeometry';

export interface CropChoice {
  cropId: string;
  cropName: string;
  rootDepthInches: number;
  spacingInches: number;
  sun: SunExposure;
  waterConfidence?: PlantingWaterProfileSnapshot['confidence'];
  weeklyWaterInches: number;
}
export interface PlanIssue {
  id: string;
  message: string;
  plantingGroupIds: string[];
  severity: 'attention' | 'blocking';
  title: string;
  type: 'bounds' | 'environment' | 'overlap' | 'placement' | 'waterConfidence';
}
export interface LayoutProposalChange {
  from: { xFt: number; yFt: number };
  plantingGroupId: string;
  to: { xFt: number; yFt: number };
}
export interface LayoutProposal {
  changes: LayoutProposalChange[];
  id: string;
  summary: string;
}

export function createPlantingGroup(input: {
  arrangement: PlantingArrangement;
  crop: CropChoice;
  id: string;
  quantity: number;
  structure: GardenStructure | null;
}): PlantingGroup {
  const quantity = clamp(Math.round(input.quantity), 1, 500);
  const spacingFt = input.crop.spacingInches / 12;
  const columns =
    input.arrangement === 'row' || input.arrangement === 'trellisLine'
      ? quantity
      : Math.ceil(Math.sqrt(quantity));
  const rows = Math.ceil(quantity / columns);
  const widthFt = Math.max(
    spacingFt * Math.max(columns - 1, 0) + spacingFt,
    0.5,
  );
  const depthFt = Math.max(spacingFt * Math.max(rows - 1, 0) + spacingFt, 0.5);
  const center = input.structure
    ? {
        xFt: input.structure.xFt + input.structure.widthFt / 2,
        yFt: input.structure.yFt + input.structure.depthFt / 2,
      }
    : { xFt: widthFt / 2, yFt: depthFt / 2 };
  const startX = center.xFt - ((columns - 1) * spacingFt) / 2;
  const startY = center.yFt - ((rows - 1) * spacingFt) / 2;
  const instances = Array.from({ length: quantity }, (_, index) => ({
    id: `${input.id}-plant-${index + 1}`,
    label: `${input.crop.cropName} ${index + 1}`,
    xFt: round(startX + (index % columns) * spacingFt),
    yFt: round(startY + Math.floor(index / columns) * spacingFt),
  }));
  return {
    arrangement: input.arrangement,
    cropId: input.crop.cropId,
    cropName: input.crop.cropName,
    depthFt: round(depthFt),
    growingAreaStructureId: input.structure?.id ?? null,
    id: input.id,
    instances,
    irrigationZoneId: input.structure?.irrigationZoneId ?? null,
    lifecycle: 'planned',
    locked: false,
    mulched: input.structure?.mulched ?? false,
    notes: '',
    plantedOn: null,
    plannedFor: null,
    spacingInches: input.crop.spacingInches,
    sun: input.crop.sun,
    waterProfile: createWaterProfile(input.crop),
    wateringStage: wateringStageForLifecycle('planned'),
    wateringStageSource: 'lifecycleFallback',
    widthFt: round(widthFt),
    xFt: round(center.xFt),
    yFt: round(center.yFt),
  };
}

export function movePlantingGroup(
  plan: GardenPlan,
  plantingGroupId: string,
  next: { xFt: number; yFt: number },
) {
  const group = plan.plantings.find(
    (candidate) => candidate.id === plantingGroupId,
  );
  if (!group || group.locked) return plan;
  const halfWidth = group.widthFt / 2;
  const halfDepth = group.depthFt / 2;
  const xFt = snap(
    clamp(
      next.xFt,
      halfWidth,
      Math.max(plan.plot.widthFt - halfWidth, halfWidth),
    ),
    plan.plot.snapFt,
  );
  const yFt = snap(
    clamp(
      next.yFt,
      halfDepth,
      Math.max(plan.plot.depthFt - halfDepth, halfDepth),
    ),
    plan.plot.snapFt,
  );
  const deltaX = xFt - group.xFt;
  const deltaY = yFt - group.yFt;
  return {
    ...plan,
    plantings: plan.plantings.map((candidate) =>
      candidate.id === plantingGroupId
        ? {
            ...candidate,
            instances: candidate.instances.map((instance) => ({
              ...instance,
              xFt: round(instance.xFt + deltaX),
              yFt: round(instance.yFt + deltaY),
            })),
            xFt,
            yFt,
          }
        : candidate,
    ),
  };
}

export function findPlanIssues(plan: GardenPlan): PlanIssue[] {
  const issues: PlanIssue[] = [];
  if (!hasOperationalGardenLocation(plan.plot.location)) {
    issues.push({
      id: 'environment:operational-location',
      message:
        'Save bounded latitude and longitude plus a valid IANA garden timezone. Weather and watering cannot use a location description alone.',
      plantingGroupIds: [],
      severity: 'blocking',
      title: 'Operational weather location is incomplete',
      type: 'environment',
    });
  }
  for (const group of plan.plantings) {
    if (
      group.xFt - group.widthFt / 2 < 0 ||
      group.yFt - group.depthFt / 2 < 0 ||
      group.xFt + group.widthFt / 2 > plan.plot.widthFt ||
      group.yFt + group.depthFt / 2 > plan.plot.depthFt
    ) {
      issues.push({
        id: `bounds:${group.id}`,
        message: `${group.cropName}'s full planting footprint must stay inside the plot.`,
        plantingGroupIds: [group.id],
        severity: 'blocking',
        title: 'Crop group exceeds the plot',
        type: 'bounds',
      });
    }
    if (!group.growingAreaStructureId) {
      issues.push({
        id: `placement:${group.id}`,
        message: `Assign ${group.cropName} to one saved bed or container so soil and watering calculations have a physical target.`,
        plantingGroupIds: [group.id],
        severity: 'attention',
        title: 'Growing area is not assigned',
        type: 'placement',
      });
    } else {
      const structure = plan.structures.find(
        (candidate) => candidate.id === group.growingAreaStructureId,
      );
      if (structure && !structureContainsPlanting(structure, group)) {
        issues.push({
          id: `placement-bounds:${group.id}:${structure.id}`,
          message: `${group.cropName}'s mature footprint does not fit fully inside ${structure.label}. Move it, reduce the group, or assign another growing area.`,
          plantingGroupIds: [group.id],
          severity: 'blocking',
          title: 'Crop group exceeds its growing area',
          type: 'placement',
        });
      }
    }
    if (group.waterProfile.confidence === 'low') {
      issues.push({
        id: `water-confidence:${group.id}`,
        message: `${group.cropName} uses an estimated water profile. Review its weekly need and root depth.`,
        plantingGroupIds: [group.id],
        severity: 'attention',
        title: 'Water profile needs confirmation',
        type: 'waterConfidence',
      });
    }
  }
  for (let leftIndex = 0; leftIndex < plan.plantings.length; leftIndex += 1) {
    const left = plan.plantings[leftIndex];
    if (!left) continue;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < plan.plantings.length;
      rightIndex += 1
    ) {
      const right = plan.plantings[rightIndex];
      if (!right || !rectanglesOverlap(left, right)) continue;
      issues.push({
        id: `overlap:${[left.id, right.id].sort().join(':')}`,
        message: `${left.cropName} and ${right.cropName} need the same mature space.`,
        plantingGroupIds: [left.id, right.id],
        severity: 'blocking',
        title: 'Crop groups overlap',
        type: 'overlap',
      });
    }
  }
  return issues;
}

export function createLayoutProposal(plan: GardenPlan): LayoutProposal {
  const structures = plan.structures.filter(
    (structure) =>
      ['bed', 'container', 'raisedBed'].includes(structure.type) &&
      structure.rotationDegrees === 0 &&
      structureFitsPlot(structure, plan.plot),
  );
  const movable = plan.plantings.filter(
    (group) => !group.locked && group.lifecycle === 'planned',
  );
  const changes: LayoutProposalChange[] = [];
  let cursor = 0;
  for (const group of movable) {
    const structure = structures.find(
      (candidate) => candidate.id === group.growingAreaStructureId,
    );
    if (!structure) continue;
    if (
      group.widthFt > structure.widthFt ||
      group.depthFt > structure.depthFt
    ) {
      continue;
    }
    const columns = Math.max(
      1,
      Math.floor(structure.widthFt / Math.max(group.widthFt, plan.plot.snapFt)),
    );
    const slot = cursor % columns;
    const row = Math.floor(cursor / columns);
    const xFt = clamp(
      structure.xFt + group.widthFt / 2 + slot * group.widthFt,
      structure.xFt + group.widthFt / 2,
      structure.xFt + structure.widthFt - group.widthFt / 2,
    );
    const yFt = clamp(
      structure.yFt + group.depthFt / 2 + row * group.depthFt,
      structure.yFt + group.depthFt / 2,
      structure.yFt + structure.depthFt - group.depthFt / 2,
    );
    if (
      Math.abs(xFt - group.xFt) > 0.001 ||
      Math.abs(yFt - group.yFt) > 0.001
    ) {
      changes.push({
        from: { xFt: group.xFt, yFt: group.yFt },
        plantingGroupId: group.id,
        to: {
          xFt: snap(xFt, plan.plot.snapFt),
          yFt: snap(yFt, plan.plot.snapFt),
        },
      });
    }
    cursor += 1;
  }
  const proposal = {
    changes,
    id: `layout-${plan.updatedAtIso}`,
    summary:
      changes.length > 0
        ? `Reposition ${changes.length} planned crop group${changes.length === 1 ? '' : 's'} inside their growing areas.`
        : 'This geometry heuristic found no suggested move for the current planned crop groups.',
  };
  const unsafe =
    changes.length > 0 &&
    findPlanIssues(applyLayoutProposal(plan, proposal)).some(
      (issue) =>
        issue.severity === 'blocking' &&
        ['bounds', 'overlap', 'placement'].includes(issue.type),
    );
  return unsafe
    ? {
        ...proposal,
        changes: [],
        summary:
          'No safe geometry-only move was found. Rotated growing areas and layouts that retain a bounds or overlap conflict are left unchanged.',
      }
    : proposal;
}

export function applyLayoutProposal(
  plan: GardenPlan,
  proposal: LayoutProposal,
) {
  return proposal.changes.reduce(
    (current, change) =>
      movePlantingGroup(current, change.plantingGroupId, change.to),
    plan,
  );
}

export function recordReviewDecision(
  plan: GardenPlan,
  issueId: string,
  decision: 'accepted' | 'ignored' | 'snoozed',
  now = new Date(),
) {
  if (
    decision === 'ignored' &&
    findPlanIssues(plan).some(
      (issue) => issue.id === issueId && issue.severity === 'blocking',
    )
  ) {
    return plan;
  }
  return {
    ...plan,
    reviewDecisions: [
      { decision, issueId, updatedAtIso: now.toISOString() },
      ...plan.reviewDecisions.filter((item) => item.issueId !== issueId),
    ],
  };
}

export function restoreReviewIssue(plan: GardenPlan, issueId: string) {
  return {
    ...plan,
    reviewDecisions: plan.reviewDecisions.filter(
      (item) => item.issueId !== issueId,
    ),
  };
}

function createWaterProfile(crop: CropChoice): PlantingWaterProfileSnapshot {
  return {
    baseWeeklyInches: crop.weeklyWaterInches,
    confidence: crop.waterConfidence ?? 'medium',
    depletionFraction: 0.45,
    rootDepthInches: crop.rootDepthInches,
    source: 'catalog',
    sourceVersion: 'home-garden-catalog-v2',
    stageCoefficients: {
      establishing: 1.2,
      flowering: 1.05,
      fruiting: 1.15,
      mature: 1,
    },
  };
}

function rectanglesOverlap(
  left: Pick<PlantingGroup, 'depthFt' | 'widthFt' | 'xFt' | 'yFt'>,
  right: Pick<PlantingGroup, 'depthFt' | 'widthFt' | 'xFt' | 'yFt'>,
) {
  return (
    Math.abs(left.xFt - right.xFt) < (left.widthFt + right.widthFt) / 2 &&
    Math.abs(left.yFt - right.yFt) < (left.depthFt + right.depthFt) / 2
  );
}

function snap(value: number, increment: number) {
  return round(Math.round(value / increment) * increment);
}

function round(value: number) {
  return Number(value.toFixed(3));
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
