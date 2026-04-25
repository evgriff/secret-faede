import { StatusBadge } from '../../shared/design/DesignPrimitives';
import { formatMonthDay } from '../todayFormatters';
import type { TodayHarvestScheduleItem } from '../todayFieldModel';
import type { TodayQuickActionState } from './TodayQuickActionRail';
import styles from './TodayFieldPanels.module.css';

export function TodayHarvestCard({
  item,
  onOpenAction,
}: {
  item: TodayHarvestScheduleItem;
  onOpenAction(action: TodayQuickActionState): void;
}) {
  return (
    <article className={styles.miniCard}>
      <div className={styles.harvestCopy}>
        <div className={styles.harvestHeader}>
          <h3>{item.planting.label}</h3>
          <StatusBadge tone={getHarvestTone(item.status)}>
            {getHarvestBadgeLabel(item.status)}
          </StatusBadge>
        </div>
        <p>
          {item.cropName}, expected {formatMonthDay(item.expectedHarvestDate)}
        </p>
        <small>{item.summary}</small>
      </div>
      <div className={styles.harvestActions}>
        <button
          onClick={() =>
            onOpenAction({
              kind: 'harvest',
              plantingId: item.planting.id,
            })
          }
          type="button"
        >
          Log harvest
        </button>
      </div>
    </article>
  );
}

function getHarvestBadgeLabel(status: TodayHarvestScheduleItem['status']) {
  const labels: Record<TodayHarvestScheduleItem['status'], string> = {
    late: 'Late',
    opening: 'Soon',
    ready: 'Now',
    upcoming: 'Coming',
  };

  return labels[status];
}

function getHarvestTone(status: TodayHarvestScheduleItem['status']) {
  if (status === 'late') {
    return 'warning';
  }

  if (status === 'ready') {
    return 'success';
  }

  return 'neutral';
}
