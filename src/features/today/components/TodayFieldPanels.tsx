import { Link } from 'react-router-dom';

import type {
  IssueStatus,
  PlantingLifecycleStatus,
  Task,
  WaterRecommendation,
} from '../../../domain/gardens/GardenRepository';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import { formatTaskType } from '../todayFormatters';
import type {
  TodayFieldModel,
  TodayHarvestReadyItem,
} from '../todayFieldModel';
import { getTaskTargetLink } from '../todayTaskLinks';
import { getCriticalCheckTasks } from '../todaySelectors';
import type { TodayQuickActionState } from './TodayQuickActionRail';
import {
  CropStageCard,
  IssueCard,
  RecentActivityItem,
  WaterCard,
} from './TodayFieldCards';
import { TodayHarvestCard } from './TodayHarvestCard';
import styles from './TodayFieldPanels.module.css';

export function TodayFieldPanels({
  model,
  onCompleteTask,
  onDeferTask,
  onDelayHarvest,
  onLogHarvest,
  onOpenAction,
  onSnoozeTask,
  onUpdatePlantingStatus,
  onUpdateIssue,
  onWaterDone,
  selectedTasks,
  todayDate,
}: {
  model: TodayFieldModel;
  onCompleteTask(taskId: string): void;
  onDeferTask(taskId: string): void;
  onDelayHarvest(
    plantingId: string,
    delayUntilDate: string,
    reason: string,
  ): void;
  onLogHarvest(item: TodayHarvestReadyItem): void;
  onOpenAction(action: TodayQuickActionState): void;
  onSnoozeTask(taskId: string): void;
  onUpdatePlantingStatus(
    plantingId: string,
    status: PlantingLifecycleStatus,
  ): void;
  onUpdateIssue(entryId: string, status: IssueStatus): void;
  onWaterDone(recommendationId: string): void;
  selectedTasks: Task[];
  todayDate: string;
}) {
  const criticalTasks = getCriticalCheckTasks(selectedTasks);
  const hasWatering = model.activeWatering.length > 0;
  const hasCriticalChecks =
    model.urgentAlerts.length > 0 ||
    model.cropStageActions.length > 0 ||
    model.unresolvedIssues.length > 0 ||
    criticalTasks.length > 0;
  const hasAnyFieldPanel =
    hasWatering ||
    hasCriticalChecks ||
    model.harvestReady.length > 0 ||
    model.bedAttention.length > 0 ||
    model.recentActivity.length > 0;

  if (!hasAnyFieldPanel) {
    return null;
  }

  return (
    <div className={styles.fieldStack}>
      {hasWatering ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Water</p>
              <h2>Watering today</h2>
            </div>
            <StatusBadge tone="warning">
              {model.activeWatering.length}
            </StatusBadge>
          </div>
          <div className={styles.compactList}>
            {model.activeWatering.map((recommendation) => (
              <WaterCard
                key={recommendation.id}
                onDone={() => onWaterDone(recommendation.id)}
                onNote={() =>
                  onOpenAction({
                    kind: 'note',
                    targetId: getRecommendationTargetId(recommendation),
                  })
                }
                recommendation={recommendation}
              />
            ))}
          </div>
        </section>
      ) : null}

      {hasCriticalChecks ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Checks</p>
              <h2>Critical field checks</h2>
            </div>
            <StatusBadge tone="warning">
              {model.urgentAlerts.length +
                model.cropStageActions.length +
                model.unresolvedIssues.length +
                criticalTasks.length}
            </StatusBadge>
          </div>
          <div className={styles.compactList}>
            {model.urgentAlerts.map((alert) => (
              <p className={styles.alertItem} key={alert.id}>
                <StatusBadge tone={alert.tone}>{alert.tone}</StatusBadge>
                <span>{alert.message}</span>
              </p>
            ))}
            {criticalTasks.map((task) => (
              <TaskCheckCard
                key={task.id}
                onCompleteTask={onCompleteTask}
                onDeferTask={onDeferTask}
                onSnoozeTask={onSnoozeTask}
                task={task}
              />
            ))}
            {model.cropStageActions.map((action) => (
              <CropStageCard
                action={action}
                key={action.planting.id}
                onUpdatePlantingStatus={onUpdatePlantingStatus}
              />
            ))}
            {model.unresolvedIssues.map((issue) => (
              <IssueCard
                issue={issue}
                key={issue.id}
                onUpdateIssue={onUpdateIssue}
              />
            ))}
          </div>
        </section>
      ) : null}

      {model.harvestReady.length > 0 ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Harvest</p>
              <h2>Ready to pick</h2>
            </div>
            <StatusBadge>{model.harvestReady.length}</StatusBadge>
          </div>
          <div className={styles.compactList}>
            {model.harvestReady.map((item) => (
              <TodayHarvestCard
                item={item}
                key={item.planting.id}
                onDelayHarvest={onDelayHarvest}
                onLogHarvest={onLogHarvest}
                onOpenAction={onOpenAction}
                todayDate={todayDate}
              />
            ))}
          </div>
        </section>
      ) : null}

      {model.bedAttention.length > 0 ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Attention</p>
              <h2>Beds and containers</h2>
            </div>
            <StatusBadge>{model.bedAttention.length}</StatusBadge>
          </div>
          <ul className={styles.bedList}>
            {model.bedAttention.map((bed) => (
              <li key={bed.label}>
                <span>
                  {bed.label}
                  <small>{bed.summary}</small>
                </span>
                <strong>{bed.count}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {model.recentActivity.length > 0 ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>Recent</p>
              <h2>Feed highlights</h2>
            </div>
            <StatusBadge>{model.recentActivity.length}</StatusBadge>
          </div>
          <div className={styles.compactList}>
            {model.recentActivity.map((activity) => (
              <RecentActivityItem activity={activity} key={activity.id} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function getRecommendationTargetId(recommendation: WaterRecommendation) {
  return recommendation.targetType === 'planting'
    ? `planting:${recommendation.plantingId ?? recommendation.targetId}`
    : `structure:${recommendation.targetId}`;
}

function TaskCheckCard({
  onCompleteTask,
  onDeferTask,
  onSnoozeTask,
  task,
}: {
  onCompleteTask(taskId: string): void;
  onDeferTask(taskId: string): void;
  onSnoozeTask(taskId: string): void;
  task: Task;
}) {
  const targetLink = getTaskTargetLink(task);

  return (
    <article className={styles.miniCard}>
      <div>
        <h3>{task.title}</h3>
        <p>
          {formatTaskType(task.type)}, {task.bedLabel ?? 'Open plot'}
        </p>
        {task.notes ? <small>{task.notes}</small> : null}
      </div>
      <div className={styles.cardActions}>
        <button onClick={() => onCompleteTask(task.id)} type="button">
          Task done
        </button>
        <button onClick={() => onSnoozeTask(task.id)} type="button">
          Snooze
        </button>
        <button onClick={() => onDeferTask(task.id)} type="button">
          Defer
        </button>
        {targetLink ? <Link to={targetLink.to}>{targetLink.label}</Link> : null}
      </div>
    </article>
  );
}
