import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  PlantingMode,
  SeasonCropSelection,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import {
  coercePlantQuantity,
  formatGlyph,
  getRecommendedPlantingMode,
  getCropIconTone,
  modeLabels,
} from '../../garden/cropPickerHelpers';
import {
  formatSeasonCropFitReasonGroup,
  formatSeasonCropPlanningState,
  needsSeasonCropReview,
} from '../seasonCropFitDisplay';
import {
  getSeasonCropFitSignal,
  type SeasonCropFitSignal,
  type SeasonCropLayoutRequest,
} from '../seasonCropPlan';
import styles from './ChoosePlantsBoard.module.css';

export function SeasonCropBoard({
  garden,
  layoutRequests,
  onMoveSelection,
  onRemoveSelection,
  onUpdateSelection,
  selections,
  sunExposureAtPlacement,
}: {
  garden: Garden;
  layoutRequests: SeasonCropLayoutRequest[];
  onMoveSelection(selectionId: string, delta: -1 | 1): void;
  onRemoveSelection(selectionId: string): void;
  onUpdateSelection(
    selectionId: string,
    values: Partial<SeasonCropSelection>,
  ): void;
  selections: SeasonCropSelection[];
  sunExposureAtPlacement: SunExposure | null;
}) {
  const fitBySelectionId = new Map(
    layoutRequests.map((request) => [
      getSelectionId(request.cropId, selections),
      request.fit,
    ]),
  );
  const plantCount = selections.reduce(
    (total, selection) => total + coercePlantQuantity(selection.quantity),
    0,
  );
  const reviewCount = layoutRequests.filter((request) =>
    needsSeasonCropReview(request.fit),
  ).length;

  return (
    <section className={styles.board} aria-label="Season crop board">
      <div className={styles.boardHeader}>
        <div>
          <span className={styles.kicker}>Season board</span>
          <h3>Wanted crops</h3>
        </div>
        <div className={styles.boardStats}>
          <span>{selections.length} selected</span>
          <span>
            {plantCount} {plantCount === 1 ? 'plant' : 'plants'}
          </span>
          <span>{reviewCount} need review</span>
        </div>
      </div>

      {selections.length > 0 ? (
        <div className={styles.boardList}>
          {selections.map((selection, index) => {
            const crop = getCropById(selection.cropId);

            return crop ? (
              <CropBoardItem
                crop={crop}
                fit={
                  fitBySelectionId.get(selection.id) ??
                  getSeasonCropFitSignal({
                    crop,
                    garden,
                    selection,
                    sunExposureAtPlacement,
                  })
                }
                isFirst={index === 0}
                isLast={index === selections.length - 1}
                key={selection.id}
                onMoveDown={() => onMoveSelection(selection.id, 1)}
                onMoveUp={() => onMoveSelection(selection.id, -1)}
                onRemove={() => onRemoveSelection(selection.id)}
                onUpdate={(values) => onUpdateSelection(selection.id, values)}
                selection={selection}
              />
            ) : null;
          })}
        </div>
      ) : (
        <p className={styles.emptyText}>No plants selected.</p>
      )}
    </section>
  );
}

function CropBoardItem({
  crop,
  fit,
  isFirst,
  isLast,
  onMoveDown,
  onMoveUp,
  onRemove,
  onUpdate,
  selection,
}: {
  crop: CropProfile;
  fit: SeasonCropFitSignal;
  isFirst: boolean;
  isLast: boolean;
  onMoveDown(): void;
  onMoveUp(): void;
  onRemove(): void;
  onUpdate(values: Partial<SeasonCropSelection>): void;
  selection: SeasonCropSelection;
}) {
  const recommendedMode = getRecommendedPlantingMode(crop, selection.quantity);
  const reviewReasons = fit.groupedReasons
    .filter((reason) => reason.severity !== 'notice')
    .slice(0, 2);
  const showReview = needsSeasonCropReview(fit);
  const reviewText =
    reviewReasons.length > 0
      ? reviewReasons
          .map(
            (reason) =>
              `${formatSeasonCropFitReasonGroup(reason.group)}: ${reason.label}`,
          )
          .join(' ')
      : (fit.uncertainty ?? fit.summary);
  const currentModeLabel = modeLabels[selection.plantingForm];
  const recommendedModeLabel = modeLabels[recommendedMode];
  const formText =
    selection.plantingForm === recommendedMode
      ? recommendedModeLabel
      : `${currentModeLabel} (recommended ${recommendedModeLabel})`;
  const showSupportOption = crop.trellisRequired || crop.trellisRecommended;

  function handleQuantityChange(value: string) {
    const nextQuantity = coercePlantQuantity(value);
    const nextRecommendedMode = getRecommendedPlantingMode(crop, nextQuantity);

    onUpdate({
      plantingForm:
        selection.plantingForm === recommendedMode
          ? nextRecommendedMode
          : selection.plantingForm,
      quantity: nextQuantity,
    });
  }

  return (
    <article className={styles.boardItem} data-fit-level={fit.level}>
      <div className={styles.boardItemHeader}>
        <span
          className={styles.cropGlyph}
          data-crop-tone={getCropIconTone(crop)}
          aria-hidden="true"
        >
          {formatGlyph(crop)}
        </span>
        <div>
          <h4>{crop.commonName}</h4>
          <span className={styles.itemMeta}>
            {selection.quantity} {selection.quantity === 1 ? 'plant' : 'plants'}{' '}
            - {formText}
          </span>
        </div>
        {showReview ? (
          <span className={styles.stateBadge} data-fit-level={fit.level}>
            {formatSeasonCropPlanningState(fit.level)}
          </span>
        ) : null}
        <div className={styles.rowActions}>
          <button
            aria-label={`Move ${crop.commonName} up`}
            className={styles.iconAction}
            disabled={isFirst}
            onClick={onMoveUp}
            type="button"
          >
            ↑
          </button>
          <button
            aria-label={`Move ${crop.commonName} down`}
            className={styles.iconAction}
            disabled={isLast}
            onClick={onMoveDown}
            type="button"
          >
            ↓
          </button>
          <button
            aria-label={`Remove ${crop.commonName}`}
            className={styles.iconAction}
            onClick={onRemove}
            type="button"
          >
            ×
          </button>
        </div>
      </div>

      <p className={styles.fitLine}>
        {showReview ? reviewText : 'Ready for layout.'}
      </p>

      <div className={styles.primaryGrid}>
        <label className={styles.compactField}>
          <span>How many plants?</span>
          <input
            inputMode="numeric"
            min="1"
            onChange={(event) =>
              handleQuantityChange(event.currentTarget.value)
            }
            step="1"
            type="number"
            value={selection.quantity}
          />
        </label>

        <div className={styles.formIntent}>
          <span>Recommended form</span>
          <strong>{formText}</strong>
        </div>
      </div>

      <label className={styles.notesField}>
        <span>Variety or notes</span>
        <input
          onChange={(event) => onUpdate({ notes: event.currentTarget.value })}
          placeholder="Cultivar, timing, or placement"
          type="text"
          value={selection.notes}
        />
      </label>

      <details className={styles.advancedFields}>
        <summary>More options</summary>
        <div className={styles.secondaryGrid}>
          <label className={styles.compactField}>
            <span>Planting form</span>
            <select
              onChange={(event) =>
                onUpdate({
                  plantingForm: event.currentTarget.value as PlantingMode,
                })
              }
              value={selection.plantingForm}
            >
              {crop.supportedPlantingModes.map((mode) => (
                <option key={mode} value={mode}>
                  {modeLabels[mode]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.compactField}>
            <span>Variety</span>
            <input
              onChange={(event) =>
                onUpdate({ varietyName: event.currentTarget.value })
              }
              type="text"
              value={selection.varietyName}
            />
          </label>

          {showSupportOption ? (
            <label className={styles.checkField}>
              <input
                checked={selection.supportAllowed}
                onChange={(event) =>
                  onUpdate({ supportAllowed: event.currentTarget.checked })
                }
                type="checkbox"
              />
              <span>Allow support structures</span>
            </label>
          ) : null}
        </div>
      </details>
    </article>
  );
}

function getSelectionId(cropId: string, selections: SeasonCropSelection[]) {
  return (
    selections.find((selection) => selection.cropId === cropId)?.id ?? cropId
  );
}
