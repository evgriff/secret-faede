import type { ChangeEvent, FormEvent } from 'react';
import type {
  IssueSeverity,
  IssueStatus,
  JournalEntryType,
  JournalIssueCategory,
} from '../../../domain/gardens/GardenRepository';
import type { TargetOption } from '../logHelpers';
import styles from './LogForms.module.css';

export function LogEntryForm({
  canUseNativeCamera,
  entryBody,
  entryDate,
  entryTitle,
  entryType,
  issueCategory,
  issueSeverity,
  issueStatus,
  isOffline,
  onCapturePhoto,
  onClearPhotos,
  onPhotoChange,
  onSaveWithoutPhotos,
  onSubmit,
  photoFiles,
  setEntryBody,
  setEntryDate,
  setEntryTitle,
  setEntryType,
  setIssueCategory,
  setIssueSeverity,
  setIssueStatus,
  setTargetId,
  showTypeField = true,
  submitLabel = 'Save entry',
  targetId,
  targetOptions,
}: {
  canUseNativeCamera: boolean;
  entryBody: string;
  entryDate: string;
  entryTitle: string;
  entryType: JournalEntryType;
  issueCategory: JournalIssueCategory;
  issueSeverity: IssueSeverity;
  issueStatus: IssueStatus;
  isOffline: boolean;
  onCapturePhoto(): void;
  onClearPhotos(): void;
  onPhotoChange(event: ChangeEvent<HTMLInputElement>): void;
  onSaveWithoutPhotos(): void;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  photoFiles: File[];
  setEntryBody(value: string): void;
  setEntryDate(value: string): void;
  setEntryTitle(value: string): void;
  setEntryType(value: JournalEntryType): void;
  setIssueCategory(value: JournalIssueCategory): void;
  setIssueSeverity(value: IssueSeverity): void;
  setIssueStatus(value: IssueStatus): void;
  setTargetId(value: string): void;
  showTypeField?: boolean;
  submitLabel?: string;
  targetId: string;
  targetOptions: TargetOption[];
}) {
  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {showTypeField ? (
        <label>
          <span>Type</span>
          <select
            onChange={(event) =>
              setEntryType(event.currentTarget.value as JournalEntryType)
            }
            value={entryType}
          >
            <option value="note">General note</option>
            <option value="issue">Issue</option>
          </select>
        </label>
      ) : null}
      <label>
        <span>Attach to</span>
        <select
          onChange={(event) => setTargetId(event.currentTarget.value)}
          value={targetId}
        >
          <TargetOptionGroup
            label="Garden"
            options={targetOptions}
            type="garden"
          />
          <TargetOptionGroup
            label="Beds and structures"
            options={targetOptions}
            type="structure"
          />
          <TargetOptionGroup
            label="Plantings"
            options={targetOptions}
            type="planting"
          />
        </select>
      </label>
      <label>
        <span>Date</span>
        <input
          onChange={(event) => setEntryDate(event.currentTarget.value)}
          type="date"
          value={entryDate}
        />
      </label>
      <label>
        <span>Title</span>
        <input
          onChange={(event) => setEntryTitle(event.currentTarget.value)}
          placeholder="Observation title"
          value={entryTitle}
        />
      </label>
      {entryType === 'issue' ? (
        <IssueFields
          issueCategory={issueCategory}
          issueSeverity={issueSeverity}
          issueStatus={issueStatus}
          setIssueCategory={setIssueCategory}
          setIssueSeverity={setIssueSeverity}
          setIssueStatus={setIssueStatus}
        />
      ) : null}
      <label className={styles.fullWidth}>
        <span>Notes</span>
        <textarea
          onChange={(event) => setEntryBody(event.currentTarget.value)}
          rows={4}
          value={entryBody}
        />
      </label>
      <label className={styles.fullWidth}>
        <span>Photos</span>
        <input accept="image/*" multiple onChange={onPhotoChange} type="file" />
      </label>
      {canUseNativeCamera ? (
        <div className={styles.inlineActions}>
          <button onClick={onCapturePhoto} type="button">
            Use camera
          </button>
        </div>
      ) : null}
      {photoFiles.length > 0 ? (
        <div className={styles.fileQueue}>
          <p className={styles.fileHint}>
            {photoFiles.length} photo{photoFiles.length === 1 ? '' : 's'} ready
            to attach
            {isOffline ? '; reconnect to upload or save text only' : ''}
          </p>
          <ul>
            {photoFiles.map((file) => (
              <li key={`${file.name}-${file.size}`}>
                <span>{file.name || 'Photo'}</span>
                <strong>{formatFileSize(file.size)}</strong>
              </li>
            ))}
          </ul>
          <div className={styles.inlineActions}>
            {isOffline ? (
              <button onClick={onSaveWithoutPhotos} type="button">
                Save text only
              </button>
            ) : null}
            <button onClick={onClearPhotos} type="button">
              Remove photos
            </button>
          </div>
        </div>
      ) : null}
      <button type="submit">{submitLabel}</button>
    </form>
  );
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function TargetOptionGroup({
  label,
  options,
  type,
}: {
  label: string;
  options: TargetOption[];
  type: TargetOption['type'];
}) {
  const groupedOptions = options.filter((option) => option.type === type);

  if (groupedOptions.length === 0) {
    return null;
  }

  return (
    <optgroup label={label}>
      {groupedOptions.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </optgroup>
  );
}

function IssueFields({
  issueCategory,
  issueSeverity,
  issueStatus,
  setIssueCategory,
  setIssueSeverity,
  setIssueStatus,
}: {
  issueCategory: JournalIssueCategory;
  issueSeverity: IssueSeverity;
  issueStatus: IssueStatus;
  setIssueCategory(value: JournalIssueCategory): void;
  setIssueSeverity(value: IssueSeverity): void;
  setIssueStatus(value: IssueStatus): void;
}) {
  return (
    <div className={styles.issueGrid}>
      <label>
        <span>Issue</span>
        <select
          onChange={(event) =>
            setIssueCategory(event.currentTarget.value as JournalIssueCategory)
          }
          value={issueCategory}
        >
          <option value="pest">Pest</option>
          <option value="disease">Disease</option>
          <option value="nutrient">Nutrient issue</option>
          <option value="weatherDamage">Weather damage</option>
          <option value="irrigation">Irrigation issue</option>
          <option value="general">General note</option>
        </select>
      </label>
      <label>
        <span>Severity</span>
        <select
          onChange={(event) =>
            setIssueSeverity(event.currentTarget.value as IssueSeverity)
          }
          value={issueSeverity}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <label>
        <span>Status</span>
        <select
          onChange={(event) =>
            setIssueStatus(event.currentTarget.value as IssueStatus)
          }
          value={issueStatus}
        >
          <option value="open">Open</option>
          <option value="inProgress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
    </div>
  );
}
