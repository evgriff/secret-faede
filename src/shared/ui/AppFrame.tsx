import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import type { AuthUser } from '../../domain/auth/types';
import {
  hasDemoModeSession,
  readDemoModeBackup,
} from '../../features/demo/demoModeStorage';
import type { AppEnvironment } from '../config/env';
import { routePaths } from '../lib/routes';
import { useNetworkStatus } from '../network/networkStatus';
import { usePendingGardenSyncState } from '../sync/pendingGardenSync';
import {
  ActionButton,
  Banner,
  StatusBadge,
} from '../../features/shared/design/DesignPrimitives';
import styles from './AppFrame.module.css';

const navItems = [
  { label: 'Plan', to: routePaths.plan },
  { label: 'Today', to: routePaths.today },
  { label: 'Feed', to: routePaths.feed },
  { label: 'Settings', to: routePaths.settings },
] as const;

interface AppFrameProps {
  children: ReactNode;
  environment: AppEnvironment;
  onSignOut(): Promise<void>;
  user: AuthUser;
}

export function AppFrame({
  children,
  environment,
  onSignOut,
  user,
}: AppFrameProps) {
  const networkStatus = useNetworkStatus();
  const isOffline = networkStatus === 'offline';
  const syncState = usePendingGardenSyncState(user.uid);
  const hasQueuedChanges = syncState.status !== 'synced';
  const hasSyncConflict = syncState.status === 'conflict';
  const syncCopy = getSyncCopy({
    hasQueuedChanges,
    hasSyncConflict,
    isOffline,
    publishedRevisionId: syncState.metadata?.publishedRevisionId ?? null,
    queuedAtIso: syncState.metadata?.queuedAtIso ?? null,
  });
  const syncTone = hasSyncConflict
    ? 'danger'
    : isOffline || hasQueuedChanges
      ? 'warning'
      : 'success';
  const userLabel = getUserLabel(user);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.branding}>
          <Link className={styles.brandLink} to={routePaths.root}>
            <span className={styles.title}>Secret Faede</span>
            <span className={styles.subtitle}>Garden OS</span>
          </Link>
        </div>
        <nav aria-label="Workspace" className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`
              }
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.syncCard}>
          <StatusBadge key={syncCopy.badge} tone={syncTone}>
            {syncCopy.badge}
          </StatusBadge>
          <p>{syncCopy.message}</p>
        </div>
      </aside>

      <div className={styles.contentColumn}>
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}>
            <span className={styles.title}>Secret Faede</span>
            <span className={styles.subtitle}>Garden OS</span>
          </div>
          <div className={styles.actions}>
            <div
              aria-label="Shell status"
              aria-live="polite"
              className={styles.statusCluster}
              role="status"
              title={syncCopy.message}
            >
              <StatusBadge key={syncCopy.badge} tone={syncTone}>
                {syncCopy.badge}
              </StatusBadge>
            </div>
            <ShellDemoControls userId={user.uid} />
            <span className={styles.user} title={user.email}>
              {userLabel}
            </span>
            <ActionButton
              className={styles.signOutButton}
              onClick={() => void onSignOut()}
              priority="ghost"
              type="button"
            >
              Sign out
            </ActionButton>
          </div>
        </header>
        {hasSyncConflict ? (
          <div className={styles.bannerWrap}>
            <Banner tone="warning">
              Saved local draft needs review. The published plan changed before
              this browser synced, so open Plan before publishing or discarding
              the queued draft.
            </Banner>
          </div>
        ) : null}
        {!hasSyncConflict && isOffline ? (
          <div className={styles.bannerWrap}>
            <Banner tone="warning">
              Offline. Plan edits, Today actions, and text Feed entries can save
              locally in this browser. Photos still need a connection.
            </Banner>
          </div>
        ) : null}
        {!hasSyncConflict && !isOffline && hasQueuedChanges ? (
          <div className={styles.bannerWrap}>
            <Banner tone="warning">
              Saved local changes are waiting for cloud sync. Secret Faede will
              check the draft base before writing them to the shared garden.
            </Banner>
          </div>
        ) : null}
        {environment.fallbackReason ? (
          <div className={styles.bannerWrap}>
            <Banner tone="warning">{environment.fallbackReason}</Banner>
          </div>
        ) : null}
        <main className={styles.main}>{children}</main>
      </div>

      <nav aria-label="Workspace" className={styles.mobileNav}>
        {navItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.activeNavLink : ''}`
            }
            key={item.to}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function ShellDemoControls({ userId }: { userId: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [demoState, setDemoState] = useState(() => readShellDemoState(userId));
  const buildDemoCommandRoute = (action: 'enter' | 'exit' | 'reset') => {
    const params = new URLSearchParams({ demo: action });
    const returnTo = `${location.pathname}${location.search}`;

    if (!returnTo.startsWith(routePaths.settings)) {
      params.set('returnTo', returnTo);
    }

    return `${routePaths.settings}?${params.toString()}`;
  };

  useEffect(() => {
    const refreshDemoState = () => {
      setDemoState(readShellDemoState(userId));
    };

    refreshDemoState();
    window.addEventListener('secret-faede:demo-mode-changed', refreshDemoState);

    return () => {
      window.removeEventListener(
        'secret-faede:demo-mode-changed',
        refreshDemoState,
      );
    };
  }, [userId]);

  if (demoState.isActive) {
    return (
      <div
        aria-label="Demo controls"
        className={styles.demoControls}
        data-demo-state="demo"
        key="demo"
      >
        <StatusBadge tone="warning">Demo mode</StatusBadge>
        <ActionButton
          className={styles.demoButton}
          onClick={() => {
            void navigate(buildDemoCommandRoute('reset'));
          }}
          priority="ghost"
          type="button"
        >
          Reset seeded demo
        </ActionButton>
        <ActionButton
          className={styles.demoButton}
          disabled={!demoState.canExit}
          onClick={() => {
            void navigate(buildDemoCommandRoute('exit'));
          }}
          priority="secondary"
          title={
            demoState.canExit
              ? 'Restore the garden saved before demo mode.'
              : 'No real garden backup is available in this browser.'
          }
          type="button"
        >
          Exit demo
        </ActionButton>
      </div>
    );
  }

  return (
    <div
      aria-label="Demo controls"
      className={styles.demoControls}
      data-demo-state="real"
      key="real"
    >
      <StatusBadge tone="success">Real garden</StatusBadge>
      <ActionButton
        className={styles.demoButton}
        onClick={() => {
          void navigate(buildDemoCommandRoute('enter'));
        }}
        priority="secondary"
        type="button"
      >
        Enter demo
      </ActionButton>
    </div>
  );
}

function readShellDemoState(userId: string) {
  return {
    canExit: Boolean(readDemoModeBackup(userId)),
    isActive: hasDemoModeSession(userId),
  };
}

function getSyncCopy({
  hasQueuedChanges,
  hasSyncConflict,
  isOffline,
  publishedRevisionId,
  queuedAtIso,
}: {
  hasQueuedChanges: boolean;
  hasSyncConflict: boolean;
  isOffline: boolean;
  publishedRevisionId: string | null;
  queuedAtIso: string | null;
}) {
  if (hasSyncConflict) {
    return {
      badge: 'Sync review',
      message: `Saved locally${
        queuedAtIso ? ` since ${formatTime(queuedAtIso)}` : ''
      }. Published revision ${
        publishedRevisionId ?? 'changed'
      }; review before syncing.`,
    };
  }

  if (hasQueuedChanges) {
    return {
      badge: 'Saved locally',
      message: `Saved in this browser${
        queuedAtIso ? ` since ${formatTime(queuedAtIso)}` : ''
      }. Cloud sync resumes when connection is stable.`,
    };
  }

  return {
    badge: isOffline ? 'Offline' : 'Online',
    message: isOffline
      ? 'No changes waiting. Text saves can queue locally; photos need connection.'
      : 'Ready for cloud sync.',
  };
}

function getUserLabel(user: AuthUser) {
  if (user.displayName) {
    return user.displayName;
  }

  return user.email.split('@')[0] || user.email;
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
