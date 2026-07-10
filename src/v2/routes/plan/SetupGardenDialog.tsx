import { useState, type FormEvent } from 'react';

import type {
  ClimateDefaults,
  GardenCoordinates,
  GardenLocation,
} from '../../domain';
import { Button, Modal, TextField } from '../../ui';
import styles from './PlanDialogs.module.css';

export interface GardenSetupInput {
  climate: ClimateDefaults;
  depthFt: number;
  location: GardenLocation & { coordinates: GardenCoordinates };
  name: string;
  template: 'blank' | 'containers' | 'raisedBed';
  widthFt: number;
}

export function SetupGardenDialog({
  isOpen,
  onCreate,
}: {
  isOpen: boolean;
  onCreate(input: GardenSetupInput): void;
}) {
  const [name, setName] = useState('Home garden');
  const [widthFt, setWidthFt] = useState(12);
  const [depthFt, setDepthFt] = useState(8);
  const [template, setTemplate] =
    useState<GardenSetupInput['template']>('raisedBed');
  const [locationLabel, setLocationLabel] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [timezone, setTimezone] = useState(resolveDeviceTimezone);
  const [hardinessZone, setHardinessZone] = useState('');
  const [lastFrost, setLastFrost] = useState('');
  const [firstFrost, setFirstFrost] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const coordinates = parseRequiredCoordinates(latitude, longitude);
    const validationError = validateEnvironment({
      depthFt,
      firstFrost,
      hardinessZone,
      lastFrost,
      locationLabel,
      locationQuery,
      name,
      timezone,
      widthFt,
    });
    if (coordinates instanceof Error || validationError) {
      setError(
        coordinates instanceof Error ? coordinates.message : validationError,
      );
      return;
    }
    setError(null);
    onCreate({
      climate: {
        firstFrost: firstFrost as `${number}-${number}`,
        hardinessZone: hardinessZone.trim().toLowerCase(),
        lastFrost: lastFrost as `${number}-${number}`,
      },
      depthFt,
      location: {
        coordinates,
        label: locationLabel.trim(),
        query: locationQuery.trim(),
        timezone: timezone.trim(),
      },
      name: name.trim(),
      template,
      widthFt,
    });
  }

  return (
    <Modal
      description="Confirm the physical plot and operational location before weather, watering, frost, or task schedules can run. Nothing below is inferred from a generic garden default."
      dismissOnBackdrop={false}
      footer={
        <Button form="v2-setup-garden" type="submit">
          Create garden plan
        </Button>
      }
      isOpen={isOpen}
      onClose={() => undefined}
      title="Set up your garden"
      variant="drawer"
    >
      <form
        className={styles.formStack}
        id="v2-setup-garden"
        noValidate
        onSubmit={submit}
      >
        <TextField
          label="Garden name"
          onChange={(event) => setName(event.currentTarget.value)}
          required
          value={name}
        />
        <div className={styles.formGrid}>
          <TextField
            label="Width in feet"
            max={500}
            min={1}
            onChange={(event) =>
              setWidthFt(event.currentTarget.valueAsNumber || 1)
            }
            required
            type="number"
            value={widthFt}
          />
          <TextField
            label="Depth in feet"
            max={500}
            min={1}
            onChange={(event) =>
              setDepthFt(event.currentTarget.valueAsNumber || 1)
            }
            required
            type="number"
            value={depthFt}
          />
        </div>
        <fieldset className={styles.templateChoices}>
          <legend>Starting structure</legend>
          {[
            ['raisedBed', 'Raised bed', 'A centered 4 × 8 ft growing bed.'],
            [
              'containers',
              'Containers',
              'Three movable container growing areas.',
            ],
            ['blank', 'Blank plot', 'Start with only the measured plot.'],
          ].map(([value, label, detail]) => (
            <label key={value}>
              <input
                checked={template === value}
                name="garden-template"
                onChange={() =>
                  setTemplate(value as GardenSetupInput['template'])
                }
                type="radio"
              />
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.formStack}>
          <legend>Operational weather location</legend>
          <p>
            Coordinates drive provider requests. The description is saved for
            people and is not silently geocoded.
          </p>
          <div className={styles.formGrid}>
            <TextField
              label="Location label"
              onChange={(event) => setLocationLabel(event.currentTarget.value)}
              placeholder="Back garden"
              required
              value={locationLabel}
            />
            <TextField
              hint="City or postal-code description for people and provider diagnostics."
              label="Weather location description"
              onChange={(event) => setLocationQuery(event.currentTarget.value)}
              placeholder="Detroit, MI"
              required
              value={locationQuery}
            />
            <TextField
              label="Latitude"
              max={90}
              min={-90}
              onChange={(event) => setLatitude(event.currentTarget.value)}
              placeholder="42.3314"
              required
              step="any"
              type="number"
              value={latitude}
            />
            <TextField
              label="Longitude"
              max={180}
              min={-180}
              onChange={(event) => setLongitude(event.currentTarget.value)}
              placeholder="-83.0458"
              required
              step="any"
              type="number"
              value={longitude}
            />
            <TextField
              hint="An IANA name. A detected device value is prefilled; confirm it matches the garden."
              label="Garden timezone"
              onChange={(event) => setTimezone(event.currentTarget.value)}
              required
              value={timezone}
            />
          </div>
        </fieldset>
        <fieldset className={styles.formStack}>
          <legend>Planning climate assumptions</legend>
          <p>
            Enter local planning references. They are editable assumptions, not
            observed guarantees.
          </p>
          <div className={styles.formGrid}>
            <TextField
              hint="USDA zone, for example 6b."
              label="Hardiness zone"
              onChange={(event) => setHardinessZone(event.currentTarget.value)}
              placeholder="6b"
              required
              value={hardinessZone}
            />
            <TextField
              hint="MM-DD"
              label="Typical last frost"
              onChange={(event) => setLastFrost(event.currentTarget.value)}
              placeholder="05-05"
              required
              value={lastFrost}
            />
            <TextField
              hint="MM-DD"
              label="Typical first frost"
              onChange={(event) => setFirstFrost(event.currentTarget.value)}
              placeholder="10-20"
              required
              value={firstFrost}
            />
          </div>
        </fieldset>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

function parseRequiredCoordinates(latitudeText: string, longitudeText: string) {
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (!latitudeText.trim() || !longitudeText.trim()) {
    return new Error(
      'Enter both coordinates before enabling garden operations.',
    );
  }
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return new Error('Latitude must be -90 to 90 and longitude -180 to 180.');
  }
  return { latitude, longitude };
}

function validateEnvironment(input: {
  depthFt: number;
  firstFrost: string;
  hardinessZone: string;
  lastFrost: string;
  locationLabel: string;
  locationQuery: string;
  name: string;
  timezone: string;
  widthFt: number;
}) {
  if (!input.name.trim()) return 'Enter a garden name.';
  if (
    !Number.isFinite(input.widthFt) ||
    !Number.isFinite(input.depthFt) ||
    input.widthFt < 1 ||
    input.widthFt > 500 ||
    input.depthFt < 1 ||
    input.depthFt > 500
  ) {
    return 'Plot width and depth must each be from 1 through 500 feet.';
  }
  if (!input.locationLabel.trim() || !input.locationQuery.trim()) {
    return 'Enter both a location label and weather location description.';
  }
  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: input.timezone.trim(),
    }).format(new Date(0));
  } catch {
    return 'Enter a valid IANA garden timezone such as America/Detroit.';
  }
  if (!/^(?:[1-9]|1[0-3])[ab]$/i.test(input.hardinessZone.trim())) {
    return 'Enter a USDA hardiness zone from 1a through 13b.';
  }
  if (!isMonthDay(input.lastFrost) || !isMonthDay(input.firstFrost)) {
    return 'Enter real typical frost dates in MM-DD form.';
  }
  return null;
}

function isMonthDay(value: string) {
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function resolveDeviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
}
