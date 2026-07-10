import { useRef, useState, type ReactNode } from 'react';

import { Button, LinkButton, LoadingState, StatusBanner } from '../../ui';
import styles from './SystemPages.module.css';

export interface RouteErrorPageProps {
  error: unknown;
  onReload?(): void;
  onRetry?(): Promise<void> | void;
  returnHref?: string;
}

export function RouteErrorPage({
  error,
  onReload = () => window.location.reload(),
  onRetry,
  returnHref = '/app/plan',
}: RouteErrorPageProps) {
  const errorKind = classifyRouteError(error);
  const retryInFlight = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState(false);

  async function handleRetry() {
    if (!onRetry || retryInFlight.current) {
      return;
    }
    retryInFlight.current = true;
    setIsRetrying(true);
    setRetryError(false);
    try {
      await onRetry();
    } catch {
      setRetryError(true);
    } finally {
      retryInFlight.current = false;
      setIsRetrying(false);
    }
  }

  const staleChunk = errorKind === 'stale-app-version';
  return (
    <main className={styles.page} data-sf-v2="system">
      <section aria-labelledby="route-error-title" className={styles.card}>
        <StatusBanner tone="warning">
          {staleChunk
            ? 'A newer app version is ready.'
            : 'This page stopped before it could finish.'}
        </StatusBanner>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Workspace recovery</p>
          <h1 className={styles.title} id="route-error-title">
            {staleChunk
              ? 'Reload to update the field book'
              : 'This page needs another try'}
          </h1>
          <p className={styles.lead}>
            {staleChunk
              ? 'Reload the app to use its newest files. Work that already showed as saved remains in garden storage.'
              : 'The last confirmed save is unchanged. Try this page again, reload the app, or return to Plan.'}
          </p>
        </div>
        {retryError ? (
          <StatusBanner live tone="error">
            The retry did not finish. Reload the app or return to Plan.
          </StatusBanner>
        ) : null}
        <div className={styles.actions}>
          {!staleChunk && onRetry ? (
            <Button
              busyLabel="Trying again…"
              isBusy={isRetrying}
              onClick={() => void handleRetry()}
            >
              Try this page again
            </Button>
          ) : null}
          <Button
            disabled={isRetrying}
            onClick={onReload}
            variant={staleChunk ? 'primary' : 'secondary'}
          >
            Reload app
          </Button>
          <LinkButton href={returnHref} variant="quiet">
            Return to Plan
          </LinkButton>
        </div>
      </section>
    </main>
  );
}

export type BootstrapScreenProps =
  | {
      detail?: ReactNode;
      status: 'loading';
    }
  | {
      detail?: ReactNode;
      onRetry?(): Promise<void> | void;
      status: 'error';
    };

export function BootstrapScreen(props: BootstrapScreenProps) {
  if (props.status === 'loading') {
    return (
      <main className={styles.page} data-sf-v2="system">
        <LoadingState
          detail="Loading your account, garden plan, and field settings."
          title="Opening Secret Faeries"
        />
      </main>
    );
  }

  return (
    <main className={styles.page} data-sf-v2="system">
      <section aria-labelledby="bootstrap-error-title" className={styles.card}>
        <StatusBanner tone="error">The app could not start.</StatusBanner>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Startup recovery</p>
          <h1 className={styles.title} id="bootstrap-error-title">
            The field book did not open
          </h1>
          <p className={styles.lead}>
            {props.detail ??
              'Check your connection, then try again. No garden changes were made.'}
          </p>
        </div>
        <div className={styles.actions}>
          {props.onRetry ? (
            <RetryBootstrapButton onRetry={props.onRetry} />
          ) : null}
          <Button onClick={() => window.location.reload()} variant="secondary">
            Reload app
          </Button>
        </div>
      </section>
    </main>
  );
}

function RetryBootstrapButton({
  onRetry,
}: {
  onRetry(): Promise<void> | void;
}) {
  const inFlight = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  async function handleRetry() {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setIsRetrying(true);
    setRetryFailed(false);
    try {
      await onRetry();
    } catch {
      setRetryFailed(true);
    } finally {
      inFlight.current = false;
      setIsRetrying(false);
    }
  }

  return (
    <>
      <Button
        busyLabel="Opening field book…"
        isBusy={isRetrying}
        onClick={() => void handleRetry()}
      >
        Try opening again
      </Button>
      {retryFailed ? (
        <span aria-live="assertive" role="alert">
          Startup still failed. Reload the app or check your connection.
        </span>
      ) : null}
    </>
  );
}

export function classifyRouteError(error: unknown) {
  const text = getErrorText(error).toLowerCase();
  if (
    text.includes('dynamically imported module') ||
    text.includes('failed to fetch dynamically imported module') ||
    text.includes('importing a module script failed') ||
    text.includes('loading chunk')
  ) {
    return 'stale-app-version' as const;
  }
  return 'unexpected' as const;
}

function getErrorText(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusText' in error &&
    typeof error.statusText === 'string'
  ) {
    return error.statusText;
  }
  return String(error);
}
