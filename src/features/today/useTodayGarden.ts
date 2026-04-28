import { useEffect, useState } from 'react';

import { useServices } from '../../app/providers';
import {
  createDefaultGarden,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import { isBrowserOffline } from '../../shared/network/networkStatus';
import { useAuth } from '../auth/auth-context';
import { synchronizeGardenTasks, tasksAreEqual } from '../tasks/taskEngine';
import {
  rebuildGardenWateringFromLatestSnapshot,
  refreshGardenWateringFromWeather,
} from '../garden/wateringScheduleRefresh';
import type { TodaySaveStatus } from './components/TodaySaveState';
import { toErrorMessage } from './todayFormatters';

export type TodayLoadStatus = 'error' | 'loading' | 'ready';

export function useTodayGarden(today: Date, isOffline: boolean) {
  const {
    gardenOperationsService,
    gardenRepository,
    mediaStorageService,
    userProfileRepository,
    weatherProvider,
  } = useServices();
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

    const unsubscribe = gardenRepository.subscribeWorkspace(
      userId,
      (workspace) => {
        if (!active) {
          return;
        }

        setGarden(
          synchronizeGardenTasks(workspace.draft.garden, { now: today }),
        );
        setLoadStatus('ready');
      },
    );

    void gardenRepository
      .getGarden(userId)
      .then(async (savedGarden) => {
        const baseGarden = savedGarden ?? createDefaultGarden(userId);
        const syncedGarden = synchronizeGardenTasks(baseGarden, { now: today });
        let initialSaveStatus: TodaySaveStatus = 'idle';

        if (!tasksAreEqual(baseGarden.tasks, syncedGarden.tasks)) {
          const authUser = state.user;
          const wasOffline = isBrowserOffline();

          if (authUser?.email) {
            await gardenRepository.saveSharedOperations({
              actor: {
                displayName: authUser.displayName,
                email: authUser.email,
                userId: authUser.uid,
              },
              baseGarden,
              updatedGarden: syncedGarden,
              userId: authUser.uid,
            });
          } else {
            await gardenRepository.saveGarden(syncedGarden);
          }

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
      unsubscribe();
    };
  }, [gardenRepository, state.user, state.user?.uid, today]);

  async function applyGardenUpdate(
    updateGarden: (current: Garden) => Garden,
    fallback = 'Unable to save today.',
    options: { refreshWateringFromSnapshot?: boolean } = {},
  ) {
    if (!garden) {
      return false;
    }

    const authUser = state.user;

    if (!authUser?.email) {
      setError('Sign in before saving field activity.');
      setSaveStatus('error');
      return false;
    }

    let updatedGarden = updateGarden(garden);

    if (options.refreshWateringFromSnapshot) {
      const profile =
        authUser?.email && authUser.uid === garden.userId
          ? await userProfileRepository
              .getUserProfile(authUser.uid, authUser.email)
              .catch(() => null)
          : null;

      updatedGarden = rebuildGardenWateringFromLatestSnapshot(updatedGarden, {
        now: today,
        profile,
      });
    }

    setGarden(updatedGarden);
    setSaveStatus('saving');
    setError(null);

    try {
      const wasOffline = isBrowserOffline();
      const savedGarden = await gardenRepository.saveSharedOperations({
        actor: {
          displayName: authUser.displayName,
          email: authUser.email,
          userId: authUser.uid,
        },
        baseGarden: garden,
        updatedGarden,
        userId: authUser.uid,
      });
      setGarden(savedGarden);
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
            userId: state.user?.uid ?? garden.userId,
          }),
        ),
      );
    } catch (photoError) {
      setError(toErrorMessage(photoError, 'Unable to upload field photo.'));
      setSaveStatus('error');
      return null;
    }
  }

  async function refreshWeatherAndWatering() {
    if (!garden) {
      return false;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      const now = new Date();
      const wasOffline = isBrowserOffline();
      const authUser = state.user;
      const backendResult = authUser
        ? await gardenOperationsService
            .refreshGardenOperations(authUser.uid)
            .catch(() => null)
        : null;

      if (backendResult?.ok && backendResult.backendAvailable) {
        const savedGarden = await gardenRepository.getGarden(garden.userId);

        if (savedGarden) {
          setGarden(savedGarden);
          setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
          return true;
        }
      }

      const profile =
        authUser?.email && authUser.uid === garden.userId
          ? await userProfileRepository
              .getUserProfile(authUser.uid, authUser.email)
              .catch(() => null)
          : null;
      const updatedGarden = await refreshGardenWateringFromWeather(
        garden,
        weatherProvider,
        {
          forceWeatherRefresh: true,
          now,
          profile,
        },
      );

      const savedGarden = authUser?.email
        ? await gardenRepository.saveSharedOperations({
            actor: {
              displayName: authUser.displayName,
              email: authUser.email,
              userId: authUser.uid,
            },
            baseGarden: garden,
            updatedGarden,
            userId: authUser.uid,
          })
        : updatedGarden;

      setGarden(savedGarden);
      setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
      return true;
    } catch (refreshError) {
      setError(
        toErrorMessage(
          refreshError,
          'Unable to refresh weather and watering schedule.',
        ),
      );
      setSaveStatus('error');
      return false;
    }
  }

  return {
    applyGardenUpdate,
    error,
    garden,
    loadStatus,
    refreshWeatherAndWatering,
    saveStatus,
    uploadQuickPhotos,
  };
}
