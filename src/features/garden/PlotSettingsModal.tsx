import { useState, type FormEvent } from 'react';

import type {
  GardenLocation,
  GardenPlot,
} from '../../domain/gardens/GardenRepository';
import { clampPlotDimension, maxPlotFeet, minPlotFeet } from './gardenMath';
import styles from './GardenEditorScreen.module.css';

interface PlotSettingsModalProps {
  geocodingApiKey: string | null;
  onApply(
    widthFt: number,
    depthFt: number,
    orientationDegrees: number,
    location: GardenLocation,
  ): void;
  onClose(): void;
  plot: GardenPlot;
}

export function PlotSettingsModal({
  geocodingApiKey,
  onApply,
  onClose,
  plot,
}: PlotSettingsModalProps) {
  const [depthFt, setDepthFt] = useState(String(plot.depthFt));
  const [latitude, setLatitude] = useState(
    plot.location.latitude === null ? '' : String(plot.location.latitude),
  );
  const [locationName, setLocationName] = useState(plot.location.locationName);
  const [locationQuery, setLocationQuery] = useState(
    plot.location.locationQuery,
  );
  const [longitude, setLongitude] = useState(
    plot.location.longitude === null ? '' : String(plot.location.longitude),
  );
  const [orientationDegrees, setOrientationDegrees] = useState(
    String(plot.orientationDegrees),
  );
  const [widthFt, setWidthFt] = useState(String(plot.widthFt));
  const [geocodeStatus, setGeocodeStatus] = useState<
    'error' | 'idle' | 'loading'
  >('idle');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(
      clampPlotDimension(Number(widthFt)),
      clampPlotDimension(Number(depthFt)),
      normalizeOrientation(Number(orientationDegrees)),
      {
        latitude: readCoordinate(latitude),
        locationName: locationName.trim() || locationQuery.trim(),
        locationQuery: locationQuery.trim(),
        longitude: readCoordinate(longitude),
        timezone: plot.location.timezone,
      },
    );
  }

  async function handleGeocode() {
    if (!geocodingApiKey || !locationQuery.trim()) {
      return;
    }

    setGeocodeStatus('loading');

    try {
      const result = await geocodeLocation(locationQuery, geocodingApiKey);
      setLatitude(String(result.latitude));
      setLongitude(String(result.longitude));
      setLocationName(result.locationName);
      setGeocodeStatus('idle');
    } catch {
      setGeocodeStatus('error');
    }
  }

  return (
    <div className={styles.modalBackdrop}>
      <section
        aria-labelledby="plot-settings-title"
        aria-modal="true"
        className={`${styles.modal} ${styles.plotModal}`}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <h2 id="plot-settings-title">Plot</h2>
          <button
            aria-label="Close"
            className={styles.iconButton}
            onClick={onClose}
            type="button"
          >
            x
          </button>
        </div>
        <form className={styles.modalForm} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Width in feet</span>
            <input
              inputMode="numeric"
              max={maxPlotFeet}
              min={minPlotFeet}
              onChange={(event) => setWidthFt(event.currentTarget.value)}
              step="1"
              type="number"
              value={widthFt}
            />
          </label>
          <label className={styles.field}>
            <span>Depth in feet</span>
            <input
              inputMode="numeric"
              max={maxPlotFeet}
              min={minPlotFeet}
              onChange={(event) => setDepthFt(event.currentTarget.value)}
              step="1"
              type="number"
              value={depthFt}
            />
          </label>
          <label className={styles.field}>
            <span>North orientation degrees</span>
            <input
              inputMode="numeric"
              max="359"
              min="0"
              onChange={(event) =>
                setOrientationDegrees(event.currentTarget.value)
              }
              step="1"
              type="number"
              value={orientationDegrees}
            />
          </label>
          <label className={styles.field}>
            <span>Garden location</span>
            <input
              onChange={(event) => setLocationQuery(event.currentTarget.value)}
              type="text"
              value={locationQuery}
            />
          </label>
          <button
            className={styles.secondaryButton}
            disabled={!geocodingApiKey || geocodeStatus === 'loading'}
            onClick={() => void handleGeocode()}
            type="button"
          >
            {geocodeStatus === 'loading' ? 'Geocoding...' : 'Geocode'}
          </button>
          {geocodeStatus === 'error' ? (
            <p className={styles.error} role="alert">
              Unable to geocode this location. Enter latitude and longitude
              manually.
            </p>
          ) : null}
          {!geocodingApiKey ? (
            <p className={styles.helpText}>
              Add VITE_GOOGLE_MAPS_API_KEY to enable geocoding, or enter
              coordinates manually.
            </p>
          ) : null}
          <label className={styles.field}>
            <span>Location name</span>
            <input
              onChange={(event) => setLocationName(event.currentTarget.value)}
              type="text"
              value={locationName}
            />
          </label>
          <div className={styles.filterGrid}>
            <label className={styles.field}>
              <span>Latitude</span>
              <input
                inputMode="decimal"
                onChange={(event) => setLatitude(event.currentTarget.value)}
                type="number"
                value={latitude}
              />
            </label>
            <label className={styles.field}>
              <span>Longitude</span>
              <input
                inputMode="decimal"
                onChange={(event) => setLongitude(event.currentTarget.value)}
                type="number"
                value={longitude}
              />
            </label>
          </div>
          <button className={styles.primaryButton} type="submit">
            Save plot
          </button>
        </form>
      </section>
    </div>
  );
}

async function geocodeLocation(query: string, apiKey: string) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  const payload = (await response.json()) as {
    results?: Array<{
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
    status?: string;
  };
  const firstResult = payload.results?.[0];
  const latitude = firstResult?.geometry?.location?.lat;
  const longitude = firstResult?.geometry?.location?.lng;

  if (
    !response.ok ||
    !firstResult ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number'
  ) {
    throw new Error(`Geocode failed: ${payload.status ?? response.status}`);
  }

  return {
    latitude,
    locationName: firstResult.formatted_address ?? query,
    longitude,
  };
}

function readCoordinate(value: string) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function normalizeOrientation(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const normalized = Math.round(value) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
