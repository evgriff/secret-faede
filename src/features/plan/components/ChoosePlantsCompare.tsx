import {
  formatSeasonCropFitReasonGroup,
  formatSeasonCropPlanningState,
  getSeasonCropPlanningRank,
} from '../seasonCropFitDisplay';
import type { SeasonCropLayoutRequest } from '../seasonCropPlan';
import sharedStyles from '../PlanModal.module.css';
import styles from './ChoosePlantsModal.module.css';

export function CropComparePanel({
  explicitCompareCount,
  layoutRequests,
  onClearCompare,
}: {
  explicitCompareCount: number;
  layoutRequests: SeasonCropLayoutRequest[];
  onClearCompare(): void;
}) {
  const rankedRequests = [...layoutRequests].sort(
    (left, right) =>
      getSeasonCropPlanningRank(right.fit) -
        getSeasonCropPlanningRank(left.fit) ||
      left.estimatedAreaSqFt - right.estimatedAreaSqFt,
  );
  const easiestRequest = rankedRequests[0] ?? null;

  return (
    <section
      aria-label="Crop planning compare"
      className={`${styles.panelSlot} ${styles.comparePanel}`}
    >
      <div className={styles.compareHeader}>
        <div>
          <span className={styles.kicker}>Compare</span>
          <h3>Plan tradeoffs</h3>
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
      {rankedRequests.length > 0 ? (
        <ul className={styles.compareList}>
          {rankedRequests.map((request) => (
            <li
              data-easiest={
                request.cropId === easiestRequest?.cropId ? 'true' : undefined
              }
              key={request.cropId}
            >
              <div>
                <strong>{request.crop.commonName}</strong>
                <span>
                  {request.quantity} plants - {request.estimatedAreaSqFt} sq ft
                </span>
              </div>
              <span
                className={styles.fitPill}
                data-fit-level={request.fit.level}
              >
                {formatSeasonCropPlanningState(request.fit.level)}
              </span>
              <small>{getCompareLine(request, easiestRequest)}</small>
              {request.fit.groupedReasons.length > 0 ? (
                <div className={styles.reasonTags}>
                  {request.fit.groupedReasons.slice(0, 3).map((reason) => (
                    <span
                      data-reason-severity={reason.severity}
                      key={reason.group}
                    >
                      {formatSeasonCropFitReasonGroup(reason.group)}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyText}>
          Select up to 3 crops to compare space, timing, and support.
        </p>
      )}
    </section>
  );
}

function getCompareLine(
  request: SeasonCropLayoutRequest,
  easiestRequest: SeasonCropLayoutRequest | null,
) {
  if (!easiestRequest || request.cropId === easiestRequest.cropId) {
    return `Best planning match in this set: ${request.fit.summary}`;
  }

  const tradeoffs = getTradeoffGroups(request, easiestRequest);

  if (tradeoffs.length > 0) {
    return `Harder than ${easiestRequest.crop.commonName}: more ${tradeoffs.join(
      ', ',
    )} constraints.`;
  }

  if (request.estimatedAreaSqFt > easiestRequest.estimatedAreaSqFt * 1.2) {
    return `Harder than ${easiestRequest.crop.commonName}: needs more room at this quantity.`;
  }

  return `Similar planning work to ${easiestRequest.crop.commonName}; choose by quantity and intent.`;
}

function getTradeoffGroups(
  request: SeasonCropLayoutRequest,
  easiestRequest: SeasonCropLayoutRequest,
) {
  const easiestGroups = new Set(
    easiestRequest.fit.groupedReasons.map((reason) => reason.group),
  );

  return request.fit.groupedReasons
    .filter((reason) => !easiestGroups.has(reason.group))
    .map((reason) => formatSeasonCropFitReasonGroup(reason.group).toLowerCase())
    .slice(0, 2);
}
