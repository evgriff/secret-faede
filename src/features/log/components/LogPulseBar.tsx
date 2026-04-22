import type { buildJournalAnalytics } from '../../journal/journalAnalytics';
import styles from '../LogPage.module.css';

export function LogPulseBar({
  analytics,
  feedItemCount,
  harvestCount,
}: {
  analytics: ReturnType<typeof buildJournalAnalytics>;
  feedItemCount: number;
  harvestCount: number;
}) {
  return (
    <section aria-label="Feed summary" className={styles.pulseBar}>
      <PulseItem label="Memories" value={String(feedItemCount)} />
      {analytics.issues.unresolved > 0 ? (
        <PulseItem
          label="Open issues"
          tone="warning"
          value={String(analytics.issues.unresolved)}
        />
      ) : (
        <PulseItem
          label="Open issues"
          value={String(analytics.issues.unresolved)}
        />
      )}
      <PulseItem label="Harvests" value={String(harvestCount)} />
      <PulseItem
        label="Photos"
        value={String(analytics.media.attachedPhotos)}
      />
    </section>
  );
}

function PulseItem({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: 'warning';
  value: string;
}) {
  return (
    <span className={tone === 'warning' ? styles.pulseWarning : undefined}>
      <strong>{value}</strong>
      {label}
    </span>
  );
}
