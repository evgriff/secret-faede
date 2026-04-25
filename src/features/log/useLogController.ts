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
  type JournalEntryType,
  type JournalIssueCategory,
} from '../../domain/gardens/GardenRepository';
import type { PublishedGardenRevision } from '../../domain/gardens/gardenWorkspace';
import {
  isBrowserOffline,
  useNetworkStatus,
} from '../../shared/network/networkStatus';
import { useAuth } from '../auth/auth-context';
import { buildJournalAnalytics } from '../journal/journalAnalytics';
import {
  addFieldNote,
  reportFieldIssue,
  updateIssueStatus,
} from '../today/todayActions';
import { rebuildGardenWateringFromLatestSnapshot } from '../garden/wateringScheduleRefresh';
import {
  buildTargetOptions,
  createId,
  toErrorMessage,
  toLocalDate,
} from './logHelpers';
import {
  buildLogFeedFilterOptions,
  buildLogFeedItems,
  filterLogFeedItems,
} from './logFeedItems';
import { type LogFilterState } from './logSelectors';
import type { LogSaveStatus } from './components/LogSaveState';

type LoadStatus = 'error' | 'loading' | 'ready';
type HarvestUnit = HarvestEvent['unit'];

export function useLogController() {
  const {
    gardenRepository,
    mediaStorageService,
    mobileDeviceService,
    telemetryService,
    userProfileRepository,
  } = useServices();
  const { state } = useAuth();
  const networkStatus = useNetworkStatus();
  const [garden, setGarden] = useState<Garden | null>(null);
  const [revisions, setRevisions] = useState<PublishedGardenRevision[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveStatus, setSaveStatus] = useState<LogSaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [entryBody, setEntryBody] = useState('');
  const [entryDate, setEntryDate] = useState(() => toLocalDate(new Date()));
  const [entryTitle, setEntryTitle] = useState('');
  const [entryType, setEntryType] = useState<JournalEntryType>('note');
  const [issueCategory, setIssueCategory] =
    useState<JournalIssueCategory>('general');
  const [issueSeverity, setIssueSeverity] = useState<IssueSeverity>('medium');
  const [issueStatus, setIssueStatus] = useState<IssueStatus>('open');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [targetId, setTargetId] = useState('garden');
  const [harvestAmountText, setHarvestAmountText] = useState('');
  const [harvestDate, setHarvestDate] = useState(() => toLocalDate(new Date()));
  const [harvestNotes, setHarvestNotes] = useState('');
  const [harvestPlantingId, setHarvestPlantingId] = useState('');
  const [harvestQuantity, setHarvestQuantity] = useState('1');
  const [harvestUnit, setHarvestUnit] = useState<HarvestUnit>('count');
  const [filters, setFilters] = useState<LogFilterState>({
    bedId: 'all',
    cropId: 'all',
    issueStatus: 'all',
    query: '',
    season: 'all',
    targetId: 'all',
    type: 'all',
  });
  const isOffline = networkStatus === 'offline';
  const canUseNativeCamera = mobileDeviceService.getCapabilities().camera;

  useEffect(() => {
    const userId = state.user?.uid;

    if (!userId) {
      return;
    }

    let active = true;
    setLoadStatus('loading');
    setError(null);

    void gardenRepository
      .getWorkspace(userId)
      .then((workspace) => {
        if (!active) {
          return;
        }

        setGarden(workspace.draft.garden ?? createDefaultGarden(userId));
        setRevisions(workspace.revisions);
        setLoadStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(toErrorMessage(loadError, 'Unable to load feed.'));
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
  const feedItems = useMemo(
    () => (garden ? buildLogFeedItems({ garden, revisions }) : []),
    [garden, revisions],
  );
  const filteredFeedItems = useMemo(
    () => filterLogFeedItems(feedItems, filters),
    [feedItems, filters],
  );
  const feedFilterOptions = useMemo(
    () =>
      garden
        ? buildLogFeedFilterOptions(garden, feedItems)
        : { beds: [], crops: [], seasons: [] },
    [feedItems, garden],
  );

  async function saveUpdatedGarden(
    updatedGarden: Garden,
    options: { refreshWateringFromSnapshot?: boolean } = {},
  ) {
    let gardenToSave = updatedGarden;
    const authUser = state.user;

    if (options.refreshWateringFromSnapshot && authUser?.email) {
      const profile = await userProfileRepository
        .getUserProfile(authUser.uid, authUser.email)
        .catch(() => null);

      gardenToSave = rebuildGardenWateringFromLatestSnapshot(updatedGarden, {
        profile,
      });
    }

    setGarden(gardenToSave);
    setSaveStatus('saving');
    setError(null);

    try {
      const wasOffline = isBrowserOffline();
      await gardenRepository.saveGarden(gardenToSave);
      setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
      return true;
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Unable to save feed.'));
      setSaveStatus('error');
      return false;
    }
  }

  async function handleJournalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return saveJournalEntry({ attachPhotos: true });
  }

  async function handleSaveEntryWithoutPhotos() {
    return saveJournalEntry({ attachPhotos: false });
  }

  async function saveJournalEntry({ attachPhotos }: { attachPhotos: boolean }) {
    if (!garden || !entryBody.trim()) {
      return false;
    }

    if (attachPhotos && isOffline && photoFiles.length > 0) {
      setError(
        'Photos need a connection. Reconnect to upload them, or save text only.',
      );
      setSaveStatus('error');
      return false;
    }

    const entryId = createId(entryType === 'issue' ? 'issue' : 'journal');
    const target =
      targetOptions.find((option) => option.id === targetId) ??
      targetOptions[0];

    if (!target) {
      setError('Choose a garden area before saving this entry.');
      setSaveStatus('error');
      return false;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      const photos = attachPhotos
        ? await Promise.all(
            photoFiles.map((file) =>
              mediaStorageService.uploadJournalPhoto({
                entryId,
                file,
                gardenId: garden.id,
                userId: garden.userId,
              }),
            ),
          )
        : [];
      const journalInput = {
        body: entryBody.trim(),
        id: entryId,
        occurredOn: entryDate,
        photos,
      };
      const updatedGarden =
        entryType === 'issue'
          ? reportFieldIssue(garden, {
              ...journalInput,
              category: issueCategory,
              severity: issueSeverity,
              status: issueStatus,
              target,
              title: entryTitle.trim() || 'Garden issue',
            })
          : addFieldNote(garden, {
              ...journalInput,
              target,
              title: entryTitle.trim() || 'Garden note',
            });
      const saved = await saveUpdatedGarden(updatedGarden, {
        refreshWateringFromSnapshot: entryType !== 'issue',
      });

      if (saved) {
        telemetryService.trackEvent(
          entryType === 'issue' ? 'issue_reported' : 'note_added',
          {
            source: 'log',
            target_type: target.type,
          },
        );
        setEntryBody('');
        setEntryTitle('');
        setPhotoFiles([]);
        setIssueStatus('open');
      }
      return saved;
    } catch (journalError) {
      setError(
        toErrorMessage(
          journalError,
          attachPhotos
            ? 'Unable to save feed entry. Selected photos are still queued in this form.'
            : 'Unable to save feed entry.',
        ),
      );
      setSaveStatus('error');
      return false;
    }
  }

  async function handleHarvestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!garden) {
      return false;
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

    const saved = await saveUpdatedGarden(
      {
        ...garden,
        harvestEvents: [harvest, ...garden.harvestEvents],
        updatedAtIso: new Date().toISOString(),
      },
      {
        refreshWateringFromSnapshot: true,
      },
    );

    if (saved) {
      telemetryService.trackEvent('harvest_logged', {
        source: 'log',
        unit: harvestUnit,
      });
      setHarvestAmountText('');
      setHarvestNotes('');
      setHarvestQuantity('1');
    }

    return saved;
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setPhotoFiles(Array.from(event.currentTarget.files ?? []));
    setError(null);
  }

  async function handleCapturePhoto() {
    try {
      const photo = await mobileDeviceService.capturePhoto();

      if (photo) {
        setPhotoFiles((current) => [...current, photo]);
        setError(null);
      }
    } catch (photoError) {
      setError(toErrorMessage(photoError, 'Unable to capture photo.'));
      setSaveStatus('error');
    }
  }

  async function handleIssueStatusChange(entryId: string, status: IssueStatus) {
    if (!garden) {
      return;
    }

    await saveUpdatedGarden(updateIssueStatus(garden, entryId, status));
  }

  return {
    analytics,
    canUseNativeCamera,
    entryBody,
    entryDate,
    entryTitle,
    entryType,
    error,
    filteredFeedItems,
    feedFilterOptions,
    feedItems,
    filters,
    garden,
    handleHarvestSubmit,
    handleIssueStatusChange,
    handleJournalSubmit,
    handlePhotoChange,
    handleCapturePhoto,
    handleSaveEntryWithoutPhotos,
    harvestAmountText,
    harvestDate,
    harvestNotes,
    harvestPlantingId,
    harvestQuantity,
    harvestUnit,
    isOffline,
    issueCategory,
    issueSeverity,
    issueStatus,
    loadStatus,
    photoFiles,
    saveStatus,
    setEntryBody,
    setEntryDate,
    setEntryTitle,
    setEntryType,
    setFilters,
    setHarvestAmountText,
    setHarvestDate,
    setHarvestNotes,
    setHarvestPlantingId,
    setHarvestQuantity,
    setHarvestUnit,
    setIssueCategory,
    setIssueSeverity,
    setIssueStatus,
    setPhotoFiles,
    setTargetId,
    targetId,
    targetOptions,
  };
}
