import type { WateringRecommendation } from '../../domain/watering';
import { Button } from '../../ui';
import {
  formatInstant,
  humanize,
  recommendationBasisRows,
  recommendationDisplay,
} from './todayModel';
import styles from './Watering.module.css';
import type { TodayLinkComponent } from './types';

export function WateringCard({
  isFocused,
  LinkComponent,
  onLog,
  recommendation,
  timezone,
}: {
  isFocused: boolean;
  LinkComponent: TodayLinkComponent;
  onLog(recommendation: WateringRecommendation): void;
  recommendation: WateringRecommendation;
  timezone: string;
}) {
  const display = recommendationDisplay(recommendation, timezone);
  const titleId = `watering-${safeId(recommendation.id)}`;
  const balancePercent = Math.min(
    100,
    Math.max(
      0,
      (recommendation.balance.depletionInches /
        Math.max(recommendation.triggerDepletionInches, 0.01)) *
        100,
    ),
  );

  return (
    <article
      aria-labelledby={titleId}
      className={styles.wateringCard}
      data-status={recommendation.status}
      data-today-focus={isFocused ? 'true' : undefined}
      {...(isFocused ? { tabIndex: -1 } : {})}
    >
      <header className={styles.cardHeader}>
        <div>
          <p className={styles.cardEyebrow}>Crop group</p>
          <h3 id={titleId}>
            {recommendation.target.cropGroupLabel ??
              recommendation.target.cropName}
          </h3>
        </div>
        <span className={`${styles.statusPill} ${styles[display.statusTone]}`}>
          {display.statusLabel}
        </span>
      </header>

      <p className={styles.recommendationInstruction}>{display.instruction}</p>
      {display.amount ? (
        <p className={styles.exactAmount}>
          <span>Recommendation</span>
          <strong>{display.amount}</strong>
        </p>
      ) : null}

      <div className={styles.qualityRow} aria-label="Recommendation quality">
        <span>
          <strong>{humanize(recommendation.confidence)}</strong> confidence
        </span>
        <span>
          <strong>{humanize(recommendation.dataQuality)}</strong> weather data
        </span>
      </div>

      <div className={styles.balanceBlock}>
        <div>
          <span>Root-zone depletion</span>
          <strong>
            {recommendation.balance.depletionInches.toFixed(2)} in of{' '}
            {recommendation.triggerDepletionInches.toFixed(2)} in trigger
          </strong>
        </div>
        <div
          aria-label={`${Math.round(balancePercent)} percent of crop watering threshold`}
          className={styles.meter}
          role="meter"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(balancePercent)}
        >
          <span style={{ inlineSize: `${balancePercent}%` }} />
        </div>
      </div>

      <details className={styles.details}>
        <summary>Why this recommendation</summary>
        <ul className={styles.reasonList}>
          {recommendation.reasonDetails.map((reason, index) => (
            <li key={`${reason.code}:${index}`}>
              <strong>{humanize(reason.code.toLowerCase())}</strong>
              <span>{reason.message}</span>
              {reason.amountInches !== null ? (
                <small>{reason.amountInches.toFixed(2)} in</small>
              ) : null}
            </li>
          ))}
        </ul>
      </details>

      <details className={styles.details}>
        <summary>Calculation basis</summary>
        <dl className={styles.basisList}>
          {recommendationBasisRows(recommendation).map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
          <div>
            <dt>Calculated</dt>
            <dd>{formatInstant(recommendation.calculatedAtIso, timezone)}</dd>
          </div>
          <div>
            <dt>Next check</dt>
            <dd>{formatInstant(recommendation.recheckAtIso, timezone)}</dd>
          </div>
        </dl>
      </details>

      <footer className={styles.cardActions}>
        <Button onClick={() => onLog(recommendation)}>
          Log watering decision
        </Button>
        <LinkComponent
          className={styles.inlineLink ?? ''}
          to={`/app/plan?plantingId=${encodeURIComponent(recommendation.target.cropGroupId)}`}
        >
          Open crop details
        </LinkComponent>
      </footer>
    </article>
  );
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}
