import { useRef, useState } from 'react';

import { Button, StatusBanner } from '../../ui';
import { formatInstant, humanize } from './todayModel';
import pageStyles from './TodayPage.module.css';
import styles from './Weather.module.css';
import type { TodayLinkComponent, TodayWeatherSummary } from './types';

export function WeatherPanel({
  focusAlertId,
  LinkComponent,
  onRefresh,
  timezone,
  weather,
}: {
  focusAlertId: string | null;
  LinkComponent: TodayLinkComponent;
  onRefresh?(): Promise<void> | void;
  timezone: string;
  weather: TodayWeatherSummary | null;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const inFlight = useRef(false);

  async function refresh() {
    if (!onRefresh || inFlight.current) return;
    inFlight.current = true;
    setIsRefreshing(true);
    setRefreshError(false);
    try {
      await onRefresh();
    } catch {
      setRefreshError(true);
    } finally {
      inFlight.current = false;
      setIsRefreshing(false);
    }
  }

  return (
    <section
      aria-labelledby="weather-title"
      className={pageStyles.weatherPanel}
      id="weather"
    >
      <div className={pageStyles.sectionHeading}>
        <div>
          <p className={pageStyles.eyebrow}>Conditions</p>
          <h2 id="weather-title">Weather</h2>
        </div>
        {onRefresh ? (
          <Button
            busyLabel="Refreshing weather…"
            isBusy={isRefreshing}
            onClick={() => void refresh()}
            variant="secondary"
          >
            Refresh
          </Button>
        ) : null}
      </div>

      {weather ? (
        <>
          <div className={styles.weatherSummary}>
            <div>
              <span
                className={styles.qualityLabel}
                data-quality={weather.quality}
              >
                {humanize(weather.quality)} data
              </span>
              <p>{weather.summary}</p>
              {weather.observedAtIso ? (
                <small>
                  Updated {formatInstant(weather.observedAtIso, timezone)}
                </small>
              ) : null}
            </div>
            <dl>
              {weather.currentTemperatureF !== null ? (
                <div>
                  <dt>Now</dt>
                  <dd>{Math.round(weather.currentTemperatureF)}°F</dd>
                </div>
              ) : null}
              {weather.highTemperatureF !== null ||
              weather.lowTemperatureF !== null ? (
                <div>
                  <dt>High / low</dt>
                  <dd>
                    {temperature(weather.highTemperatureF)} /{' '}
                    {temperature(weather.lowTemperatureF)}
                  </dd>
                </div>
              ) : null}
              {weather.expectedRainInches !== null ? (
                <div>
                  <dt>Expected rain</dt>
                  <dd>{weather.expectedRainInches.toFixed(2)} in</dd>
                </div>
              ) : null}
              {weather.precipitationProbabilityPercent !== null ? (
                <div>
                  <dt>Rain chance</dt>
                  <dd>
                    {Math.round(weather.precipitationProbabilityPercent)}%
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          {weather.quality === 'stale' || weather.quality === 'insufficient' ? (
            <StatusBanner tone="warning">
              Weather data is {weather.quality}. Watering cards will ask for a
              soil check instead of treating an uncertain forecast as fact.
            </StatusBanner>
          ) : null}

          {weather.alerts.length > 0 ? (
            <div
              className={styles.alertList}
              aria-label="Active weather alerts"
            >
              {weather.alerts.map((alert) => (
                <article
                  className={styles.weatherAlert}
                  data-severity={alert.severity}
                  data-today-focus={
                    focusAlertId === alert.id ? 'true' : undefined
                  }
                  key={alert.id}
                  {...(focusAlertId === alert.id ? { tabIndex: -1 } : {})}
                >
                  <div>
                    <span>{humanize(alert.severity)}</span>
                    <h3>{alert.title}</h3>
                    <p>{alert.detail}</p>
                    <small>
                      Effective {formatInstant(alert.effectiveAtIso, timezone)}
                      {alert.expiresAtIso
                        ? ` · Ends ${formatInstant(alert.expiresAtIso, timezone)}`
                        : ''}
                    </small>
                  </div>
                  <LinkComponent
                    className={styles.inlineLink ?? ''}
                    to={alert.deepLink}
                  >
                    Review affected work
                  </LinkComponent>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.noAlerts}>No active garden weather alerts.</p>
          )}
        </>
      ) : (
        <StatusBanner tone="warning">
          Weather is unavailable. Crop cards cannot infer recent rain; check
          soil before watering.
        </StatusBanner>
      )}

      {refreshError ? (
        <StatusBanner live tone="error">
          Weather did not refresh. The last known conditions remain visible.
        </StatusBanner>
      ) : null}
    </section>
  );
}

function temperature(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}°F`;
}
