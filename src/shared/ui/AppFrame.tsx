import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import type { AuthUser } from '../../domain/auth/types';
import type { AppEnvironment } from '../config/env';
import { routePaths } from '../lib/routes';
import { useNetworkStatus } from '../network/networkStatus';
import styles from './AppFrame.module.css';

const navItems = [
  { label: 'Garden', to: routePaths.garden },
  { label: 'Tasks', to: routePaths.tasks },
  { label: 'Journal', to: routePaths.journal },
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

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.branding}>
          <Link className={styles.brandLink} to={routePaths.root}>
            <span className={styles.brandText}>
              <span className={styles.title}>Secret Faede</span>
            </span>
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
        <div className={styles.actions}>
          <span
            aria-live="polite"
            className={`${styles.connectionStatus} ${
              networkStatus === 'offline' ? styles.offline : styles.online
            }`}
          >
            {networkStatus === 'offline' ? 'Offline' : 'Online'}
          </span>
          <span className={styles.user}>{user.email}</span>
          <button
            className={styles.button}
            onClick={() => void onSignOut()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>
      {environment.fallbackReason ? (
        <aside className={styles.notice}>{environment.fallbackReason}</aside>
      ) : null}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
