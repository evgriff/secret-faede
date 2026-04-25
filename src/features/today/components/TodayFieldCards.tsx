import type {
  IssueStatus,
  JournalEntry,
  PlantingLifecycleStatus,
  WeatherSnapshot,
} from '../../../domain/gardens/GardenRepository';
import {
  ActionButton,
  StatusBadge,
} from '../../shared/design/DesignPrimitives';
import { formatLongDate } from '../todayFormatters';
import type {
  TodayCropStageAction,
  TodayRecentActivity,
  TodaySelectedWeather,
  TodayWateringOutlookItem,
} from '../todayFieldModel';
import type { TodayWateringGroup } from '../todayWateringGroups';
import styles from './TodayFieldPanels.module.css';

export function WeatherPanel({
  latestWeather,
  nextWateringRun,
  selectedWeather,
  wateringGroups = [],
}: {
  latestWeather: WeatherSnapshot | null;
  nextWateringRun?: TodayWateringOutlookItem | null;
  selectedWeather: TodaySelectedWeather | null;
  wateringGroups?: TodayWateringGroup[];
}) {
  const waterTotalIn = wateringGroups.reduce(
    (total, group) => total + group.totalTargetAmountInches,
    0,
  );
  const waterTargetCount = wateringGroups.reduce(
    (total, group) => total + group.targetCount,
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
          {selectedWeather?.providerLabel ?? 'Manual'}
        </StatusBadge>
      </div>
      {selectedWeather ? (
        <div className={styles.weatherBody}>
          <div className={styles.weatherHero}>
            <strong>{selectedWeather.conditionSummary}</strong>
            <span>
              {formatNullableNumber(selectedWeather.temperatureF, 'F')}
            </span>
          </div>
          <div className={styles.weatherFacts}>
            <span>
              <strong>
                {selectedWeather.mode === 'observed'
                  ? 'Recent rain'
                  : 'Expected rain'}
              </strong>
              {formatNullableNumber(
                selectedWeather.mode === 'observed'
                  ? selectedWeather.recentPrecipitation72hIn
                  : selectedWeather.forecastRainIn,
                'in',
              )}
            </span>
            <span className={styles.weatherNextDay}>
              <strong>
                {selectedWeather.mode === 'observed' ? 'Next 24h' : 'Chance'}
              </strong>
              {selectedWeather.mode === 'observed'
                ? formatNullableNumber(selectedWeather.forecastRainIn, 'in')
                : formatPercent(selectedWeather.precipitationChancePercent)}
            </span>
            <span>
              <strong>Next rain</strong>
              {formatNextRain(selectedWeather.nextRainIso)}
            </span>
            <span className={styles.weatherRisk}>
              <strong>Risk</strong>
              {formatWeatherRisk(selectedWeather)}
            </span>
            <span className={styles.weatherWatering}>
              <strong>Watering</strong>
              {wateringGroups.length > 0
                ? `${wateringGroups.length} run${wateringGroups.length === 1 ? '' : 's'}, ${waterTargetCount} target${waterTargetCount === 1 ? '' : 's'}, ${waterTotalIn.toFixed(2)} in`
                : nextWateringRun
                  ? formatNextWatering(nextWateringRun)
                  : 'Check again tomorrow after the next weather refresh.'}
            </span>
            <span className={styles.weatherObserved}>
              <strong>{selectedWeather.displayDateLabel}</strong>
              {formatLongDate(selectedWeather.date)}
            </span>
          </div>
        </div>
      ) : (
        <p className={styles.empty}>
          Weather appears here after the next update.
        </p>
      )}
    </section>
  );
}

export function WaterGroupCard({
  group,
  onDone,
  onReview,
}: {
  group: TodayWateringGroup;
  onDone(): void;
  onReview(): void;
}) {
  return (
    <article className={`${styles.miniCard} ${styles.waterCard}`}>
      <div className={styles.waterCardCopy}>
        <div className={styles.waterCardHeader}>
          <h3>{group.label}</h3>
          <StatusBadge tone={group.urgency === 'high' ? 'warning' : 'neutral'}>
            {group.urgency}
          </StatusBadge>
        </div>
        <p className={styles.waterMeta}>
          {formatWaterAmount(group.totalTargetAmountInches)} in still due across{' '}
          {group.targetCount} target{group.targetCount === 1 ? '' : 's'}
        </p>
        <small>{group.reasonSummary}</small>
        {group.statusSummary ? <small>{group.statusSummary}</small> : null}
        <div className={styles.waterMemberList}>
          {group.visibleMemberLabels.map((label) => (
            <span className={styles.waterMemberChip} key={label}>
              {label}
            </span>
          ))}
          {group.hiddenMemberCount > 0 ? (
            <span className={styles.waterMemberChip}>
              +{group.hiddenMemberCount} more
            </span>
          ) : null}
        </div>
      </div>
      <div className={`${styles.cardActions} ${styles.waterCardActions}`}>
        <ActionButton intent="success" onClick={onDone} priority="primary">
          Water all done
        </ActionButton>
        <ActionButton onClick={onReview} priority="secondary">
          Review watering
        </ActionButton>
      </div>
    </article>
  );
}

export function WateringOutlookCard({
  item,
}: {
  item: TodayWateringOutlookItem;
}) {
  return (
    <article className={`${styles.miniCard} ${styles.waterCard}`}>
      <div className={styles.waterCardCopy}>
        <div className={styles.waterCardHeader}>
          <h3>{item.label}</h3>
          <StatusBadge tone={item.urgency === 'high' ? 'warning' : 'neutral'}>
            {formatLongDate(item.date)}
          </StatusBadge>
        </div>
        <p className={styles.waterMeta}>
          {formatWaterAmount(item.expectedAmountInches)} in likely due across{' '}
          {item.targetCount} target{item.targetCount === 1 ? '' : 's'}
        </p>
        <small>{item.summary}</small>
        <small>{item.reason}</small>
        <div className={styles.waterMemberList}>
          {item.memberLabels.slice(0, 3).map((label) => (
            <span className={styles.waterMemberChip} key={label}>
              {label}
            </span>
          ))}
          {item.memberLabels.length > 3 ? (
            <span className={styles.waterMemberChip}>
              +{item.memberLabels.length - 3} more
            </span>
          ) : null}
        </div>
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
      <div className={styles.cardActions}>
        <ActionButton
          intent="success"
          onClick={() =>
            onUpdatePlantingStatus(action.planting.id, action.nextStatus)
          }
          priority="primary"
        >
          {getLifecycleActionLabel(action.nextStatus)}
        </ActionButton>
      </div>
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
          <ActionButton
            intent="warning"
            onClick={() => onUpdateIssue(issue.id, 'inProgress')}
            priority="secondary"
          >
            In progress
          </ActionButton>
        ) : null}
        <ActionButton
          intent="success"
          onClick={() => onUpdateIssue(issue.id, 'resolved')}
          priority="primary"
        >
          Resolve
        </ActionButton>
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

function formatPercent(value: number | null) {
  return value === null ? 'unknown' : `${value}%`;
}

function formatNextWatering(item: TodayWateringOutlookItem) {
  return `Next likely ${formatLongDate(item.date)}, ${formatWaterAmount(
    item.expectedAmountInches,
  )} in for ${item.label}`;
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

function formatWaterAmount(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatWeatherRisk(weather: TodaySelectedWeather) {
  const risks = [
    weather.frostRisk !== 'none' ? `frost ${weather.frostRisk}` : null,
    weather.heatRisk !== 'none' ? `heat ${weather.heatRisk}` : null,
    ...weather.alertSummaries.slice(0, 1),
  ].filter(Boolean);

  return risks.length > 0 ? risks.join(', ') : 'None flagged';
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
