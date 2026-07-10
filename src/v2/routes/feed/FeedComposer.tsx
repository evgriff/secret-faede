import { useId, useRef, useState, type FormEvent } from 'react';

import { Button, Modal, StatusBanner } from '../../ui';
import {
  createFeedComposerDraft,
  createFeedEntryInput,
  validateFeedDraft,
  type FeedComposerDraft,
} from './feedModel';
import { FeedComposerFields } from './FeedComposerFields';
import styles from './FeedPage.module.css';
import type {
  FeedCreateEntryInput,
  FeedCreateResult,
  FeedEntryMode,
  FeedTargetOption,
} from './types';

export function FeedComposer({
  isOnline,
  isOpen,
  onClose,
  onCreateEntry,
  onSaved,
  targets,
  today,
}: {
  isOnline: boolean;
  isOpen: boolean;
  onClose(): void;
  onCreateEntry(input: FeedCreateEntryInput): Promise<FeedCreateResult>;
  onSaved(result: FeedCreateResult): void;
  targets: readonly FeedTargetOption[];
  today: string;
}) {
  const [draft, setDraft] = useState(() =>
    createFeedComposerDraft(today, targets[0]?.value ?? ''),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const formId = `feed-composer-${useId().replaceAll(':', '')}`;
  const hasOfflinePhotos = !isOnline && draft.files.length > 0;
  const canSaveTextOnly =
    hasOfflinePhotos && (draft.mode === 'note' || draft.mode === 'issue');

  function change(update: Partial<FeedComposerDraft>) {
    setDraft((current) => ({ ...current, ...update }));
    setErrors({});
    setSubmitError(null);
  }

  function changeMode(mode: FeedEntryMode) {
    const currentTarget = targets.find(
      (option) => option.value === draft.targetValue,
    );
    const nextTarget =
      mode === 'harvest' && currentTarget?.target.kind !== 'plantingGroup'
        ? targets.find((option) => option.target.kind === 'plantingGroup')
        : currentTarget;
    change({ mode, targetValue: nextTarget?.value ?? '' });
  }

  function removeFile(index: number) {
    change({
      files: draft.files.filter((_, candidate) => candidate !== index),
    });
  }

  function resetDraft() {
    setDraft(createFeedComposerDraft(today, targets[0]?.value ?? ''));
    setErrors({});
    setSubmitError(null);
  }

  async function submit(withoutFiles: boolean) {
    if (inFlight.current) return;
    if (hasOfflinePhotos && !withoutFiles) return;
    const nextErrors = validateFeedDraft(draft, targets, withoutFiles);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const target = targets.find((option) => option.value === draft.targetValue);
    if (!target) return;

    inFlight.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onCreateEntry(
        createFeedEntryInput(draft, target, withoutFiles),
      );
      resetDraft();
      onSaved(result);
      onClose();
    } catch (caught) {
      setSubmitError(toMessage(caught));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(false);
  }

  return (
    <Modal
      description="Create one private garden memory without leaving the activity stream. Closing keeps this draft."
      footer={
        <>
          <Button disabled={isSubmitting} onClick={resetDraft} variant="quiet">
            Discard draft
          </Button>
          {canSaveTextOnly ? (
            <Button
              disabled={isSubmitting}
              onClick={() => void submit(true)}
              variant="secondary"
            >
              Save text without photos
            </Button>
          ) : null}
          <Button
            busyLabel="Saving entry…"
            disabled={hasOfflinePhotos}
            form={formId}
            isBusy={isSubmitting}
            type="submit"
          >
            {hasOfflinePhotos
              ? 'Reconnect to upload photos'
              : submitLabel(draft.mode)}
          </Button>
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
      title="New entry"
    >
      <form
        className={styles.composerForm}
        id={formId}
        noValidate
        onSubmit={handleSubmit}
      >
        {hasOfflinePhotos ? (
          <StatusBanner title="Photos stay on this device" tone="warning">
            Reconnect to upload the selected images. They are not uploaded or
            queued while offline. Notes and issues can be saved as text only.
          </StatusBanner>
        ) : null}
        {submitError ? (
          <StatusBanner live title="Entry not saved" tone="error">
            {submitError} Your draft is still here.
          </StatusBanner>
        ) : null}
        <FeedComposerFields
          draft={draft}
          errors={errors}
          onChange={change}
          onModeChange={changeMode}
          onRemoveFile={removeFile}
          targets={targets}
        />
      </form>
    </Modal>
  );
}

function submitLabel(mode: FeedEntryMode) {
  return {
    harvest: 'Log harvest',
    issue: 'Create issue',
    note: 'Save note',
    photo: 'Save photo update',
  }[mode];
}

function toMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'The entry could not be saved.';
}
