import type { FormEvent } from 'react';

import { Modal } from '../../shared/design/DesignPrimitives';
import type { useLogController } from '../useLogController';
import { HarvestForm } from './HarvestForm';
import { LogEntryForm } from './LogEntryForm';
import styles from './LogForms.module.css';

export type LogComposerMode = 'harvest' | 'issue' | 'photo' | 'post';
type LogController = ReturnType<typeof useLogController>;
const entryModes = new Set<LogComposerMode>(['issue', 'photo', 'post']);

export function LogComposerModal({
  log,
  mode,
  onModeChange,
  onClose,
}: {
  log: LogController;
  mode: LogComposerMode;
  onModeChange(mode: LogComposerMode): void;
  onClose(): void;
}) {
  if (!log.garden) {
    return null;
  }

  async function handleEntrySubmit(event: FormEvent<HTMLFormElement>) {
    const saved = await log.handleJournalSubmit(event);

    if (saved) {
      onClose();
    }
  }

  async function handleHarvestSubmit(event: FormEvent<HTMLFormElement>) {
    const saved = await log.handleHarvestSubmit(event);

    if (saved) {
      onClose();
    }
  }

  return (
    <Modal
      className={styles.composerDialog ?? ''}
      description={
        mode === 'harvest'
          ? 'Capture what was picked.'
          : 'Post a field memory, issue, or photo update.'
      }
      mobilePresentation="fullScreen"
      onClose={onClose}
      title="Compose feed entry"
    >
      <div className={styles.composerModes} aria-label="Composer type">
        {(['post', 'issue', 'photo', 'harvest'] as const).map((option) => (
          <button
            aria-pressed={mode === option}
            key={option}
            onClick={() => onModeChange(option)}
            type="button"
          >
            {getModeLabel(option)}
          </button>
        ))}
      </div>
      {mode === 'harvest' ? (
        <HarvestForm
          garden={log.garden}
          harvestAmountText={log.harvestAmountText}
          harvestDate={log.harvestDate}
          harvestNotes={log.harvestNotes}
          harvestPlantingId={log.harvestPlantingId}
          harvestQuantity={log.harvestQuantity}
          harvestUnit={log.harvestUnit}
          onSubmit={(event) => void handleHarvestSubmit(event)}
          setHarvestAmountText={log.setHarvestAmountText}
          setHarvestDate={log.setHarvestDate}
          setHarvestNotes={log.setHarvestNotes}
          setHarvestPlantingId={log.setHarvestPlantingId}
          setHarvestQuantity={log.setHarvestQuantity}
          setHarvestUnit={log.setHarvestUnit}
        />
      ) : entryModes.has(mode) ? (
        <LogEntryForm
          canUseNativeCamera={log.canUseNativeCamera}
          entryBody={log.entryBody}
          entryDate={log.entryDate}
          entryTitle={log.entryTitle}
          entryType={log.entryType}
          isOffline={log.isOffline}
          issueCategory={log.issueCategory}
          issueSeverity={log.issueSeverity}
          issueStatus={log.issueStatus}
          onCapturePhoto={() => void log.handleCapturePhoto()}
          onClearPhotos={() => log.setPhotoFiles([])}
          onPhotoChange={log.handlePhotoChange}
          onSaveWithoutPhotos={() =>
            void log.handleSaveEntryWithoutPhotos().then((saved) => {
              if (saved) {
                onClose();
              }
            })
          }
          onSubmit={(event) => void handleEntrySubmit(event)}
          photoFiles={log.photoFiles}
          setEntryBody={log.setEntryBody}
          setEntryDate={log.setEntryDate}
          setEntryTitle={log.setEntryTitle}
          setEntryType={log.setEntryType}
          setIssueCategory={log.setIssueCategory}
          setIssueSeverity={log.setIssueSeverity}
          setIssueStatus={log.setIssueStatus}
          setTargetId={log.setTargetId}
          showTypeField={false}
          submitLabel={getSubmitLabel(mode)}
          targetId={log.targetId}
          targetOptions={log.targetOptions}
        />
      ) : null}
    </Modal>
  );
}

function getModeLabel(mode: LogComposerMode) {
  const labels: Record<LogComposerMode, string> = {
    harvest: 'Harvest',
    issue: 'Issue',
    photo: 'Photo',
    post: 'Post',
  };

  return labels[mode];
}

function getSubmitLabel(mode: LogComposerMode) {
  const labels: Partial<Record<LogComposerMode, string>> = {
    issue: 'Create issue',
    photo: 'Post photo update',
    post: 'Post update',
  };

  return labels[mode] ?? 'Save entry';
}
