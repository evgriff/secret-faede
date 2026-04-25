import { routePaths } from '../../shared/lib/routes';
import {
  hasDemoModeSession,
  readDemoModeBackup,
} from '../demo/demoModeStorage';

export type DemoModeAction = 'enter' | 'exit' | 'reset';

export interface SettingsDemoState {
  canExit: boolean;
  error: string | null;
  isActive: boolean;
  isBusy: boolean;
  message: string | null;
  status: 'idle' | 'loading' | 'loaded' | 'reset' | 'exited';
}

export const sampleGardenRestoreLabel = 'Back to my garden';
export const sampleGardenActiveLabel = 'Sample garden active.';
export const sampleGardenRestoreDisabledMessage =
  'No saved garden backup is available on this device, so Back to my garden is unavailable.';
export const sampleGardenRestoreTitle = {
  available: 'Back to the garden saved before opening the sample.',
  unavailable: 'No saved garden backup is available on this device.',
} as const;

export function readSettingsDemoState(
  uid: string | null | undefined,
  overrides: Partial<SettingsDemoState> = {},
): SettingsDemoState {
  return {
    canExit: uid ? Boolean(readDemoModeBackup(uid)) : false,
    error: null,
    isActive: uid ? hasDemoModeSession(uid) : false,
    isBusy: false,
    message: null,
    status: 'idle',
    ...overrides,
  };
}

export function isDemoModeAction(
  value: string | null,
): value is DemoModeAction {
  return value === 'enter' || value === 'exit' || value === 'reset';
}

export function getSafeDemoReturnTo(value: string | null) {
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

export function buildSettingsDemoCommandPath(
  action: DemoModeAction,
  returnTo?: string | null,
) {
  const params = new URLSearchParams({ demo: action });
  const safeReturnTo = getSafeDemoReturnTo(returnTo ?? null);

  if (safeReturnTo) {
    params.set('returnTo', safeReturnTo);
  }

  return `${routePaths.settings}?${params.toString()}`;
}
