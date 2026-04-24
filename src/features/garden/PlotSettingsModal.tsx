import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import type {
  ClimateProfile,
  GardenLocation,
  GardenPlot,
} from '../../domain/gardens/GardenRepository';
import { routePaths } from '../../shared/lib/routes';
import { Button, Modal } from '../shared/design/DesignPrimitives';
import { clampPlotDimension, maxPlotFeet, minPlotFeet } from './gardenMath';
import { geocodeLocation } from './geocoding';
import styles from '../plan/PlanModal.module.css';

interface PlotSettingsModalProps {
  climateProfile: ClimateProfile;
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
  climateProfile,
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
    <Modal
      className={styles.plotModal}
      closeLabel="Close plot settings"
      description="Update the saved plot size, orientation, and location."
      footer={
        <>
          <Button onClick={onClose} tone="secondary" type="button">
            Cancel
          </Button>
          <Button form="plot-settings-form" tone="primary" type="submit">
            Save plot
          </Button>
        </>
      }
      onClose={onClose}
      title="Plot settings"
    >
      <form
        className={styles.modalForm}
        id="plot-settings-form"
        onSubmit={handleSubmit}
      >
        <fieldset className={styles.settingsSection}>
          <legend>Size</legend>
          <div className={styles.filterGrid}>
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
          </div>
        </fieldset>

        <fieldset className={styles.settingsSection}>
          <legend>Orientation</legend>
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
        </fieldset>

        <fieldset className={styles.settingsSection}>
          <legend>Location</legend>
          <label className={styles.field}>
            <span>Garden location</span>
            <input
              onChange={(event) => setLocationQuery(event.currentTarget.value)}
              type="text"
              value={locationQuery}
            />
          </label>
          <div className={styles.inlineAction}>
            <button
              className={styles.secondaryButton}
              disabled={!geocodingApiKey || geocodeStatus === 'loading'}
              onClick={() => void handleGeocode()}
              type="button"
            >
              {geocodeStatus === 'loading' ? 'Finding...' : 'Find coords'}
            </button>
            <span>{plot.location.timezone || 'Timezone not set'}</span>
          </div>
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
        </fieldset>

        <fieldset className={styles.settingsSection}>
          <legend>Manual coordinates</legend>
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
        </fieldset>

        <section className={styles.settingsSection}>
          <h3>Climate defaults</h3>
          <p className={styles.helpText}>
            {formatClimateDefaults(climateProfile)}
          </p>
          <Link className={styles.inlineLink} to={routePaths.settings}>
            Open Settings
          </Link>
        </section>
      </form>
    </Modal>
  );
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

function formatClimateDefaults(climateProfile: ClimateProfile) {
  const zone = climateProfile.hardinessZone
    ? `Zone ${climateProfile.hardinessZone}`
    : 'Zone not set';
  const frostWindow =
    climateProfile.averageLastFrost && climateProfile.averageFirstFrost
      ? `${climateProfile.averageLastFrost} to ${climateProfile.averageFirstFrost}`
      : 'frost dates not set';

  return `${zone}; frost window ${frostWindow}.`;
}
