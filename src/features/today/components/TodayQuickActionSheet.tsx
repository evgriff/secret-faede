import { useEffect, useState, type FormEvent } from 'react';

import type {
  Garden,
  HarvestEvent,
  IssueSeverity,
  JournalIssueCategory,
} from '../../../domain/gardens/GardenRepository';
import type { TodayTarget } from '../todayActions';
import { getTodayTarget } from '../todaySelectors';
import type { TodayQuickActionState } from './TodayQuickActionRail';
import { TodayQuickPhotoFields } from './TodayQuickPhotoFields';
import {
  defaultQuickBody,
  defaultQuickTitle,
  formatHarvestUnit,
  formatIssueCategory,
  getQuickActionHeading,
  harvestUnits,
  issueCategories,
  resolveQuickTargetId,
} from '../todayQuickActionOptions';
import styles from './TodayQuickActionSheet.module.css';

export interface QuickJournalSubmit {
  body: string;
  occurredOn: string;
  photoFiles: File[];
  targetId: string;
  title: string;
}

export interface QuickIssueSubmit extends QuickJournalSubmit {
  category: JournalIssueCategory;
  severity: IssueSeverity;
}

export interface QuickHarvestSubmit {
  amountText: string;
  cropFinished: boolean;
  harvestedOn: string;
  notes: string;
  plantingId: string | null;
  quantity: number | null;
  unit: HarvestEvent['unit'];
}

export function TodayQuickActionSheet({
  action,
  canUseNativeCamera,
  garden,
  isOffline,
  onClose,
  onCapturePhoto,
  onSubmitHarvest,
  onSubmitIssue,
  onSubmitNote,
  targets,
  todayDate,
}: {
  action: TodayQuickActionState | null;
  canUseNativeCamera: boolean;
  garden: Garden;
  isOffline: boolean;
  onClose(): void;
  onCapturePhoto(): Promise<File | null>;
  onSubmitHarvest(input: QuickHarvestSubmit): Promise<boolean>;
  onSubmitIssue(input: QuickIssueSubmit): Promise<boolean>;
  onSubmitNote(input: QuickJournalSubmit): Promise<boolean>;
  targets: TodayTarget[];
  todayDate: string;
}) {
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<JournalIssueCategory>('general');
  const [cropFinished, setCropFinished] = useState(false);
  const [date, setDate] = useState(todayDate);
  const [issueSeverity, setIssueSeverity] = useState<IssueSeverity>('medium');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [plantingId, setPlantingId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [targetId, setTargetId] = useState('garden');
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState<HarvestEvent['unit']>('count');

  useEffect(() => {
    setBody(defaultQuickBody());
    setCategory('general');
    setCropFinished(false);
    setDate(todayDate);
    setIssueSeverity('medium');
    setPhotoFiles([]);
    setPhotoMessage(null);
    setPlantingId(action?.plantingId ?? garden.plantings[0]?.id ?? '');
    setQuantity('1');
    setTargetId(resolveQuickTargetId(action, targets));
    setTitle(defaultQuickTitle(action?.kind));
    setUnit('count');
  }, [action, garden.plantings, targets, todayDate]);

  if (!action) {
    return null;
  }

  const selectedTarget = getTodayTarget(targets, targetId);
  const heading = getQuickActionHeading(action.kind);
  const canAttachPhoto = action.kind === 'photo' || action.kind === 'issue';
  const hasOfflinePhotos = isOffline && photoFiles.length > 0;
  async function handleJournalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTarget) {
      return;
    }

    const submit = action?.kind === 'issue' ? onSubmitIssue : onSubmitNote;
    const saved = await submit({
      body: body.trim(),
      category,
      occurredOn: date,
      photoFiles,
      severity: issueSeverity,
      targetId,
      title: title.trim() || defaultQuickTitle(action?.kind),
    } as QuickIssueSubmit);

    if (saved) {
      onClose();
    }
  }

  async function handleHarvestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedQuantity =
      unit === 'freeform' ? null : Number.parseFloat(quantity);
    const amountText =
      unit === 'freeform'
        ? body.trim()
        : `${Number.isFinite(parsedQuantity) ? parsedQuantity : 0} ${unit}`;
    const saved = await onSubmitHarvest({
      amountText,
      cropFinished,
      harvestedOn: date,
      notes: body.trim(),
      plantingId: plantingId || null,
      quantity:
        unit === 'freeform'
          ? null
          : Number.isFinite(parsedQuantity)
            ? parsedQuantity
            : 0,
      unit,
    });

    if (!saved) {
      return;
    }
  }

  return (
    <section
      aria-label={heading}
      className={styles.quickSheet}
      data-action-kind={action.kind}
    >
      <div className={styles.sheetHeader}>
        <div>
          <p className={styles.kicker}>Quick action</p>
          <h2>{heading}</h2>
        </div>
        <button onClick={onClose} type="button">
          Close
        </button>
      </div>

      {action.kind === 'harvest' ? (
        <form
          className={styles.sheetForm}
          onSubmit={(event) => void handleHarvestSubmit(event)}
        >
          <label>
            <span>Crop</span>
            <select
              onChange={(event) => setPlantingId(event.currentTarget.value)}
              value={plantingId}
            >
              <option value="">Whole garden</option>
              {garden.plantings.map((planting) => (
                <option key={planting.id} value={planting.id}>
                  {planting.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input
              onChange={(event) => setDate(event.currentTarget.value)}
              type="date"
              value={date}
            />
          </label>
          <label>
            <span>Unit</span>
            <select
              onChange={(event) =>
                setUnit(event.currentTarget.value as HarvestEvent['unit'])
              }
              value={unit}
            >
              {harvestUnits.map((harvestUnit) => (
                <option key={harvestUnit} value={harvestUnit}>
                  {formatHarvestUnit(harvestUnit)}
                </option>
              ))}
            </select>
          </label>
          {unit === 'freeform' ? null : (
            <label>
              <span>Amount</span>
              <input
                min="0"
                onChange={(event) => setQuantity(event.currentTarget.value)}
                step="0.1"
                type="number"
                value={quantity}
              />
            </label>
          )}
          <label className={styles.fullField}>
            <span>Notes</span>
            <textarea
              onChange={(event) => setBody(event.currentTarget.value)}
              placeholder="Ripeness, yield quality, what to pick next"
              rows={3}
              value={body}
            />
          </label>
          <fieldset className={styles.harvestMode}>
            <legend>Harvest type</legend>
            <label>
              <input
                checked={!cropFinished}
                name="harvest-type"
                onChange={() => setCropFinished(false)}
                type="radio"
              />
              <span>Partial harvest</span>
            </label>
            <label>
              <input
                checked={cropFinished}
                name="harvest-type"
                onChange={() => setCropFinished(true)}
                type="radio"
              />
              <span>Final harvest</span>
            </label>
          </fieldset>
          <button type="submit">Save harvest</button>
        </form>
      ) : (
        <form
          className={styles.sheetForm}
          onSubmit={(event) => void handleJournalSubmit(event)}
        >
          <label>
            <span>Target</span>
            <select
              onChange={(event) => setTargetId(event.currentTarget.value)}
              value={targetId}
            >
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input
              onChange={(event) => setDate(event.currentTarget.value)}
              type="date"
              value={date}
            />
          </label>
          <label>
            <span>Title</span>
            <input
              onChange={(event) => setTitle(event.currentTarget.value)}
              value={title}
            />
          </label>
          {action.kind === 'issue' ? (
            <>
              <label>
                <span>Type</span>
                <select
                  onChange={(event) =>
                    setCategory(
                      event.currentTarget.value as JournalIssueCategory,
                    )
                  }
                  value={category}
                >
                  {issueCategories.map((issueCategory) => (
                    <option key={issueCategory} value={issueCategory}>
                      {formatIssueCategory(issueCategory)}
                    </option>
                  ))}
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
            </>
          ) : null}
          <label className={styles.fullField}>
            <span>{action.kind === 'issue' ? 'Notes' : 'Note'}</span>
            <textarea
              onChange={(event) => setBody(event.currentTarget.value)}
              placeholder={
                action.kind === 'issue'
                  ? 'What changed, where it is, what you already tried'
                  : 'Short field observation'
              }
              rows={3}
              value={body}
            />
          </label>
          {canAttachPhoto ? (
            <TodayQuickPhotoFields
              canUseNativeCamera={canUseNativeCamera}
              isOffline={isOffline}
              onCapturePhoto={onCapturePhoto}
              onPhotoFilesChange={setPhotoFiles}
              onPhotoMessageChange={setPhotoMessage}
              photoFiles={photoFiles}
              photoMessage={photoMessage}
            />
          ) : null}
          <button disabled={!body.trim() || hasOfflinePhotos} type="submit">
            {hasOfflinePhotos
              ? 'Reconnect to upload photos'
              : action.kind === 'issue'
                ? 'Create issue task'
                : 'Save entry'}
          </button>
        </form>
      )}
    </section>
  );
}
