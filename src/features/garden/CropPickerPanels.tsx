import type { CropSuitabilityScore } from '../../domain/crops/cropSuitability';
import type { CropProfile } from '../../domain/gardens/GardenRepository';
import {
  formatProfileCompleteness,
  formatCropFamilyLine,
  formatCropSpacing,
  formatGlyph,
  formatLabel,
  formatSun,
  formatWater,
  getCropIconTone,
} from './cropPickerHelpers';
import cropStyles from './CropPickerPanels.module.css';

export function CropResultButton({
  crop,
  isSelected,
  onSelect,
  suitabilityLabel,
}: {
  crop: CropProfile;
  isSelected: boolean;
  onSelect(): void;
  suitabilityLabel: string;
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
          <span className={cropStyles.cropFit}>{suitabilityLabel}</span>
        </span>
        <small>{formatCropFamilyLine(crop)}</small>
        <CropResultFacts crop={crop} />
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
        </div>
      </div>
      <dl className={cropStyles.cropStats}>
        <Stat label="Sun" value={formatLabel(crop.sunRequirement)} />
        <Stat label="Water" value={formatWater(crop.waterNeeds)} />
        <Stat label="Spacing" value={`${crop.spacingInches ?? '-'} in`} />
        <Stat label="Maturity" value={`${crop.daysToMaturity ?? '-'} days`} />
        <Stat label="Family" value={crop.family} />
        <Stat
          label="Catalog"
          value={formatProfileCompleteness(crop.profileCompleteness)}
        />
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
    return 'Ready to place';
  }

  return suitability.level === 'watch' ? 'Check details' : 'Needs review';
}

export function CropResultFacts({ crop }: { crop: CropProfile }) {
  return (
    <span className={cropStyles.resultFacts}>
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
  const lead =
    suitability.level === 'fit'
      ? 'Ready to place'
      : suitability.level === 'watch'
        ? 'Check details'
        : 'Needs review';

  return (
    <section className={cropStyles.suitabilityPanel}>
      <div>
        <strong>{lead}</strong>
      </div>
      <ul>
        {[...suitability.reasons, ...suitability.warnings]
          .slice(0, 4)
          .map((reason) => (
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
