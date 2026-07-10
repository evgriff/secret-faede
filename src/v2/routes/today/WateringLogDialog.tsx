import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import type { WateringRecommendation } from '../../domain/watering';
import { Button, Modal, StatusBanner, TextField } from '../../ui';
import {
  createWateringLogDraft,
  validateWateringLogDraft,
  wateringLogInput,
  wateringMethodEfficiency,
} from './todayModel';
import styles from './Watering.module.css';
import type {
  TodayActionResult,
  TodayWateringLogInput,
  WateringLogDraft,
  WateringLogErrors,
  WateringLogOutcome,
  WateringMethod,
} from './types';

const outcomes: ReadonlyArray<{
  detail: string;
  label: string;
  value: WateringLogOutcome;
}> = [
  {
    detail: 'The measured amount was fully applied.',
    label: 'Applied',
    value: 'applied',
  },
  {
    detail: 'Some water was applied; record only the amount used.',
    label: 'Partial',
    value: 'partial',
  },
  {
    detail: 'No water was applied and the water balance gets zero credit.',
    label: 'Skipped',
    value: 'skipped',
  },
];

const methods: Array<{ label: string; value: WateringMethod }> = [
  { label: 'Drip irrigation', value: 'drip' },
  { label: 'Hose', value: 'hose' },
  { label: 'Hand watering', value: 'hand' },
  { label: 'Sprinkler', value: 'sprinkler' },
  { label: 'Other', value: 'other' },
];

export function WateringLogDialog({
  onClose,
  onLog,
  onSaved,
  recommendation,
  today,
}: {
  onClose(): void;
  onLog(input: TodayWateringLogInput): Promise<TodayActionResult>;
  onSaved(result: TodayActionResult, outcome: WateringLogOutcome): void;
  recommendation: WateringRecommendation | null;
  today: string;
}) {
  const formId = useId();
  const submittingRef = useRef(false);
  const [draft, setDraft] = useState<WateringLogDraft | null>(null);
  const [errors, setErrors] = useState<WateringLogErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDraft(
      recommendation ? createWateringLogDraft(recommendation, today) : null,
    );
    setErrors({});
    setSubmitError(null);
  }, [recommendation, today]);

  function update<K extends keyof WateringLogDraft>(
    key: K,
    value: WateringLogDraft[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !recommendation || submittingRef.current) return;
    const nextErrors = validateWateringLogDraft(draft, today);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onLog(wateringLogInput(recommendation, draft));
      onSaved(result, draft.outcome);
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : 'The watering decision was not saved. Try again.',
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  function requestClose() {
    if (!isSubmitting) onClose();
  }

  return (
    <Modal
      description={
        recommendation
          ? `Record what happened for ${recommendation.target.cropGroupLabel ?? recommendation.target.cropName}.`
          : undefined
      }
      footer={
        <>
          <Button
            disabled={isSubmitting}
            onClick={requestClose}
            variant="quiet"
          >
            Cancel
          </Button>
          <Button
            busyLabel="Saving decision…"
            form={formId}
            isBusy={isSubmitting}
            type="submit"
          >
            Save decision
          </Button>
        </>
      }
      isOpen={recommendation !== null}
      onClose={requestClose}
      title="Log watering"
    >
      {draft ? (
        <form
          className={styles.logForm}
          id={formId}
          onSubmit={(event) => void submit(event)}
        >
          <fieldset className={styles.choiceGroup}>
            <legend>What happened?</legend>
            {outcomes.map((outcome) => (
              <label key={outcome.value}>
                <input
                  checked={draft.outcome === outcome.value}
                  name="watering-outcome"
                  onChange={() => update('outcome', outcome.value)}
                  type="radio"
                  value={outcome.value}
                />
                <span>
                  <strong>{outcome.label}</strong>
                  <small>{outcome.detail}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <TextField
            error={errors.occurredOn ?? null}
            label="Date"
            max={today}
            onChange={(event) =>
              update('occurredOn', event.currentTarget.value)
            }
            required
            type="date"
            value={draft.occurredOn}
          />

          <label className={styles.field}>
            <span>Watering method</span>
            <select
              onChange={(event) =>
                update('method', event.currentTarget.value as WateringMethod)
              }
              value={draft.method}
            >
              {methods.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            {draft.outcome !== 'skipped' ? (
              <small>
                The balance conservatively credits{' '}
                {Math.round(
                  wateringMethodEfficiency(draft.method).fraction * 100,
                )}
                % of the entered amount for this method. This is an estimate,
                not a measured calibration.
              </small>
            ) : null}
          </label>

          {draft.outcome === 'skipped' ? (
            <TextField
              error={errors.skipReason ?? null}
              hint="Skipped watering always adds zero water to the crop balance."
              label="Why was it skipped?"
              onChange={(event) =>
                update('skipReason', event.currentTarget.value)
              }
              placeholder="Rain arrived, soil still moist…"
              required
              value={draft.skipReason}
            />
          ) : (
            <div className={styles.amountFields}>
              <TextField
                error={errors.amount ?? null}
                inputMode="decimal"
                label={
                  draft.outcome === 'partial'
                    ? 'Amount actually applied'
                    : 'Amount applied'
                }
                min="0.01"
                onChange={(event) =>
                  update('amount', event.currentTarget.value)
                }
                required
                step="0.01"
                type="number"
                value={draft.amount}
              />
              <label className={styles.field}>
                <span>Unit</span>
                <select
                  onChange={(event) =>
                    update(
                      'amountUnit',
                      event.currentTarget
                        .value as WateringLogDraft['amountUnit'],
                    )
                  }
                  value={draft.amountUnit}
                >
                  <option value="gallons">Gallons</option>
                  <option value="inches">Inches of water</option>
                </select>
              </label>
            </div>
          )}

          {submitError ? (
            <StatusBanner tone="error">{submitError}</StatusBanner>
          ) : null}
        </form>
      ) : null}
    </Modal>
  );
}
