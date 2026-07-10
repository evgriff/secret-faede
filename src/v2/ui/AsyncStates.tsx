import { useRef, useState, type ReactNode } from 'react';

import { Button } from './Button';
import { StatusBanner } from './Status';
import './foundation.css';
import styles from './components.module.css';

interface StatePanelProps {
  actions?: ReactNode;
  children: ReactNode;
  title: string;
}

function StatePanel({ actions, children, title }: StatePanelProps) {
  return (
    <section className={styles.statePanel}>
      <h2>{title}</h2>
      <div>{children}</div>
      {actions ? <div className={styles.stateActions}>{actions}</div> : null}
    </section>
  );
}

export interface LoadingStateProps {
  detail?: string;
  title?: string;
}

export function LoadingState({
  detail = 'This should only take a moment.',
  title = 'Loading garden workspace',
}: LoadingStateProps) {
  return (
    <div aria-busy="true" aria-live="polite" role="status">
      <StatePanel title={title}>
        <p>{detail}</p>
      </StatePanel>
    </div>
  );
}

export interface EmptyStateProps {
  action?: ReactNode;
  detail: ReactNode;
  title: string;
}

export function EmptyState({ action, detail, title }: EmptyStateProps) {
  return (
    <StatePanel actions={action} title={title}>
      <p>{detail}</p>
    </StatePanel>
  );
}

export interface ErrorStateProps {
  detail?: ReactNode;
  onRetry?(): Promise<void> | void;
  retryLabel?: string;
  title?: string;
}

export function ErrorState({
  detail = 'The workspace could not finish this request. Your last confirmed save is unchanged.',
  onRetry,
  retryLabel = 'Try again',
  title = 'That did not work',
}: ErrorStateProps) {
  const retryInFlight = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);

  async function handleRetry() {
    if (!onRetry || retryInFlight.current) {
      return;
    }

    retryInFlight.current = true;
    setIsRetrying(true);
    setRetryFailed(false);
    try {
      await onRetry();
    } catch {
      setRetryFailed(true);
    } finally {
      retryInFlight.current = false;
      setIsRetrying(false);
    }
  }

  return (
    <div aria-live="assertive" role="alert">
      <StatePanel
        actions={
          onRetry ? (
            <Button
              busyLabel="Trying again…"
              isBusy={isRetrying}
              onClick={() => void handleRetry()}
              variant="secondary"
            >
              {retryLabel}
            </Button>
          ) : undefined
        }
        title={title}
      >
        <p>{detail}</p>
        {retryFailed ? (
          <StatusBanner live tone="error">
            The retry did not finish. Check your connection and try again.
          </StatusBanner>
        ) : null}
      </StatePanel>
    </div>
  );
}

export type SaveStatusKind =
  | 'idle'
  | 'saving'
  | 'saved'
  | 'queued'
  | 'error'
  | 'conflict';

export interface SaveStatusProps {
  message?: string;
  status: SaveStatusKind;
}

const defaultSaveCopy: Record<SaveStatusKind, string> = {
  idle: 'No unsaved changes',
  saving: 'Saving changes…',
  saved: 'All changes saved',
  queued: 'Saved on this device; waiting to sync',
  error: 'Changes are not saved',
  conflict: 'Saved versions need review',
};

const saveTone: Record<SaveStatusKind, StatusToneClass> = {
  idle: 'info',
  saving: 'info',
  saved: 'success',
  queued: 'warning',
  error: 'error',
  conflict: 'warning',
};

type StatusToneClass = 'info' | 'success' | 'warning' | 'error';

export function SaveStatus({ message, status }: SaveStatusProps) {
  const isUrgent = status === 'error' || status === 'conflict';

  return (
    <span
      aria-atomic="true"
      aria-live={isUrgent ? 'assertive' : 'polite'}
      className={`${styles.saveStatus} ${styles[saveTone[status]]}`}
      role="status"
    >
      <span aria-hidden="true" className={styles.saveDot} />
      {message ?? defaultSaveCopy[status]}
    </span>
  );
}

export interface ConflictStateProps {
  detail?: ReactNode;
  keepMineLabel?: string;
  onKeepMine(): Promise<void> | void;
  onUseLatest(): Promise<void> | void;
  useLatestLabel?: string;
}

export function ConflictState({
  detail = 'Another saved version changed while you were working. Compare the versions before replacing either one.',
  keepMineLabel = 'Keep my version',
  onKeepMine,
  onUseLatest,
  useLatestLabel = 'Use latest saved version',
}: ConflictStateProps) {
  const [action, setAction] = useState<'mine' | 'latest' | null>(null);
  const actionInFlight = useRef(false);
  const [resolutionFailed, setResolutionFailed] = useState(false);

  async function resolve(
    nextAction: 'mine' | 'latest',
    callback: () => Promise<void> | void,
  ) {
    if (actionInFlight.current) {
      return;
    }

    actionInFlight.current = true;
    setAction(nextAction);
    setResolutionFailed(false);
    try {
      await callback();
    } catch {
      setResolutionFailed(true);
    } finally {
      actionInFlight.current = false;
      setAction(null);
    }
  }

  return (
    <StatePanel
      actions={
        <>
          <Button
            busyLabel="Keeping this version…"
            disabled={action !== null}
            isBusy={action === 'mine'}
            onClick={() => void resolve('mine', onKeepMine)}
            variant="secondary"
          >
            {keepMineLabel}
          </Button>
          <Button
            busyLabel="Loading latest…"
            disabled={action !== null}
            isBusy={action === 'latest'}
            onClick={() => void resolve('latest', onUseLatest)}
          >
            {useLatestLabel}
          </Button>
        </>
      }
      title="Choose which saved version to use"
    >
      <p>{detail}</p>
      {resolutionFailed ? (
        <StatusBanner live tone="error">
          The saved-version choice did not finish. Neither version was replaced;
          try again.
        </StatusBanner>
      ) : null}
    </StatePanel>
  );
}
