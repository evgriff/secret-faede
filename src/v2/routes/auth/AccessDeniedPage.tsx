import { useRef, useState } from 'react';

import { Button, StatusBanner } from '../../ui';
import styles from './AuthPages.module.css';

export interface AccessDeniedPageProps {
  attemptedEmail?: string | null;
  onReturnToSignIn(): Promise<void>;
}

export function AccessDeniedPage({
  attemptedEmail,
  onReturnToSignIn,
}: AccessDeniedPageProps) {
  const returning = useRef(false);
  const [isReturning, setIsReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReturn() {
    if (returning.current) {
      return;
    }
    returning.current = true;
    setIsReturning(true);
    setError(null);
    try {
      await onReturnToSignIn();
    } catch {
      setError(
        'We could not return to sign in. Check your connection and try again.',
      );
    } finally {
      returning.current = false;
      setIsReturning(false);
    }
  }

  return (
    <main className={styles.page} data-sf-v2="auth">
      <section aria-labelledby="denied-title" className={styles.card}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Private workspace</p>
          <h1 className={styles.title} id="denied-title">
            This account cannot open the garden
          </h1>
          <p className={styles.lead}>
            Secret Faeries is limited to two provisioned accounts. Ask the
            garden owner to confirm access before trying again.
          </p>
        </div>
        {attemptedEmail ? (
          <p className={styles.attemptedEmail}>
            Attempted account: <strong>{attemptedEmail}</strong>
          </p>
        ) : null}
        {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
        <Button
          busyLabel="Closing session…"
          isBusy={isReturning}
          onClick={() => void handleReturn()}
        >
          Return to sign in
        </Button>
      </section>
    </main>
  );
}
