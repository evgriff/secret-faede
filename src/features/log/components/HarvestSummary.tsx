import type { buildJournalAnalytics } from '../../journal/journalAnalytics';
import cardStyles from './LogCards.module.css';
import pageStyles from '../LogPage.module.css';

export function HarvestSummary({
  analytics,
}: {
  analytics: ReturnType<typeof buildJournalAnalytics>;
}) {
  return (
    <section className={pageStyles.panel}>
      <div className={pageStyles.sectionHeader}>
        <div>
          <h2>Harvest summary</h2>
          <p className={pageStyles.summary}>
            Crop, bed, and season totals for {analytics.seasonYear}.
          </p>
        </div>
      </div>
      <div className={cardStyles.summaryColumns}>
        <SummaryList
          empty="No crop yield yet."
          items={analytics.yieldByCrop.map((item) => ({
            label: item.cropName,
            value: item.total,
          }))}
          title="By crop"
        />
        <SummaryList
          empty="No bed yield yet."
          items={analytics.yieldByBed.map((item) => ({
            label: item.bedName,
            value: item.total,
          }))}
          title="By bed"
        />
      </div>
    </section>
  );
}

export function SummaryList({
  empty,
  items,
  title,
}: {
  empty: string;
  items: Array<{ label: string; value: string }>;
  title: string;
}) {
  return (
    <section className={cardStyles.summaryList}>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul className={cardStyles.simpleList}>
          {items.map((item) => (
            <li key={`${title}-${item.label}-${item.value}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cardStyles.empty}>{empty}</p>
      )}
    </section>
  );
}
