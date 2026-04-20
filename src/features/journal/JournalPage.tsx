import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import { useServices } from '../../app/providers';
import {
  createDefaultGarden,
  type Garden,
  type HarvestEvent,
  type IssueSeverity,
  type IssueStatus,
  type JournalEntry,
  type JournalEntryType,
  type JournalIssueCategory,
  type JournalTargetType,
} from '../../domain/gardens/GardenRepository';
import {
  isBrowserOffline,
  useNetworkStatus,
} from '../../shared/network/networkStatus';
import { LoadingState } from '../../shared/ui/LoadingState';
import { useAuth } from '../auth/auth-context';
import { buildJournalAnalytics } from './journalAnalytics';
import styles from './JournalPage.module.css';

type LoadStatus = 'error' | 'loading' | 'ready';
type SaveStatus = 'error' | 'idle' | 'queued' | 'saved' | 'saving';
type HarvestUnit = HarvestEvent['unit'];

interface TargetOption {
  id: string;
  label: string;
  plantingId: string | null;
  structureId: string | null;
  type: JournalTargetType;
}

export function JournalPage() {
  const { gardenRepository, mediaStorageService } = useServices();
  const { state } = useAuth();
  const networkStatus = useNetworkStatus();
  const [garden, setGarden] = useState<Garden | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [entryBody, setEntryBody] = useState('');
  const [entryDate, setEntryDate] = useState(() => toLocalDate(new Date()));
  const [entryTitle, setEntryTitle] = useState('');
  const [entryType, setEntryType] = useState<JournalEntryType>('note');
  const [issueCategory, setIssueCategory] =
    useState<JournalIssueCategory>('general');
  const [issueSeverity, setIssueSeverity] = useState<IssueSeverity>('medium');
  const [issueStatus, setIssueStatus] = useState<IssueStatus>('todo');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [targetId, setTargetId] = useState('garden');
  const [harvestAmountText, setHarvestAmountText] = useState('');
  const [harvestDate, setHarvestDate] = useState(() => toLocalDate(new Date()));
  const [harvestNotes, setHarvestNotes] = useState('');
  const [harvestPlantingId, setHarvestPlantingId] = useState('');
  const [harvestQuantity, setHarvestQuantity] = useState('1');
  const [harvestUnit, setHarvestUnit] = useState<HarvestUnit>('count');
  const isOffline = networkStatus === 'offline';

  useEffect(() => {
    const userId = state.user?.uid;

    if (!userId) {
      return;
    }

    let active = true;
    setLoadStatus('loading');
    setError(null);

    void gardenRepository
      .getGarden(userId)
      .then((savedGarden) => {
        if (!active) {
          return;
        }

        setGarden(savedGarden ?? createDefaultGarden(userId));
        setLoadStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(toErrorMessage(loadError, 'Unable to load journal.'));
        setLoadStatus('error');
      });

    return () => {
      active = false;
    };
  }, [gardenRepository, state.user?.uid]);

  const targetOptions = useMemo(
    () => (garden ? buildTargetOptions(garden) : []),
    [garden],
  );
  const analytics = useMemo(
    () => (garden ? buildJournalAnalytics(garden) : null),
    [garden],
  );
  const recentEntries = useMemo(
    () =>
      [...(garden?.journalEntries ?? [])].sort((left, right) =>
        right.occurredOn.localeCompare(left.occurredOn),
      ),
    [garden?.journalEntries],
  );
  const recentHarvests = useMemo(
    () =>
      [...(garden?.harvestEvents ?? [])].sort((left, right) =>
        right.harvestedOn.localeCompare(left.harvestedOn),
      ),
    [garden?.harvestEvents],
  );

  async function saveUpdatedGarden(updatedGarden: Garden) {
    setGarden(updatedGarden);
    setSaveStatus('saving');
    setError(null);

    try {
      const wasOffline = isBrowserOffline();
      await gardenRepository.saveGarden(updatedGarden);
      setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
      return true;
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Unable to save journal.'));
      setSaveStatus('error');
      return false;
    }
  }

  async function handleJournalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!garden || !entryBody.trim()) {
      return;
    }

    if (isOffline && photoFiles.length > 0) {
      setError('Photos need a connection. Save the note without photos first.');
      setSaveStatus('error');
      return;
    }

    const entryId = createId('journal');
    const target =
      targetOptions.find((option) => option.id === targetId) ??
      targetOptions[0];
    const now = new Date().toISOString();

    setSaveStatus('saving');
    setError(null);

    try {
      const photos = await Promise.all(
        photoFiles.map((file) =>
          mediaStorageService.uploadJournalPhoto({
            entryId,
            file,
            gardenId: garden.id,
            userId: garden.userId,
          }),
        ),
      );
      const entry: JournalEntry = {
        body: entryBody.trim(),
        createdAtIso: now,
        gardenId: garden.id,
        id: entryId,
        issueCategory: entryType === 'issue' ? issueCategory : null,
        issueSeverity: entryType === 'issue' ? issueSeverity : null,
        issueStatus: entryType === 'issue' ? issueStatus : null,
        occurredOn: entryDate,
        photos,
        plantingId: target?.plantingId ?? null,
        structureId: target?.structureId ?? null,
        targetLabel: target?.label ?? 'Whole garden',
        targetType: target?.type ?? 'garden',
        title: entryTitle.trim() || defaultEntryTitle(entryType),
        type: entryType,
        weatherSnapshotId: null,
      };

      const saved = await saveUpdatedGarden({
        ...garden,
        journalEntries: [entry, ...garden.journalEntries],
        updatedAtIso: now,
      });
      if (saved) {
        setEntryBody('');
        setEntryTitle('');
        setPhotoFiles([]);
      }
    } catch (journalError) {
      setError(toErrorMessage(journalError, 'Unable to save journal entry.'));
      setSaveStatus('error');
    }
  }

  async function handleHarvestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!garden) {
      return;
    }

    const planting =
      garden.plantings.find(
        (candidate) => candidate.id === harvestPlantingId,
      ) ?? null;
    const quantity =
      harvestUnit === 'freeform' ? null : Number.parseFloat(harvestQuantity);
    const harvest: HarvestEvent = {
      amountText:
        harvestUnit === 'freeform'
          ? harvestAmountText.trim()
          : `${Number.isFinite(quantity) ? quantity : 0} ${harvestUnit}`,
      cropId: planting?.cropId ?? null,
      gardenId: garden.id,
      harvestedOn: harvestDate,
      id: createId('harvest'),
      notes: harvestNotes.trim(),
      plantingId: planting?.id ?? null,
      quantity:
        harvestUnit === 'freeform'
          ? null
          : Number.isFinite(quantity)
            ? quantity
            : 0,
      unit: harvestUnit,
    };

    const saved = await saveUpdatedGarden({
      ...garden,
      harvestEvents: [harvest, ...garden.harvestEvents],
      updatedAtIso: new Date().toISOString(),
    });
    if (saved) {
      setHarvestAmountText('');
      setHarvestNotes('');
      setHarvestQuantity('1');
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setPhotoFiles(Array.from(event.currentTarget.files ?? []));
  }

  if (loadStatus === 'loading') {
    return <LoadingState message="Loading garden memory." title="Journal" />;
  }

  if (loadStatus === 'error' || !garden || !analytics) {
    return (
      <section className={styles.page}>
        <h1>Journal</h1>
        <p role="alert">{error ?? 'Unable to load journal.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Garden memory</p>
          <h1>Journal</h1>
          <p className={styles.summary}>
            {garden.journalEntries.length} notes, {garden.harvestEvents.length}{' '}
            harvests
          </p>
        </div>
        <div className={styles.saveState}>
          {saveStatus === 'saving' ? <span>Saving...</span> : null}
          {saveStatus === 'saved' ? <span>Saved</span> : null}
          {saveStatus === 'queued' ? <span>Saved locally</span> : null}
          {isOffline && saveStatus !== 'queued' ? (
            <span>Offline notes and harvests will queue</span>
          ) : null}
          {saveStatus === 'error' && error ? (
            <span role="alert">{error}</span>
          ) : null}
        </div>
      </header>

      <nav aria-label="Quick journal actions" className={styles.quickActions}>
        <a href="#add-entry">Add note</a>
        <a href="#log-harvest">Log harvest</a>
      </nav>

      <div className={styles.layout}>
        <main className={styles.main}>
          <section className={styles.panel} id="add-entry">
            <h2>Add journal entry</h2>
            <form
              className={styles.form}
              onSubmit={(event) => void handleJournalSubmit(event)}
            >
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
              <label>
                <span>Attach to</span>
                <select
                  onChange={(event) => setTargetId(event.currentTarget.value)}
                  value={targetId}
                >
                  {targetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
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
                <div className={styles.issueGrid}>
                  <label>
                    <span>Issue</span>
                    <select
                      onChange={(event) =>
                        setIssueCategory(
                          event.currentTarget.value as JournalIssueCategory,
                        )
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
                        setIssueSeverity(
                          event.currentTarget.value as IssueSeverity,
                        )
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
                      <option value="todo">To do</option>
                      <option value="monitoring">Monitoring</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                </div>
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
                <input
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  type="file"
                />
              </label>
              {photoFiles.length > 0 ? (
                <p className={styles.fileHint}>
                  {photoFiles.length} photo{photoFiles.length === 1 ? '' : 's'}{' '}
                  ready to attach
                </p>
              ) : null}
              <button type="submit">Save entry</button>
            </form>
          </section>

          <section className={styles.panel} id="log-harvest">
            <h2>Log harvest</h2>
            <form
              className={styles.form}
              onSubmit={(event) => void handleHarvestSubmit(event)}
            >
              <label>
                <span>Planting</span>
                <select
                  onChange={(event) =>
                    setHarvestPlantingId(event.currentTarget.value)
                  }
                  value={harvestPlantingId}
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
                  onChange={(event) =>
                    setHarvestDate(event.currentTarget.value)
                  }
                  type="date"
                  value={harvestDate}
                />
              </label>
              <label>
                <span>Unit</span>
                <select
                  onChange={(event) =>
                    setHarvestUnit(event.currentTarget.value as HarvestUnit)
                  }
                  value={harvestUnit}
                >
                  <option value="count">Count</option>
                  <option value="lb">Pounds</option>
                  <option value="oz">Ounces</option>
                  <option value="bunch">Bunches</option>
                  <option value="freeform">Freeform</option>
                </select>
              </label>
              {harvestUnit === 'freeform' ? (
                <label>
                  <span>Amount</span>
                  <input
                    onChange={(event) =>
                      setHarvestAmountText(event.currentTarget.value)
                    }
                    placeholder="A basket, 3 handfuls"
                    value={harvestAmountText}
                  />
                </label>
              ) : (
                <label>
                  <span>Quantity</span>
                  <input
                    min="0"
                    onChange={(event) =>
                      setHarvestQuantity(event.currentTarget.value)
                    }
                    step="0.1"
                    type="number"
                    value={harvestQuantity}
                  />
                </label>
              )}
              <label className={styles.fullWidth}>
                <span>Notes</span>
                <textarea
                  onChange={(event) =>
                    setHarvestNotes(event.currentTarget.value)
                  }
                  rows={3}
                  value={harvestNotes}
                />
              </label>
              <button type="submit">Log harvest</button>
            </form>
          </section>

          <section className={styles.panel}>
            <h2>Recent entries</h2>
            {recentEntries.length > 0 ? (
              <div className={styles.entryList}>
                {recentEntries.map((entry) => (
                  <JournalEntryCard entry={entry} key={entry.id} />
                ))}
              </div>
            ) : (
              <p className={styles.empty}>No notes or issues yet.</p>
            )}
          </section>

          <section className={styles.panel}>
            <h2>Recent harvests</h2>
            {recentHarvests.length > 0 ? (
              <div className={styles.entryList}>
                {recentHarvests.map((harvest) => (
                  <HarvestCard
                    garden={garden}
                    harvest={harvest}
                    key={harvest.id}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.empty}>No harvests logged yet.</p>
            )}
          </section>
        </main>

        <aside className={styles.analytics}>
          <AnalyticsPanel analytics={analytics} />
        </aside>
      </div>
    </section>
  );
}

function AnalyticsPanel({
  analytics,
}: {
  analytics: ReturnType<typeof buildJournalAnalytics>;
}) {
  return (
    <>
      <section className={styles.metricGrid}>
        <Metric
          label="Unresolved issues"
          value={String(analytics.issues.unresolved)}
        />
        <Metric
          label="High severity"
          value={String(analytics.issues.highSeverity)}
        />
        <Metric
          label="Water alerts"
          value={`${analytics.waterAlerts.acknowledged}/${analytics.waterAlerts.sent}`}
        />
      </section>
      <section className={styles.panel}>
        <h2>Harvest totals</h2>
        <SimpleList
          empty="No season harvest totals yet."
          items={analytics.harvestTotals.map((item) => ({
            label: item.label,
            value: item.value,
          }))}
        />
      </section>
      <section className={styles.panel}>
        <h2>Yield by crop</h2>
        <SimpleList
          empty="No crop yield yet."
          items={analytics.yieldByCrop.map((item) => ({
            label: item.cropName,
            value: item.total,
          }))}
        />
      </section>
      <section className={styles.panel}>
        <h2>Most active beds</h2>
        <SimpleList
          empty="No bed activity yet."
          items={analytics.activeBeds.map((item) => ({
            label: item.label,
            value: String(item.count),
          }))}
        />
      </section>
    </>
  );
}

function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  return (
    <article className={styles.entryCard}>
      <div className={styles.cardHeader}>
        <span>{entry.type === 'issue' ? 'Issue' : 'Note'}</span>
        <time>{formatDate(entry.occurredOn)}</time>
      </div>
      <h3>{entry.title}</h3>
      <p>{entry.body}</p>
      <div className={styles.meta}>
        <span>{entry.targetLabel}</span>
        {entry.issueCategory ? (
          <span>{formatIssue(entry.issueCategory)}</span>
        ) : null}
        {entry.issueSeverity ? (
          <span>{entry.issueSeverity} severity</span>
        ) : null}
        {entry.issueStatus ? <span>{entry.issueStatus}</span> : null}
      </div>
      {entry.photos.length > 0 ? (
        <div className={styles.photoGrid}>
          {entry.photos.map((photo) => (
            <img alt={photo.fileName} key={photo.id} src={photo.downloadUrl} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function HarvestCard({
  garden,
  harvest,
}: {
  garden: Garden;
  harvest: HarvestEvent;
}) {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === harvest.plantingId,
  );

  return (
    <article className={styles.entryCard}>
      <div className={styles.cardHeader}>
        <span>Harvest</span>
        <time>{formatDate(harvest.harvestedOn)}</time>
      </div>
      <h3>{planting?.label ?? 'Whole garden'}</h3>
      <p>{formatHarvestAmount(harvest)}</p>
      {harvest.notes ? <p>{harvest.notes}</p> : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SimpleList({
  empty,
  items,
}: {
  empty: string;
  items: Array<{ label: string; value: string }>;
}) {
  return items.length > 0 ? (
    <ul className={styles.simpleList}>
      {items.map((item) => (
        <li key={`${item.label}-${item.value}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </li>
      ))}
    </ul>
  ) : (
    <p className={styles.empty}>{empty}</p>
  );
}

function buildTargetOptions(garden: Garden): TargetOption[] {
  return [
    {
      id: 'garden',
      label: 'Whole garden',
      plantingId: null,
      structureId: null,
      type: 'garden',
    },
    ...garden.structures.map((structure) => ({
      id: `structure:${structure.id}`,
      label: structure.label,
      plantingId: null,
      structureId: structure.id,
      type: 'structure' as const,
    })),
    ...garden.plantings.map((planting) => ({
      id: `planting:${planting.id}`,
      label: planting.label,
      plantingId: planting.id,
      structureId: null,
      type: 'planting' as const,
    })),
  ];
}

function defaultEntryTitle(type: JournalEntryType) {
  return type === 'issue' ? 'Garden issue' : 'Garden note';
}

function formatHarvestAmount(harvest: HarvestEvent) {
  if (harvest.unit === 'freeform') {
    return harvest.amountText || 'Harvest logged';
  }

  return `${harvest.quantity ?? 0} ${harvest.unit}`;
}

function formatIssue(category: JournalIssueCategory) {
  const labels: Record<JournalIssueCategory, string> = {
    disease: 'Disease',
    general: 'General note',
    irrigation: 'Irrigation issue',
    nutrient: 'Nutrient issue',
    pest: 'Pest',
    weatherDamage: 'Weather damage',
  };

  return labels[category];
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(parseLocalDate(date));
}

function parseLocalDate(date: string) {
  const [year = '1970', month = '1', day = '1'] = date.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function toLocalDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}`;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
