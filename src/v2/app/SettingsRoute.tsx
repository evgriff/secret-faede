import type { PushRegistrationState } from '../domain';
import { LoadingState } from '../ui';
import {
  SettingsPage,
  type SettingsDeviceCapabilities,
  type SettingsSaveValue,
} from '../routes/settings';
import { useV2Auth } from './AuthProvider';
import { useDeliveryHistory } from './useDeliveryHistory';
import { usePushRegistration } from './usePushRegistration';
import { useV2Services } from './V2ServicesContext';
import { useV2Workspace } from './WorkspaceProvider';

export function SettingsRoute() {
  const auth = useV2Auth();
  const workspace = useV2Workspace();
  const services = useV2Services();
  const deliveryHistory = useDeliveryHistory(auth.user?.uid ?? null);
  const registration = usePushRegistration(auth.user?.uid ?? null);
  const plan = workspace.workspace?.published.plan ?? null;
  const profile = workspace.profile;

  if (!auth.user || !plan || !profile) {
    return <LoadingState detail="Loading garden and account settings." />;
  }
  const capabilities = deviceCapabilities(services);

  async function save(value: SettingsSaveValue) {
    const currentPlan = workspace.workspace?.published.plan;
    if (!currentPlan) throw new Error('The shared garden is not loaded.');
    let sharedQueued = false;
    if (sharedSettingsChanged(currentPlan, value.plan)) {
      const planResult = await workspace.publishSharedSettings(value.plan);
      if (!planResult || planResult.status === 'conflict') {
        throw new Error(
          'The shared plan changed. Reload Settings and review it.',
        );
      }
      sharedQueued = planResult.status === 'queued';
    }
    const profileResult = await workspace.saveProfile(value.profile);
    if (!profileResult || profileResult.status === 'conflict') {
      throw new Error('The account preferences did not save.');
    }
    return sharedQueued || profileResult.status === 'queued'
      ? ('queued' as const)
      : ('saved' as const);
  }

  async function registerPush(): Promise<PushRegistrationState> {
    const capability = services.mobileDeviceService.getCapabilities();
    const result = capability.nativePush
      ? await services.notificationService.registerNativePush(auth.user!.uid)
      : await services.notificationService.registerWebPush(auth.user!.uid);
    return {
      permission:
        result.status === 'registered'
          ? 'granted'
          : result.status === 'denied'
            ? 'denied'
            : result.status === 'unsupported'
              ? 'unsupported'
              : 'prompt',
      registered: result.status === 'registered',
      tokenUpdatedAtIso: result.tokenRegisteredAtIso,
    };
  }

  return (
    <SettingsPage
      deliveryHistory={deliveryHistory.items}
      deliveryHistoryError={deliveryHistory.error}
      deviceCapabilities={capabilities}
      {...(workspace.error ? { errorMessage: workspace.error.message } : {})}
      identity={{ displayName: profile.displayName, email: profile.email }}
      loadState={workspace.loadState}
      onRegisterPush={registerPush}
      onRetry={workspace.reload}
      onSave={save}
      plan={plan}
      profile={profile}
      pushRegistration={registration}
    />
  );
}

function sharedSettingsChanged(
  current: SettingsSaveValue['plan'],
  next: SettingsSaveValue['plan'],
) {
  return (
    JSON.stringify(current.plot.location) !==
      JSON.stringify(next.plot.location) ||
    JSON.stringify(current.plot.climate) !== JSON.stringify(next.plot.climate)
  );
}

function deviceCapabilities(
  services: ReturnType<typeof useV2Services>,
): SettingsDeviceCapabilities {
  const capability = services.mobileDeviceService.getCapabilities();
  const webPushConfigured = Boolean(services.environment.messagingVapidKey);
  return {
    camera: capability.camera ? 'available' : 'unsupported',
    localNotifications: capability.localNotifications
      ? 'unconfigured'
      : 'unsupported',
    platform: capability.platform,
    push:
      capability.platform === 'ios' || capability.platform === 'android'
        ? 'unconfigured'
        : capability.nativePush || webPushConfigured
          ? 'available'
          : services.environment.runtimeMode === 'firebase'
            ? 'unconfigured'
            : 'unsupported',
  };
}
