import { type SuccessionRecommendation } from '../../tasks/taskEngine';
import { formatLongDate } from '../todayFormatters';
import styles from '../TodayPage.module.css';

export function TodaySidebar({
  bedCounts,
  onAddSuccession,
  successionRecommendations,
}: {
  bedCounts: Array<{ count: number; label: string }>;
  onAddSuccession(recommendation: SuccessionRecommendation): void;
  successionRecommendations: SuccessionRecommendation[];
}) {
  if (bedCounts.length === 0 && successionRecommendations.length === 0) {
    return null;
  }

  return (
    <aside className={styles.sidebar}>
      {bedCounts.length > 0 ? (
        <section className={styles.panel}>
          <h2>By bed</h2>
          <ul className={styles.bedList}>
            {bedCounts.map((bed) => (
              <li key={bed.label}>
                <span>{bed.label}</span>
                <strong>{bed.count}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {successionRecommendations.length > 0 ? (
        <section className={styles.panel}>
          <h2>Succession</h2>
          <div className={styles.successionList}>
            {successionRecommendations.map((recommendation) => (
              <SuccessionCard
                key={recommendation.id}
                onAdd={() => onAddSuccession(recommendation)}
                recommendation={recommendation}
              />
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function SuccessionCard({
  onAdd,
  recommendation,
}: {
  onAdd(): void;
  recommendation: SuccessionRecommendation;
}) {
  return (
    <article className={styles.successionCard}>
      <h3>{recommendation.cropName}</h3>
      <p>{recommendation.reason}</p>
      <div className={styles.meta}>
        <span>Bed opens {formatLongDate(recommendation.bedOpensOn)}</span>
        <span>{recommendation.targetLabel}</span>
      </div>
      <button onClick={onAdd} type="button">
        Add task
      </button>
    </article>
  );
}
