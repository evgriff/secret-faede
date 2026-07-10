import { describe, expect, it } from 'vitest';

import type { GardenStructure, PlantingGroup } from '../domain';
import { createEmptyGardenPlan } from './defaultPlan';
import { validateGardenPlan } from './planValidation';

describe('v2 garden plan validation', () => {
  it('accepts the empty canonical plan', () => {
    expect(validateGardenPlan(createEmptyGardenPlan())).toEqual([]);
  });

  it('rejects invalid coordinates instead of coercing blanks to zero', () => {
    const plan = createEmptyGardenPlan();
    plan.plot.location.coordinates = { latitude: 91, longitude: -181 };

    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'plot.location.latitude' }),
        expect.objectContaining({ field: 'plot.location.longitude' }),
      ]),
    );
  });

  it('requires a deliberate crop selection and a valid growing area', () => {
    const plan = createEmptyGardenPlan();
    plan.plantings.push({
      ...planting(),
      cropId: '',
      cropName: '',
      growingAreaStructureId: 'missing-bed',
      instances: [],
    });

    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'plantings.planting-1.cropId' }),
        expect.objectContaining({
          field: 'plantings.planting-1.growingAreaStructureId',
        }),
      ]),
    );
  });

  it('requires setup state and nonempty plan, structure, and instance identities', () => {
    const plan = createEmptyGardenPlan();
    plan.id = '';
    plan.setupCompleted = undefined as unknown as boolean;
    plan.structures.push({ ...bed(), id: '', label: '' });
    plan.plantings.push({
      ...planting(),
      instances: [{ id: '', label: '', xFt: 3, yFt: 3 }],
    });

    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'id' }),
        expect.objectContaining({ field: 'setupCompleted' }),
        expect.objectContaining({ field: 'structures..id' }),
        expect.objectContaining({ field: 'structures..label' }),
        expect.objectContaining({
          field: 'plantings.planting-1.instances..id',
        }),
        expect.objectContaining({
          field: 'plantings.planting-1.instances..label',
        }),
      ]),
    );
  });

  it('rejects group footprints and instances outside plot or group bounds', () => {
    const plan = createEmptyGardenPlan();
    plan.structures.push({ ...bed(), xFt: 0, yFt: 0 });
    plan.plantings.push({
      ...planting(),
      instances: [{ id: 'plant-1', label: 'Tomato 1', xFt: 8, yFt: 3 }],
      widthFt: 4,
      xFt: 0.5,
    });

    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'plantings.planting-1.xFt' }),
        expect.objectContaining({
          field: 'plantings.planting-1.instances.plant-1',
        }),
      ]),
    );
  });

  it('requires a growing structure that contains the full planting footprint', () => {
    const plan = createEmptyGardenPlan();
    plan.structures.push({ ...bed(), type: 'path' });
    plan.plantings.push(planting());

    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'plantings.planting-1.growingAreaStructureId',
          message: expect.stringMatching(/not a bed or container/i),
        }),
      ]),
    );

    plan.structures[0] = { ...bed(), widthFt: 0.5 };
    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'plantings.planting-1.growingAreaStructureId',
          message: expect.stringMatching(/full planting footprint/i),
        }),
      ]),
    );
  });

  it('validates rotated structure bounds and rotated growing-area containment', () => {
    const plan = createEmptyGardenPlan();
    plan.structures.push({
      ...bed(),
      rotationDegrees: 45,
      xFt: 0,
      yFt: 0,
    });
    plan.plantings.push(planting());

    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'structures.bed-1',
          message: expect.stringMatching(/rotated structure footprint/i),
        }),
        expect.objectContaining({
          field: 'plantings.planting-1.growingAreaStructureId',
        }),
      ]),
    );

    plan.structures[0] = { ...bed(), rotationDegrees: 360 };
    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'structures.bed-1.rotationDegrees',
        }),
      ]),
    );
  });

  it('rejects unsafe deterministic watering profile inputs', () => {
    const plan = createEmptyGardenPlan();
    plan.structures.push(bed());
    plan.plantings.push({
      ...planting(),
      waterProfile: {
        ...planting().waterProfile,
        baseWeeklyInches: Number.NaN,
        confidence: 'unknown' as PlantingGroup['waterProfile']['confidence'],
        depletionFraction: 1.5,
        rootDepthInches: 0,
        source: 'api' as PlantingGroup['waterProfile']['source'],
        sourceVersion: '',
        stageCoefficients: {
          establishing: 0,
          flowering: 1,
          fruiting: 4,
          mature: 1,
        },
      },
    });

    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'plantings.planting-1.waterProfile.baseWeeklyInches',
        }),
        expect.objectContaining({
          field: 'plantings.planting-1.waterProfile.rootDepthInches',
        }),
        expect.objectContaining({
          field: 'plantings.planting-1.waterProfile.depletionFraction',
        }),
        expect.objectContaining({
          field: 'plantings.planting-1.waterProfile.confidence',
        }),
        expect.objectContaining({
          field: 'plantings.planting-1.waterProfile.source',
        }),
        expect.objectContaining({
          field: 'plantings.planting-1.waterProfile.sourceVersion',
        }),
      ]),
    );
  });

  it('requires a valid watering stage with honest lifecycle provenance', () => {
    const plan = createEmptyGardenPlan();
    plan.structures.push(bed());
    plan.plantings.push({
      ...planting(),
      wateringStage: 'flowering',
      wateringStageSource: 'lifecycleFallback',
    });

    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'plantings.planting-1.wateringStage',
          message: expect.stringMatching(/does not match lifecycle/i),
        }),
      ]),
    );

    plan.plantings[0] = {
      ...planting(),
      wateringStage: 'invalid' as PlantingGroup['wateringStage'],
      wateringStageSource: 'unknown' as PlantingGroup['wateringStageSource'],
    };
    expect(validateGardenPlan(plan)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'plantings.planting-1.wateringStage',
        }),
        expect.objectContaining({
          field: 'plantings.planting-1.wateringStageSource',
        }),
      ]),
    );
  });
});

function bed(): GardenStructure {
  return {
    depthFt: 4,
    drainage: 'moderate',
    id: 'bed-1',
    irrigationZoneId: null,
    label: 'Raised bed',
    locked: false,
    mulched: false,
    notes: '',
    rotationDegrees: 0,
    soilDepthInches: 18,
    soilType: 'loam',
    type: 'raisedBed',
    widthFt: 4,
    xFt: 1,
    yFt: 1,
  };
}

function planting(): PlantingGroup {
  return {
    arrangement: 'single',
    cropId: 'tomato',
    cropName: 'Tomato',
    depthFt: 1,
    growingAreaStructureId: 'bed-1',
    id: 'planting-1',
    instances: [{ id: 'plant-1', label: 'Tomato 1', xFt: 3, yFt: 3 }],
    irrigationZoneId: null,
    lifecycle: 'planned',
    locked: false,
    mulched: false,
    notes: '',
    plantedOn: null,
    plannedFor: null,
    spacingInches: 12,
    sun: 'fullSun',
    waterProfile: {
      baseWeeklyInches: 1,
      confidence: 'medium',
      depletionFraction: 0.45,
      rootDepthInches: 18,
      source: 'catalog',
      sourceVersion: 'test-v1',
      stageCoefficients: {
        establishing: 1.2,
        flowering: 1,
        fruiting: 1.1,
        mature: 1,
      },
    },
    wateringStage: 'establishing',
    wateringStageSource: 'lifecycleFallback',
    widthFt: 1,
    xFt: 3,
    yFt: 3,
  };
}
