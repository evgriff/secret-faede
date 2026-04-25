import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { ActionButton, Sheet } from '../../shared/design/DesignPrimitives';
import type { TodayWateringGroup } from '../todayWateringGroups';
import styles from './TodayWateringSheet.module.css';

export interface TodayWateringSheetState {
  groupId: string;
}

type WateringSheetMode = 'adjust' | 'partial' | 'review';

export function TodayWateringSheet({
  action,
  group,
  onAdjustAmount,
  onClose,
  onSkipGroupForRain,
  onSnoozeGroup,
  onSubmitPartial,
  onWaterDoneGroup,
}: {
  action: TodayWateringSheetState | null;
  group: TodayWateringGroup | null;
  onAdjustAmount(
    recommendationId: string,
    amountInches: number,
  ): Promise<boolean>;
  onClose(): void;
  onSkipGroupForRain(recommendationIds: string[]): void;
  onSnoozeGroup(
    recommendationIds: string[],
    option: 'tonight' | 'tomorrow',
  ): void;
  onSubmitPartial(
    recommendationId: string,
    amountInches: number,
  ): Promise<boolean>;
  onWaterDoneGroup(recommendationIds: string[]): void;
}) {
  const [amountInches, setAmountInches] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<WateringSheetMode>('review');
  const [selectedRecommendationId, setSelectedRecommendationId] = useState<
    string | null
  >(null);

  const selectedRecommendation = useMemo(
    () =>
      group?.entries.find((entry) => entry.id === selectedRecommendationId) ??
      null,
    [group, selectedRecommendationId],
  );

  useEffect(() => {
    if (!action || !group) {
      setAmountInches('');
      setError(null);
      setMode('review');
      setSelectedRecommendationId(null);
      return;
    }

    setAmountInches('');
    setError(null);
    setMode('review');
    setSelectedRecommendationId(null);
  }, [action, group]);

  useEffect(() => {
    if (!selectedRecommendation || mode === 'review') {
      setAmountInches('');
      return;
    }

    setAmountInches(
      formatInputAmount(selectedRecommendation.targetAmountInches),
    );
  }, [mode, selectedRecommendation]);

  if (!action || !group) {
    return null;
  }

  const isEditMode = mode !== 'review' && selectedRecommendation;
  const title = isEditMode
    ? mode === 'partial'
      ? 'Partial watering'
      : 'Adjust watering amount'
    : 'Review watering';
  const description = isEditMode
    ? mode === 'partial'
      ? 'Record the amount you actually applied so Today can keep the remaining watering work visible.'
      : 'Set the remaining amount still due for this target.'
    : 'Review this watering run, then finish it at once or update one target precisely.';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRecommendation) {
      return;
    }

    const parsedAmount = Number.parseFloat(amountInches);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than 0 inches.');
      return;
    }

    setError(null);
    const saved =
      mode === 'partial'
        ? await onSubmitPartial(selectedRecommendation.id, parsedAmount)
        : await onAdjustAmount(selectedRecommendation.id, parsedAmount);

    if (saved) {
      setMode('review');
      setSelectedRecommendationId(null);
      setAmountInches('');
    }
  }

  return (
    <Sheet
      bodyClassName={styles.sheetBody}
      className={styles.sheet}
      closeLabel="Close watering action"
      description={description}
      kicker="Watering"
      onClose={onClose}
      title={title}
    >
      <div className={styles.summaryCard}>
        <div>
          <p className={styles.kicker}>Watering run</p>
          <h3>{group.label}</h3>
        </div>
        <p className={styles.summaryAmount}>
          {formatSummaryAmount(group.totalTargetAmountInches)} in across{' '}
          {group.targetCount} target{group.targetCount === 1 ? '' : 's'}
        </p>
        <p className={styles.summaryReason}>{group.reasonSummary}</p>
        {group.statusSummary ? (
          <p className={styles.summaryReason}>{group.statusSummary}</p>
        ) : null}
        <div className={styles.memberChips}>
          {group.memberLabels.map((label) => (
            <span className={styles.memberChip} key={label}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {isEditMode ? (
        <form
          className={styles.form}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className={styles.targetCard}>
            <p className={styles.kicker}>Target</p>
            <h3>{selectedRecommendation.targetLabel}</h3>
            <p className={styles.summaryReason}>
              {formatSummaryAmount(selectedRecommendation.targetAmountInches)}{' '}
              in remaining
            </p>
            <p className={styles.summaryReason}>
              {selectedRecommendation.reasonSummary}
            </p>
          </div>
          <label className={styles.field}>
            <span>
              {mode === 'partial'
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
              {mode === 'partial'
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
              {mode === 'partial'
                ? 'Save partial watering'
                : 'Save remaining amount'}
            </ActionButton>
            <ActionButton
              onClick={() => {
                setMode('review');
                setSelectedRecommendationId(null);
                setError(null);
              }}
              priority="secondary"
              type="button"
            >
              Back to watering run
            </ActionButton>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.groupActions}>
            <ActionButton
              intent="success"
              onClick={() => onWaterDoneGroup(group.entryIds)}
              priority="primary"
            >
              Water all done
            </ActionButton>
            <ActionButton
              intent="warning"
              onClick={() => onSkipGroupForRain(group.entryIds)}
              priority="secondary"
            >
              Skip for rain
            </ActionButton>
            <ActionButton
              onClick={() => onSnoozeGroup(group.entryIds, 'tonight')}
              priority="ghost"
            >
              Snooze to tonight
            </ActionButton>
            <ActionButton
              onClick={() => onSnoozeGroup(group.entryIds, 'tomorrow')}
              priority="ghost"
            >
              Snooze to tomorrow
            </ActionButton>
          </div>

          <div className={styles.entryList}>
            {group.entries.map((entry) => (
              <article className={styles.entryCard} key={entry.id}>
                <div>
                  <h3>{entry.targetLabel}</h3>
                  <p className={styles.entryMeta}>
                    {formatSummaryAmount(entry.targetAmountInches)} in still due
                  </p>
                  <small>{entry.reasonSummary}</small>
                </div>
                <div className={styles.entryActions}>
                  <ActionButton
                    onClick={() => {
                      setMode('partial');
                      setSelectedRecommendationId(entry.id);
                      setError(null);
                    }}
                    priority="secondary"
                  >
                    Partial watering
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      setMode('adjust');
                      setSelectedRecommendationId(entry.id);
                      setError(null);
                    }}
                    priority="ghost"
                  >
                    Adjust amount
                  </ActionButton>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

function formatInputAmount(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}

function formatSummaryAmount(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(2);
}
