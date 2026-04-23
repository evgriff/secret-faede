import type {
  GardenPlant,
  PlantingLifecycleStatus,
  PlantStatus,
} from '../../../domain/gardens/GardenRepository';
import { formatLifecycle, lifecycleStates } from './PlantEditorSheetShared';
import styles from './PlantEditorSheet.module.css';

type UpdatePlanting = (id: string, values: Partial<GardenPlant>) => void;

export function PlantEditorBasics({
  onUpdatePlanting,
  plant,
  plantStatus,
}: {
  onUpdatePlanting: UpdatePlanting;
  plant: GardenPlant;
  plantStatus: PlantStatus;
}) {
  function updateStatus(values: Partial<PlantStatus>) {
    onUpdatePlanting(plant.id, {
      plantStatus: {
        ...plantStatus,
        ...values,
      },
    });
  }

  function updateLifecycle(lifecycle: PlantingLifecycleStatus) {
    onUpdatePlanting(plant.id, {
      plantStatus: {
        ...plantStatus,
        lifecycle,
      },
      status: lifecycle,
    });
  }

  function updateNotes(notes: string) {
    onUpdatePlanting(plant.id, {
      notes,
      plantStatus: {
        ...plantStatus,
        notes,
      },
    });
  }

  return (
    <section className={styles.section} aria-labelledby="plant-basics">
      <h3 id="plant-basics">Care log</h3>
      <div className={styles.checkGrid}>
        <label className={styles.checkbox}>
          <input
            checked={plantStatus.watered}
            onChange={(event) =>
              updateStatus({
                watered: event.currentTarget.checked,
                wateredAtIso: event.currentTarget.checked
                  ? (plantStatus.wateredAtIso ?? new Date().toISOString())
                  : null,
              })
            }
            type="checkbox"
          />
          Watered
        </label>
        <label className={styles.checkbox}>
          <input
            checked={plantStatus.thinned}
            onChange={(event) =>
              updateStatus({
                thinned: event.currentTarget.checked,
                thinnedAtIso: event.currentTarget.checked
                  ? (plantStatus.thinnedAtIso ?? new Date().toISOString())
                  : null,
              })
            }
            type="checkbox"
          />
          Thinned
        </label>
      </div>
      <label className={styles.field}>
        <span>Notes</span>
        <textarea
          onChange={(event) => updateNotes(event.currentTarget.value)}
          rows={3}
          value={plant.notes}
        />
      </label>
      <details className={styles.details}>
        <summary>Advanced care state</summary>
        <div className={styles.twoColumn}>
          <label className={styles.field}>
            <span>Name</span>
            <input
              onChange={(event) =>
                onUpdatePlanting(plant.id, { label: event.currentTarget.value })
              }
              value={plant.label}
            />
          </label>
          <label className={styles.field}>
            <span>Lifecycle</span>
            <select
              onChange={(event) =>
                updateLifecycle(
                  event.currentTarget.value as PlantingLifecycleStatus,
                )
              }
              value={plant.status}
            >
              {lifecycleStates.map((status) => (
                <option key={status} value={status}>
                  {formatLifecycle(status)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Planned for</span>
            <input
              onChange={(event) =>
                onUpdatePlanting(plant.id, {
                  plannedFor: event.currentTarget.value || null,
                })
              }
              type="date"
              value={plant.plannedFor ?? ''}
            />
          </label>
          <label className={styles.field}>
            <span>Planted on</span>
            <input
              onChange={(event) =>
                onUpdatePlanting(plant.id, {
                  plantedOn: event.currentTarget.value || null,
                })
              }
              type="date"
              value={plant.plantedOn ?? ''}
            />
          </label>
          <label className={styles.checkbox}>
            <input
              checked={plant.mulched}
              onChange={(event) =>
                onUpdatePlanting(plant.id, {
                  mulched: event.currentTarget.checked,
                })
              }
              type="checkbox"
            />
            Mulched
          </label>
        </div>
      </details>
    </section>
  );
}
