import { describe, expect, it } from 'vitest';

import { createEmptyGardenPlan } from '../../data';
import type { GardenStructure } from '../../domain';
import {
  applyLayoutProposal,
  createLayoutProposal,
  createPlantingGroup,
  findPlanIssues,
  movePlantingGroup,
  recordReviewDecision,
  restoreReviewIssue,
} from './planModel';

const bed: GardenStructure = {
  depthFt: 4,
  drainage: 'moderate',
  id: 'bed-1',
  irrigationZoneId: 'front-hose',
  label: 'Kitchen bed',
  locked: false,
  mulched: true,
  notes: '',
  rotationDegrees: 0,
  soilDepthInches: 18,
  soilType: 'loam',
  type: 'raisedBed',
  widthFt: 8,
  xFt: 1,
  yFt: 1,
};

describe('v2 plan model', () => {
  it('creates one crop group with individual feet-based instances', () => {
    const group = createPlantingGroup({
      arrangement: 'block',
      crop: {
        cropId: 'lettuce',
        cropName: 'Lettuce',
        rootDepthInches: 8,
        spacingInches: 8,
        sun: 'partShade',
        weeklyWaterInches: 1,
      },
      id: 'lettuce-group',
      quantity: 6,
      structure: bed,
    });

    expect(group.instances).toHaveLength(6);
    expect(group.growingAreaStructureId).toBe('bed-1');
    expect(group).toMatchObject({
      lifecycle: 'planned',
      wateringStage: 'establishing',
      wateringStageSource: 'lifecycleFallback',
    });
    expect(
      group.instances.every((instance) => Number.isFinite(instance.xFt)),
    ).toBe(true);
  });

  it('moves group and instances together on the saved feet grid', () => {
    const plan = createPlanWithGroup();
    const original = plan.plantings[0]!;
    const moved = movePlantingGroup(plan, original.id, {
      xFt: 7.13,
      yFt: 4.12,
    });
    const next = moved.plantings[0]!;

    expect(next.xFt).toBe(7.125);
    expect(next.yFt).toBe(4.125);
    expect(next.instances[0]!.xFt - original.instances[0]!.xFt).toBeCloseTo(
      next.xFt - original.xFt,
    );
  });

  it('reports overlapping crop groups and refuses to ignore blocking issues', () => {
    const plan = createPlanWithGroup();
    plan.plantings.push({
      ...structuredClone(plan.plantings[0]!),
      id: 'other',
    });
    const issue = findPlanIssues(plan).find(
      (candidate) => candidate.type === 'overlap',
    );
    expect(issue).toBeDefined();

    const ignored = recordReviewDecision(
      plan,
      issue!.id,
      'ignored',
      new Date('2026-07-09T12:00:00.000Z'),
    );
    expect(ignored).toBe(plan);
    expect(ignored.reviewDecisions).toEqual([]);
  });

  it('retains restorable review decisions for non-blocking issues', () => {
    const plan = createPlanWithGroup();
    plan.plantings[0]!.growingAreaStructureId = null;
    const issue = findPlanIssues(plan).find(
      (candidate) => candidate.type === 'placement',
    );

    const ignored = recordReviewDecision(
      plan,
      issue!.id,
      'ignored',
      new Date('2026-07-09T12:00:00.000Z'),
    );
    expect(ignored.reviewDecisions[0]?.decision).toBe('ignored');
    expect(restoreReviewIssue(ignored, issue!.id).reviewDecisions).toEqual([]);
  });

  it('previews layout changes without mutating until applied', () => {
    const plan = createPlanWithGroup();
    plan.plantings[0]!.xFt = 10;
    plan.plantings[0]!.yFt = 7;
    const proposal = createLayoutProposal(plan);

    expect(proposal.changes).toHaveLength(1);
    expect(plan.plantings[0]?.xFt).toBe(10);
    const applied = applyLayoutProposal(plan, proposal);
    expect(applied.plantings[0]?.xFt).not.toBe(10);
    expect(
      findPlanIssues(applied).filter(
        (issue) =>
          issue.severity === 'blocking' &&
          ['bounds', 'overlap', 'placement'].includes(issue.type),
      ),
    ).toEqual([]);
  });

  it('uses rotated growing-area geometry when reviewing placement', () => {
    const plan = createPlanWithGroup();
    plan.structures[0] = {
      ...bed,
      depthFt: 2,
      rotationDegrees: 90,
      widthFt: 6,
      xFt: 4,
      yFt: 2,
    };
    plan.plantings[0] = {
      ...plan.plantings[0]!,
      depthFt: 1,
      widthFt: 1,
      xFt: 7,
      yFt: 5,
    };

    expect(
      findPlanIssues(plan).find((issue) =>
        issue.id.startsWith('placement-bounds'),
      ),
    ).toBeUndefined();
  });

  it('skips rotated areas and withholds unsafe layout proposals', () => {
    const rotated = createPlanWithGroup();
    rotated.structures[0] = {
      ...rotated.structures[0]!,
      rotationDegrees: 45,
    };
    rotated.plantings[0]!.xFt = 10;
    expect(createLayoutProposal(rotated).changes).toEqual([]);

    const crowded = createPlanWithGroup();
    crowded.structures[0] = { ...bed, depthFt: 2, widthFt: 2 };
    const first = {
      ...crowded.plantings[0]!,
      depthFt: 2,
      widthFt: 2,
      xFt: 5,
      yFt: 5,
    };
    crowded.plantings = [
      first,
      { ...structuredClone(first), id: 'second-group', xFt: 6 },
    ];

    const proposal = createLayoutProposal(crowded);
    expect(proposal.changes).toEqual([]);
    expect(proposal.summary).toMatch(/no safe geometry-only move/i);
  });

  it('blocks publishing when weather coordinates and timezone are not coherent', () => {
    const plan = createPlanWithGroup();
    plan.plot.location.coordinates = null;

    expect(findPlanIssues(plan)).toContainEqual(
      expect.objectContaining({
        severity: 'blocking',
        type: 'environment',
      }),
    );
  });
});

function createPlanWithGroup() {
  const plan = createEmptyGardenPlan(new Date('2026-07-09T12:00:00.000Z'));
  plan.plot.location = {
    coordinates: { latitude: 42.3314, longitude: -83.0458 },
    label: 'Back garden',
    query: 'Detroit, MI',
    timezone: 'America/Detroit',
  };
  plan.structures = [bed];
  plan.plantings = [
    createPlantingGroup({
      arrangement: 'row',
      crop: {
        cropId: 'carrot',
        cropName: 'Carrot',
        rootDepthInches: 12,
        spacingInches: 4,
        sun: 'fullSun',
        weeklyWaterInches: 0.8,
      },
      id: 'carrot-group',
      quantity: 3,
      structure: bed,
    }),
  ];
  return plan;
}
