import { useState } from 'react';

import { addDays, formatMonthDay } from '../todayFormatters';
import type { TodayHarvestReadyItem } from '../todayFieldModel';
import type { TodayQuickActionState } from './TodayQuickActionRail';
import styles from './TodayFieldPanels.module.css';

const delayOptions = [
  { days: 1, label: 'Tomorrow' },
  { days: 2, label: '2 days' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
];

export function TodayHarvestCard({
  item,
  onDelayHarvest,
  onOpenAction,
  todayDate,
}: {
  item: TodayHarvestReadyItem;
  onDelayHarvest(
    plantingId: string,
    delayUntilDate: string,
    reason: string,
  ): void;
  onOpenAction(action: TodayQuickActionState): void;
  todayDate: string;
}) {
  const minCustomDate = addDays(todayDate, 1);
  const [customDate, setCustomDate] = useState(addDays(todayDate, 3));
  const [showDelayControls, setShowDelayControls] = useState(false);

  function delayHarvest(days: number, label: string) {
    const delayUntilDate = addDays(todayDate, days);

    onDelayHarvest(
      item.planting.id,
      delayUntilDate,
      `Checked ${item.planting.label} on ${todayDate}; not ready. Recheck ${label.toLowerCase()}.`,
    );
  }

  function delayHarvestToCustomDate() {
    onDelayHarvest(
      item.planting.id,
      customDate,
      `Checked ${item.planting.label} on ${todayDate}; not ready. Recheck ${formatMonthDay(customDate)}.`,
    );
  }

  return (
    <article className={styles.miniCard}>
      <div>
        <h3>{item.planting.label}</h3>
        <p>
          {item.cropName}
          {item.dueDate ? `, due ${formatMonthDay(item.dueDate)}` : ''}
        </p>
        {item.delayReason ? <small>{item.delayReason}</small> : null}
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
        <button
          aria-expanded={showDelayControls}
          onClick={() => setShowDelayControls((current) => !current)}
          type="button"
        >
          Not ready
        </button>
        {showDelayControls ? (
          <div className={styles.delayControls}>
            {delayOptions.map((option) => (
              <button
                key={option.days}
                onClick={() => delayHarvest(option.days, option.label)}
                type="button"
              >
                {option.label}
              </button>
            ))}
            <label>
              <span>Custom date</span>
              <input
                min={minCustomDate}
                onChange={(event) => setCustomDate(event.currentTarget.value)}
                type="date"
                value={customDate}
              />
            </label>
            <button
              disabled={!customDate || customDate < minCustomDate}
              onClick={delayHarvestToCustomDate}
              type="button"
            >
              Set date
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
