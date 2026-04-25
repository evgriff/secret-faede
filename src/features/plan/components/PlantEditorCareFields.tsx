import { useEffect, useState } from 'react';

import {
  appendPlantingEvent,
  formatPlantingEventLabel,
  type GardenPlant,
  type PlantingEventType,
  type PlantingLifecycleStatus,
  type PlantStatus,
} from '../../../domain/gardens/GardenRepository';
import { formatDateForTimeZone } from '../planDates';
import { formatLifecycle, lifecycleStates } from './PlantEditorSheetShared';
import styles from './PlantEditorSheet.module.css';

type UpdatePlanting = (id: string, values: Partial<GardenPlant>) => void;

export function PlantEditorBasics({
  onUpdatePlanting,
  plant,
  plantStatus,
  timezone,
}: {
  onUpdatePlanting: UpdatePlanting;
  plant: GardenPlant;
  plantStatus: PlantStatus;
  timezone: string;
}) {
  const [eventDate, setEventDate] = useState(() =>
    formatDateForTimeZone(new Date(), timezone),
  );

  useEffect(() => {
    setEventDate(formatDateForTimeZone(new Date(), timezone));
  }, [plant.id, timezone]);

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

  function recordEvent(type: PlantingEventType) {
    const nextPlanting = appendPlantingEvent(plant, {
      nowIso: new Date().toISOString(),
      occurredOn: eventDate,
      type,
    });

    onUpdatePlanting(plant.id, {
      plannedFor: nextPlanting.plannedFor,
      plantedOn: nextPlanting.plantedOn,
      plantingEvents: nextPlanting.plantingEvents,
      plantStatus: nextPlanting.plantStatus,
      status: nextPlanting.status,
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
      </div>
      <div className={styles.eventPanel}>
        <div className={styles.eventHeader}>
          <strong>Planting events</strong>
          <span>Record the actual date for work you finished.</span>
        </div>
        <label className={styles.field}>
          <span>Event date</span>
          <input
            onChange={(event) => setEventDate(event.currentTarget.value)}
            type="date"
            value={eventDate}
          />
        </label>
        <div className={styles.eventButtons}>
          {(
            [
              'startedInside',
              'directSowed',
              'plantedOut',
              'thinned',
            ] as const satisfies PlantingEventType[]
          ).map((eventType) => (
            <button
              className={styles.secondaryButton}
              key={eventType}
              onClick={() => recordEvent(eventType)}
              type="button"
            >
              {formatPlantingEventLabel(eventType)}
            </button>
          ))}
        </div>
        <ul aria-label="Recent planting events" className={styles.eventHistory}>
          {plant.plantingEvents.length > 0 ? (
            plant.plantingEvents.slice(0, 4).map((event) => (
              <li key={event.id}>
                <strong>{formatPlantingEventLabel(event.type)}</strong>
                <span>{event.occurredOn}</span>
              </li>
            ))
          ) : (
            <li>
              <span>No planting events recorded yet.</span>
            </li>
          )}
        </ul>
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
