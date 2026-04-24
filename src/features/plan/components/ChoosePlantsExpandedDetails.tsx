import { useId, useState } from 'react';

import type {
  CropProfile,
  PlantingMode,
  SeasonCropSelection,
} from '../../../domain/gardens/GardenRepository';
import { formatLabel, modeLabels } from '../../garden/cropPickerHelpers';
import {
  formatSeasonCropFitReasonGroup,
  needsSeasonCropReview,
} from '../seasonCropFitDisplay';
import type { SeasonCropFitSignal } from '../seasonCropPlan';
import type { CompactPlantFacts } from './ChoosePlantsCompactFacts';
import disclosureStyles from './ChoosePlantsDisclosure.module.css';
import { PlantFootprintPreview } from './PlantFootprintPreview';

export function LibraryExpandedDetails({
  crop,
  facts,
  id,
  mode,
  modeOptions,
  onModeChange,
  quantity,
}: {
  crop: CropProfile;
  facts: CompactPlantFacts;
  id: string;
  mode: PlantingMode;
  modeOptions: PlantingMode[];
  onModeChange(mode: PlantingMode): void;
  quantity: number;
}) {
  return (
    <div
      className={`${disclosureStyles.expandedPanel} ${disclosureStyles.libraryPanel}`}
      id={id}
    >
      <section
        className={disclosureStyles.locationPanel}
        data-match-band={facts.locationMatchBand}
      >
        <strong>Plot fit: {facts.locationMatchLabel}</strong>
        <p>{facts.locationMatchSummary}</p>
        <p className={disclosureStyles.mutedText}>{facts.locationMatchBasis}</p>
        {facts.locationMatchDetails.length > 0 ? (
          <ul>
            {facts.locationMatchDetails.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <PlantFootprintPreview
        compact
        crop={crop}
        mode={mode}
        modeOptions={modeOptions}
        onModeChange={onModeChange}
        quantity={quantity}
      />
      <dl className={disclosureStyles.detailGrid}>
        <div>
          <dt>Spacing</dt>
          <dd>{facts.spacingLabel}</dd>
        </div>
        <div>
          <dt>Lifecycle</dt>
          <dd>{facts.lifecycleLabel}</dd>
        </div>
        <div>
          <dt>Harvest</dt>
          <dd>{facts.harvestLabel}</dd>
        </div>
        <div>
          <dt>Sow</dt>
          <dd>{formatLabel(crop.sowMethod)}</dd>
        </div>
        <div>
          <dt>Support</dt>
          <dd>{facts.supportLabel}</dd>
        </div>
      </dl>
    </div>
  );
}

export function BoardExpandedDetails({
  crop,
  facts,
  fit,
  id,
  modeOptions,
  onUpdate,
  selection,
  showSupportOption,
}: {
  crop: CropProfile;
  facts: CompactPlantFacts;
  fit: SeasonCropFitSignal;
  id: string;
  modeOptions: PlantingMode[];
  onUpdate(values: Partial<SeasonCropSelection>): void;
  selection: SeasonCropSelection;
  showSupportOption: boolean;
}) {
  function handleSpacingChange(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      onUpdate({ spacingOverrideInches: null });
      return;
    }

    const parsed = Number(trimmed);

    onUpdate({
      spacingOverrideInches:
        Number.isFinite(parsed) && parsed > 0
          ? Number(parsed.toFixed(1))
          : null,
    });
  }

  return (
    <div className={disclosureStyles.expandedPanel} id={id}>
      {needsSeasonCropReview(fit) ? <ReviewPanel fit={fit} /> : null}
      <PlantFootprintPreview
        compact
        crop={crop}
        mode={selection.plantingForm}
        quantity={selection.quantity}
        spacingOverrideInches={selection.spacingOverrideInches ?? null}
      />
      <div className={disclosureStyles.detailGrid}>
        <label className={disclosureStyles.detailField}>
          <span>Planting form</span>
          <select
            onChange={(event) =>
              onUpdate({
                plantingForm: event.currentTarget.value as PlantingMode,
              })
            }
            value={selection.plantingForm}
          >
            {modeOptions.map((mode) => (
              <option key={mode} value={mode}>
                {modeLabels[mode]}
              </option>
            ))}
          </select>
        </label>

        <label className={disclosureStyles.detailField}>
          <span>Spacing override</span>
          <input
            aria-label={`${crop.commonName} spacing override in inches`}
            inputMode="decimal"
            min="1"
            onChange={(event) => handleSpacingChange(event.currentTarget.value)}
            placeholder={facts.spacingLabel}
            step="0.5"
            type="number"
            value={selection.spacingOverrideInches ?? ''}
          />
        </label>

        <label className={disclosureStyles.detailField}>
          <span>Variety</span>
          <input
            onChange={(event) =>
              onUpdate({ varietyName: event.currentTarget.value })
            }
            type="text"
            value={selection.varietyName}
          />
        </label>

        <label className={disclosureStyles.detailField}>
          <span>Sow method</span>
          <input readOnly value={formatLabel(crop.sowMethod)} />
        </label>

        {showSupportOption ? (
          <label className={disclosureStyles.checkField}>
            <input
              checked={selection.supportAllowed}
              onChange={(event) =>
                onUpdate({ supportAllowed: event.currentTarget.checked })
              }
              type="checkbox"
            />
            <span>{facts.supportLabel}</span>
          </label>
        ) : null}

        <dl className={disclosureStyles.detailGrid}>
          <div>
            <dt>Lifecycle</dt>
            <dd>{facts.lifecycleLabel}</dd>
          </div>
          <div>
            <dt>Harvest</dt>
            <dd>{facts.harvestLabel}</dd>
          </div>
        </dl>

        <label
          className={`${disclosureStyles.detailField} ${disclosureStyles.fullWidth}`}
        >
          <span>Notes</span>
          <textarea
            onChange={(event) => onUpdate({ notes: event.currentTarget.value })}
            placeholder="Timing, cultivar source, or placement notes"
            value={selection.notes}
          />
        </label>
      </div>
    </div>
  );
}

export function ReviewDisclosure({
  cropName,
  fit,
}: {
  cropName: string;
  fit: SeasonCropFitSignal;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();
  const text = getReviewLines(fit).join(' ');

  return (
    <span
      className={disclosureStyles.reviewWrap}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-label={`${cropName} review reason`}
        className={disclosureStyles.reviewButton}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen(true)}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        type="button"
      >
        Review
      </button>
      {isOpen ? (
        <span
          className={disclosureStyles.tooltip}
          id={tooltipId}
          role="tooltip"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

function ReviewPanel({ fit }: { fit: SeasonCropFitSignal }) {
  const lines = getReviewLines(fit);

  return (
    <section
      className={disclosureStyles.reviewPanel}
      aria-label="Review reason"
    >
      <strong>{fit.summary}</strong>
      <ul className={disclosureStyles.reviewList}>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function getReviewLines(fit: SeasonCropFitSignal) {
  const grouped = fit.groupedReasons.map(
    (reason) =>
      `${formatSeasonCropFitReasonGroup(reason.group)}: ${reason.label}`,
  );

  if (fit.uncertainty) {
    return [...grouped, fit.uncertainty];
  }

  return grouped.length > 0 ? grouped : [fit.summary];
}
