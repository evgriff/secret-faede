import type {
  IssueStatus,
  PlantingLifecycleStatus,
  Task,
  WaterRecommendation,
} from '../../../domain/gardens/GardenRepository';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import {
  formatMonthDay,
  formatPriority,
  formatTaskType,
} from '../todayFormatters';
import type { TodayFieldModel } from '../todayFieldModel';
import type { TodayQuickActionState } from './TodayQuickActionRail';
import { WeatherPanel } from './TodayFieldCards';
import styles from '../TodayPage.module.css';

interface PriorityAction {
  id: string;
  label: string;
  meta: string;
  onSelect(): void;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
  verb: string;
}

export function TodayDayOverview({
  model,
  onCompleteTask,
  onOpenAction,
  onUpdateIssue,
  onUpdatePlantingStatus,
  onWaterDone,
  selectedDate,
  selectedTasks,
}: {
  model: TodayFieldModel;
  onCompleteTask(taskId: string): void;
  onOpenAction(action: TodayQuickActionState): void;
  onUpdateIssue(entryId: string, status: IssueStatus): void;
  onUpdatePlantingStatus(
    plantingId: string,
    status: PlantingLifecycleStatus,
  ): void;
  onWaterDone(recommendationId: string): void;
  selectedDate: string;
  selectedTasks: Task[];
}) {
  const priorityActions = buildPriorityActions({
    model,
    onCompleteTask,
    onOpenAction,
    onUpdateIssue,
    onUpdatePlantingStatus,
    onWaterDone,
    selectedTasks,
  });

  return (
    <section className={styles.overviewGrid}>
      <WeatherPanel
        activeWatering={model.activeWatering}
        latestWeather={model.latestWeather}
      />
      <section className={styles.priorityPanel}>
        <div className={styles.priorityHeader}>
          <div>
            <p className={styles.kicker}>Do now</p>
            <h2>{formatMonthDay(selectedDate)} field priorities</h2>
          </div>
          <StatusBadge
            tone={priorityActions.length > 0 ? 'warning' : 'success'}
          >
            {priorityActions.length || 'Clear'}
          </StatusBadge>
        </div>
        {priorityActions.length > 0 ? (
          <div className={styles.priorityList}>
            {priorityActions.map((action) => (
              <article className={styles.priorityItem} key={action.id}>
                <div>
                  <StatusBadge tone={action.tone}>{action.verb}</StatusBadge>
                  <strong className={styles.priorityTitle}>
                    {action.label}
                  </strong>
                  <p>{action.meta}</p>
                </div>
                <button onClick={action.onSelect} type="button">
                  {action.verb}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.clearNotice}>
            No priority field action for this day.
          </p>
        )}
      </section>
    </section>
  );
}

function buildPriorityActions({
  model,
  onCompleteTask,
  onOpenAction,
  onUpdateIssue,
  onUpdatePlantingStatus,
  onWaterDone,
  selectedTasks,
}: {
  model: TodayFieldModel;
  onCompleteTask(taskId: string): void;
  onOpenAction(action: TodayQuickActionState): void;
  onUpdateIssue(entryId: string, status: IssueStatus): void;
  onUpdatePlantingStatus(
    plantingId: string,
    status: PlantingLifecycleStatus,
  ): void;
  onWaterDone(recommendationId: string): void;
  selectedTasks: Task[];
}): PriorityAction[] {
  const waterActions = model.activeWatering
    .filter((recommendation) => recommendation.urgency !== 'low')
    .slice(0, 2)
    .map((recommendation) => ({
      id: `water-${recommendation.id}`,
      label: recommendation.targetLabel,
      meta: `${recommendation.recommendedWaterInches} in water. ${recommendation.reason}`,
      onSelect: () => onWaterDone(recommendation.id),
      tone: waterTone(recommendation),
      verb: 'Water done',
    }));
  const issueActions = model.unresolvedIssues
    .filter((issue) => issue.issueSeverity === 'high')
    .slice(0, 1)
    .map((issue) => ({
      id: `issue-${issue.id}`,
      label: issue.title,
      meta: `${issue.targetLabel}. ${issue.issueCategory ?? 'field check'}`,
      onSelect: () => onUpdateIssue(issue.id, 'inProgress'),
      tone: 'danger' as const,
      verb: 'Start check',
    }));
  const harvestActions = model.harvestReady.slice(0, 1).map((item) => ({
    id: `harvest-${item.planting.id}`,
    label: item.planting.label,
    meta: `${item.cropName}${item.dueDate ? ` due ${formatMonthDay(item.dueDate)}` : ''}`,
    onSelect: () =>
      onOpenAction({
        kind: 'harvest',
        plantingId: item.planting.id,
      }),
    tone: 'success' as const,
    verb: 'Log harvest',
  }));
  const cropStageActions = model.cropStageActions.slice(0, 1).map((action) => ({
    id: `stage-${action.planting.id}`,
    label: action.planting.label,
    meta: action.summary,
    onSelect: () =>
      onUpdatePlantingStatus(action.planting.id, action.nextStatus),
    tone: 'neutral' as const,
    verb: 'Update',
  }));
  const taskActions = selectedTasks
    .filter((task) => task.priority === 'high')
    .slice(0, 1)
    .map((task) => ({
      id: `task-${task.id}`,
      label: task.title,
      meta: `${formatTaskType(task.type)}. ${task.bedLabel ?? 'Open plot'}. ${formatPriority(task.priority)}`,
      onSelect: () => onCompleteTask(task.id),
      tone: 'warning' as const,
      verb: 'Task done',
    }));

  return [
    ...waterActions,
    ...issueActions,
    ...harvestActions,
    ...cropStageActions,
    ...taskActions,
  ].slice(0, 4);
}

function waterTone(recommendation: WaterRecommendation) {
  return recommendation.urgency === 'high'
    ? ('warning' as const)
    : ('neutral' as const);
}
