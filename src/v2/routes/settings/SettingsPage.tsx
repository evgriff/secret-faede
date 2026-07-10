import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { PushRegistrationState } from '../../domain';
import {
  Button,
  ErrorState,
  LoadingState,
  SaveStatus,
  StatusBanner,
} from '../../ui';
import { NotificationConsentPanel } from './NotificationConsentPanel';
import { NotificationDeliveryHistory } from './NotificationDeliveryHistory';
import {
  AlertSettingsFields,
  GardenSettingsFields,
} from './SettingsFormFields';
import styles from './SettingsPage.module.css';
import {
  createSettingsDraft,
  createSettingsSaveValue,
  validateSettingsDraft,
  type SettingsDraft,
  type SettingsErrors,
} from './settingsModel';
import type { SettingsPageProps, SettingsSaveResult } from './types';

export function SettingsPage({
  deliveryHistory,
  deliveryHistoryError,
  deviceCapabilities,
  errorMessage,
  identity,
  loadState = 'ready',
  onRegisterPush,
  onRetry,
  onSave,
  plan,
  profile,
  pushRegistration,
}: SettingsPageProps) {
  const [registration, setRegistration] =
    useState<PushRegistrationState>(pushRegistration);
  const [draft, setDraft] = useState(() => createSettingsDraft(plan, profile));
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<
    'error' | 'idle' | 'queued' | 'saved' | 'saving'
  >('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setRegistration(pushRegistration);
  }, [pushRegistration]);

  useEffect(() => {
    if (!dirty) {
      setDraft(createSettingsDraft(plan, profile));
    }
  }, [dirty, plan, profile, pushRegistration]);

  function change(update: Partial<SettingsDraft>) {
    setDraft((current) => ({ ...current, ...update }));
    setDirty(true);
    setSaveState('idle');
    setErrors({});
    setSaveError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors = validateSettingsDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(formRef.current);
      return;
    }

    inFlight.current = true;
    setSaveState('saving');
    setSaveError(null);
    try {
      const result = await onSave(
        createSettingsSaveValue(draft, plan, profile),
      );
      setSaveState(result);
      setDirty(false);
    } catch (caught) {
      setSaveState('error');
      setSaveError(toMessage(caught));
    } finally {
      inFlight.current = false;
    }
  }

  if (loadState === 'loading') {
    return (
      <main className={styles.page} data-sf-v2="settings">
        <LoadingState
          detail="Loading shared climate values, notification consent, and private delivery history."
          title="Loading Settings"
        />
      </main>
    );
  }

  if (loadState === 'error') {
    const retryProps = onRetry ? { onRetry } : {};
    return (
      <main className={styles.page} data-sf-v2="settings">
        <ErrorState
          detail={errorMessage ?? 'Garden settings could not be loaded.'}
          title="Settings are unavailable"
          {...retryProps}
        />
      </main>
    );
  }

  const registerProps = onRegisterPush ? { onRegisterPush } : {};
  return (
    <main className={styles.page} data-sf-v2="settings">
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Account and garden</p>
          <h1>Settings</h1>
          <p>
            Keep the shared climate assumptions accurate and choose how this
            account receives garden operations alerts.
          </p>
        </div>
      </header>

      <IdentityPanel identity={identity} />

      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => void submit(event)}
        ref={formRef}
      >
        {Object.keys(errors).length > 0 ? (
          <StatusBanner
            live
            title="Review the highlighted settings"
            tone="error"
          >
            Nothing was saved. Correct the invalid or incomplete values and try
            again.
          </StatusBanner>
        ) : null}
        {saveError ? (
          <StatusBanner live title="Settings not saved" tone="error">
            {saveError} Your edits remain in this form.
          </StatusBanner>
        ) : null}

        <GardenSettingsFields draft={draft} errors={errors} onChange={change} />
        <AlertSettingsFields draft={draft} errors={errors} onChange={change} />
        <NotificationConsentPanel
          capabilities={deviceCapabilities}
          onPushEnabledChange={(enabled) => change({ pushEnabled: enabled })}
          onRegistrationChange={setRegistration}
          pushEnabled={draft.pushEnabled}
          registration={registration}
          {...registerProps}
        />

        <div className={styles.saveBar}>
          <SaveStatus
            message={saveMessage(saveState, dirty)}
            status={saveState}
          />
          <Button
            busyLabel="Saving settings…"
            disabled={!dirty}
            isBusy={saveState === 'saving'}
            type="submit"
          >
            Save settings
          </Button>
        </div>
      </form>

      <NotificationDeliveryHistory
        items={deliveryHistory}
        {...(deliveryHistoryError ? { error: deliveryHistoryError } : {})}
      />
    </main>
  );
}

function IdentityPanel({
  identity,
}: {
  identity: SettingsPageProps['identity'];
}) {
  return (
    <section aria-labelledby="identity-title" className={styles.identityPanel}>
      <div>
        <p className={styles.avatar} aria-hidden="true">
          {identity.displayName.trim().charAt(0).toUpperCase() || 'G'}
        </p>
      </div>
      <div>
        <h2 id="identity-title">Signed-in identity</h2>
        <strong>{identity.displayName}</strong>
        <span>{identity.email}</span>
      </div>
      <p>
        This private account has access to the shared published garden and its
        own plan draft.
      </p>
    </section>
  );
}

function saveMessage(
  state: 'error' | 'idle' | 'queued' | 'saved' | 'saving',
  dirty: boolean,
) {
  if (state === 'idle' && dirty) return 'Unsaved changes';
  if (state === 'queued') return 'Saved locally; waiting to sync';
  if (state === 'saved') return 'Settings saved';
  if (state === 'saving') return 'Saving settings…';
  if (state === 'error') return 'Changes are not saved';
  return 'No unsaved changes';
}

function focusFirstInvalid(form: HTMLFormElement | null) {
  window.setTimeout(() => {
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, 0);
}

function toMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'The settings save did not finish.';
}

export type { SettingsSaveResult };
