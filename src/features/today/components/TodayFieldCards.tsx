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
  TodayWeekRainItem,
  TodayWateringOutlookItem,
} from '../todayFieldModel';
import type { TodayWateringGroup } from '../todayWateringGroups';
import styles from './TodayFieldPanels.module.css';

export function WeatherPanel({
  latestWeather,
  nextWateringWindow,
  selectedWeather,
  weekRain = [],
  wateringGroups = [],
}: {
  latestWeather: WeatherSnapshot | null;
  nextWateringWindow: TodayWateringOutlookItem | null | undefined;
  selectedWeather: TodaySelectedWeather | null;
  weekRain?: TodayWeekRainItem[];
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
  const waterBalanceSummary =
    wateringGroups[0]?.entries[0]?.waterBalance?.nextCheckReason ?? null;

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
                selectedWeather.mode === 'forecast'
                  ? selectedWeather.rainSummary
                  : null,
              )}
            </span>
            <span className={styles.weatherNextDay}>
              <strong>
                {selectedWeather.mode === 'observed' ? 'Next 24h' : 'Chance'}
              </strong>
              {selectedWeather.mode === 'observed'
                ? formatNullableNumber(
                    selectedWeather.forecastRainIn,
                    'in',
                    selectedWeather.rainSummary,
                  )
                : formatPercent(selectedWeather.precipitationChancePercent)}
            </span>
            <span>
              <strong>Next rain</strong>
              {formatNextRain(selectedWeather.nextRainIso)}
            </span>
            <span className={styles.weatherWeekRain}>
              <strong>Week rain</strong>
              {formatWeekRainSummary(weekRain)}
            </span>
            <span className={styles.weatherRisk}>
              <strong>Risk</strong>
              {formatWeatherRisk(selectedWeather)}
            </span>
            <span className={styles.weatherWatering}>
              <strong>Watering</strong>
              {formatWeatherWateringSummary({
                nextWateringWindow,
                selectedWeather,
                waterTargetCount,
                waterTotalIn,
                wateringGroups,
              })}
            </span>
            {waterBalanceSummary ? (
              <span className={styles.weatherWatering}>
                <strong>Balance</strong>
                {waterBalanceSummary}
              </span>
            ) : null}
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
          <h3>{item.headline}</h3>
          <StatusBadge tone={item.urgency === 'high' ? 'warning' : 'neutral'}>
            {item.rangeLabel}
          </StatusBadge>
        </div>
        <p className={styles.waterMeta}>
          Best: {formatLongDate(item.bestDate)} morning
        </p>
        <small>
          Deep soak about {formatWaterAmount(item.amountInches)} in.
        </small>
        <small>{item.details}</small>
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

function formatWeatherWateringSummary({
  nextWateringWindow,
  selectedWeather,
  waterTargetCount,
  waterTotalIn,
  wateringGroups,
}: {
  nextWateringWindow: TodayWateringOutlookItem | null | undefined;
  selectedWeather: TodaySelectedWeather | null;
  waterTargetCount: number;
  waterTotalIn: number;
  wateringGroups: TodayWateringGroup[];
}) {
  if (wateringGroups.length > 0) {
    return `Water today: ${wateringGroups.length} run${wateringGroups.length === 1 ? '' : 's'}, ${waterTargetCount} target${waterTargetCount === 1 ? '' : 's'}, ${waterTotalIn.toFixed(2)} in`;
  }

  if (nextWateringWindow) {
    const selectedDate = selectedWeather?.date ?? '';

    if (
      selectedDate &&
      selectedDate >= nextWateringWindow.startDate &&
      selectedDate <= nextWateringWindow.endDate
    ) {
      return nextWateringWindow.headline;
    }

    return `Next water window: ${nextWateringWindow.rangeLabel}`;
  }

  if (
    (selectedWeather?.forecastRainIn ?? 0) >= 0.1 ||
    (selectedWeather?.recentPrecipitation72hIn ?? 0) >= 0.25
  ) {
    return 'Rain likely covers this week.';
  }

  if (selectedWeather?.rainLikely) {
    return 'Rain likely; watering will recheck after the NWS window.';
  }

  return 'No watering today.';
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

function formatNullableNumber(
  value: number | null,
  unit: string,
  qualitativeFallback: string | null = null,
) {
  if (qualitativeFallback && (value === null || value === 0)) {
    return qualitativeFallback;
  }

  return value === null ? 'unknown' : `${value}${unit}`;
}

function formatPercent(value: number | null) {
  return value === null ? 'unknown' : `${value}%`;
}

function formatNextRain(value: string | null) {
  if (!value) {
    return 'No future rain saved';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  if (date < new Date()) {
    return 'No future rain saved';
  }

  return date.toLocaleString(undefined, {
    day: 'numeric',
    hour: 'numeric',
    month: 'short',
  });
}

function formatWeekRainSummary(weekRain: TodayWeekRainItem[]) {
  if (weekRain.length === 0) {
    return 'No NWS rain signal this week.';
  }

  return weekRain
    .slice(0, 7)
    .map((item) => {
      const dayLabel = formatLongDate(item.date);

      if (item.expectedRainIn >= 0.01) {
        return `${dayLabel}: ${item.expectedRainIn.toFixed(2)} in`;
      }

      return `${dayLabel}: ${item.rainSummary}`;
    })
    .join(' · ');
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
