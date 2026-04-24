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
          <span className={styles.kicker}>Optional compare</span>
          <h3>Check a few crops side by side</h3>
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
                <dl className={styles.compareFacts}>
                  <CompareFact
                    label="Space"
                    value={`${request.quantity} ${request.quantity === 1 ? 'plant' : 'plants'} · ${request.estimatedAreaSqFt} sq ft`}
                  />
                  <CompareFact label="Sun" value={facts.sunShortLabel} />
                  <CompareFact
                    label="Plot fit"
                    reasonLines={[
                      ...facts.locationMatchDetails,
                      facts.locationMatchBasis,
                    ]}
                    tone={facts.locationMatchBand}
                    value={facts.locationMatchShortLabel}
                  />
                  <CompareFact
                    label="Support"
                    value={facts.supportShortLabel}
                  />
                  <CompareFact label="Harvest" value={facts.harvestLabel} />
                </dl>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.emptyText}>
          Use Compare on a crop if you want a quick side-by-side check before
          saving.
        </p>
      )}
    </section>
  );
}

function CompareFact({
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
  const fact = (
    <div
      aria-label={`${label}: ${value}`}
      className={styles.compareFact}
      data-tone={tone}
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );

  return reasonLines?.length ? (
    <ReasonTooltip
      ariaLabel={`${label} reason: ${value}`}
      content={<ReasonTooltipList lines={reasonLines} />}
    >
      {fact}
    </ReasonTooltip>
  ) : (
    fact
  );
}
