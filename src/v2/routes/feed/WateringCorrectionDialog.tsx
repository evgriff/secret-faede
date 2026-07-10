import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { getGardenDate } from '../../domain/time';
import type { WaterApplication } from '../../domain/watering';
import { Button, Modal, StatusBanner, TextField } from '../../ui';
import { validateWateringLogDraft, wateringMethodEfficiency } from '../today';
import type {
  WateringLogDraft,
  WateringLogErrors,
  WateringMethod,
} from '../today';
import styles from './WateringCorrectionDialog.module.css';
import type { FeedCorrectWateringInput, FeedCreateResult } from './types';

const outcomes = [
  { label: 'Applied', value: 'applied' },
  { label: 'Partial', value: 'partial' },
  { label: 'Skipped', value: 'skipped' },
] as const;

const methods: Array<{ label: string; value: WateringMethod }> = [
  { label: 'Drip irrigation', value: 'drip' },
  { label: 'Hose', value: 'hose' },
  { label: 'Hand watering', value: 'hand' },
  { label: 'Sprinkler', value: 'sprinkler' },
  { label: 'Other', value: 'other' },
];

export function WateringCorrectionDialog({
  application,
  onClose,
  onCorrect,
  onSaved,
  timezone,
  today,
}: {
  application: WaterApplication | null;
  onClose(): void;
  onCorrect(input: FeedCorrectWateringInput): Promise<FeedCreateResult>;
  onSaved(result: FeedCreateResult): void;
  timezone: string;
  today: string;
}) {
  const formId = useId();
  const submittingRef = useRef(false);
  const [draft, setDraft] = useState<WateringLogDraft | null>(null);
  const [errors, setErrors] = useState<WateringLogErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDraft(application ? correctionDraft(application, timezone) : null);
    setErrors({});
    setSubmitError(null);
  }, [application, timezone]);

  function update<K extends keyof WateringLogDraft>(
    key: K,
    value: WateringLogDraft[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !application || submittingRef.current) return;
    const nextErrors = validateWateringLogDraft(draft, today);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onCorrect(correctionInput(application.id, draft));
      onSaved(result);
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : 'The watering correction was not saved. Try again.',
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
        application
          ? `Update revision ${application.revision} in place. Its crop group and original recorder stay fixed.`
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
            busyLabel="Saving correction…"
            form={formId}
            isBusy={isSubmitting}
            type="submit"
          >
            Save correction
          </Button>
        </>
      }
      isOpen={application !== null}
      onClose={requestClose}
      title="Correct watering record"
    >
      {draft ? (
        <form
          className={styles.form}
          id={formId}
          onSubmit={(event) => void submit(event)}
        >
          <fieldset className={styles.outcomes}>
            <legend>Corrected outcome</legend>
            {outcomes.map((outcome) => (
              <label key={outcome.value}>
                <input
                  checked={draft.outcome === outcome.value}
                  name="corrected-watering-outcome"
                  onChange={() => update('outcome', outcome.value)}
                  type="radio"
                  value={outcome.value}
                />
                <span>{outcome.label}</span>
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
              aria-label="Watering method"
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
                Estimated effective credit:{' '}
                {Math.round(
                  wateringMethodEfficiency(draft.method).fraction * 100,
                )}
                %.
              </small>
            ) : null}
          </label>

          {draft.outcome === 'skipped' ? (
            <TextField
              error={errors.skipReason ?? null}
              hint="A skipped record receives zero water credit."
              label="Reason"
              onChange={(event) =>
                update('skipReason', event.currentTarget.value)
              }
              required
              value={draft.skipReason}
            />
          ) : (
            <div className={styles.amountFields}>
              <TextField
                error={errors.amount ?? null}
                inputMode="decimal"
                label="Amount actually applied"
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
                  aria-label="Unit"
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

function correctionDraft(
  application: WaterApplication,
  timezone: string,
): WateringLogDraft {
  if (application.outcome === 'skipped') {
    return {
      amount: '',
      amountUnit: 'gallons',
      method: application.method,
      occurredOn: getGardenDate(application.appliedAtIso, timezone),
      outcome: 'skipped',
      skipReason: application.skipReason,
    };
  }
  return {
    amount:
      application.amount.unit === 'gallons'
        ? String(application.amount.gallons)
        : application.amount.unit === 'inches'
          ? String(application.amount.depthInches)
          : '',
    amountUnit: application.amount.unit === 'inches' ? 'inches' : 'gallons',
    method: application.method,
    occurredOn: getGardenDate(application.appliedAtIso, timezone),
    outcome: application.outcome,
    skipReason: '',
  };
}

function correctionInput(
  applicationId: string,
  draft: WateringLogDraft,
): FeedCorrectWateringInput {
  if (draft.outcome === 'skipped') {
    return {
      amount: null,
      applicationId,
      method: draft.method,
      occurredOn: draft.occurredOn,
      outcome: 'skipped',
      skipReason: draft.skipReason.trim(),
    };
  }
  return {
    amount: { unit: draft.amountUnit, value: Number(draft.amount) },
    applicationId,
    method: draft.method,
    occurredOn: draft.occurredOn,
    outcome: draft.outcome,
    skipReason: null,
  };
}
