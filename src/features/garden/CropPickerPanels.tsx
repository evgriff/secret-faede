import type { CropSuitabilityScore } from '../../domain/crops/cropSuitability';
import type { CropProfile } from '../../domain/gardens/GardenRepository';
import {
  formatCropSpacing,
  formatGlyph,
  formatLabel,
  formatLocationFilterLabel,
  formatLocationSource,
  formatSun,
  formatTimingLabel,
  formatWater,
  getCropIconTone,
} from './cropPickerHelpers';
import cropStyles from './CropPickerPanels.module.css';

export function CropResultButton({
  crop,
  fitHeadline,
  isSelected,
  onSelect,
  timingLabel,
}: {
  crop: CropProfile;
  fitHeadline: string;
  isSelected: boolean;
  onSelect(): void;
  timingLabel: string;
}) {
  return (
    <button
      aria-label={`${crop.commonName} crop`}
      aria-pressed={isSelected}
      className={`${cropStyles.cropOption} ${
        isSelected ? cropStyles.selectedCropOption : ''
      }`}
      onClick={onSelect}
      type="button"
    >
      <span
        className={cropStyles.cropGlyph}
        data-crop-tone={getCropIconTone(crop)}
        aria-hidden="true"
      >
        {formatGlyph(crop)}
      </span>
      <span className={cropStyles.cropOptionBody}>
        <span className={cropStyles.cropOptionHeader}>
          <strong>{crop.commonName}</strong>
          <span className={cropStyles.cropFit}>{timingLabel}</span>
        </span>
        <small className={cropStyles.fitHeadline}>{fitHeadline}</small>
        <CropResultFacts
          crop={crop}
          cropTypeLabel={formatLabel(crop.category)}
        />
      </span>
    </button>
  );
}

export function CropDetailCard({
  crop,
  suitability,
  sunWarning,
}: {
  crop: CropProfile;
  suitability: CropSuitabilityScore;
  sunWarning: string | null;
}) {
  return (
    <article className={cropStyles.cropCard}>
      <div className={cropStyles.cropCardHeader}>
        <span
          className={cropStyles.cropBadge}
          data-crop-tone={getCropIconTone(crop)}
          aria-hidden="true"
        >
          {formatGlyph(crop)}
        </span>
        <div>
          <h3>{crop.commonName}</h3>
          <p>{crop.scientificName}</p>
          <div className={cropStyles.detailBadges}>
            <span className={cropStyles.cropFit}>
              {formatTimingLabel(suitability.timing.status)}
            </span>
            <span className={cropStyles.cropDetailHint}>
              {formatLocationSource(suitability, { concise: true })}
            </span>
          </div>
        </div>
      </div>
      <dl className={cropStyles.cropStats}>
        <Stat
          label="Garden fit"
          value={formatLocationFilterLabel(suitability)}
        />
        <Stat label="Sun" value={formatLabel(crop.sunRequirement)} />
        <Stat label="Water" value={formatWater(crop.waterNeeds)} />
        <Stat label="Spacing" value={`${crop.spacingInches ?? '-'} in`} />
        <Stat label="Maturity" value={`${crop.daysToMaturity ?? '-'} days`} />
        <Stat label="Crop type" value={formatLabel(crop.category)} />
        <Stat label="Family" value={crop.family} />
      </dl>
      <p className={cropStyles.cropNotes}>{crop.notes}</p>
      <SuitabilityPanel suitability={suitability} />
      {sunWarning ? (
        <p className={cropStyles.warningText}>{sunWarning}</p>
      ) : null}
    </article>
  );
}

export function CropComparePanel({
  crops,
  onSelect,
  selectedCropId,
}: {
  crops: CropProfile[];
  onSelect(cropId: string): void;
  selectedCropId: string;
}) {
  return (
    <section className={cropStyles.comparePanel}>
      <h3>Quick compare</h3>
      <div className={cropStyles.compareGrid}>
        {crops.map((crop) => (
          <button
            aria-pressed={crop.id === selectedCropId}
            key={crop.id}
            onClick={() => onSelect(crop.id)}
            type="button"
          >
            <strong>{crop.commonName}</strong>
            <span>
              {crop.daysToMaturity ?? '-'} days - {crop.spacingInches ?? '-'} in
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function formatSuitabilityLevel(suitability: CropSuitabilityScore) {
  if (suitability.level === 'fit') {
    return 'Fits here';
  }

  return suitability.level === 'watch' ? 'Possible fit' : 'Needs review';
}

export function CropResultFacts({
  crop,
  cropTypeLabel,
}: {
  crop: CropProfile;
  cropTypeLabel: string;
}) {
  return (
    <span className={cropStyles.resultFacts}>
      <span>{cropTypeLabel}</span>
      <span>{formatSun(crop.sunRequirement)}</span>
      <span>{formatWater(crop.waterNeeds)}</span>
      <span>{formatCropSpacing(crop)}</span>
    </span>
  );
}

function SuitabilityPanel({
  suitability,
}: {
  suitability: CropSuitabilityScore;
}) {
  const visibleReasons = Array.from(
    new Set([
      suitability.timing.detail,
      ...suitability.reasons,
      ...suitability.warnings,
    ]),
  ).slice(0, 4);
  const lead =
    suitability.level === 'fit'
      ? 'Fits this garden'
      : suitability.level === 'watch'
        ? 'Worth a closer look'
        : 'Needs review';

  return (
    <section className={cropStyles.suitabilityPanel}>
      <div>
        <strong>{lead}</strong>
        <span>{formatLocationFilterLabel(suitability)}</span>
      </div>
      <ul>
        {visibleReasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
