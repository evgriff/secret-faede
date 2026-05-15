import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useServices } from '../../../app/providers';
import {
  isEmailAllowed,
  isEmailFormatValid,
  normalizeEmail,
} from '../../../shared/auth/allowlist';
import { routePaths } from '../../../shared/lib/routes';
import { useAuth } from '../auth-context';
import { getPostSignInRoute } from '../sessionResume';
import styles from './SignInPage.module.css';

export function SignInPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { environment } = useServices();
  const { sendPasswordReset, signInWithPassword, state } = useAuth();
  const usesClientAllowlist = environment.runtimeMode === 'mock';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  if (state.accessStatus === 'denied') {
    return <Navigate replace to={routePaths.accessDenied} />;
  }

  if (state.status === 'loading') {
    return (
      <section className={styles.shell} data-route-shell="true">
        <div className={styles.card}>
          <p className={styles.kicker}>Trusted device</p>
          <h1 className="pageTitle">Checking session</h1>
          <p className={styles.lead}>
            Looking for an active Secret Faeries session on this device.
          </p>
        </div>
      </section>
    );
  }

  if (state.user) {
    return <Navigate replace to={getPostSignInRoute(location.state)} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (!canAttemptAuth(normalizedEmail)) {
      return;
    }

    if (!password) {
      setError('Enter your password.');
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      await signInWithPassword({
        email: normalizedEmail,
        password,
        rememberDevice,
      });
      await navigate(getPostSignInRoute(location.state), { replace: true });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to sign in.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    const normalizedEmail = normalizeEmail(email);

    if (!canAttemptAuth(normalizedEmail)) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsResetting(true);

    try {
      await sendPasswordReset(normalizedEmail);
      setMessage('Password reset email sent.');
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : 'Unable to send a password reset email.',
      );
    } finally {
      setIsResetting(false);
    }
  }

  function canAttemptAuth(normalizedEmail: string) {
    if (usesClientAllowlist && environment.allowlistError) {
      setError(environment.allowlistError);
      return false;
    }

    if (!isEmailFormatValid(normalizedEmail)) {
      setError('Enter a valid email address.');
      return false;
    }

    if (
      usesClientAllowlist &&
      !isEmailAllowed(environment.allowedEmails, normalizedEmail)
    ) {
      setError('This email is not allowed for Secret Faeries.');
      return false;
    }

    return true;
  }

  return (
    <section className={styles.shell} data-route-shell="true">
      <div className={styles.card}>
        <p className={styles.kicker}>Garden workspace</p>
        <h1 className="pageTitle">Sign in</h1>
        <p className={styles.lead}>
          Use your Secret Faeries password. Trusted devices stay signed in so
          you can get back to the garden quickly.
        </p>

        {usesClientAllowlist && environment.allowlistError ? (
          <p className={styles.error} role="alert">
            {environment.allowlistError}
          </p>
        ) : null}

        {environment.fallbackReason ? (
          <p className={styles.notice} role="status">
            {environment.fallbackReason}
          </p>
        ) : null}

        <form
          className={styles.form}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label className={styles.field}>
            <span>Email</span>
            <input
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              enterKeyHint="next"
              id="email"
              inputMode="email"
              name="email"
              onChange={(event) => setEmail(event.currentTarget.value)}
              placeholder="you@example.com"
              spellCheck={false}
              type="email"
              value={email}
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input
              autoComplete="current-password"
              enterKeyHint="go"
              id="password"
              name="password"
              onChange={(event) => setPassword(event.currentTarget.value)}
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
          </label>

          <div className={styles.options}>
            <label className={styles.checkOption}>
              <input
                checked={showPassword}
                onChange={(event) =>
                  setShowPassword(event.currentTarget.checked)
                }
                type="checkbox"
              />
              <span>Show password</span>
            </label>

            <label className={styles.checkOption}>
              <input
                checked={rememberDevice}
                onChange={(event) =>
                  setRememberDevice(event.currentTarget.checked)
                }
                type="checkbox"
              />
              <span>Stay signed in on this trusted device</span>
            </label>
          </div>

          <p className={styles.sessionHint}>
            This stores a Firebase/mock session token through the auth provider.
            Secret Faeries never stores your raw password.
          </p>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          {message ? (
            <p className={styles.notice} role="status">
              {message}
            </p>
          ) : null}

          <button
            className={styles.primaryButton}
            disabled={
              (usesClientAllowlist && Boolean(environment.allowlistError)) ||
              isSubmitting
            }
            type="submit"
          >
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </button>

          <button
            className={styles.resetButton}
            disabled={
              (usesClientAllowlist && Boolean(environment.allowlistError)) ||
              isResetting
            }
            onClick={() => void handlePasswordReset()}
            type="button"
          >
            {isResetting ? 'Sending reset...' : 'Reset password'}
          </button>
        </form>
      </div>
    </section>
  );
}
