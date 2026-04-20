import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { useServices } from '../../../app/providers';
import {
  isEmailFormatValid,
  normalizeEmail,
} from '../../../shared/auth/allowlist';
import { routePaths } from '../../../shared/lib/routes';
import { useAuth } from '../auth-context';
import styles from './SignInPage.module.css';

export function SignInPage() {
  const { environment } = useServices();
  const { requestEmailSignIn, state } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentState, setSentState] = useState<{
    completionPath?: string;
    delivery: 'email' | 'mock-link';
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (state.user) {
    return <Navigate replace to={routePaths.root} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    if (environment.allowlistError) {
      setError(environment.allowlistError);
      return;
    }

    if (!isEmailFormatValid(normalizedEmail)) {
      setError('Enter a valid email address to receive the sign-in link.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await requestEmailSignIn(normalizedEmail);
      setSentState(result);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to send the sign-in link.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="pageShell" data-route-shell="true">
      <div className={`pageCard ${styles.card}`}>
        <h1 className="pageTitle">Sign in with an email link.</h1>

        {environment.allowlistError ? (
          <p className={styles.error} role="alert">
            {environment.allowlistError}
          </p>
        ) : null}

        {environment.fallbackReason ? (
          <p className={styles.notice} role="status">
            {environment.fallbackReason}
          </p>
        ) : null}

        {sentState ? (
          <div className={styles.sentState}>
            <p className="pageLead">Check your email for the sign-in link.</p>
            {sentState.delivery === 'mock-link' && sentState.completionPath ? (
              <Link
                className={styles.secondaryButton}
                to={sentState.completionPath}
              >
                Use mock sign-in link
              </Link>
            ) : null}
            <button
              className={styles.secondaryButton}
              onClick={() => setSentState(null)}
              type="button"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form
            className={styles.form}
            onSubmit={(event) => void handleSubmit(event)}
          >
            <label className={styles.field}>
              <span>Email</span>
              <input
                autoComplete="email"
                id="email"
                inputMode="email"
                name="email"
                onChange={(event) => setEmail(event.currentTarget.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </label>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <button
              className={styles.primaryButton}
              disabled={Boolean(environment.allowlistError) || isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Sending link...' : 'Send sign-in link'}
            </button>
          </form>
        )}

        <p className={styles.runtime}>
          {environment.runtimeMode === 'mock' ? 'Mock mode' : 'Firebase mode'}
        </p>
      </div>
    </section>
  );
}
