import { useEffect, useState } from 'react';

import { useServices } from '../../app/providers';
import {
  createDefaultGarden,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import { isBrowserOffline } from '../../shared/network/networkStatus';
import { useAuth } from '../auth/auth-context';
import { synchronizeGardenTasks, tasksAreEqual } from '../tasks/taskEngine';
import type { TodaySaveStatus } from './components/TodaySaveState';
import { toErrorMessage } from './todayFormatters';

export type TodayLoadStatus = 'error' | 'loading' | 'ready';

export function useTodayGarden(today: Date, isOffline: boolean) {
  const { gardenRepository, mediaStorageService } = useServices();
  const { state } = useAuth();
  const [garden, setGarden] = useState<Garden | null>(null);
  const [loadStatus, setLoadStatus] = useState<TodayLoadStatus>('loading');
  const [saveStatus, setSaveStatus] = useState<TodaySaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);

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
      .then(async (savedGarden) => {
        const baseGarden = savedGarden ?? createDefaultGarden(userId);
        const syncedGarden = synchronizeGardenTasks(baseGarden, { now: today });
        let initialSaveStatus: TodaySaveStatus = 'idle';

        if (!tasksAreEqual(baseGarden.tasks, syncedGarden.tasks)) {
          const wasOffline = isBrowserOffline();
          await gardenRepository.saveGarden(syncedGarden);
          initialSaveStatus =
            wasOffline || isBrowserOffline() ? 'queued' : 'saved';
        }

        if (!active) {
          return;
        }

        setGarden(syncedGarden);
        setLoadStatus('ready');
        setSaveStatus(initialSaveStatus);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(toErrorMessage(loadError, 'Unable to load today.'));
        setLoadStatus('error');
      });

    return () => {
      active = false;
    };
  }, [gardenRepository, state.user?.uid, today]);

  async function applyGardenUpdate(
    updateGarden: (current: Garden) => Garden,
    fallback = 'Unable to save today.',
  ) {
    if (!garden) {
      return false;
    }

    const updatedGarden = updateGarden(garden);
    setGarden(updatedGarden);
    setSaveStatus('saving');
    setError(null);

    try {
      const wasOffline = isBrowserOffline();
      await gardenRepository.saveGarden(updatedGarden);
      setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
      return true;
    } catch (saveError) {
      setError(toErrorMessage(saveError, fallback));
      setSaveStatus('error');
      return false;
    }
  }

  async function uploadQuickPhotos(entryId: string, files: File[]) {
    if (!garden) {
      return null;
    }

    if (files.length === 0) {
      return [];
    }

    if (isOffline) {
      setError(
        'Photos need a connection. Text changes can still save locally.',
      );
      setSaveStatus('error');
      return null;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      return await Promise.all(
        files.map((file) =>
          mediaStorageService.uploadJournalPhoto({
            entryId,
            file,
            gardenId: garden.id,
            userId: garden.userId,
          }),
        ),
      );
    } catch (photoError) {
      setError(toErrorMessage(photoError, 'Unable to upload field photo.'));
      setSaveStatus('error');
      return null;
    }
  }

  return {
    applyGardenUpdate,
    error,
    garden,
    loadStatus,
    saveStatus,
    uploadQuickPhotos,
  };
}
