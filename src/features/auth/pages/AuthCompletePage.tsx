import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { routePaths } from '../../../shared/lib/routes';
import { useAuth } from '../auth-context';
import styles from './AuthCompletePage.module.css';

type CompletionStatus = 'checking' | 'error' | 'needs-email' | 'submitting';

export function AuthCompletePage() {
  const navigate = useNavigate();
  const { completeEmailLinkSignIn, service, state } = useAuth();
  const [status, setStatus] = useState<CompletionStatus>('checking');
  const [email, setEmail] = useState(service.getStoredEmail() ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.user) {
      void navigate(routePaths.root, { replace: true });
      return;
    }

    const currentUrl = window.location.href;

    if (!service.canHandleEmailLink(currentUrl)) {
      setError(
        'This sign-in link is invalid, expired, or meant for another environment.',
      );
      setStatus('error');
      return;
    }

    const storedEmail = service.getStoredEmail();

    if (!storedEmail) {
      setStatus('needs-email');
      return;
    }

    setStatus('submitting');
    void completeEmailLinkSignIn({ url: currentUrl })
      .then(() => navigate(routePaths.root, { replace: true }))
      .catch((completionError) => {
        setError(
          completionError instanceof Error
            ? completionError.message
            : 'Unable to complete sign-in.',
        );
        setStatus('error');
      });
  }, [completeEmailLinkSignIn, navigate, service, state.user]);

  async function handleConfirmEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    try {
      await completeEmailLinkSignIn({
        email,
        url: window.location.href,
      });
      await navigate(routePaths.root, { replace: true });
    } catch (completionError) {
      setError(
        completionError instanceof Error
          ? completionError.message
          : 'Unable to complete sign-in.',
      );
      setStatus('error');
    }
  }

  return (
    <section className="pageShell" data-route-shell="true">
      <div className="pageCard stack">
        <p className="pageLead">Completing sign-in</p>
        <h1 className="pageTitle">Finish the email-link flow.</h1>
        {status === 'checking' || status === 'submitting' ? (
          <p className="pageLead">
            {status === 'checking'
              ? 'Checking the sign-in link…'
              : 'Signing you in and restoring the session…'}
          </p>
        ) : null}
        {status === 'needs-email' ? (
          <form
            className={styles.form}
            onSubmit={(event) => void handleConfirmEmail(event)}
          >
            <p className="pageLead">
              This looks like a different-device flow. Re-enter the email
              address that received the link to continue.
            </p>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="completion-email">
                Email
              </label>
              <input
                autoComplete="email"
                className={styles.input}
                id="completion-email"
                onChange={(event) => setEmail(event.currentTarget.value)}
                type="email"
                value={email}
              />
            </div>
            <button className={styles.button} type="submit">
              Complete sign-in
            </button>
          </form>
        ) : null}
        {status === 'error' && error ? (
          <>
            <p className={styles.error} role="alert">
              {error}
            </p>
            <Link to={routePaths.signIn}>Return to sign-in</Link>
          </>
        ) : null}
      </div>
    </section>
  );
}
