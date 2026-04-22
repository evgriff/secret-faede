import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import type { AuthUser } from '../../domain/auth/types';
import type { AppEnvironment } from '../config/env';
import { routePaths } from '../lib/routes';
import { useNetworkStatus } from '../network/networkStatus';
import { usePendingGardenSyncState } from '../sync/pendingGardenSync';
import {
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
          <StatusBadge tone={syncTone}>{syncCopy.badge}</StatusBadge>
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
            <StatusBadge tone={syncTone}>{syncCopy.badge}</StatusBadge>
            <StatusBadge
              tone={
                hasSyncConflict
                  ? 'danger'
                  : hasQueuedChanges
                    ? 'warning'
                    : 'success'
              }
            >
              {hasSyncConflict
                ? 'Conflict'
                : hasQueuedChanges
                  ? 'Queued change'
                  : 'Cloud ready'}
            </StatusBadge>
            <span className={styles.user}>
              {user.displayName
                ? `${user.displayName} · ${user.email}`
                : user.email}
            </span>
            <button
              className={styles.button}
              onClick={() => void onSignOut()}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>
        {hasSyncConflict ? (
          <div className={styles.bannerWrap}>
            <Banner tone="warning">
              A queued garden draft was not synced because the published plan
              changed first. Open Plan, review the draft conflict, then publish
              intentionally or discard the queued draft.
            </Banner>
          </div>
        ) : null}
        {!hasSyncConflict && isOffline ? (
          <div className={styles.bannerWrap}>
            <Banner tone="warning">
              Offline mode is active. Text changes queue locally in this
              browser. If the published plan changes before this reconnects,
              Secret Faede will stop automatic sync and ask for a draft review.
            </Banner>
          </div>
        ) : null}
        {!hasSyncConflict && !isOffline && hasQueuedChanges ? (
          <div className={styles.bannerWrap}>
            <Banner tone="warning">
              A local garden change is waiting to sync. The app will verify the
              draft base revision before writing it to the cloud.
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
      badge: 'Sync conflict',
      message: `Queued locally${
        queuedAtIso ? ` since ${formatTime(queuedAtIso)}` : ''
      }. Published revision ${
        publishedRevisionId ?? 'changed'
      }; review before syncing.`,
    };
  }

  if (hasQueuedChanges) {
    return {
      badge: isOffline ? 'Offline queue' : 'Sync pending',
      message: `Queued locally${
        queuedAtIso ? ` since ${formatTime(queuedAtIso)}` : ''
      }. Base revision will be checked before cloud sync.`,
    };
  }

  return {
    badge: isOffline ? 'Offline' : 'Online',
    message: isOffline ? 'No queued edits yet.' : 'Ready to sync.',
  };
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
