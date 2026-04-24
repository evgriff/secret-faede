import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useServices } from '../../app/providers';
import type { AuthUser } from '../../domain/auth/types';
import type {
  Garden,
  UserProfile,
} from '../../domain/gardens/GardenRepository';
import { routePaths } from '../../shared/lib/routes';
import {
  exitSettingsDemoGarden,
  loadSettingsDemoGarden,
  readSettingsDemoState,
  type SettingsDemoState,
} from './settingsDemoMode';
import { toErrorMessage } from './settingsHelpers';

export function useSettingsDemoMode({
  authUser,
  garden,
  profile,
  setGarden,
  setPageError,
  setProfile,
  setSaveStatus,
}: {
  authUser: AuthUser | null;
  garden: Garden | null;
  profile: UserProfile | null;
  setGarden(garden: Garden): void;
  setPageError(error: string | null): void;
  setProfile(profile: UserProfile): void;
  setSaveStatus(status: 'idle' | 'saved' | 'saving'): void;
}) {
  const { gardenRepository, userProfileRepository } = useServices();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<SettingsDemoState>(() =>
    readSettingsDemoState(authUser?.uid),
  );
  const handledCommandRef = useRef<string | null>(null);
  const requestedDemoAction = searchParams.get('demo');
  const requestedReturnTo = searchParams.get('returnTo');

  useEffect(() => {
    setState((current) =>
      readSettingsDemoState(authUser?.uid, {
        error: current.error,
        isBusy: current.isBusy,
        message: current.message,
        status: current.status,
      }),
    );
  }, [authUser?.uid]);

  const loadDemoGarden = useCallback(
    async (nextStatus: 'loaded' | 'reset') => {
      if (!authUser || !profile) {
        return false;
      }

      setState((current) => ({
        ...current,
        error: null,
        isBusy: true,
        message: null,
        status: 'loading',
      }));
      setPageError(null);

      try {
        const result = await loadSettingsDemoGarden({
          email: authUser.email,
          gardenRepository,
          profileRepository: userProfileRepository,
          savedGarden: garden,
          savedProfile: profile,
          status: nextStatus,
          uid: authUser.uid,
        });

        setGarden(result.garden);
        setProfile(result.profile);
        setSaveStatus('saved');
        setState(
          readSettingsDemoState(authUser.uid, {
            message: result.message,
            status: nextStatus,
          }),
        );
        return true;
      } catch (demoError) {
        setState(
          readSettingsDemoState(authUser.uid, {
            error: toErrorMessage(demoError, 'Unable to open sample garden.'),
          }),
        );
        return false;
      }
    },
    [
      authUser,
      garden,
      gardenRepository,
      profile,
      setGarden,
      setPageError,
      setProfile,
      setSaveStatus,
      userProfileRepository,
    ],
  );

  const exitDemoGarden = useCallback(async () => {
    if (!authUser) {
      return false;
    }

    setState((current) => ({
      ...current,
      error: null,
      isBusy: true,
      message: null,
      status: 'loading',
    }));
    setPageError(null);

    try {
      const result = await exitSettingsDemoGarden({
        email: authUser.email,
        gardenRepository,
        profileRepository: userProfileRepository,
        uid: authUser.uid,
      });

      setGarden(result.garden);
      setProfile(result.profile);
      setSaveStatus('saved');
      setState(
        readSettingsDemoState(authUser.uid, {
          message: result.message,
          status: 'exited',
        }),
      );
      return true;
    } catch (demoError) {
      setState(
        readSettingsDemoState(authUser.uid, {
          error: toErrorMessage(
            demoError,
            'Unable to return to the saved garden.',
          ),
        }),
      );
      return false;
    }
  }, [
    authUser,
    gardenRepository,
    setGarden,
    setPageError,
    setProfile,
    setSaveStatus,
    userProfileRepository,
  ]);

  useEffect(() => {
    if (!authUser || !profile || !isDemoAction(requestedDemoAction)) {
      handledCommandRef.current = null;
      return;
    }

    const action = requestedDemoAction;
    const returnTo = getSafeDemoReturnTo(requestedReturnTo);
    const commandKey = `${action}:${requestedReturnTo ?? ''}`;

    if (handledCommandRef.current === commandKey) {
      return;
    }

    handledCommandRef.current = commandKey;

    setSearchParams({}, { replace: true });

    void (async () => {
      const didComplete =
        action === 'exit'
          ? await exitDemoGarden()
          : await loadDemoGarden(action === 'reset' ? 'reset' : 'loaded');

      if (didComplete && returnTo) {
        void navigate(returnTo, { replace: true });
      }
    })();
  }, [
    authUser,
    exitDemoGarden,
    loadDemoGarden,
    navigate,
    profile,
    requestedDemoAction,
    requestedReturnTo,
    setSearchParams,
  ]);

  return {
    exitDemoGarden,
    loadDemoGarden,
    state,
  };
}

function isDemoAction(
  value: string | null,
): value is 'enter' | 'exit' | 'reset' {
  return value === 'enter' || value === 'exit' || value === 'reset';
}

function getSafeDemoReturnTo(value: string | null) {
  if (!value) {
    return null;
  }

  const allowedRoutes = [
    routePaths.plan,
    routePaths.today,
    routePaths.feed,
    routePaths.settings,
  ];

  return allowedRoutes.some(
    (route) => value === route || value.startsWith(`${route}?`),
  )
    ? value
    : null;
}
