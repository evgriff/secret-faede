import { routePaths } from '../../shared/lib/routes';
import { readStorageValue, writeStorageValue } from '../../shared/lib/storage';

const lastAppRouteKey = 'secret-faede.auth.last-app-route.v1';

type ReturnState = {
  returnTo?: unknown;
};

export function readLastAppRoute(fallback = routePaths.plan) {
  return sanitizeAppRoute(readStorageValue(lastAppRouteKey)) ?? fallback;
}

export function rememberAppRoute(route: string) {
  const safeRoute = sanitizeAppRoute(route);

  if (safeRoute) {
    writeStorageValue(lastAppRouteKey, safeRoute);
  }
}

export function getPostSignInRoute(state: unknown) {
  return sanitizeAppRoute(getReturnTo(state)) ?? readLastAppRoute();
}

export function sanitizeAppRoute(route: unknown): string | null {
  if (
    typeof route !== 'string' ||
    !route.startsWith('/') ||
    route.startsWith('//')
  ) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(route, getLocalOrigin());
  } catch {
    return null;
  }

  if (parsed.origin !== getLocalOrigin()) {
    return null;
  }

  const canonicalPath = getCanonicalAppPath(parsed.pathname);

  if (!canonicalPath) {
    return null;
  }

  return `${canonicalPath}${parsed.search}`;
}

function getReturnTo(state: unknown) {
  if (!state || typeof state !== 'object') {
    return null;
  }

  return (state as ReturnState).returnTo;
}

function getCanonicalAppPath(pathname: string) {
  switch (pathname) {
    case routePaths.app:
    case routePaths.plan:
    case routePaths.garden:
      return routePaths.plan;
    case routePaths.today:
    case routePaths.tasks:
      return routePaths.today;
    case routePaths.feed:
    case routePaths.journal:
    case routePaths.log:
      return routePaths.feed;
    case routePaths.settings:
      return routePaths.settings;
    default:
      return null;
  }
}

function getLocalOrigin() {
  return typeof window === 'undefined'
    ? 'http://localhost'
    : window.location.origin;
}
