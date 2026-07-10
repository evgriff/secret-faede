import type { PlantingGroup, PlantingWateringStage } from '../../domain';
import {
  resetPlantingWateringStage,
  wateringStageForLifecycle,
} from '../../domain';
import { Button, TextField } from '../../ui';
import styles from './PlanInspector.module.css';

export function PlantingWaterFields({
  group,
  onUpdate,
}: {
  group: PlantingGroup;
  onUpdate(group: PlantingGroup): void;
}) {
  return (
    <section className={styles.waterCard}>
      <div>
        <p className={styles.eyebrow}>Water model input</p>
        <h3>Specific to this {group.cropName} group</h3>
      </div>
      <label className={styles.selectField}>
        <span>Watering stage</span>
        <select
          onChange={(event) =>
            onUpdate({
              ...group,
              wateringStage: event.currentTarget.value as PlantingWateringStage,
              wateringStageSource: 'manual',
            })
          }
          value={group.wateringStage}
        >
          <option value="establishing">Establishing</option>
          <option value="flowering">Flowering</option>
          <option value="fruiting">Fruiting</option>
          <option value="mature">Mature</option>
        </select>
      </label>
      <div className={styles.stageProvenance}>
        <p className={styles.hint}>{wateringStageSourceCopy(group)}</p>
        <Button
          disabled={
            group.wateringStageSource === 'lifecycleFallback' &&
            group.wateringStage === wateringStageForLifecycle(group.lifecycle)
          }
          onClick={() => onUpdate(resetPlantingWateringStage(group))}
          variant="quiet"
        >
          Reset stage from lifecycle
        </Button>
      </div>
      <div className={styles.formGrid}>
        <TextField
          hint="Crop baseline before weather, soil, mulch, stage, and recent watering."
          label="Weekly need (inches)"
          min={0.05}
          onChange={(event) => {
            const value = event.currentTarget.valueAsNumber;
            if (Number.isFinite(value)) {
              onUpdate({
                ...group,
                waterProfile: {
                  ...group.waterProfile,
                  baseWeeklyInches: value,
                  confidence: 'medium',
                  source: 'manual',
                  sourceVersion: 'manual-v1',
                },
              });
            }
          }}
          step={0.05}
          type="number"
          value={group.waterProfile.baseWeeklyInches}
        />
        <TextField
          label="Root depth (inches)"
          min={1}
          onChange={(event) => {
            const value = event.currentTarget.valueAsNumber;
            if (Number.isFinite(value)) {
              onUpdate({
                ...group,
                waterProfile: {
                  ...group.waterProfile,
                  confidence: 'medium',
                  rootDepthInches: value,
                  source: 'manual',
                  sourceVersion: 'manual-v1',
                },
              });
            }
          }}
          step={1}
          type="number"
          value={group.waterProfile.rootDepthInches}
        />
      </div>
      <p className={styles.hint}>
        Profile: {group.waterProfile.source} · {group.waterProfile.confidence}{' '}
        confidence. Editing one input never marks the whole profile as high
        confidence. Today calculates and notifies this crop group separately.
      </p>
    </section>
  );
}

function wateringStageSourceCopy(group: PlantingGroup) {
  if (group.wateringStageSource === 'manual') {
    return 'Stage source: manual observation. It stays selected when lifecycle changes.';
  }
  if (group.wateringStageSource === 'plantingEvent') {
    return 'Stage source: recorded planting event. It stays selected when lifecycle changes.';
  }
  return 'Stage source: lifecycle fallback. It updates when lifecycle changes.';
}
