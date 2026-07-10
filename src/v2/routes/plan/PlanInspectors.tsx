import type {
  GardenPlan,
  GardenStructure,
  PlantingGroup,
  PlantingLifecycle,
} from '../../domain';
import { isValidLocalDate, transitionPlantingLifecycle } from '../../domain';
import { Button, CheckboxField, TextField } from '../../ui';
import styles from './PlanInspector.module.css';
import { PlantInstanceFields } from './PlantInstanceFields';
import { PlantingWaterFields } from './PlantingWaterFields';

export function InspectorEmpty({ plan }: { plan: GardenPlan }) {
  return (
    <div className={styles.inspectorEmpty}>
      <p className={styles.eyebrow}>Inspector</p>
      <h2>Select something on the plot</h2>
      <p>
        Crop groups hold their own spacing, lifecycle, and watering profile.
        Structures hold physical soil and drainage details.
      </p>
      <dl className={styles.summaryList}>
        <div>
          <dt>Plot</dt>
          <dd>
            {plan.plot.widthFt} × {plan.plot.depthFt} ft
          </dd>
        </div>
        <div>
          <dt>Snap</dt>
          <dd>{plan.plot.snapFt} ft</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{plan.plot.location.label || 'Not confirmed'}</dd>
        </div>
      </dl>
    </div>
  );
}

export function PlantingInspector({
  group,
  onDelete,
  onDuplicate,
  onUpdate,
  plan,
}: {
  group: PlantingGroup;
  onDelete(): void;
  onDuplicate(): void;
  onUpdate(group: PlantingGroup): void;
  plan: GardenPlan;
}) {
  const growingAreas = plan.structures.filter((item) =>
    ['bed', 'container', 'raisedBed'].includes(item.type),
  );
  const updateNumber = (field: 'xFt' | 'yFt', value: number) => {
    if (Number.isFinite(value)) onUpdate({ ...group, [field]: value });
  };

  return (
    <div className={styles.inspectorContent}>
      <div className={styles.inspectorHeading}>
        <div>
          <p className={styles.eyebrow}>Crop group</p>
          <h2>{group.cropName}</h2>
          <p>{group.instances.length} individual plant positions</p>
        </div>
        {group.locked ? <span className={styles.badge}>Locked</span> : null}
      </div>
      <label className={styles.selectField}>
        <span>Lifecycle</span>
        <select
          onChange={(event) =>
            onUpdate(
              transitionPlantingLifecycle(
                group,
                event.currentTarget.value as PlantingLifecycle,
              ),
            )
          }
          value={group.lifecycle}
        >
          <option value="planned">Planned</option>
          <option value="planted">Planted</option>
          <option value="growing">Growing</option>
          <option value="harvestReady">Harvest ready</option>
          <option value="harvested">Harvested</option>
          <option value="removed">Removed</option>
        </select>
      </label>
      <div className={styles.formGrid}>
        <TextField
          error={dateError(group.plannedFor)}
          hint="Used to schedule sowing and transplant work. Leave blank only when no date is known."
          label="Planned planting date"
          onChange={(event) =>
            updateLocalDate('plannedFor', event.currentTarget.value)
          }
          type="date"
          value={validDateValue(group.plannedFor)}
        />
        <TextField
          error={dateError(group.plantedOn)}
          hint="Record the actual local garden date; watering and succession work use this date."
          label="Actually planted on"
          onChange={(event) =>
            updateLocalDate('plantedOn', event.currentTarget.value)
          }
          type="date"
          value={validDateValue(group.plantedOn)}
        />
      </div>
      <label className={styles.selectField}>
        <span>Growing area</span>
        <select
          onChange={(event) =>
            onUpdate({
              ...group,
              growingAreaStructureId: event.currentTarget.value || null,
            })
          }
          value={group.growingAreaStructureId ?? ''}
        >
          <option value="">Unassigned</option>
          {growingAreas.map((structure) => (
            <option key={structure.id} value={structure.id}>
              {structure.label}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.formGrid}>
        <TextField
          disabled={group.locked}
          label="Center X in feet"
          onChange={(event) =>
            updateNumber('xFt', event.currentTarget.valueAsNumber)
          }
          step={plan.plot.snapFt}
          type="number"
          value={group.xFt}
        />
        <TextField
          disabled={group.locked}
          label="Center Y in feet"
          onChange={(event) =>
            updateNumber('yFt', event.currentTarget.valueAsNumber)
          }
          step={plan.plot.snapFt}
          type="number"
          value={group.yFt}
        />
      </div>
      <PlantInstanceFields group={group} onUpdate={onUpdate} plan={plan} />
      <PlantingWaterFields group={group} onUpdate={onUpdate} />
      <div className={styles.checkRow}>
        <CheckboxField
          checked={group.mulched}
          onChange={(event) =>
            onUpdate({ ...group, mulched: event.currentTarget.checked })
          }
        >
          Mulched
        </CheckboxField>
        <CheckboxField
          checked={group.locked}
          onChange={(event) =>
            onUpdate({ ...group, locked: event.currentTarget.checked })
          }
        >
          Lock position
        </CheckboxField>
      </div>
      <div className={styles.inspectorActions}>
        <Button onClick={onDuplicate} variant="secondary">
          Duplicate
        </Button>
        <Button onClick={onDelete} variant="danger">
          Delete
        </Button>
      </div>
    </div>
  );

  function updateLocalDate(field: 'plantedOn' | 'plannedFor', value: string) {
    if (value === '' || isValidLocalDate(value)) {
      onUpdate({ ...group, [field]: value || null });
    }
  }
}

function validDateValue(value: string | null) {
  return value && isValidLocalDate(value) ? value : '';
}

function dateError(value: string | null) {
  return value !== null && !isValidLocalDate(value)
    ? 'Use a real date in YYYY-MM-DD form.'
    : null;
}

export function StructureInspector({
  onDelete,
  onUpdate,
  plan,
  structure,
}: {
  onDelete(): void;
  onUpdate(structure: GardenStructure): void;
  plan: GardenPlan;
  structure: GardenStructure;
}) {
  const updateNumber = (
    field:
      | 'depthFt'
      | 'rotationDegrees'
      | 'soilDepthInches'
      | 'widthFt'
      | 'xFt'
      | 'yFt',
    value: number,
  ) => {
    if (
      Number.isFinite(value) &&
      (field !== 'rotationDegrees' || (value >= 0 && value < 360))
    ) {
      onUpdate({ ...structure, [field]: value });
    }
  };

  return (
    <div className={styles.inspectorContent}>
      <div className={styles.inspectorHeading}>
        <div>
          <p className={styles.eyebrow}>Structure</p>
          <h2>{structure.label}</h2>
          <p>{formatStructureType(structure.type)}</p>
        </div>
        {structure.locked ? <span className={styles.badge}>Locked</span> : null}
      </div>
      <TextField
        label="Label"
        onChange={(event) =>
          onUpdate({ ...structure, label: event.currentTarget.value })
        }
        value={structure.label}
      />
      <div className={styles.formGrid}>
        {[
          ['xFt', 'X from left (feet)', 0],
          ['yFt', 'Y from top (feet)', 0],
          ['widthFt', 'Width (feet)', 0.25],
          ['depthFt', 'Depth (feet)', 0.25],
        ].map(([field, label, min]) => (
          <TextField
            key={String(field)}
            label={String(label)}
            min={Number(min)}
            onChange={(event) =>
              updateNumber(
                field as 'depthFt' | 'widthFt' | 'xFt' | 'yFt',
                event.currentTarget.valueAsNumber,
              )
            }
            step={plan.plot.snapFt}
            type="number"
            value={structure[field as 'depthFt' | 'widthFt' | 'xFt' | 'yFt']}
          />
        ))}
      </div>
      <TextField
        hint="Clockwise from the top of the plot. The full rotated footprint must remain inside the plot."
        label="Structure rotation in degrees"
        max={359.999}
        min={0}
        onChange={(event) =>
          updateNumber('rotationDegrees', event.currentTarget.valueAsNumber)
        }
        step="any"
        type="number"
        value={structure.rotationDegrees}
      />
      {['bed', 'container', 'raisedBed'].includes(structure.type) ? (
        <GrowingStructureFields
          onUpdate={onUpdate}
          structure={structure}
          updateNumber={updateNumber}
        />
      ) : null}
      <CheckboxField
        checked={structure.locked}
        onChange={(event) =>
          onUpdate({ ...structure, locked: event.currentTarget.checked })
        }
      >
        Lock structure
      </CheckboxField>
      <div className={styles.inspectorActions}>
        <Button onClick={onDelete} variant="danger">
          Delete structure
        </Button>
      </div>
    </div>
  );
}

function GrowingStructureFields({
  onUpdate,
  structure,
  updateNumber,
}: {
  onUpdate(structure: GardenStructure): void;
  structure: GardenStructure;
  updateNumber(field: 'soilDepthInches', value: number): void;
}) {
  return (
    <>
      <div className={styles.formGrid}>
        <label className={styles.selectField}>
          <span>Soil</span>
          <select
            onChange={(event) =>
              onUpdate({
                ...structure,
                soilType: event.currentTarget
                  .value as GardenStructure['soilType'],
              })
            }
            value={structure.soilType}
          >
            <option value="unknown">Not confirmed</option>
            <option value="sandy">Sandy</option>
            <option value="loam">Loam</option>
            <option value="clay">Clay</option>
          </select>
        </label>
        <label className={styles.selectField}>
          <span>Drainage</span>
          <select
            onChange={(event) =>
              onUpdate({
                ...structure,
                drainage: event.currentTarget
                  .value as GardenStructure['drainage'],
              })
            }
            value={structure.drainage}
          >
            <option value="unknown">Not confirmed</option>
            <option value="fast">Fast</option>
            <option value="moderate">Moderate</option>
            <option value="slow">Slow</option>
          </select>
        </label>
      </div>
      <TextField
        label="Soil depth (inches)"
        min={1}
        onChange={(event) =>
          updateNumber('soilDepthInches', event.currentTarget.valueAsNumber)
        }
        placeholder="Not measured"
        type="number"
        value={structure.soilDepthInches ?? ''}
      />
      <CheckboxField
        checked={structure.mulched}
        onChange={(event) =>
          onUpdate({ ...structure, mulched: event.currentTarget.checked })
        }
      >
        Mulched growing area
      </CheckboxField>
    </>
  );
}

function formatStructureType(type: GardenStructure['type']) {
  return {
    bed: 'In-ground bed',
    container: 'Container',
    path: 'Path',
    raisedBed: 'Raised bed',
    trellis: 'Trellis',
  }[type];
}
