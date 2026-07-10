import type { ReactNode } from 'react';

import './foundation.css';
import styles from './components.module.css';

export type StatusTone = 'info' | 'success' | 'warning' | 'error';

export interface StatusBannerProps {
  actions?: ReactNode;
  children: ReactNode;
  live?: boolean;
  title?: string;
  tone?: StatusTone;
}

export function StatusBanner({
  actions,
  children,
  live = false,
  title,
  tone = 'info',
}: StatusBannerProps) {
  const role = tone === 'error' ? 'alert' : live ? 'status' : undefined;

  return (
    <div
      aria-atomic={role ? 'true' : undefined}
      className={`${styles.banner} ${styles[tone]}`}
      role={role}
    >
      {title ? <p className={styles.bannerTitle}>{title}</p> : null}
      <div>{children}</div>
      {actions ? <div className={styles.bannerActions}>{actions}</div> : null}
    </div>
  );
}
