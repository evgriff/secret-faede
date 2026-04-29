import { useEffect, useId, useState, type ReactNode } from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  SeasonCropSelection,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import { getCropSupportProfile } from '../../../domain/gardens/GardenRepository';
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

export interface CurrentPlanCropOption {
  cropId: string;
  cropName: string;
  plantedQuantity: number;
  label: string;
}

export function SeasonCropBoard({
  currentPlanCropOptions,
  garden,
  layoutRequests,
  onMoveSelection,
  onRemoveSelection,
  onUpdateSelection,
  selections,
  sunExposureAtPlacement,
  today,
}: {
  currentPlanCropOptions: CurrentPlanCropOption[];
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
  today: Date;
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
  const [selectedCurrentPlanCropId, setSelectedCurrentPlanCropId] = useState(
    currentPlanCropOptions[0]?.cropId ?? '',
  );

  useEffect(() => {
    if (currentPlanCropOptions.length === 0) {
      if (selectedCurrentPlanCropId !== '') {
        setSelectedCurrentPlanCropId('');
      }
      return;
    }

    if (
      !currentPlanCropOptions.some(
        (option) => option.cropId === selectedCurrentPlanCropId,
      )
    ) {
      setSelectedCurrentPlanCropId(currentPlanCropOptions[0]?.cropId ?? '');
    }
  }, [currentPlanCropOptions, selectedCurrentPlanCropId]);

  return (
    <section className={styles.board} aria-label="Season crop board">
      <div className={styles.boardHeader}>
        <div>
          <span className={styles.kicker}>Picked plants</span>
          <h3>Save the crops you want to grow</h3>
          <p className={styles.boardSummary}>
            {selections.length > 0
              ? `${selections.length} crop${selections.length === 1 ? '' : 's'} selected, ${plantCount} ${plantCount === 1 ? 'plant' : 'plants'}${reviewCount > 0 ? `, ${reviewCount} to review` : ''}.`
              : 'Search the library, adjust quantity, then save the list.'}
          </p>
        </div>
        <div className={styles.planReference}>
          <label className={styles.planReferenceLabel}>
            <span>Already on the plot</span>
            <select
              aria-label="Crops already on the plot"
              disabled={currentPlanCropOptions.length === 0}
              onChange={(event) =>
                setSelectedCurrentPlanCropId(event.currentTarget.value)
              }
              value={selectedCurrentPlanCropId}
            >
              {currentPlanCropOptions.length === 0 ? (
                <option value="">No crops on plot yet</option>
              ) : (
                currentPlanCropOptions.map((option) => (
                  <option key={option.cropId} value={option.cropId}>
                    {option.label}
                  </option>
                ))
              )}
            </select>
          </label>
          <p className={styles.planReferenceCaption}>
            Reference only. This list stays separate from the wanted-crop
            viewer.
          </p>
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
                    today,
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
                today={today}
                garden={garden}
              />
            ) : null;
          })}
        </div>
      ) : (
        <p className={styles.emptyText}>Search and add crops to start.</p>
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
  today,
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
  today: Date;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = useId();
  const recommendedMode = normalizeSeasonPlantingForm(crop, selection.quantity);
  const currentMode = normalizeSeasonPlantingForm(
    crop,
    selection.quantity,
    selection.plantingForm,
  );
  const currentModeLabel = modeLabels[currentMode];
  const modeOptions = getQuantityFirstPlantingModes(crop, selection.quantity);
  const showSupportOption = getCropSupportProfile(crop).scope === 'structure';
  const showReview = needsSeasonCropReview(fit);
  const facts = getCompactPlantFacts({
    crop,
    garden,
    mode: currentMode,
    sunExposureAtPlacement,
    today,
  });
  const footprint = buildPlantFootprintPreview({
    crop,
    mode: currentMode,
    quantity: selection.quantity,
    spacingOverrideInches: selection.spacingOverrideInches ?? null,
  });
  const showSupport = facts.supportShortLabel !== 'No support';
  const showMode = selection.quantity > 1 || currentMode !== 'single';

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
        <FactPill label={facts.timingLabel} />
        <FactPill icon="space" label={formatFootprintFact(footprint)} />
        {showMode ? (
          <FactPill label={`${currentModeLabel} form`}>
            <PlacementGlyph mode={currentMode} />
          </FactPill>
        ) : null}
        <FactPill icon="sun" label={facts.sunShortLabel} />
        {showSupport ? (
          <FactPill icon="support" label={facts.supportShortLabel} />
        ) : null}
        {showReview ? (
          <ReviewDisclosure cropName={crop.commonName} fit={fit} />
        ) : null}
      </div>

      {isExpanded ? (
        <>
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
          <div className={styles.boardCardActions}>
            <button
              aria-label={`Move ${crop.commonName} up`}
              className={styles.boardAction}
              disabled={isFirst}
              onClick={onMoveUp}
              type="button"
            >
              Move earlier
            </button>
            <button
              aria-label={`Move ${crop.commonName} down`}
              className={styles.boardAction}
              disabled={isLast}
              onClick={onMoveDown}
              type="button"
            >
              Move later
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}

function FactPill({
  children,
  icon,
  label,
}: {
  children?: ReactNode;
  icon?: string;
  label: string;
}) {
  return (
    <span className={compactStyles.factPill}>
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
