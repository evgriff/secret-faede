import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import type { AuthUser } from '../../domain/auth/types';
import type { AppEnvironment } from '../config/env';
import { routePaths } from '../lib/routes';
import styles from './AppFrame.module.css';

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
        <div className={styles.actions}>
          <span className={styles.runtimeBadge}>
            {environment.runtimeMode === 'mock' ? 'Mock mode' : 'Firebase mode'}
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
