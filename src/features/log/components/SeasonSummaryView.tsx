import type { buildJournalAnalytics } from '../../journal/journalAnalytics';
import { HarvestSummary } from './HarvestSummary';
import cardStyles from './LogCards.module.css';
import pageStyles from '../LogPage.module.css';

export function SeasonSummaryView({
  analytics,
}: {
  analytics: ReturnType<typeof buildJournalAnalytics>;
}) {
  return (
    <>
      <section className={pageStyles.panel}>
        <h2>{analytics.seasonYear} season summary</h2>
        <div className={cardStyles.metricGrid}>
          <div className={cardStyles.metric}>
            <span>Seedlings / starts</span>
            <strong>{analytics.impact.seedOrSeedlingCount}</strong>
          </div>
          <div className={cardStyles.metric}>
            <span>Harvested plantings</span>
            <strong>{analytics.impact.harvestedPlantings}</strong>
          </div>
          <div className={cardStyles.metric}>
            <span>Rough value</span>
            <strong>{analytics.impact.estimatedValueLabel}</strong>
          </div>
        </div>
        <p className={cardStyles.disclosure}>
          {analytics.impact.estimatedValueNote}
        </p>
      </section>
      <HarvestSummary analytics={analytics} />
    </>
  );
}
