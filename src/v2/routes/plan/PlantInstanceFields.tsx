import type { GardenPlan, PlantingGroup } from '../../domain';
import { TextField } from '../../ui';
import styles from './PlanInspector.module.css';

export function PlantInstanceFields({
  group,
  onUpdate,
  plan,
}: {
  group: PlantingGroup;
  onUpdate(group: PlantingGroup): void;
  plan: GardenPlan;
}) {
  const bounds = {
    maxX: Math.min(plan.plot.widthFt, group.xFt + group.widthFt / 2),
    maxY: Math.min(plan.plot.depthFt, group.yFt + group.depthFt / 2),
    minX: Math.max(0, group.xFt - group.widthFt / 2),
    minY: Math.max(0, group.yFt - group.depthFt / 2),
  };

  return (
    <details className={styles.instanceEditor}>
      <summary>
        Edit {group.instances.length} individual plant position
        {group.instances.length === 1 ? '' : 's'}
      </summary>
      <p className={styles.hint}>
        Coordinates are feet from the plot’s left and top edges. Each point must
        remain inside this crop group’s saved footprint.
      </p>
      <div className={styles.instanceList}>
        {group.instances.map((instance, index) => {
          const xError = coordinateError(
            instance.xFt,
            bounds.minX,
            bounds.maxX,
          );
          const yError = coordinateError(
            instance.yFt,
            bounds.minY,
            bounds.maxY,
          );
          const name = instance.label.trim() || `Plant ${index + 1}`;
          return (
            <section className={styles.instanceRow} key={instance.id}>
              <h4>{name}</h4>
              <div className={styles.formGrid}>
                <TextField
                  disabled={group.locked}
                  error={xError}
                  label={`${name} X in feet`}
                  max={bounds.maxX}
                  min={bounds.minX}
                  onChange={(event) =>
                    updateCoordinate(
                      instance.id,
                      'xFt',
                      event.currentTarget.valueAsNumber,
                      bounds.minX,
                      bounds.maxX,
                    )
                  }
                  step={0.001}
                  type="number"
                  value={instance.xFt}
                />
                <TextField
                  disabled={group.locked}
                  error={yError}
                  label={`${name} Y in feet`}
                  max={bounds.maxY}
                  min={bounds.minY}
                  onChange={(event) =>
                    updateCoordinate(
                      instance.id,
                      'yFt',
                      event.currentTarget.valueAsNumber,
                      bounds.minY,
                      bounds.maxY,
                    )
                  }
                  step={0.001}
                  type="number"
                  value={instance.yFt}
                />
              </div>
            </section>
          );
        })}
      </div>
    </details>
  );

  function updateCoordinate(
    instanceId: string,
    field: 'xFt' | 'yFt',
    value: number,
    minimum: number,
    maximum: number,
  ) {
    if (
      group.locked ||
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum
    )
      return;
    onUpdate({
      ...group,
      instances: group.instances.map((instance) =>
        instance.id === instanceId ? { ...instance, [field]: value } : instance,
      ),
    });
  }
}

function coordinateError(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum
    ? null
    : `Use ${minimum.toFixed(3)} through ${maximum.toFixed(3)} feet.`;
}
