import { useEffect, useMemo, useState, type FormEvent } from 'react';

import type { PlantCatalogEntry } from '../../../domain/crops/plantCatalogTypes';
import type { GardenPlan, PlantingArrangement } from '../../domain';
import { Button, Modal, TextField } from '../../ui';
import { createPlantingGroup, type CropChoice } from './planModel';
import styles from './PlanDialogs.module.css';

export function AddCropDialog({
  isOpen,
  onAdd,
  onClose,
  plan,
}: {
  isOpen: boolean;
  onAdd(group: ReturnType<typeof createPlantingGroup>): void;
  onClose(): void;
  plan: GardenPlan;
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [arrangement, setArrangement] = useState<PlantingArrangement>('single');
  const [structureId, setStructureId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<readonly PlantCatalogEntry[] | null>(
    null,
  );
  const growingAreas = useMemo(
    () =>
      plan.structures.filter((structure) =>
        ['bed', 'container', 'raisedBed'].includes(structure.type),
      ),
    [plan.structures],
  );
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (catalog ?? [])
      .filter(
        (entry) =>
          !needle ||
          entry.commonName.toLowerCase().includes(needle) ||
          entry.scientificName.toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [catalog, query]);

  useEffect(() => {
    if (!isOpen || catalog) return;
    let active = true;
    void loadPlantCatalog()
      .then((entries) => {
        if (active) setCatalog(entries);
      })
      .catch(() => {
        if (active) {
          setError(
            'The crop catalog could not be loaded. Close this dialog and try again.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [catalog, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelectedId(null);
    setQuantity(1);
    setArrangement('single');
    setStructureId(growingAreas[0]?.id ?? '');
    setError(null);
  }, [growingAreas, isOpen]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const selected = selectedId
      ? catalog?.find((entry) => entry.id === selectedId)
      : null;
    if (!selected) {
      setError('Choose a crop before adding it to the plan.');
      return;
    }
    const structure =
      growingAreas.find((item) => item.id === structureId) ?? null;
    const id = createClientId(`crop-${selected.id}`);
    onAdd(
      createPlantingGroup({
        arrangement,
        crop: toCropChoice(selected),
        id,
        quantity,
        structure,
      }),
    );
  }

  return (
    <Modal
      description="Choose one crop deliberately, set the number of plants, and assign its physical growing area."
      footer={
        <>
          <Button onClick={onClose} variant="quiet">
            Cancel
          </Button>
          <Button disabled={!catalog} form="v2-add-crop" type="submit">
            Add crop group
          </Button>
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
      title="Add a crop group"
      variant="drawer"
    >
      <form className={styles.formStack} id="v2-add-crop" onSubmit={submit}>
        <TextField
          label="Search crops"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Tomato, lettuce, basil…"
          type="search"
          value={query}
        />
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <fieldset className={styles.cropResults}>
          <legend>Crop</legend>
          {!catalog && !error ? (
            <p aria-live="polite" role="status">
              Loading crop catalog…
            </p>
          ) : null}
          {results.map((entry) => (
            <label className={styles.cropChoice} key={entry.id}>
              <input
                checked={selectedId === entry.id}
                name="crop-choice"
                onChange={() => {
                  setSelectedId(entry.id);
                  setError(null);
                }}
                type="radio"
                value={entry.id}
              />
              <span>
                <strong>{entry.commonName}</strong>
                <small>
                  {entry.defaultSpacingInches} in spacing · {formatSun(entry)} ·{' '}
                  {entry.crop.weeklyWaterNeedInches ?? 1} in/week
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className={styles.formGrid}>
          <TextField
            label="Number of plants"
            max={500}
            min={1}
            onChange={(event) =>
              setQuantity(event.currentTarget.valueAsNumber || 1)
            }
            type="number"
            value={quantity}
          />
          <label className={styles.selectField}>
            <span>Arrangement</span>
            <select
              onChange={(event) =>
                setArrangement(event.currentTarget.value as PlantingArrangement)
              }
              value={arrangement}
            >
              <option value="single">Single / spaced</option>
              <option value="row">Row</option>
              <option value="block">Block</option>
              <option value="cluster">Cluster</option>
              <option value="trellisLine">Trellis line</option>
            </select>
          </label>
          <label className={styles.selectField}>
            <span>Growing area</span>
            <select
              onChange={(event) => setStructureId(event.currentTarget.value)}
              value={structureId}
            >
              <option value="">Unassigned</option>
              {growingAreas.map((structure) => (
                <option key={structure.id} value={structure.id}>
                  {structure.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>
    </Modal>
  );
}

let plantCatalogPromise: Promise<readonly PlantCatalogEntry[]> | null = null;

function loadPlantCatalog() {
  plantCatalogPromise ??= import('../../../domain/crops/plantCatalog').then(
    (module) => module.plantCatalog,
  );
  return plantCatalogPromise.catch((error: unknown) => {
    plantCatalogPromise = null;
    throw error;
  });
}

function toCropChoice(entry: PlantCatalogEntry): CropChoice {
  return {
    cropId: entry.id,
    cropName: entry.commonName,
    rootDepthInches: entry.crop.rootDepthInches ?? 12,
    spacingInches: entry.defaultSpacingInches,
    sun: normalizeSun(entry.sunPreference),
    waterConfidence:
      entry.crop.rootDepthInches && entry.crop.weeklyWaterNeedInches
        ? 'medium'
        : 'low',
    weeklyWaterInches: entry.crop.weeklyWaterNeedInches ?? 1,
  };
}

function formatSun(entry: PlantCatalogEntry) {
  const sun = normalizeSun(entry.sunPreference);
  return sun === 'fullSun'
    ? 'Full sun'
    : sun === 'partShade'
      ? 'Part shade'
      : 'Shade';
}

function normalizeSun(value: string): CropChoice['sun'] {
  if (value === 'fullShade' || value === 'shade') return 'shade';
  if (value === 'partShade' || value === 'partSun') return 'partShade';
  return 'fullSun';
}

function createClientId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}
