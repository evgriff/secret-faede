import { lazy, Suspense } from 'react';

import type {
  Garden,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type { SuccessionRecommendation } from '../../tasks/taskEngine';
import type {
  AutoLayoutCandidate,
  AutoLayoutRunStatus,
} from '../autoLayoutTypes';
import { buildMaterialsList } from '../materialsList';
import { buildSeasonCropLayoutRequests } from '../seasonCropPlan';
import {
  formatAlerts,
  formatNextRain,
  formatRecommendationAmount,
  formatUrgency,
  formatWateringSummary,
  formatWeatherSummary,
  getLatestWeatherSnapshot,
} from './planFormatters';
import styles from './PlanOperationsPanel.module.css';

const PlanOptimizeCandidates = lazy(() =>
  import('./PlanOptimizeCandidates').then((module) => ({
    default: module.PlanOptimizeCandidates,
  })),
);

export function PlanOperationsPanel({
  autoLayoutCandidates,
  currentWarnings,
  garden,
  isOffline,
  isLoading,
  onRejectAutoLayoutCandidate,
  onApproveSuccession,
  onApplyAutoLayoutCandidate,
  onGenerateAutoLayoutCandidates,
  onRefresh,
  onSelectAutoLayoutCandidate,
  optimizerMessage,
  optimizerStatus,
  rejectedAutoLayoutCandidateIds,
  refreshError,
  selectedAutoLayoutCandidateId,
  successionRecommendations,
  sunLayer,
  sunSeason,
}: {
  autoLayoutCandidates: AutoLayoutCandidate[];
  currentWarnings: PlanWarning[];
  garden: Garden;
  isOffline: boolean;
  isLoading: boolean;
  onApproveSuccession(recommendation: SuccessionRecommendation): void;
  onApplyAutoLayoutCandidate(): void;
  onGenerateAutoLayoutCandidates(): void;
  onRejectAutoLayoutCandidate(candidateId: string): void;
  onRefresh(): void;
  onSelectAutoLayoutCandidate(candidateId: string): void;
  optimizerMessage: string | null;
  optimizerStatus: AutoLayoutRunStatus;
  rejectedAutoLayoutCandidateIds: string[];
  refreshError: string | null;
  selectedAutoLayoutCandidateId: string | null;
  successionRecommendations: SuccessionRecommendation[];
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}) {
  const latestSnapshot = getLatestWeatherSnapshot(garden.weatherSnapshots);
  const activeRecommendations = garden.waterRecommendations.filter(
    (recommendation) =>
      recommendation.status === 'active' ||
      recommendation.status === 'new' ||
      recommendation.status === 'suppressed',
  );
  const todayRecommendations = activeRecommendations.filter(
    (recommendation) =>
      recommendation.recommendationDate === latestSnapshot?.observedForDate,
  );
  const visibleRecommendations =
    todayRecommendations.length > 0
      ? todayRecommendations
      : activeRecommendations.slice(0, 3);
  const inAppNotifications = [...garden.notificationLogs]
    .filter((log) => log.channel === 'inApp')
    .sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso))
    .slice(0, 3);
  const materials = buildMaterialsList(garden);
  const layoutRequests = buildSeasonCropLayoutRequests(garden);
  const mustGrowCount = layoutRequests.filter(
    (request) => request.mustGrow,
  ).length;
  const isOptimizing = optimizerStatus === 'running';

  return (
    <section className={styles.panel} aria-label="Garden operations">
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>Plan context</span>
          <h2>Weather and watering</h2>
        </div>
        <button
          className={styles.secondaryButton}
          disabled={isLoading || isOffline}
          onClick={onRefresh}
          type="button"
        >
          {isLoading ? 'Updating...' : isOffline ? 'Offline' : 'Update weather'}
        </button>
      </div>
      <div className={styles.metricGrid}>
        <OperationMetric
          label="Current weather"
          value={formatWeatherSummary(latestSnapshot)}
        />
        <OperationMetric
          label="Next rain"
          value={formatNextRain(latestSnapshot)}
        />
        <OperationMetric label="Alerts" value={formatAlerts(latestSnapshot)} />
        <OperationMetric
          label="Watering"
          value={formatWateringSummary(activeRecommendations)}
        />
      </div>
      {visibleRecommendations.length > 0 ? (
        <ul className={styles.recommendationList}>
          {visibleRecommendations.slice(0, 4).map((recommendation) => (
            <li key={recommendation.id}>
              <strong>
                {recommendation.targetLabel}:{' '}
                {formatRecommendationAmount(recommendation)}
              </strong>
              <span>
                {formatUrgency(recommendation.urgency)} -{' '}
                {recommendation.reason}
              </span>
              <span>
                Refreshed{' '}
                {formatRefreshTime(
                  recommendation.refreshedAtIso ??
                    recommendation.generatedAtIso,
                )}
                ; quality {recommendation.dataQuality ?? 'limited'}; source{' '}
                {recommendation.generatedBy ?? 'client'}
              </span>
              {recommendation.rationale.length > 1 ? (
                <ul className={styles.recommendationReasons}>
                  {recommendation.rationale.slice(1, 4).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.helpText}>
          No active watering recommendations. Update weather to refresh the
          garden model.
        </p>
      )}
      {refreshError ? (
        <p className={styles.error} role="alert">
          {refreshError}
        </p>
      ) : null}
      <section className={styles.materials} aria-label="Layout candidates">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.kicker}>Optimizer input</span>
            <h3>Wanted crops</h3>
          </div>
          <button
            className={styles.secondaryButton}
            disabled={layoutRequests.length === 0 || isOptimizing}
            onClick={onGenerateAutoLayoutCandidates}
            type="button"
          >
            {isOptimizing ? 'Generating...' : 'Generate layouts'}
          </button>
        </div>
        {optimizerMessage ? (
          <p
            className={
              optimizerStatus === 'error' ? styles.error : styles.statusText
            }
            role={optimizerStatus === 'error' ? 'alert' : 'status'}
          >
            {optimizerMessage}
          </p>
        ) : null}
        {layoutRequests.length > 0 ? (
          <>
            <p className={styles.helpText}>
              {layoutRequests.length} layout candidate
              {layoutRequests.length === 1 ? '' : 's'}; {mustGrowCount}{' '}
              must-grow.
            </p>
            <ul className={styles.candidateList}>
              {layoutRequests.slice(0, 5).map((request) => (
                <li key={request.cropId}>
                  <strong>{request.crop.commonName}</strong>
                  <span>
                    {request.targetQuantity} target - {request.fit.label}
                  </span>
                  <small>{request.fit.summary}</small>
                </li>
              ))}
            </ul>
            {autoLayoutCandidates.length > 0 ? (
              <Suspense
                fallback={<p className={styles.helpText}>Loading preview.</p>}
              >
                <PlanOptimizeCandidates
                  autoLayoutCandidates={autoLayoutCandidates}
                  currentWarnings={currentWarnings}
                  garden={garden}
                  onApplyAutoLayoutCandidate={onApplyAutoLayoutCandidate}
                  onRejectAutoLayoutCandidate={onRejectAutoLayoutCandidate}
                  onSelectAutoLayoutCandidate={onSelectAutoLayoutCandidate}
                  rejectedAutoLayoutCandidateIds={
                    rejectedAutoLayoutCandidateIds
                  }
                  selectedAutoLayoutCandidateId={selectedAutoLayoutCandidateId}
                  sunLayer={sunLayer}
                  sunSeason={sunSeason}
                />
              </Suspense>
            ) : null}
          </>
        ) : (
          <p className={styles.helpText}>
            Choose plants before running layout optimization.
          </p>
        )}
      </section>
      <section className={styles.materials} aria-label="Shopping list">
        <div>
          <span className={styles.kicker}>Shopping list</span>
          <h3>Materials from this plan</h3>
        </div>
        {materials.seedStarts.length > 0 ? (
          <ul>
            {materials.seedStarts.slice(0, 5).map((item, index) => (
              <li key={`${item.label}-${item.method}-${index}`}>
                {item.count} {item.method}: {item.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.helpText}>
            Add crops to estimate seeds, starts, and supports.
          </p>
        )}
        {materials.beds.length > 0 ||
        materials.paths.length > 0 ||
        materials.supports.length > 0 ||
        materials.addOns.length > 0 ||
        materials.totals.length > 0 ? (
          <div className={styles.materialGrid}>
            {materials.beds.slice(0, 3).map((bed) => (
              <span key={bed.label}>
                <strong>{bed.label}</strong>
                {bed.summary}
              </span>
            ))}
            {materials.paths.slice(0, 2).map((path) => (
              <span key={path.label}>
                <strong>{path.label}</strong>
                {path.summary}
              </span>
            ))}
            {materials.supports.slice(0, 3).map((support, index) => (
              <span key={`${support}-${index}`}>{support}</span>
            ))}
            {materials.addOns.slice(0, 4).map((addOn) => (
              <span key={addOn.id}>
                <strong>{addOn.label}</strong>
                {formatAddOnQuantity(addOn.quantity, addOn.unit)} -{' '}
                {addOn.reason}
              </span>
            ))}
            {materials.totals.slice(0, 3).map((total) => (
              <span key={total}>{total}</span>
            ))}
          </div>
        ) : null}
        <p className={styles.helpText}>{materials.amendments[0]}</p>
      </section>
      <section className={styles.materials} aria-label="Succession windows">
        <div>
          <span className={styles.kicker}>Succession</span>
          <h3>Bed openings</h3>
        </div>
        {successionRecommendations.length > 0 ? (
          <ul className={styles.successionList}>
            {successionRecommendations.slice(0, 4).map((recommendation) => (
              <li key={recommendation.id}>
                <div>
                  <strong>
                    {recommendation.cropName} after {recommendation.targetLabel}
                  </strong>
                  <span>
                    Opens {recommendation.bedOpensOn};{' '}
                    {recommendation.daysRemaining} frost-free days remain.
                  </span>
                </div>
                <button
                  onClick={() => onApproveSuccession(recommendation)}
                  type="button"
                >
                  Add to plan
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.helpText}>
            Harvest dates and crop maturity will surface follow-on windows.
          </p>
        )}
      </section>
      {inAppNotifications.length > 0 ? (
        <div className={styles.inAppNotifications}>
          <span className={styles.kicker}>In-app notifications</span>
          <ul>
            {inAppNotifications.map((log) => (
              <li key={log.id}>{log.body || log.messageSummary}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function formatRefreshTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  });
}

function OperationMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatAddOnQuantity(quantity: number, unit: string) {
  const formatted = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(1);

  return `${formatted} ${unit}`;
}
