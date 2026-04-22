import type {
  IssueStatus,
  JournalEntry,
  PlantingLifecycleStatus,
  WaterRecommendation,
  WeatherSnapshot,
} from '../../../domain/gardens/GardenRepository';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import { formatLongDate } from '../todayFormatters';
import type {
  TodayCropStageAction,
  TodayRecentActivity,
} from '../todayFieldModel';
import styles from './TodayFieldPanels.module.css';

export function WeatherPanel({
  activeWatering = [],
  latestWeather,
}: {
  activeWatering?: WaterRecommendation[];
  latestWeather: WeatherSnapshot | null;
}) {
  const waterTotalIn = activeWatering.reduce(
    (total, recommendation) => total + recommendation.recommendedWaterInches,
    0,
  );

  return (
    <section className={`${styles.panel} ${styles.weatherPanel}`}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Weather</p>
          <h2>Field weather</h2>
        </div>
        <StatusBadge tone={getWeatherTone(latestWeather)}>
          {latestWeather?.providerLabel ?? latestWeather?.source ?? 'Manual'}
        </StatusBadge>
      </div>
      {latestWeather ? (
        <div className={styles.weatherBody}>
          <div className={styles.weatherHero}>
            <strong>{latestWeather.conditionSummary}</strong>
            <span>{formatNullableNumber(latestWeather.temperatureF, 'F')}</span>
          </div>
          <div className={styles.weatherFacts}>
            <span>
              <strong>Recent rain</strong>
              {formatNullableNumber(
                latestWeather.recentPrecipitation72hIn,
                'in',
              )}
            </span>
            <span className={styles.weatherNextDay}>
              <strong>Next 24h</strong>
              {formatNullableNumber(latestWeather.forecastRainNext24In, 'in')}
            </span>
            <span>
              <strong>Next rain</strong>
              {formatNextRain(latestWeather.nextRainIso)}
            </span>
            <span className={styles.weatherRisk}>
              <strong>Risk</strong>
              {formatWeatherRisk(latestWeather)}
            </span>
            <span className={styles.weatherWatering}>
              <strong>Watering</strong>
              {activeWatering.length > 0
                ? `${activeWatering.length} target${activeWatering.length === 1 ? '' : 's'}, ${waterTotalIn.toFixed(2)} in`
                : 'No saved water need'}
            </span>
            <span className={styles.weatherObserved}>
              <strong>Observed</strong>
              {formatLongDate(latestWeather.observedForDate)}
            </span>
          </div>
          <p className={styles.weatherSource}>
            Quality {latestWeather.dataQuality ?? 'limited'}
          </p>
        </div>
      ) : (
        <p className={styles.empty}>No weather snapshot saved yet.</p>
      )}
    </section>
  );
}

export function WaterCard({
  onDone,
  onNote,
  recommendation,
}: {
  onDone(): void;
  onNote(): void;
  recommendation: WaterRecommendation;
}) {
  return (
    <article className={styles.miniCard}>
      <div>
        <h3>{recommendation.targetLabel}</h3>
        <p>
          {recommendation.recommendedWaterInches} in, {recommendation.urgency}{' '}
          urgency
        </p>
        <small>{recommendation.reason}</small>
        <small>
          Refreshed{' '}
          {formatRefreshTime(
            recommendation.refreshedAtIso ?? recommendation.generatedAtIso,
          )}
          ; quality {recommendation.dataQuality ?? 'limited'}
        </small>
        {recommendation.rationale.length > 1 ? (
          <small>{recommendation.rationale.slice(1, 3).join(' ')}</small>
        ) : null}
      </div>
      <div className={styles.cardActions}>
        <button onClick={onDone} type="button">
          Water done
        </button>
        <button onClick={onNote} type="button">
          Override note
        </button>
      </div>
    </article>
  );
}

export function CropStageCard({
  action,
  onUpdatePlantingStatus,
}: {
  action: TodayCropStageAction;
  onUpdatePlantingStatus(
    plantingId: string,
    status: PlantingLifecycleStatus,
  ): void;
}) {
  return (
    <article className={styles.miniCard}>
      <div>
        <h3>{action.planting.label}</h3>
        <p>
          {action.cropName}, {action.bedLabel}
        </p>
        <small>{action.summary}</small>
      </div>
      <button
        onClick={() =>
          onUpdatePlantingStatus(action.planting.id, action.nextStatus)
        }
        type="button"
      >
        {getLifecycleActionLabel(action.nextStatus)}
      </button>
    </article>
  );
}

export function IssueCard({
  issue,
  onUpdateIssue,
}: {
  issue: JournalEntry;
  onUpdateIssue(entryId: string, status: IssueStatus): void;
}) {
  return (
    <article className={styles.miniCard}>
      <div>
        <h3>{issue.title}</h3>
        <p>{issue.targetLabel}</p>
        <small>
          {issue.issueSeverity ?? 'medium'} severity,{' '}
          {issue.issueStatus ?? 'open'}
        </small>
      </div>
      <div className={styles.cardActions}>
        {issue.issueStatus !== 'inProgress' ? (
          <button
            onClick={() => onUpdateIssue(issue.id, 'inProgress')}
            type="button"
          >
            In progress
          </button>
        ) : null}
        <button
          onClick={() => onUpdateIssue(issue.id, 'resolved')}
          type="button"
        >
          Resolve
        </button>
      </div>
    </article>
  );
}

export function RecentActivityItem({
  activity,
}: {
  activity: TodayRecentActivity;
}) {
  return (
    <article className={styles.activityItem}>
      <div>
        <h3>{activity.title}</h3>
        <p>{activity.meta}</p>
      </div>
      <StatusBadge tone={activity.tone}>{activity.tone}</StatusBadge>
    </article>
  );
}

function getWeatherTone(latestWeather: WeatherSnapshot | null) {
  if (!latestWeather) {
    return 'neutral';
  }

  return latestWeather.frostRisk !== 'none' ||
    latestWeather.heatRisk !== 'none' ||
    latestWeather.alertSummaries.length > 0
    ? 'warning'
    : 'success';
}

function formatNullableNumber(value: number | null, unit: string) {
  return value === null ? 'unknown' : `${value}${unit}`;
}

function formatNextRain(value: string | null) {
  if (!value) {
    return 'Not saved';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    month: 'short',
  });
}

function formatWeatherRisk(weather: WeatherSnapshot) {
  const risks = [
    weather.frostRisk !== 'none' ? `frost ${weather.frostRisk}` : null,
    weather.heatRisk !== 'none' ? `heat ${weather.heatRisk}` : null,
    ...weather.alertSummaries.slice(0, 1),
  ].filter(Boolean);

  return risks.length > 0 ? risks.join(', ') : 'None flagged';
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

function getLifecycleActionLabel(status: PlantingLifecycleStatus) {
  const labels: Record<PlantingLifecycleStatus, string> = {
    growing: 'Mark growing',
    'harvest-ready': 'Mark harvest-ready',
    harvested: 'Mark harvested',
    planned: 'Mark planned',
    planted: 'Mark planted',
    removed: 'Mark removed',
  };

  return labels[status];
}
