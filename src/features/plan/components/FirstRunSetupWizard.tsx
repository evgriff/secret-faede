import { useMemo, useState, type FormEvent } from 'react';

import {
  annArborClimateProfile,
  annArborLocation,
  type Garden,
} from '../../../domain/gardens/GardenRepository';
import {
  createClimateProfileForLocation,
  createGardenLocationFromInput,
  findKnownClimateProfile,
} from '../../../domain/gardens/climateProfile';
import {
  blankTemplateId,
  gardenTemplates,
  type GardenSetupPlotType,
  type GardenSetupRequest,
} from '../../../domain/gardens/gardenTemplates';
import {
  clampPlotDimension,
  maxPlotFeet,
  minPlotFeet,
} from '../../garden/gardenMath';
import { geocodeLocation } from '../../garden/geocoding';
import { FirstRunTemplateOption } from './FirstRunTemplateOption';
import styles from './FirstRunSetupWizard.module.css';

export function FirstRunSetupWizard({
  garden,
  geocodingApiKey,
  onComplete,
}: {
  garden: Garden;
  geocodingApiKey: string | null;
  onComplete(request: GardenSetupRequest): void;
}) {
  const [gardenName, setGardenName] = useState(garden.name);
  const [locationName, setLocationName] = useState(
    garden.plot.location.locationName || annArborLocation.locationName,
  );
  const [locationQuery, setLocationQuery] = useState(
    garden.plot.location.locationQuery || annArborLocation.locationQuery,
  );
  const [timezone, setTimezone] = useState(
    garden.plot.location.timezone || annArborLocation.timezone,
  );
  const [latitude, setLatitude] = useState(
    coordinateToString(
      garden.plot.location.latitude ?? annArborLocation.latitude,
    ),
  );
  const [longitude, setLongitude] = useState(
    coordinateToString(
      garden.plot.location.longitude ?? annArborLocation.longitude,
    ),
  );
  const [plotType, setPlotType] = useState<GardenSetupPlotType>('raisedBed');
  const [plotWidthFt, setPlotWidthFt] = useState(String(garden.plot.widthFt));
  const [plotDepthFt, setPlotDepthFt] = useState(String(garden.plot.depthFt));
  const [templateId, setTemplateId] = useState('small-raised-bed');
  const [hardinessZone, setHardinessZone] = useState(
    garden.climateProfile.hardinessZone || annArborClimateProfile.hardinessZone,
  );
  const [averageLastFrost, setAverageLastFrost] = useState(
    garden.climateProfile.averageLastFrost ||
      annArborClimateProfile.averageLastFrost,
  );
  const [averageFirstFrost, setAverageFirstFrost] = useState(
    garden.climateProfile.averageFirstFrost ||
      annArborClimateProfile.averageFirstFrost,
  );
  const [geocodeStatus, setGeocodeStatus] = useState<
    'error' | 'idle' | 'loading'
  >('idle');
  const climateEstimate = useMemo(
    () =>
      findKnownClimateProfile(
        createGardenLocationFromInput({
          latitude: readCoordinate(latitude),
          locationName,
          locationQuery,
          longitude: readCoordinate(longitude),
          timezone,
        }),
      ),
    [latitude, locationName, locationQuery, longitude, timezone],
  );

  function handleTemplateChange(nextTemplateId: string) {
    setTemplateId(nextTemplateId);

    const template = gardenTemplates.find(
      (candidate) => candidate.id === nextTemplateId,
    );

    if (template) {
      setPlotType(template.plotType);
      setPlotWidthFt(String(template.plotWidthFt));
      setPlotDepthFt(String(template.plotDepthFt));
    }
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
      applyClimateEstimate(
        result.locationName,
        result.latitude,
        result.longitude,
      );
      setGeocodeStatus('idle');
    } catch {
      setGeocodeStatus('error');
    }
  }

  function applyClimateEstimate(
    nextName = locationName,
    nextLatitude = readCoordinate(latitude),
    nextLongitude = readCoordinate(longitude),
  ) {
    const knownProfile = findKnownClimateProfile(
      createGardenLocationFromInput({
        latitude: nextLatitude,
        locationName: nextName,
        locationQuery,
        longitude: nextLongitude,
        timezone,
      }),
    );

    if (!knownProfile) {
      return;
    }

    setAverageFirstFrost(knownProfile.averageFirstFrost);
    setAverageLastFrost(knownProfile.averageLastFrost);
    setHardinessZone(knownProfile.hardinessZone);
    setLocationName(knownProfile.locationName);
    setTimezone(knownProfile.timezone);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const location = createGardenLocationFromInput({
      latitude: readCoordinate(latitude),
      locationName,
      locationQuery,
      longitude: readCoordinate(longitude),
      timezone,
    });

    onComplete({
      climateProfile: createClimateProfileForLocation({
        averageFirstFrost,
        averageLastFrost,
        hardinessZone,
        location,
      }),
      gardenName,
      location,
      plotDepthFt: clampPlotDimension(Number(plotDepthFt)),
      plotType,
      plotWidthFt: clampPlotDimension(Number(plotWidthFt)),
      templateId,
    });
  }

  return (
    <section className={styles.setup} aria-labelledby="setup-title">
      <form className={styles.card} onSubmit={handleSubmit}>
        <header className={styles.header}>
          <span>First run</span>
          <h1 id="setup-title">Set up your garden</h1>
          <p>
            Start with a real plot, editable climate defaults, and a template
            you can change later.
          </p>
        </header>

        <div className={styles.grid}>
          <section className={styles.panel} aria-label="Garden basics">
            <h2>Basics</h2>
            <label className={styles.field}>
              <span>Garden name</span>
              <input
                onChange={(event) => setGardenName(event.currentTarget.value)}
                value={gardenName}
              />
            </label>
            <label className={styles.field}>
              <span>Location or address</span>
              <input
                onChange={(event) =>
                  setLocationQuery(event.currentTarget.value)
                }
                value={locationQuery}
              />
            </label>
            <div className={styles.actionRow}>
              <button
                disabled={!geocodingApiKey || geocodeStatus === 'loading'}
                onClick={() => void handleGeocode()}
                type="button"
              >
                {geocodeStatus === 'loading' ? 'Geocoding...' : 'Geocode'}
              </button>
              <button onClick={() => applyClimateEstimate()} type="button">
                Estimate climate
              </button>
            </div>
            {!geocodingApiKey ? (
              <p className={styles.helpText}>
                Geocoding needs VITE_GOOGLE_MAPS_API_KEY. Manual latitude and
                longitude work offline.
              </p>
            ) : null}
            {geocodeStatus === 'error' ? (
              <p className={styles.error} role="alert">
                Unable to geocode this location. Enter coordinates manually.
              </p>
            ) : null}
            <label className={styles.field}>
              <span>Location label</span>
              <input
                onChange={(event) => setLocationName(event.currentTarget.value)}
                value={locationName}
              />
            </label>
            <label className={styles.field}>
              <span>Timezone</span>
              <input
                onChange={(event) => setTimezone(event.currentTarget.value)}
                value={timezone}
              />
            </label>
            <div className={styles.twoColumn}>
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
          </section>

          <section className={styles.panel} aria-label="Climate profile">
            <h2>Climate profile</h2>
            <p className={styles.helpText}>
              USDA zone and frost dates are editable. Use your microclimate or
              local extension dates if they differ.
            </p>
            <label className={styles.field}>
              <span>USDA hardiness zone</span>
              <input
                onChange={(event) =>
                  setHardinessZone(event.currentTarget.value)
                }
                value={hardinessZone}
              />
            </label>
            <div className={styles.twoColumn}>
              <label className={styles.field}>
                <span>Average last frost</span>
                <input
                  onChange={(event) =>
                    setAverageLastFrost(event.currentTarget.value)
                  }
                  placeholder="MM-DD"
                  value={averageLastFrost}
                />
              </label>
              <label className={styles.field}>
                <span>Average first frost</span>
                <input
                  onChange={(event) =>
                    setAverageFirstFrost(event.currentTarget.value)
                  }
                  placeholder="MM-DD"
                  value={averageFirstFrost}
                />
              </label>
            </div>
            <p className={styles.estimate}>
              {climateEstimate
                ? `Using ${climateEstimate.locationName}: zone ${climateEstimate.hardinessZone}.`
                : 'No local preset found; keep the editable defaults or enter your own.'}
            </p>
          </section>
        </div>

        <section className={styles.panel} aria-label="Plot setup">
          <h2>Plot and template</h2>
          <div className={styles.plotGrid}>
            <label className={styles.field}>
              <span>Plot type</span>
              <select
                onChange={(event) =>
                  setPlotType(event.currentTarget.value as GardenSetupPlotType)
                }
                value={plotType}
              >
                <option value="raisedBed">Raised bed</option>
                <option value="inGround">In-ground</option>
                <option value="containers">Containers</option>
                <option value="mixed">Mixed garden</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>Width in feet</span>
              <input
                max={maxPlotFeet}
                min={minPlotFeet}
                onChange={(event) => setPlotWidthFt(event.currentTarget.value)}
                type="number"
                value={plotWidthFt}
              />
            </label>
            <label className={styles.field}>
              <span>Depth in feet</span>
              <input
                max={maxPlotFeet}
                min={minPlotFeet}
                onChange={(event) => setPlotDepthFt(event.currentTarget.value)}
                type="number"
                value={plotDepthFt}
              />
            </label>
          </div>

          <div className={styles.templates}>
            <FirstRunTemplateOption
              checked={templateId === blankTemplateId}
              description="Start with the plot and climate profile only."
              name="Blank plan"
              onChange={() => setTemplateId(blankTemplateId)}
              summary="Empty plot"
              value={blankTemplateId}
            />
            {gardenTemplates.map((template) => (
              <FirstRunTemplateOption
                checked={templateId === template.id}
                description={template.description}
                key={template.id}
                name={template.name}
                onChange={() => handleTemplateChange(template.id)}
                summary={template.summary}
                value={template.id}
              />
            ))}
          </div>
        </section>

        <div className={styles.footer}>
          <p>Detroit, MI remains the default demo profile.</p>
          <button type="submit">Create plan</button>
        </div>
      </form>
    </section>
  );
}

function coordinateToString(value: number | null) {
  return value === null ? '' : String(value);
}

function readCoordinate(value: string) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}
