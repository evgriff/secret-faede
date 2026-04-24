import { useId, type ReactNode } from 'react';

import type {
  CropProfile,
  Garden,
  PlantingMode,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import {
  formatCropFamilyLine,
  formatGlyph,
  getCropIconTone,
} from '../../garden/cropPickerHelpers';
import sharedStyles from '../PlanModal.module.css';
import compactStyles from './ChoosePlantsCompact.module.css';
import { getCompactPlantFacts } from './ChoosePlantsCompactFacts';
import disclosureStyles from './ChoosePlantsDisclosure.module.css';
import { LibraryExpandedDetails } from './ChoosePlantsExpandedDetails';
import locationMatchStyles from './ChoosePlantsLocationMatch.module.css';
import { PlacementGlyph } from './ChoosePlantsPlacementGlyph';
import { buildPlantFootprintPreview } from './PlantFootprintPreview';
import { ReasonTooltip, ReasonTooltipList } from './ReasonTooltip';

export function CropLibraryResult({
  compareDisabled,
  crop,
  garden,
  isExpanded,
  isComparing,
  isSelected,
  mode,
  modeOptions,
  onAdd,
  onModeChange,
  onQuantityBlur,
  onQuantityChange,
  onToggleExpanded,
  onToggleCompare,
  quantity,
  quantityValue,
  sunExposureAtPlacement,
}: {
  compareDisabled: boolean;
  crop: CropProfile;
  garden: Garden;
  isExpanded: boolean;
  isComparing: boolean;
  isSelected: boolean;
  mode: PlantingMode;
  modeOptions: PlantingMode[];
  onAdd(): void;
  onModeChange(mode: PlantingMode): void;
  onQuantityBlur(): void;
  onQuantityChange(value: string): void;
  onToggleExpanded(): void;
  onToggleCompare(): void;
  quantity: number;
  quantityValue: string;
  sunExposureAtPlacement: SunExposure | null;
}) {
  const detailsId = useId();
  const footprintPreview = buildPlantFootprintPreview({
    crop,
    mode,
    quantity,
  });
  const facts = getCompactPlantFacts({
    crop,
    garden,
    mode,
    sunExposureAtPlacement,
  });
  const locationReasonLines = getLocationReasonLines(facts);
  const supportLabel =
    facts.supportShortLabel === 'No support' ? null : facts.supportShortLabel;

  return (
    <article className={compactStyles.libraryCard}>
      <span
        className={compactStyles.plantGlyph}
        data-crop-tone={getCropIconTone(crop)}
        aria-hidden="true"
      >
        {formatGlyph(crop)}
      </span>
      <div className={compactStyles.plantBody}>
        <div className={compactStyles.plantHeader}>
          <div className={compactStyles.plantTitle}>
            <strong>{crop.commonName}</strong>
            <span>{formatCropFamilyLine(crop)}</span>
          </div>
          <div className={disclosureStyles.headerControls}>
            <label className={compactStyles.quantityField}>
              <span>Qty</span>
              <input
                aria-label={`${crop.commonName} quantity`}
                inputMode="numeric"
                min="1"
                onBlur={onQuantityBlur}
                onChange={(event) =>
                  onQuantityChange(event.currentTarget.value)
                }
                step="1"
                type="number"
                value={quantityValue}
              />
            </label>
            <button
              aria-controls={detailsId}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Hide' : 'Show'} ${crop.commonName} details`}
              className={disclosureStyles.chevronButton}
              onClick={onToggleExpanded}
              type="button"
            >
              <span className={disclosureStyles.chevron} aria-hidden="true">
                ⌄
              </span>
            </button>
          </div>
        </div>
        <p className={compactStyles.description}>{facts.description}</p>
        <div
          className={locationMatchStyles.matchLine}
          data-match-band={facts.locationMatchBand}
        >
          <ReasonTooltip
            ariaLabel={`${crop.commonName} plot fit reason`}
            content={<ReasonTooltipList lines={locationReasonLines} />}
            triggerClassName={locationMatchStyles.matchButton}
          >
            <span>
              <strong>Plot fit:</strong> {facts.locationMatchSummary}
            </span>
          </ReasonTooltip>
        </div>
        {isExpanded ? (
          <LibraryExpandedDetails
            crop={crop}
            facts={facts}
            id={detailsId}
            mode={mode}
            modeOptions={modeOptions}
            onModeChange={onModeChange}
            quantity={quantity}
          />
        ) : (
          <div
            className={compactStyles.factStrip}
            aria-label="Plant facts"
            id={detailsId}
          >
            <FactPill icon="sun" label={facts.sunShortLabel} />
            <FactPill icon="water" label={facts.waterShortLabel} />
            <FactPill icon="space" label={footprintPreview.areaLabel} />
            {supportLabel ? (
              <FactPill icon="support" label={supportLabel} />
            ) : null}
            <FactPill label={facts.modeLabel}>
              <PlacementGlyph mode={mode} />
            </FactPill>
          </div>
        )}
      </div>
      <div className={compactStyles.actions}>
        <button
          aria-label={
            isComparing
              ? `Remove ${crop.commonName} from compare`
              : `Compare ${crop.commonName}`
          }
          className={`${sharedStyles.secondaryButton} ${compactStyles.cardButton}`}
          disabled={compareDisabled}
          onClick={onToggleCompare}
          type="button"
        >
          {isComparing ? 'In compare' : 'Compare'}
        </button>
        <button
          aria-label={
            isSelected ? `${crop.commonName} added` : `Add ${crop.commonName}`
          }
          className={`${sharedStyles.primaryButton} ${compactStyles.cardButton}`}
          disabled={isSelected}
          onClick={onAdd}
          type="button"
        >
          {isSelected ? 'Added' : 'Add'}
        </button>
      </div>
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

function getLocationReasonLines(
  facts: ReturnType<typeof getCompactPlantFacts>,
) {
  return [...facts.locationMatchDetails, facts.locationMatchBasis].filter(
    Boolean,
  );
}
