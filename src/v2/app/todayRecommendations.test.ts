import { createEmptyGardenPlan } from '../data';
import { transitionPlantingLifecycle, type GardenStructure } from '../domain';
import { createPlantingGroup } from '../routes/plan';
import { createDefaultProfile } from './services';
import { recommendationsForToday } from './todayRecommendations';

const nowIso = '2026-07-09T12:00:00.000Z';
const revisionId = 'revision-9';
const bed: GardenStructure = {
  depthFt: 4,
  drainage: 'moderate',
  id: 'bed-main',
  irrigationZoneId: null,
  label: 'Main bed',
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

describe('Today recommendation integration', () => {
  it('creates a separate safe recommendation for every active crop group', () => {
    const plan = planWithCrops();
    const profile = createDefaultProfile('gardener', {}, new Date(nowIso));
    profile.timezone = 'UTC';

    const recommendations = recommendationsForToday(
      plan,
      profile,
      [],
      nowIso,
      revisionId,
    );

    expect(recommendations).toHaveLength(2);
    expect(recommendations.map((item) => item.target.cropGroupId)).toEqual([
      'tomato-group',
      'lettuce-group',
    ]);
    expect(
      recommendations.every(
        (item) =>
          item.status === 'checkSoil' &&
          item.reasonCodes.includes('MISSING_BALANCE_BASELINE') &&
          item.target.plantingIds.length === 1,
      ),
    ).toBe(true);
    expect(recommendations.map((item) => item.basis.cropProfile.stage)).toEqual(
      ['mature', 'mature'],
    );
  });

  it('uses each crop group saved stage and provenance in its fallback target', () => {
    const plan = planWithCrops();
    plan.plantings[0] = {
      ...plan.plantings[0]!,
      wateringStage: 'flowering',
      wateringStageSource: 'manual',
    };
    const profile = createDefaultProfile('gardener', {}, new Date(nowIso));

    const recommendations = recommendationsForToday(
      plan,
      profile,
      [],
      nowIso,
      revisionId,
    );

    expect(recommendations[0]?.basis.cropProfile).toMatchObject({
      stage: 'flowering',
      stageSource: 'manual',
    });
  });

  it('uses a fresh persisted recommendation only for its matching crop group', () => {
    const plan = planWithCrops();
    const profile = createDefaultProfile('gardener', {}, new Date(nowIso));
    profile.timezone = 'UTC';
    const first = recommendationsForToday(
      plan,
      profile,
      [],
      nowIso,
      revisionId,
    );
    const persistedTomato = {
      ...first[0]!,
      action: 'waterNow' as const,
      actionable: true,
      confidence: 'high' as const,
      dataQuality: 'fresh' as const,
      status: 'due' as const,
    };

    const recommendations = recommendationsForToday(
      plan,
      profile,
      [persistedTomato],
      nowIso,
      revisionId,
    );

    expect(recommendations[0]).toMatchObject({
      status: 'due',
      target: { cropGroupId: 'tomato-group' },
    });
    expect(recommendations[1]).toMatchObject({
      status: 'checkSoil',
      target: { cropGroupId: 'lettuce-group' },
    });
  });
});

function planWithCrops() {
  const plan = createEmptyGardenPlan(new Date(nowIso));
  plan.setupCompleted = true;
  plan.structures = [bed];
  plan.plantings = [
    createPlantingGroup({
      arrangement: 'single',
      crop: {
        cropId: 'tomato',
        cropName: 'Tomato',
        rootDepthInches: 24,
        spacingInches: 24,
        sun: 'fullSun',
        waterConfidence: 'high',
        weeklyWaterInches: 1.5,
      },
      id: 'tomato-group',
      quantity: 1,
      structure: bed,
    }),
    createPlantingGroup({
      arrangement: 'block',
      crop: {
        cropId: 'lettuce',
        cropName: 'Lettuce',
        rootDepthInches: 8,
        spacingInches: 8,
        sun: 'partShade',
        waterConfidence: 'medium',
        weeklyWaterInches: 1,
      },
      id: 'lettuce-group',
      quantity: 4,
      structure: bed,
    }),
  ].map((group) => transitionPlantingLifecycle(group, 'growing'));
  return plan;
}
