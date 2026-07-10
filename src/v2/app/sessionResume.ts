const lastAppRouteKey = 'secret-faeries.auth.last-app-route.v1';
const routes = {
  app: '/app',
  feed: '/app/feed',
  garden: '/app/garden',
  journal: '/app/journal',
  log: '/app/log',
  plan: '/app/plan',
  settings: '/app/settings',
  tasks: '/app/tasks',
  today: '/app/today',
} as const;

type ReturnState = { returnTo?: unknown };

export function readLastAppRoute(fallback = routes.plan) {
  return sanitizeAppRoute(readStorageValue()) ?? fallback;
}

export function rememberAppRoute(route: string) {
  const safeRoute = sanitizeAppRoute(route);
  if (!safeRoute || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(lastAppRouteKey, safeRoute);
  } catch {
    // Route memory is optional when browser storage is unavailable.
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
    parsed = new URL(route, localOrigin());
  } catch {
    return null;
  }
  if (parsed.origin !== localOrigin()) return null;
  const canonicalPath = canonicalAppPath(parsed.pathname);
  return canonicalPath ? `${canonicalPath}${parsed.search}` : null;
}

function readStorageValue() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(lastAppRouteKey);
  } catch {
    return null;
  }
}

function getReturnTo(state: unknown) {
  return state && typeof state === 'object'
    ? (state as ReturnState).returnTo
    : null;
}

function canonicalAppPath(pathname: string) {
  switch (pathname) {
    case routes.app:
    case routes.garden:
    case routes.plan:
      return routes.plan;
    case routes.tasks:
    case routes.today:
      return routes.today;
    case routes.feed:
    case routes.journal:
    case routes.log:
      return routes.feed;
    case routes.settings:
      return routes.settings;
    default:
      return null;
  }
}

function localOrigin() {
  return typeof window === 'undefined'
    ? 'http://localhost'
    : window.location.origin;
}
