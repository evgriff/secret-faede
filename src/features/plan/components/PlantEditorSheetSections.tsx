import {
  getCropSupportProfile,
  type CropProfile,
  type Garden,
  type GardenPlant,
  type PlantSupportPlan,
  type PlantSupportType,
  type Structure,
} from '../../../domain/gardens/GardenRepository';
import { PlantingArrangementEditor } from '../../garden/PlantingArrangementEditor';
import {
  getPlantingFootprint,
  getStructureFootprint,
  type PlanWarning,
} from '../../garden/gardenPlanning';
import { rectDistanceFt } from '../../garden/gardenPlanningGeometry';
import { toPlantingArrangementUpdate } from '../plantingArrangementUpdates';
import { formatSupportType, supportTypes } from './PlantEditorSheetShared';
import styles from './PlantEditorSheet.module.css';

type UpdatePlanting = (id: string, values: Partial<GardenPlant>) => void;

export function PlantEditorArrangement({
  crop,
  onUpdatePlanting,
  plant,
  quantity,
  warnings,
}: {
  crop: CropProfile | null;
  onUpdatePlanting: UpdatePlanting;
  plant: GardenPlant;
  quantity: number;
  warnings: PlanWarning[];
}) {
  return (
    <section className={styles.section} aria-label="Recommended placing">
      <PlantingArrangementEditor
        crop={crop}
        mode={plant.mode}
        onChange={(values) =>
          onUpdatePlanting(plant.id, toPlantingArrangementUpdate(plant, values))
        }
        planWarnings={warnings}
        plantCount={quantity}
        spacingInches={plant.spacingInches}
        spacingMode="plantSpacingInches"
        showQuantity
        values={{
          blockDepthFt: plant.blockDepthFt,
          blockWidthFt: plant.blockWidthFt,
          clusterRadiusFt: plant.clusterRadiusFt,
          rowLengthFt: plant.rowLengthFt,
        }}
      />
    </section>
  );
}

export function PlantEditorSupport({
  crop,
  garden,
  onAddLinkedSupportStructure,
  onLinkSupportStructure,
  onUnlinkSupportStructure,
  onUpdatePlanting,
  plant,
  quantity,
}: {
  crop: CropProfile | null;
  garden: Garden;
  onAddLinkedSupportStructure(plantingId: string): void;
  onLinkSupportStructure(plantingId: string, structureId: string): void;
  onUnlinkSupportStructure(plantingId: string, structureId: string): void;
  onUpdatePlanting: UpdatePlanting;
  plant: GardenPlant;
  quantity: number;
}) {
  const supportProfile = crop ? getCropSupportProfile(crop) : null;
  const linkedTrellises = getLinkedTrellises(garden, plant);
  const nearbyTrellises = getNearbyTrellises(garden, plant).filter(
    (structure) => !plant.supportStructureIds.includes(structure.id),
  );

  function updateSupport(values: Partial<PlantSupportPlan>) {
    const type = values.type ?? plant.support.type;
    const support: PlantSupportPlan =
      type === 'none'
        ? {
            installedAtIso: null,
            notes: '',
            perPlant: false,
            quantity: 0,
            required: false,
            type,
          }
        : {
            ...plant.support,
            ...values,
            quantity: Math.max(
              Math.round(
                values.quantity ??
                  ((values.perPlant ?? plant.support.perPlant)
                    ? quantity
                    : plant.support.quantity || 1),
              ),
              1,
            ),
            type,
          };

    onUpdatePlanting(plant.id, { support });
  }

  if (
    supportProfile?.scope === 'structure' &&
    supportProfile.kind === 'trellis'
  ) {
    return (
      <section className={styles.section} aria-labelledby="plant-support">
        <h3 id="plant-support">Supports</h3>
        <dl className={styles.grid}>
          <div>
            <dt>Need</dt>
            <dd>{supportProfile.label}</dd>
          </div>
          <div>
            <dt>Linked</dt>
            <dd>
              {linkedTrellises.length > 0
                ? linkedTrellises.map((trellis) => trellis.label).join(', ')
                : 'No linked trellis'}
            </dd>
          </div>
        </dl>
        <div className={styles.eventButtons}>
          <button
            className={styles.secondaryButton}
            onClick={() => onAddLinkedSupportStructure(plant.id)}
            type="button"
          >
            Add linked trellis
          </button>
          {linkedTrellises.map((trellis) => (
            <button
              className={styles.secondaryButton}
              key={trellis.id}
              onClick={() => onUnlinkSupportStructure(plant.id, trellis.id)}
              type="button"
            >
              Unlink {trellis.label}
            </button>
          ))}
        </div>
        {nearbyTrellises.length > 0 ? (
          <div className={styles.eventButtons}>
            {nearbyTrellises.map((trellis) => (
              <button
                className={styles.secondaryButton}
                key={trellis.id}
                onClick={() => onLinkSupportStructure(plant.id, trellis.id)}
                type="button"
              >
                Link {trellis.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="plant-support">
      <h3 id="plant-support">Supports</h3>
      <div className={styles.twoColumn}>
        {supportProfile?.scope === 'plant' ? (
          <label className={styles.field}>
            <span>Catalog need</span>
            <input readOnly value={supportProfile.label} />
          </label>
        ) : null}
        <label className={styles.field}>
          <span>Support type</span>
          <select
            onChange={(event) =>
              updateSupport({
                type: event.currentTarget.value as PlantSupportType,
              })
            }
            value={plant.support.type}
          >
            {supportTypes.map((type) => (
              <option key={type} value={type}>
                {formatSupportType(type)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Quantity</span>
          <input
            disabled={plant.support.type === 'none'}
            inputMode="numeric"
            min="0"
            onChange={(event) =>
              updateSupport({ quantity: Number(event.currentTarget.value) })
            }
            step="1"
            type="number"
            value={plant.support.quantity}
          />
        </label>
      </div>
      <div className={styles.checkGrid}>
        <label className={styles.checkbox}>
          <input
            checked={plant.support.perPlant}
            disabled={plant.support.type === 'none'}
            onChange={(event) =>
              updateSupport({ perPlant: event.currentTarget.checked })
            }
            type="checkbox"
          />
          One per plant
        </label>
        <label className={styles.checkbox}>
          <input
            checked={plant.support.required}
            disabled={plant.support.type === 'none'}
            onChange={(event) =>
              updateSupport({ required: event.currentTarget.checked })
            }
            type="checkbox"
          />
          Required
        </label>
        <label className={styles.checkbox}>
          <input
            checked={Boolean(plant.support.installedAtIso)}
            disabled={plant.support.type === 'none'}
            onChange={(event) =>
              updateSupport({
                installedAtIso: event.currentTarget.checked
                  ? (plant.support.installedAtIso ?? new Date().toISOString())
                  : null,
              })
            }
            type="checkbox"
          />
          Installed
        </label>
      </div>
      <label className={styles.field}>
        <span>Support notes</span>
        <input
          disabled={plant.support.type === 'none'}
          onChange={(event) =>
            updateSupport({ notes: event.currentTarget.value })
          }
          value={plant.support.notes}
        />
      </label>
    </section>
  );
}

function getLinkedTrellises(garden: Garden, plant: GardenPlant): Structure[] {
  if (plant.supportStructureIds.length === 0) {
    return [];
  }

  const linkedIds = new Set(plant.supportStructureIds);

  return garden.structures.filter(
    (structure) => structure.type === 'trellis' && linkedIds.has(structure.id),
  );
}

function getNearbyTrellises(garden: Garden, plant: GardenPlant): Structure[] {
  const footprint = getPlantingFootprint(plant);

  return garden.structures.filter(
    (structure) =>
      structure.type === 'trellis' &&
      rectDistanceFt(footprint, getStructureFootprint(structure)) <= 1.25,
  );
}
