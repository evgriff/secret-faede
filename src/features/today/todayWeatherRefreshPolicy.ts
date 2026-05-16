const AUTO_REFRESH_TTL_MS = 300000;

const autoRefreshAttempts = new Map<string, number>();

export function shouldRunTodayWeatherAutoRefresh(
  key: string,
  nowMs = Date.now(),
) {
  const previousAttemptMs = autoRefreshAttempts.get(key);

  if (
    previousAttemptMs !== undefined &&
    nowMs - previousAttemptMs < AUTO_REFRESH_TTL_MS
  ) {
    return false;
  }

  autoRefreshAttempts.set(key, nowMs);
  pruneAutoRefreshAttempts(nowMs);
  return true;
}

export function resetTodayWeatherAutoRefreshForTests() {
  autoRefreshAttempts.clear();
}

function pruneAutoRefreshAttempts(nowMs: number) {
  for (const [key, attemptedAtMs] of autoRefreshAttempts) {
    if (nowMs - attemptedAtMs >= AUTO_REFRESH_TTL_MS) {
      autoRefreshAttempts.delete(key);
    }
  }
}
