import { useEffect, useState } from 'react';

import styles from './components.module.css';

export interface RouteAnnouncementProps {
  appName?: string;
  focusTargetId?: string;
  routeKey: string;
  title: string;
}

export function RouteAnnouncement({
  appName = 'Secret Faeries',
  focusTargetId = 'route-heading',
  routeKey,
  title,
}: RouteAnnouncementProps) {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    document.title = `${title} · ${appName}`;
    setAnnouncement('');

    const timer = window.setTimeout(() => {
      setAnnouncement(`${title} page loaded`);
      const focusTarget = document.getElementById(focusTargetId);
      if (focusTarget instanceof HTMLElement) {
        if (!focusTarget.hasAttribute('tabindex')) {
          focusTarget.setAttribute('tabindex', '-1');
        }
        focusTarget.focus({ preventScroll: true });
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [appName, focusTargetId, routeKey, title]);

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={styles.srOnly}
      role="status"
    >
      {announcement}
    </div>
  );
}
