import { useEffect, useState, type FormEvent } from 'react';

import type { WateringScheduleEntry } from '../../../domain/gardens/GardenRepository';
import { ActionButton, Sheet } from '../../shared/design/DesignPrimitives';
import styles from './TodayWateringSheet.module.css';

export interface TodayWateringSheetState {
  mode: 'adjust' | 'partial';
  recommendationId: string;
}

export function TodayWateringSheet({
  action,
  onAdjustAmount,
  onClose,
  onSubmitPartial,
  recommendation,
}: {
  action: TodayWateringSheetState | null;
  onAdjustAmount(
    recommendationId: string,
    amountInches: number,
  ): Promise<boolean>;
  onClose(): void;
  onSubmitPartial(
    recommendationId: string,
    amountInches: number,
  ): Promise<boolean>;
  recommendation: WateringScheduleEntry | null;
}) {
  const [amountInches, setAmountInches] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!action || !recommendation) {
      setAmountInches('');
      setError(null);
      return;
    }

    setAmountInches(formatInputAmount(recommendation.targetAmountInches));
    setError(null);
  }, [action, recommendation]);

  if (!action || !recommendation) {
    return null;
  }

  const activeRecommendation = recommendation;
  const isPartial = action.mode === 'partial';
  const title = isPartial ? 'Partial watering' : 'Adjust watering amount';
  const submitLabel = isPartial
    ? 'Save partial watering'
    : 'Save remaining amount';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number.parseFloat(amountInches);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than 0 inches.');
      return;
    }

    setError(null);

    if (isPartial) {
      await onSubmitPartial(activeRecommendation.id, parsedAmount);
      return;
    }

    await onAdjustAmount(activeRecommendation.id, parsedAmount);
  }

  return (
    <Sheet
      bodyClassName={styles.sheetBody}
      className={styles.sheet}
      closeLabel="Close watering action"
      description={
        isPartial
          ? 'Record the amount you actually applied so Today can keep the remaining watering work visible.'
          : 'Set the remaining amount still due for this target.'
      }
      kicker="Watering"
      onClose={onClose}
      title={title}
    >
      <div className={styles.summaryCard}>
        <div>
          <p className={styles.kicker}>Target</p>
          <h3>{activeRecommendation.targetLabel}</h3>
        </div>
        <p className={styles.summaryAmount}>
          {formatSummaryAmount(activeRecommendation.targetAmountInches)} in
          remaining
        </p>
        <p className={styles.summaryReason}>
          {activeRecommendation.reasonSummary}
        </p>
      </div>

      <form
        className={styles.form}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label className={styles.field}>
          <span>
            {isPartial
              ? 'Amount applied (inches)'
              : 'Remaining amount due (inches)'}
          </span>
          <input
            autoFocus
            inputMode="decimal"
            min="0.05"
            onChange={(event) => setAmountInches(event.currentTarget.value)}
            step="0.05"
            type="number"
            value={amountInches}
          />
          <small>
            {isPartial
              ? 'Use the actual amount you applied. Today will keep any remaining deficit visible.'
              : 'Use the amount that should still be watered after what you saw in the garden.'}
          </small>
        </label>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.actions}>
          <ActionButton intent="success" priority="primary" type="submit">
            {submitLabel}
          </ActionButton>
          <ActionButton onClick={onClose} priority="secondary" type="button">
            Cancel
          </ActionButton>
        </div>
      </form>
    </Sheet>
  );
}

function formatInputAmount(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatSummaryAmount(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}
