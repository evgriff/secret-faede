import type { Garden, SunExposure } from '../../../domain/gardens/models';
import { formatGlyph } from '../../garden/cropPickerHelpers';
import type { SeasonCropLayoutRequest } from '../seasonCropPlan';
import sharedStyles from '../PlanModal.module.css';
import { getCompactPlantFacts } from './ChoosePlantsCompactFacts';
import styles from './ChoosePlantsCompare.module.css';
import modalStyles from './ChoosePlantsModal.module.css';
import { ReasonTooltip, ReasonTooltipList } from './ReasonTooltip';

export function CropComparePanel({
  explicitCompareCount,
  garden,
  id,
  layoutRequests,
  onClearCompare,
  sunExposureAtPlacement,
}: {
  explicitCompareCount: number;
  garden: Garden;
  id?: string | undefined;
  layoutRequests: SeasonCropLayoutRequest[];
  onClearCompare(): void;
  sunExposureAtPlacement: SunExposure | null;
}) {
  return (
    <section
      aria-label="Crop planning compare"
      className={`${modalStyles.panelSlot} ${modalStyles.comparePanel}`}
      id={id}
    >
      <div className={styles.compareHeader}>
        <div>
          <span className={styles.kicker}>Compare</span>
          <h3>Quick facts</h3>
        </div>
        {explicitCompareCount > 0 ? (
          <button
            className={sharedStyles.secondaryButton}
            onClick={onClearCompare}
            type="button"
          >
            Clear compare
          </button>
        ) : null}
      </div>
      {layoutRequests.length > 0 ? (
        <ul className={styles.compareList}>
          {layoutRequests.map((request) => {
            const facts = getCompactPlantFacts({
              crop: request.crop,
              garden,
              mode: request.plantingForm,
              sunExposureAtPlacement,
            });

            return (
              <li key={request.cropId}>
                <div className={styles.cropIdentity}>
                  <span aria-hidden="true">{formatGlyph(request.crop)}</span>
                  <strong>{request.crop.commonName}</strong>
                </div>
                <div className={styles.factChips}>
                  <CompareChip
                    label="Difficulty"
                    value={facts.difficultyShortLabel}
                  />
                  <CompareChip
                    label="Space"
                    value={`${request.quantity} ${
                      request.quantity === 1 ? 'plant' : 'plants'
                    } - ${request.estimatedAreaSqFt} sq ft`}
                  />
                  <CompareChip
                    label="Location Match"
                    reasonLines={[
                      ...facts.locationMatchDetails,
                      facts.locationMatchBasis,
                    ]}
                    tone={facts.locationMatchBand}
                    value={facts.locationMatchShortLabel}
                  />
                  <CompareChip
                    label="Support"
                    value={facts.supportShortLabel}
                  />
                  <CompareChip label="Lifecycle" value={facts.lifecycleLabel} />
                  <CompareChip label="Harvest" value={facts.harvestLabel} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyText}>
          Select up to 3 plants to compare difficulty, space, match, support,
          and harvest timing.
        </p>
      )}
    </section>
  );
}

function CompareChip({
  label,
  reasonLines,
  tone,
  value,
}: {
  label: string;
  reasonLines?: string[];
  tone?: string;
  value: string;
}) {
  const chip = (
    <span
      aria-label={`${label}: ${value}`}
      className={styles.compareChip}
      data-tone={tone}
    >
      <span aria-hidden="true">{label}</span>
      {value}
    </span>
  );

  return reasonLines?.length ? (
    <ReasonTooltip
      ariaLabel={`${label} reason: ${value}`}
      content={<ReasonTooltipList lines={reasonLines} />}
    >
      {chip}
    </ReasonTooltip>
  ) : (
    chip
  );
}
