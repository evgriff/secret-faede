import {
  getDerivedPlantingDimensions,
  type CropProfile,
  type GardenPlant,
  type PlantStatus,
  type PlantStatusPhoto,
  type PlantSupportPlan,
  type PlantSupportType,
} from '../../../domain/gardens/GardenRepository';
import { PlantingArrangementEditor } from '../../garden/PlantingArrangementEditor';
import type { PlanWarning } from '../../garden/gardenPlanning';
import { toPlantingArrangementUpdate } from '../plantingArrangementUpdates';
import {
  createPictureSlot,
  formatSupportType,
  supportTypes,
} from './PlantEditorSheetShared';
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
  function updateSpacingOverride(value: string) {
    const trimmed = value.trim();
    const spacingInches = trimmed ? Math.max(Number(trimmed) || 1, 1) : null;

    onUpdatePlanting(plant.id, {
      ...getDerivedPlantingDimensions({
        ...plant,
        quantity,
        spacingInches,
      }),
      spacingInches,
    });
  }

  return (
    <section className={styles.section} aria-labelledby="plant-placement">
      <h3 id="plant-placement">Quantity and spacing</h3>
      <PlantingArrangementEditor
        crop={crop}
        mode={plant.mode}
        onChange={(values) =>
          onUpdatePlanting(plant.id, toPlantingArrangementUpdate(plant, values))
        }
        planWarnings={warnings}
        plantCount={quantity}
        showQuantity
        values={{
          blockDepthFt: plant.blockDepthFt,
          blockWidthFt: plant.blockWidthFt,
          clusterRadiusFt: plant.clusterRadiusFt,
          rowLengthFt: plant.rowLengthFt,
        }}
      />
      <details className={styles.details}>
        <summary>Spacing override</summary>
        <label className={styles.field}>
          <span>Spacing override in inches</span>
          <input
            aria-label="Spacing override in inches"
            inputMode="decimal"
            min="1"
            onChange={(event) =>
              updateSpacingOverride(event.currentTarget.value)
            }
            placeholder={
              crop?.spacingInches ? `${crop.spacingInches}` : 'Catalog spacing'
            }
            step="0.5"
            type="number"
            value={plant.spacingInches ?? ''}
          />
        </label>
      </details>
    </section>
  );
}

export function PlantEditorSupport({
  onUpdatePlanting,
  plant,
  quantity,
}: {
  onUpdatePlanting: UpdatePlanting;
  plant: GardenPlant;
  quantity: number;
}) {
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

  return (
    <section className={styles.section} aria-labelledby="plant-support">
      <h3 id="plant-support">Supports</h3>
      <div className={styles.twoColumn}>
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

export function PlantEditorPhotos({
  onUpdatePlanting,
  plant,
  plantStatus,
}: {
  onUpdatePlanting: UpdatePlanting;
  plant: GardenPlant;
  plantStatus: PlantStatus;
}) {
  function updatePhotos(photos: PlantStatus['photos']) {
    onUpdatePlanting(plant.id, {
      plantStatus: {
        ...plantStatus,
        photos,
      },
    });
  }

  return (
    <details className={styles.details}>
      <summary>Picture metadata</summary>
      {plantStatus.photos.length > 0 ? (
        <ul className={styles.photoList}>
          {plantStatus.photos.map((photo) => (
            <li key={photo.id}>
              <PhotoMetadataField
                onChange={(values) =>
                  updatePhotos(
                    plantStatus.photos.map((currentPhoto) =>
                      currentPhoto.id === photo.id
                        ? { ...currentPhoto, ...values }
                        : currentPhoto,
                    ),
                  )
                }
                photo={photo}
              />
              <button
                onClick={() =>
                  updatePhotos(
                    plantStatus.photos.filter(
                      (currentPhoto) => currentPhoto.id !== photo.id,
                    ),
                  )
                }
                type="button"
              >
                Clear
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>
          Keep a slot ready for a field photo without starting an upload.
        </p>
      )}
      <button
        className={styles.secondaryButton}
        onClick={() =>
          updatePhotos([
            ...plantStatus.photos,
            createPictureSlot(plant.id, plantStatus.photos.length + 1),
          ])
        }
        type="button"
      >
        Reserve picture slot
      </button>
    </details>
  );
}

function PhotoMetadataField({
  onChange,
  photo,
}: {
  onChange(values: Partial<PlantStatusPhoto>): void;
  photo: PlantStatusPhoto;
}) {
  return (
    <div className={styles.photoMeta}>
      <label className={styles.field}>
        <span>Picture label</span>
        <input
          onChange={(event) =>
            onChange({ fileName: event.currentTarget.value })
          }
          value={photo.fileName}
        />
      </label>
      <span className={styles.muted}>
        {photo.uploadedAtIso ? 'Attached photo' : 'Metadata slot only'}
      </span>
    </div>
  );
}
