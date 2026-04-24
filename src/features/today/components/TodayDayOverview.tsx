import type {
  IssueStatus,
  PlantingLifecycleStatus,
  Task,
} from '../../../domain/gardens/GardenRepository';
import {
  ActionButton,
  StatusBadge,
} from '../../shared/design/DesignPrimitives';
import {
  formatMonthDay,
  formatPriority,
  formatTaskType,
} from '../todayFormatters';
import type {
  TodayFieldModel,
  TodayHarvestReadyItem,
} from '../todayFieldModel';
import { WeatherPanel } from './TodayFieldCards';
import styles from '../TodayPage.module.css';

type PriorityActionIntent = 'danger' | 'neutral' | 'success' | 'warning';

interface PriorityAction {
  id: string;
  intent: PriorityActionIntent;
  label: string;
  meta: string;
  onSelect(): void;
  verb: string;
}

export function TodayDayOverview({
  model,
  onCompleteTask,
  onLogHarvest,
  onUpdateIssue,
  onUpdatePlantingStatus,
  onWaterDone,
  selectedDate,
  selectedTasks,
}: {
  model: TodayFieldModel;
  onCompleteTask(taskId: string): void;
  onLogHarvest(item: TodayHarvestReadyItem): void;
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
    onLogHarvest,
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
                  <strong className={styles.priorityTitle}>
                    {action.label}
                  </strong>
                  <p>{action.meta}</p>
                </div>
                <ActionButton
                  intent={action.intent}
                  onClick={action.onSelect}
                  priority="primary"
                >
                  {action.verb}
                </ActionButton>
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
  onLogHarvest,
  onUpdateIssue,
  onUpdatePlantingStatus,
  onWaterDone,
  selectedTasks,
}: {
  model: TodayFieldModel;
  onCompleteTask(taskId: string): void;
  onLogHarvest(item: TodayHarvestReadyItem): void;
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
      meta: `${formatWaterAmount(recommendation.targetAmountInches)} in still due. ${recommendation.reasonSummary}`,
      onSelect: () => onWaterDone(recommendation.id),
      intent: 'success' as const,
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
      intent: 'warning' as const,
      verb: 'Start check',
    }));
  const harvestActions = model.harvestReady.slice(0, 1).map((item) => ({
    id: `harvest-${item.planting.id}`,
    label: item.planting.label,
    meta: `${item.cropName}${item.dueDate ? ` due ${formatMonthDay(item.dueDate)}` : ''}`,
    onSelect: () => onLogHarvest(item),
    intent: 'success' as const,
    verb: 'Log harvest',
  }));
  const cropStageActions = model.cropStageActions.slice(0, 1).map((action) => ({
    id: `stage-${action.planting.id}`,
    label: action.planting.label,
    meta: action.summary,
    onSelect: () =>
      onUpdatePlantingStatus(action.planting.id, action.nextStatus),
    intent: 'success' as const,
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
      intent: 'success' as const,
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

function formatWaterAmount(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}
