import { useEffect, useMemo } from 'react';

import { Button, TextField } from '../../ui';
import type { FeedComposerDraft } from './feedModel';
import styles from './FeedPage.module.css';
import type { FeedEntryMode, FeedTargetOption } from './types';

const modes: Array<{ label: string; value: FeedEntryMode }> = [
  { label: 'Note', value: 'note' },
  { label: 'Issue', value: 'issue' },
  { label: 'Photo update', value: 'photo' },
  { label: 'Harvest', value: 'harvest' },
];

export function FeedComposerFields({
  draft,
  errors,
  onChange,
  onModeChange,
  onRemoveFile,
  targets,
}: {
  draft: FeedComposerDraft;
  errors: Record<string, string>;
  onChange(update: Partial<FeedComposerDraft>): void;
  onModeChange(mode: FeedEntryMode): void;
  onRemoveFile(index: number): void;
  targets: readonly FeedTargetOption[];
}) {
  const availableTargets =
    draft.mode === 'harvest'
      ? targets.filter((option) => option.target.kind === 'plantingGroup')
      : targets;

  return (
    <>
      <fieldset className={styles.modePicker}>
        <legend>Entry type</legend>
        <div>
          {modes.map((mode) => (
            <button
              aria-pressed={draft.mode === mode.value}
              key={mode.value}
              onClick={() => onModeChange(mode.value)}
              type="button"
            >
              {mode.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={styles.twoColumnFields}>
        <label className={styles.field}>
          <span>
            {draft.mode === 'harvest' ? 'Crop group' : 'Garden target'}
          </span>
          <select
            aria-describedby={
              errors.targetValue ? 'feed-target-error' : undefined
            }
            aria-invalid={Boolean(errors.targetValue)}
            onChange={(event) =>
              onChange({ targetValue: event.currentTarget.value })
            }
            value={draft.targetValue}
          >
            <option disabled value="">
              Choose a target
            </option>
            {availableTargets.map((option) => (
              <option key={option.value} value={option.value}>
                {option.target.label}
              </option>
            ))}
          </select>
          {errors.targetValue ? (
            <span
              className={styles.fieldError}
              id="feed-target-error"
              role="alert"
            >
              {errors.targetValue}
            </span>
          ) : null}
        </label>
        <TextField
          error={errors.occurredOn ?? null}
          label="Date"
          onChange={(event) =>
            onChange({ occurredOn: event.currentTarget.value })
          }
          required
          type="date"
          value={draft.occurredOn}
        />
      </div>

      {draft.mode === 'harvest' ? (
        <HarvestFields draft={draft} errors={errors} onChange={onChange} />
      ) : (
        <MemoryFields
          draft={draft}
          errors={errors}
          onChange={onChange}
          onRemoveFile={onRemoveFile}
        />
      )}
    </>
  );
}

function MemoryFields({
  draft,
  errors,
  onChange,
  onRemoveFile,
}: {
  draft: FeedComposerDraft;
  errors: Record<string, string>;
  onChange(update: Partial<FeedComposerDraft>): void;
  onRemoveFile(index: number): void;
}) {
  return (
    <>
      <TextField
        error={errors.title ?? null}
        label="Title"
        onChange={(event) => onChange({ title: event.currentTarget.value })}
        required
        value={draft.title}
      />
      <label className={styles.field}>
        <span>{draft.mode === 'photo' ? 'Caption' : 'Details'}</span>
        <textarea
          aria-describedby={errors.body ? 'feed-body-error' : undefined}
          aria-invalid={Boolean(errors.body)}
          onChange={(event) => onChange({ body: event.currentTarget.value })}
          rows={4}
          value={draft.body}
        />
        {errors.body ? (
          <span className={styles.fieldError} id="feed-body-error" role="alert">
            {errors.body}
          </span>
        ) : null}
      </label>
      {draft.mode === 'issue' ? (
        <IssueFields draft={draft} onChange={onChange} />
      ) : null}
      <label className={styles.field}>
        <span>{draft.mode === 'photo' ? 'Photos' : 'Photos (optional)'}</span>
        <input
          accept="image/*"
          aria-describedby={
            errors.files ? 'feed-files-error' : 'feed-files-hint'
          }
          aria-invalid={Boolean(errors.files)}
          capture="environment"
          multiple
          onChange={(event) =>
            onChange({ files: Array.from(event.currentTarget.files ?? []) })
          }
          type="file"
        />
        <small id="feed-files-hint">
          Images upload only while online. A selection is not a durable upload.
        </small>
        {errors.files ? (
          <span
            className={styles.fieldError}
            id="feed-files-error"
            role="alert"
          >
            {errors.files}
          </span>
        ) : null}
      </label>
      <FileDraftList files={draft.files} onRemove={onRemoveFile} />
    </>
  );
}

function IssueFields({
  draft,
  onChange,
}: {
  draft: FeedComposerDraft;
  onChange(update: Partial<FeedComposerDraft>): void;
}) {
  return (
    <div className={styles.threeColumnFields}>
      <SelectField
        label="Issue type"
        onChange={(value) =>
          onChange({
            issueCategory: value as FeedComposerDraft['issueCategory'],
          })
        }
        options={[
          ['general', 'General'],
          ['pest', 'Pest'],
          ['disease', 'Disease'],
          ['nutrient', 'Nutrient'],
          ['weatherDamage', 'Weather damage'],
          ['irrigation', 'Irrigation'],
        ]}
        value={draft.issueCategory}
      />
      <SelectField
        label="Severity"
        onChange={(value) =>
          onChange({
            issueSeverity: value as FeedComposerDraft['issueSeverity'],
          })
        }
        options={[
          ['low', 'Low'],
          ['medium', 'Medium'],
          ['high', 'High'],
        ]}
        value={draft.issueSeverity}
      />
      <SelectField
        label="Status"
        onChange={(value) =>
          onChange({ issueStatus: value as FeedComposerDraft['issueStatus'] })
        }
        options={[
          ['open', 'Open'],
          ['inProgress', 'In progress'],
          ['resolved', 'Resolved'],
        ]}
        value={draft.issueStatus}
      />
    </div>
  );
}

function HarvestFields({
  draft,
  errors,
  onChange,
}: {
  draft: FeedComposerDraft;
  errors: Record<string, string>;
  onChange(update: Partial<FeedComposerDraft>): void;
}) {
  return (
    <>
      <div className={styles.twoColumnFields}>
        <SelectField
          label="Unit"
          onChange={(value) =>
            onChange({ harvestUnit: value as FeedComposerDraft['harvestUnit'] })
          }
          options={[
            ['count', 'Count'],
            ['lb', 'Pounds'],
            ['oz', 'Ounces'],
            ['bunch', 'Bunches'],
            ['freeform', 'Describe amount'],
          ]}
          value={draft.harvestUnit}
        />
        {draft.harvestUnit === 'freeform' ? (
          <TextField
            error={errors.freeformAmount ?? null}
            label="Amount"
            onChange={(event) =>
              onChange({ freeformAmount: event.currentTarget.value })
            }
            placeholder="One basket"
            required
            value={draft.freeformAmount}
          />
        ) : (
          <TextField
            error={errors.harvestAmount ?? null}
            label="Amount"
            min="0.01"
            onChange={(event) =>
              onChange({ harvestAmount: event.currentTarget.value })
            }
            required
            step="0.01"
            type="number"
            value={draft.harvestAmount}
          />
        )}
      </div>
      <label className={styles.field}>
        <span>Harvest notes (optional)</span>
        <textarea
          onChange={(event) => onChange({ body: event.currentTarget.value })}
          rows={3}
          value={draft.body}
        />
      </label>
    </>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange(value: string): void;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function FileDraftList({
  files,
  onRemove,
}: {
  files: readonly File[];
  onRemove(index: number): void;
}) {
  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url:
          typeof URL.createObjectURL === 'function'
            ? URL.createObjectURL(file)
            : null,
      })),
    [files],
  );

  useEffect(
    () => () => {
      previews.forEach(({ url }) => {
        if (url && typeof URL.revokeObjectURL === 'function') {
          URL.revokeObjectURL(url);
        }
      });
    },
    [previews],
  );

  if (previews.length === 0) return null;
  return (
    <ul aria-label="Selected photo drafts" className={styles.fileDrafts}>
      {previews.map(({ file, url }, index) => (
        <li key={`${file.name}:${file.lastModified}`}>
          {url ? <img alt="" src={url} /> : null}
          <span>{file.name}</span>
          <Button onClick={() => onRemove(index)} variant="quiet">
            Remove <span className={styles.srOnly}>{file.name}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
