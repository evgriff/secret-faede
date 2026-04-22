import type { buildJournalAnalytics } from '../../journal/journalAnalytics';
import { SummaryList } from './HarvestSummary';
import cardStyles from './LogCards.module.css';
import pageStyles from '../LogPage.module.css';

export function LogAnalyticsPanel({
  analytics,
}: {
  analytics: ReturnType<typeof buildJournalAnalytics>;
}) {
  return (
    <>
      <section className={pageStyles.panel}>
        <h2>Season summary</h2>
        <div className={cardStyles.metricGrid}>
          <Metric
            label="Seedlings / starts"
            value={String(analytics.impact.seedOrSeedlingCount)}
          />
          <Metric
            label="Harvest events"
            value={String(analytics.impact.harvestEvents)}
          />
          <Metric
            label="Rough value"
            value={analytics.impact.estimatedValueLabel}
          />
        </div>
        <p className={cardStyles.disclosure}>
          {analytics.impact.estimatedValueNote}
        </p>
      </section>
      <section className={cardStyles.metricGrid}>
        <Metric
          label="Unresolved issues"
          value={String(analytics.issues.unresolved)}
        />
        <Metric
          label="In progress"
          value={String(analytics.issues.inProgress)}
        />
        <Metric label="Photos" value={String(analytics.media.attachedPhotos)} />
      </section>
      <section className={cardStyles.metricGrid}>
        <Metric
          label="High severity"
          value={String(analytics.issues.highSeverity)}
        />
        <Metric
          label="Water alerts"
          value={`${analytics.waterAlerts.acknowledged}/${analytics.waterAlerts.sent}`}
        />
        <Metric
          label="Ack rate"
          value={
            analytics.waterAlerts.acknowledgementRate === null
              ? 'n/a'
              : `${analytics.waterAlerts.acknowledgementRate}%`
          }
        />
      </section>
      <section className={pageStyles.panel}>
        <h2>Harvest totals</h2>
        <SimpleList
          empty="No season harvest totals yet."
          items={analytics.harvestTotals.map((item) => ({
            label: item.label,
            value: item.value,
          }))}
        />
      </section>
      <section className={pageStyles.panel}>
        <h2>Performance</h2>
        <SummaryList
          empty="No clear best performers yet."
          items={analytics.performance.bestPerformers.map((item) => ({
            label: item.label,
            value: item.detail,
          }))}
          title="Best performers"
        />
        <SummaryList
          empty="No underperformers identified yet."
          items={analytics.performance.underperformers.map((item) => ({
            label: item.label,
            value: item.detail,
          }))}
          title="Watch list"
        />
      </section>
      <section className={pageStyles.panel}>
        <h2>Most active beds</h2>
        <SimpleList
          empty="No bed activity yet."
          items={analytics.activeBeds.map((item) => ({
            label: item.label,
            value: String(item.count),
          }))}
        />
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={cardStyles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SimpleList({
  empty,
  items,
}: {
  empty: string;
  items: Array<{ label: string; value: string }>;
}) {
  return items.length > 0 ? (
    <ul className={cardStyles.simpleList}>
      {items.map((item) => (
        <li key={`${item.label}-${item.value}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </li>
      ))}
    </ul>
  ) : (
    <p className={cardStyles.empty}>{empty}</p>
  );
}
