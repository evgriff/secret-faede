import type {
  AnchorHTMLAttributes,
  ComponentType,
  CSSProperties,
  ReactNode,
} from 'react';

import './foundation.css';
import styles from './AppShell.module.css';

export interface AppNavigationItem {
  exact?: boolean;
  href: string;
  icon?: ReactNode;
  label: string;
}

export interface AppNavigationLinkProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> {
  active: boolean;
  href: string;
}

function DefaultNavigationLink({ active, ...props }: AppNavigationLinkProps) {
  return <a {...props} data-active={active || undefined} />;
}

export interface AppShellProps {
  activePath: string;
  banner?: ReactNode;
  brandHref?: string;
  brandName?: string;
  brandSubtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  headerStatus?: ReactNode;
  linkComponent?: ComponentType<AppNavigationLinkProps>;
  mainId?: string;
  navigation: readonly AppNavigationItem[];
  userLabel?: string;
}

export function AppShell({
  activePath,
  banner,
  brandHref = '/app/plan',
  brandName = 'Secret Faeries',
  brandSubtitle = 'Garden field book',
  children,
  headerActions,
  headerStatus,
  linkComponent: NavigationLink = DefaultNavigationLink,
  mainId = 'main-content',
  navigation,
  userLabel,
}: AppShellProps) {
  const navCountStyle = {
    '--sf2-nav-count': Math.max(navigation.length, 1),
  } as CSSProperties;

  const navigationList = (placement: 'rail' | 'bottom') => (
    <ul className={styles.navList}>
      {navigation.map((item) => {
        const active = isPathActive(activePath, item);
        return (
          <li key={`${placement}-${item.href}`}>
            <NavigationLink
              active={active}
              aria-current={active ? 'page' : undefined}
              className={`${styles.navLink} ${active ? styles.activeNavLink : ''}`.trim()}
              href={item.href}
            >
              {item.icon ? (
                <span aria-hidden="true" className={styles.navIcon}>
                  {item.icon}
                </span>
              ) : null}
              <span>{item.label}</span>
            </NavigationLink>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={styles.shell} data-sf-v2="app-shell">
      <a className={styles.skipLink} href={`#${mainId}`}>
        Skip to main content
      </a>

      <aside className={styles.rail}>
        <NavigationLink
          active={false}
          className={styles.brand}
          href={brandHref}
        >
          <span className={styles.brandName}>{brandName}</span>
          <span className={styles.brandDetail}>{brandSubtitle}</span>
        </NavigationLink>
        <nav aria-label="Garden workspace">{navigationList('rail')}</nav>
      </aside>

      <div className={styles.column}>
        <header className={styles.header}>
          <NavigationLink
            active={false}
            className={`${styles.mobileBrand} ${styles.brand}`}
            href={brandHref}
          >
            <span className={styles.brandName}>{brandName}</span>
            <span className={styles.brandDetail}>{brandSubtitle}</span>
          </NavigationLink>
          <div className={styles.headerMeta}>
            {userLabel ? (
              <span className={styles.userLabel} title={userLabel}>
                {userLabel}
              </span>
            ) : null}
            {headerStatus ? <div>{headerStatus}</div> : null}
          </div>
          {headerActions ? (
            <div className={styles.headerActions}>{headerActions}</div>
          ) : null}
        </header>
        {banner ? <div className={styles.bannerSlot}>{banner}</div> : null}
        <main className={styles.main} id={mainId} tabIndex={-1}>
          {children}
        </main>
      </div>

      <nav
        aria-label="Garden workspace"
        className={styles.bottomNav}
        style={navCountStyle}
      >
        {navigationList('bottom')}
      </nav>
    </div>
  );
}

function isPathActive(pathname: string, item: AppNavigationItem) {
  if (item.exact) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
