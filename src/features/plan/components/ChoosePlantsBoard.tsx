import { useId, useState, type ReactNode } from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  SeasonCropSelection,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import {
  coercePlantQuantity,
  formatGlyph,
  getCropIconTone,
  modeLabels,
} from '../../garden/cropPickerHelpers';
import { needsSeasonCropReview } from '../seasonCropFitDisplay';
import {
  getSeasonCropFitSignal,
  type SeasonCropFitSignal,
  type SeasonCropLayoutRequest,
} from '../seasonCropPlan';
import compactStyles from './ChoosePlantsCompact.module.css';
import { getCompactPlantFacts } from './ChoosePlantsCompactFacts';
import disclosureStyles from './ChoosePlantsDisclosure.module.css';
import {
  BoardExpandedDetails,
  ReviewDisclosure,
} from './ChoosePlantsExpandedDetails';
import { PlacementGlyph } from './ChoosePlantsPlacementGlyph';
import {
  getQuantityFirstPlantingModes,
  normalizeSeasonPlantingForm,
} from './choosePlantsSelection';
import {
  buildPlantFootprintPreview,
  type PlantFootprintPreviewModel,
} from './PlantFootprintPreview';
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
                sunExposureAtPlacement={sunExposureAtPlacement}
                garden={garden}
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
  sunExposureAtPlacement,
  garden,
}: {
  crop: CropProfile;
  fit: SeasonCropFitSignal;
  garden: Garden;
  isFirst: boolean;
  isLast: boolean;
  onMoveDown(): void;
  onMoveUp(): void;
  onRemove(): void;
  onUpdate(values: Partial<SeasonCropSelection>): void;
  selection: SeasonCropSelection;
  sunExposureAtPlacement: SunExposure | null;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const recommendedMode = normalizeSeasonPlantingForm(crop, selection.quantity);
  const currentMode = normalizeSeasonPlantingForm(
    crop,
    selection.quantity,
    selection.plantingForm,
  );
  const modeOptions = getQuantityFirstPlantingModes(crop, selection.quantity);
  const currentModeLabel = modeLabels[currentMode];
  const formText = currentModeLabel;
  const showSupportOption = crop.trellisRequired || crop.trellisRecommended;
  const showReview = needsSeasonCropReview(fit);
  const facts = getCompactPlantFacts({
    crop,
    garden,
    mode: currentMode,
    sunExposureAtPlacement,
  });
  const footprint = buildPlantFootprintPreview({
    crop,
    mode: currentMode,
    quantity: selection.quantity,
    spacingOverrideInches: selection.spacingOverrideInches ?? null,
  });
  const showSupport = facts.supportShortLabel !== 'No support';

  function handleQuantityChange(value: string) {
    const nextQuantity = coercePlantQuantity(value);
    const nextRecommendedMode = normalizeSeasonPlantingForm(crop, nextQuantity);
    const nextModeOptions = getQuantityFirstPlantingModes(crop, nextQuantity);

    onUpdate({
      plantingForm:
        currentMode === recommendedMode ||
        !nextModeOptions.includes(currentMode)
          ? nextRecommendedMode
          : currentMode,
      quantity: nextQuantity,
    });
  }

  return (
    <article className={compactStyles.boardCard} data-fit-level={fit.level}>
      <div className={compactStyles.boardHeader}>
        <span
          className={compactStyles.plantGlyph}
          data-crop-tone={getCropIconTone(crop)}
          aria-hidden="true"
        >
          {formatGlyph(crop)}
        </span>
        <div className={compactStyles.boardTitle}>
          <h4>{crop.commonName}</h4>
        </div>
        <label className={compactStyles.quantityField}>
          <span>Qty</span>
          <input
            aria-label={`${crop.commonName} quantity`}
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
        <div className={compactStyles.rowActions}>
          <button
            aria-label={`Move ${crop.commonName} up`}
            className={compactStyles.iconAction}
            disabled={isFirst}
            onClick={onMoveUp}
            type="button"
          >
            ↑
          </button>
          <button
            aria-label={`Move ${crop.commonName} down`}
            className={compactStyles.iconAction}
            disabled={isLast}
            onClick={onMoveDown}
            type="button"
          >
            ↓
          </button>
          <button
            aria-label={`Remove ${crop.commonName}`}
            className={compactStyles.iconAction}
            onClick={onRemove}
            type="button"
          >
            ×
          </button>
          <button
            aria-controls={detailsId}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Hide' : 'Show'} ${crop.commonName} details`}
            className={compactStyles.iconAction}
            onClick={() => setIsExpanded((current) => !current)}
            type="button"
          >
            <span className={disclosureStyles.chevron} aria-hidden="true">
              ⌄
            </span>
          </button>
        </div>
      </div>

      <div
        className={compactStyles.factStrip}
        aria-label="Selected plant facts"
      >
        <FactPill label={`${formText} form`}>
          <PlacementGlyph mode={currentMode} />
        </FactPill>
        <FactPill icon="space" label={formatFootprintFact(footprint)} />
        {showSupport ? (
          <FactPill icon="support" label={facts.supportShortLabel} />
        ) : null}
        <FactPill icon="sun" label={facts.sunShortLabel} />
        <FactPill icon="water" label={facts.waterShortLabel} />
        {showReview ? (
          <ReviewDisclosure cropName={crop.commonName} fit={fit} />
        ) : null}
      </div>

      {isExpanded ? (
        <BoardExpandedDetails
          crop={crop}
          facts={facts}
          fit={fit}
          id={detailsId}
          modeOptions={modeOptions}
          onUpdate={onUpdate}
          selection={{ ...selection, plantingForm: currentMode }}
          showSupportOption={showSupportOption}
        />
      ) : null}
    </article>
  );
}

function FactPill({
  children,
  difficulty,
  icon,
  label,
  matchBand,
}: {
  children?: ReactNode;
  difficulty?: string;
  icon?: string;
  label: string;
  matchBand?: string;
}) {
  return (
    <span
      className={compactStyles.factPill}
      data-difficulty={difficulty}
      data-match-band={matchBand}
    >
      <span
        className={compactStyles.factIcon}
        data-icon={children ? undefined : icon}
        aria-hidden="true"
      >
        {children}
      </span>
      {label}
    </span>
  );
}

function getSelectionId(cropId: string, selections: SeasonCropSelection[]) {
  return (
    selections.find((selection) => selection.cropId === cropId)?.id ?? cropId
  );
}

function formatFootprintFact(footprint: PlantFootprintPreviewModel) {
  return `${footprint.metricLabel} · ${footprint.areaLabel}`;
}
