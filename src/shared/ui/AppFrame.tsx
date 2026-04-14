import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import { SeedPinLogo } from '../../assets/brand/BrandMarks';
import { BotanicalDivider } from '../../assets/illustrations/GardenIllustrations';
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
            <SeedPinLogo
              accentColor="var(--color-plant-green)"
              className={styles.mark}
              size={44}
              title="Secret Faede"
            />
            <span className={styles.brandText}>
              <span className={styles.eyebrow}>Garden Plot PWA</span>
              <span className={styles.title}>Secret Faede</span>
            </span>
          </Link>
        </div>
        <div className={styles.actions}>
          <NavLink
            className={({ isActive }) =>
              isActive ? `${styles.link} ${styles.linkActive}` : styles.link
            }
            to={routePaths.gardens}
          >
            Gardens
          </NavLink>
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
      <div className={styles.divider}>
        <BotanicalDivider className="botanicalDivider" size="100%" />
      </div>
      {environment.fallbackReason ? (
        <aside className={styles.notice}>{environment.fallbackReason}</aside>
      ) : null}
      <main className={styles.main}>{children}</main>
    </div>
  );
}
