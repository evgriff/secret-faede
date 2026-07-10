import { useEffect, useState, type FormEvent } from 'react';

import type { GardenPlan, GardenStructure } from '../../domain';
import { Button, Modal, TextField } from '../../ui';
import styles from './PlanDialogs.module.css';

export function PlotSettingsDialog({
  isOpen,
  onClose,
  onSave,
  plan,
}: {
  isOpen: boolean;
  onClose(): void;
  onSave(next: GardenPlan): void;
  plan: GardenPlan;
}) {
  const [draft, setDraft] = useState(() => structuredClone(plan));
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    setDraft(structuredClone(plan));
    setLatitude(plan.plot.location.coordinates?.latitude.toString() ?? '');
    setLongitude(plan.plot.location.coordinates?.longitude.toString() ?? '');
    setError(null);
  }, [isOpen, plan]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const coordinates = parseCoordinates(latitude, longitude);
    if (coordinates instanceof Error) {
      setError(coordinates.message);
      return;
    }
    try {
      new Intl.DateTimeFormat('en-US', {
        timeZone: draft.plot.location.timezone,
      }).format(new Date(0));
    } catch {
      setError('Enter a valid IANA timezone such as America/Detroit.');
      return;
    }
    onSave({
      ...draft,
      plot: {
        ...draft.plot,
        location: { ...draft.plot.location, coordinates },
      },
    });
  }

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} variant="quiet">
            Cancel
          </Button>
          <Button form="v2-plot-settings" type="submit">
            Save plot settings
          </Button>
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
      title="Plot settings"
    >
      <form
        className={styles.formStack}
        id="v2-plot-settings"
        onSubmit={submit}
      >
        <TextField
          label="Garden name"
          onChange={(event) =>
            setDraft({ ...draft, name: event.currentTarget.value })
          }
          required
          value={draft.name}
        />
        <div className={styles.formGrid}>
          <TextField
            label="Width in feet"
            min={1}
            onChange={(event) =>
              setDraft({
                ...draft,
                plot: {
                  ...draft.plot,
                  widthFt: event.currentTarget.valueAsNumber,
                },
              })
            }
            type="number"
            value={draft.plot.widthFt}
          />
          <TextField
            label="Depth in feet"
            min={1}
            onChange={(event) =>
              setDraft({
                ...draft,
                plot: {
                  ...draft.plot,
                  depthFt: event.currentTarget.valueAsNumber,
                },
              })
            }
            type="number"
            value={draft.plot.depthFt}
          />
          <TextField
            label="North orientation degrees"
            max={359.999}
            min={0}
            onChange={(event) =>
              setDraft({
                ...draft,
                plot: {
                  ...draft.plot,
                  northDegrees: event.currentTarget.valueAsNumber,
                },
              })
            }
            type="number"
            value={draft.plot.northDegrees}
          />
          <TextField
            label="Timezone"
            onChange={(event) =>
              setDraft({
                ...draft,
                plot: {
                  ...draft.plot,
                  location: {
                    ...draft.plot.location,
                    timezone: event.currentTarget.value,
                  },
                },
              })
            }
            value={draft.plot.location.timezone}
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
        </div>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}

export function AddStructureDialog({
  isOpen,
  onAdd,
  onClose,
  plan,
}: {
  isOpen: boolean;
  onAdd(structure: GardenStructure): void;
  onClose(): void;
  plan: GardenPlan;
}) {
  const [label, setLabel] = useState('Raised bed');
  const [type, setType] = useState<GardenStructure['type']>('raisedBed');
  const [widthFt, setWidthFt] = useState(4);
  const [depthFt, setDepthFt] = useState(8);
  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} variant="quiet">
            Cancel
          </Button>
          <Button form="v2-add-structure" type="submit">
            Add structure
          </Button>
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
      title="Add a structure"
    >
      <form
        className={styles.formStack}
        id="v2-add-structure"
        onSubmit={(event) => {
          event.preventDefault();
          onAdd({
            depthFt: Math.min(depthFt, plan.plot.depthFt),
            drainage: 'unknown',
            id: createClientId('structure'),
            irrigationZoneId: null,
            label: label.trim(),
            locked: false,
            mulched: false,
            notes: '',
            rotationDegrees: 0,
            soilDepthInches: null,
            soilType: 'unknown',
            type,
            widthFt: Math.min(widthFt, plan.plot.widthFt),
            xFt: 0,
            yFt: 0,
          });
        }}
      >
        <TextField
          label="Label"
          onChange={(event) => setLabel(event.currentTarget.value)}
          required
          value={label}
        />
        <label className={styles.selectField}>
          <span>Type</span>
          <select
            onChange={(event) =>
              setType(event.currentTarget.value as GardenStructure['type'])
            }
            value={type}
          >
            <option value="raisedBed">Raised bed</option>
            <option value="bed">In-ground bed</option>
            <option value="container">Container</option>
            <option value="path">Path</option>
            <option value="trellis">Trellis</option>
          </select>
        </label>
        <div className={styles.formGrid}>
          <TextField
            label="Width in feet"
            min={0.25}
            onChange={(event) => setWidthFt(event.currentTarget.valueAsNumber)}
            type="number"
            value={widthFt}
          />
          <TextField
            label="Depth in feet"
            min={0.25}
            onChange={(event) => setDepthFt(event.currentTarget.valueAsNumber)}
            type="number"
            value={depthFt}
          />
        </div>
      </form>
    </Modal>
  );
}

function parseCoordinates(latitudeText: string, longitudeText: string) {
  const latitude = latitudeText.trim();
  const longitude = longitudeText.trim();
  if (!latitude || !longitude) {
    return new Error(
      'Enter both coordinates because weather and watering use this physical point.',
    );
  }
  const parsed = { latitude: Number(latitude), longitude: Number(longitude) };
  if (
    !Number.isFinite(parsed.latitude) ||
    !Number.isFinite(parsed.longitude) ||
    parsed.latitude < -90 ||
    parsed.latitude > 90 ||
    parsed.longitude < -180 ||
    parsed.longitude > 180
  ) {
    return new Error('Latitude must be -90 to 90 and longitude -180 to 180.');
  }
  return parsed;
}

function createClientId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
