import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  PlantingMode,
  SeasonCropCommitment,
  SeasonCropPriority,
  SeasonCropSelection,
  SeasonCropSowPreference,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import {
  formatGlyph,
  formatSowMethod,
  getCropIconTone,
  modeLabels,
} from '../../garden/cropPickerHelpers';
import {
  formatSeasonCropFitLabel,
  formatSeasonCropFitReasonGroup,
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
  const mustGrowCount = selections.filter(
    (selection) => selection.commitment === 'mustGrow',
  ).length;
  const reviewCount = layoutRequests.filter(
    (request) =>
      request.fit.level === 'caution' || request.fit.level === 'unlikelyFit',
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
          <span>{mustGrowCount} must-grow</span>
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
  return (
    <article
      className={styles.boardItem}
      data-commitment={selection.commitment}
      data-fit-level={fit.level}
    >
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
            {selection.targetQuantity} target -{' '}
            {modeLabels[selection.modePreference]}
          </span>
        </div>
        <span className={styles.fitPill} data-fit-level={fit.level}>
          {formatSeasonCropFitLabel(fit.level)}
        </span>
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
        {[fit.summary, fit.uncertainty].filter(Boolean).join(' ')}
      </p>

      {fit.groupedReasons.length > 0 ? (
        <div className={styles.reasonTags} aria-label="Fit reason groups">
          {fit.groupedReasons.slice(0, 3).map((reason) => (
            <span key={reason.group} data-reason-severity={reason.severity}>
              {formatSeasonCropFitReasonGroup(reason.group)}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.primaryGrid}>
        <label className={styles.compactField}>
          <span>Quantity</span>
          <input
            min="1"
            onChange={(event) =>
              onUpdate({ targetQuantity: Number(event.currentTarget.value) })
            }
            type="number"
            value={selection.targetQuantity}
          />
        </label>

        <label className={styles.compactField}>
          <span>Mode</span>
          <select
            onChange={(event) =>
              onUpdate({
                modePreference: event.currentTarget.value as PlantingMode,
              })
            }
            value={selection.modePreference}
          >
            {crop.supportedPlantingModes.map((mode) => (
              <option key={mode} value={mode}>
                {modeLabels[mode]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.compactField}>
          <span>Need</span>
          <select
            onChange={(event) =>
              onUpdate({
                commitment: event.currentTarget.value as SeasonCropCommitment,
              })
            }
            value={selection.commitment}
          >
            <option value="mustGrow">Must-grow</option>
            <option value="niceToHave">Nice-to-have</option>
          </select>
        </label>

        <label className={styles.compactField}>
          <span>Priority</span>
          <select
            onChange={(event) =>
              onUpdate({
                priority: event.currentTarget.value as SeasonCropPriority,
              })
            }
            value={selection.priority}
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>

      <label className={styles.notesField}>
        <span>Notes</span>
        <input
          onChange={(event) => onUpdate({ notes: event.currentTarget.value })}
          placeholder="Timing, cultivar, or placement notes"
          type="text"
          value={selection.notes}
        />
      </label>

      <details className={styles.advancedFields}>
        <summary>More</summary>
        <div className={styles.secondaryGrid}>
          <label className={styles.compactField}>
            <span>Sow</span>
            <select
              onChange={(event) =>
                onUpdate({
                  sowPreference: event.currentTarget
                    .value as SeasonCropSowPreference,
                })
              }
              value={selection.sowPreference}
            >
              <option value="noPreference">No preference</option>
              <option value="directSow">{formatSowMethod('directSow')}</option>
              <option value="transplant">Transplant</option>
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

          <label className={styles.checkField}>
            <input
              checked={selection.containerAllowed}
              onChange={(event) =>
                onUpdate({ containerAllowed: event.currentTarget.checked })
              }
              type="checkbox"
            />
            <span>Container allowed</span>
          </label>

          <label className={styles.checkField}>
            <input
              checked={selection.supportAllowed}
              onChange={(event) =>
                onUpdate({ supportAllowed: event.currentTarget.checked })
              }
              type="checkbox"
            />
            <span>Support allowed</span>
          </label>
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
