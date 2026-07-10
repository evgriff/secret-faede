import { useRef, useState, type FormEvent } from 'react';

import {
  Button,
  CheckboxField,
  LoadingState,
  StatusBanner,
  TextField,
} from '../../ui';
import styles from './AuthPages.module.css';

export interface SignInFormValue {
  email: string;
  password: string;
  rememberDevice: boolean;
}

export type SignInAction = 'sign-in' | 'password-reset';

export interface SignInPageProps {
  configurationError?: string | null;
  getErrorMessage?(error: unknown, action: SignInAction): string;
  isEmailAllowed?(normalizedEmail: string): boolean;
  onPasswordReset(normalizedEmail: string): Promise<void>;
  onSignIn(value: SignInFormValue): Promise<void>;
  onSignedIn?(): Promise<void> | void;
  runtimeNotice?: string | null;
  sessionStatus?: 'checking' | 'ready';
}

export function SignInPage({
  configurationError,
  getErrorMessage,
  isEmailAllowed,
  onPasswordReset,
  onSignIn,
  onSignedIn,
  runtimeNotice,
  sessionStatus = 'ready',
}: SignInPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    message: string;
    tone: 'error' | 'success';
  } | null>(null);
  const [action, setAction] = useState<SignInAction | null>(null);
  const actionInFlight = useRef<SignInAction | null>(null);

  if (sessionStatus === 'checking') {
    return (
      <main className={styles.page} data-sf-v2="auth">
        <LoadingState
          detail="Checking for a trusted session on this device."
          title="Opening your garden field book"
        />
      </main>
    );
  }

  const isBusy = action !== null;

  function validateEmail() {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setEmailError(
        'Enter a complete email address, such as name@example.com.',
      );
      return null;
    }
    if (isEmailAllowed && !isEmailAllowed(normalizedEmail)) {
      setEmailError(
        'This email is not one of the two configured garden accounts.',
      );
      return null;
    }
    setEmailError(null);
    return normalizedEmail;
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionInFlight.current || configurationError) {
      return;
    }

    const normalizedEmail = validateEmail();
    const hasPassword = password.length > 0;
    setPasswordError(hasPassword ? null : 'Enter your password.');
    if (!normalizedEmail || !hasPassword) {
      return;
    }

    setStatus(null);
    actionInFlight.current = 'sign-in';
    setAction('sign-in');
    try {
      await onSignIn({
        email: normalizedEmail,
        password,
        rememberDevice,
      });
      try {
        await onSignedIn?.();
      } catch {
        setStatus({
          message:
            'Your account is signed in, but the workspace did not open. Reload the app to continue.',
          tone: 'error',
        });
      }
    } catch (error) {
      setStatus({
        message:
          getErrorMessage?.(error, 'sign-in') ??
          'We could not sign you in. Check the email and password, then try again.',
        tone: 'error',
      });
    } finally {
      actionInFlight.current = null;
      setAction(null);
    }
  }

  async function handlePasswordReset() {
    if (actionInFlight.current || configurationError) {
      return;
    }
    const normalizedEmail = validateEmail();
    if (!normalizedEmail) {
      return;
    }

    setStatus(null);
    actionInFlight.current = 'password-reset';
    setAction('password-reset');
    try {
      await onPasswordReset(normalizedEmail);
      setStatus({
        message:
          'If that address belongs to a configured account, its password-reset email is on the way.',
        tone: 'success',
      });
    } catch (error) {
      setStatus({
        message:
          getErrorMessage?.(error, 'password-reset') ??
          'We could not request a password reset. Check your connection and try again.',
        tone: 'error',
      });
    } finally {
      actionInFlight.current = null;
      setAction(null);
    }
  }

  return (
    <main className={styles.page} data-sf-v2="auth">
      <section aria-labelledby="sign-in-title" className={styles.card}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Private garden workspace</p>
          <h1 className={styles.title} id="sign-in-title">
            Open the field book
          </h1>
          <p className={styles.lead}>
            Sign in with one of the two provisioned accounts. There is no public
            registration for this garden.
          </p>
        </div>

        {configurationError ? (
          <StatusBanner title="Sign-in is unavailable" tone="error">
            {configurationError}
          </StatusBanner>
        ) : null}
        {runtimeNotice ? (
          <StatusBanner title="Runtime notice" tone="info">
            {runtimeNotice}
          </StatusBanner>
        ) : null}

        <form
          aria-busy={isBusy}
          className={styles.form}
          noValidate
          onSubmit={(event) => void handleSignIn(event)}
        >
          <TextField
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={isBusy || Boolean(configurationError)}
            error={emailError}
            inputMode="email"
            label="Email"
            name="email"
            onChange={(event) => {
              setEmail(event.currentTarget.value);
              setEmailError(null);
              setStatus(null);
            }}
            required
            spellCheck={false}
            type="email"
            value={email}
          />

          <TextField
            autoComplete="current-password"
            disabled={isBusy || Boolean(configurationError)}
            error={passwordError}
            label="Password"
            name="password"
            onChange={(event) => {
              setPassword(event.currentTarget.value);
              setPasswordError(null);
              setStatus(null);
            }}
            required
            type={showPassword ? 'text' : 'password'}
            value={password}
          />

          <div className={styles.options}>
            <CheckboxField
              checked={showPassword}
              disabled={isBusy || Boolean(configurationError)}
              onChange={(event) => setShowPassword(event.currentTarget.checked)}
            >
              Show password
            </CheckboxField>
            <CheckboxField
              checked={rememberDevice}
              disabled={isBusy || Boolean(configurationError)}
              onChange={(event) =>
                setRememberDevice(event.currentTarget.checked)
              }
            >
              Keep me signed in on this trusted device
            </CheckboxField>
          </div>

          <p className={styles.securityNote}>
            The auth provider stores a session token when you choose a trusted
            device. The app never stores your raw password.
          </p>

          {status ? (
            <StatusBanner live tone={status.tone}>
              {status.message}
            </StatusBanner>
          ) : null}

          <div className={styles.actions}>
            <Button
              busyLabel="Signing in…"
              disabled={isBusy || Boolean(configurationError)}
              isBusy={action === 'sign-in'}
              type="submit"
            >
              Sign in
            </Button>
            <Button
              busyLabel="Requesting reset…"
              disabled={isBusy || Boolean(configurationError)}
              isBusy={action === 'password-reset'}
              onClick={() => void handlePasswordReset()}
              variant="quiet"
            >
              Reset password
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
