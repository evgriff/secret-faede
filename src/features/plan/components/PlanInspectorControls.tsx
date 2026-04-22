import type {
  GardenPlant,
  PlantingLifecycleStatus,
  Structure,
} from '../../../domain/gardens/GardenRepository';
import { describePlantingMobility } from '../../garden/gardenImmutability';
import {
  getPlanWarningDecisionCategory,
  getPlanWarningDecisionCategoryMeta,
  type PlanWarning,
} from '../../garden/gardenPlanning';
import { readOptionalNumber } from './planFormatters';
import styles from './PlanInspector.module.css';

export const plantingLifecycleStates: PlantingLifecycleStatus[] = [
  'planned',
  'planted',
  'growing',
  'harvest-ready',
  'harvested',
  'removed',
];

export function InspectorHeader({
  item,
  selectedType,
}: {
  item: GardenPlant | Structure | null;
  selectedType: 'Planting' | 'Structure';
}) {
  return (
    <div>
      <span className={styles.kicker}>{selectedType}</span>
      <h2>{item?.label ?? 'No selection'}</h2>
      <p>{describeItemMobility(item)}</p>
    </div>
  );
}

export function ItemActions({
  isLocked,
  onDelete,
  onDuplicate,
  onToggleLock,
}: {
  isLocked: boolean;
  onDelete(): void;
  onDuplicate(): void;
  onToggleLock(): void;
}) {
  return (
    <div className={styles.itemActions}>
      <button onClick={onDuplicate} type="button">
        Duplicate
      </button>
      <button onClick={onToggleLock} type="button">
        {isLocked ? 'Unlock' : 'Lock'}
      </button>
      <button className={styles.dangerButton} onClick={onDelete} type="button">
        Delete
      </button>
    </div>
  );
}

export function InspectorGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className={styles.grid}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WarningList({ warnings }: { warnings: PlanWarning[] }) {
  if (warnings.length === 0) {
    return <p className={styles.saved}>No warnings for this item.</p>;
  }

  return (
    <ul className={styles.warningList}>
      {groupWarnings(warnings).map((group) => (
        <li key={group.category}>
          <strong>{group.label}</strong>
          <span>{group.messages.join(' ')}</span>
        </li>
      ))}
    </ul>
  );
}

export function TextField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange(value: string): void;
  value: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        onChange={(event) => onChange(event.currentTarget.value)}
        value={value}
      />
    </label>
  );
}

export function TextArea({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange(value: string): void;
  value: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <textarea
        onChange={(event) => onChange(event.currentTarget.value)}
        rows={3}
        value={value}
      />
    </label>
  );
}

export function StructureNumberField({
  label,
  nullable = false,
  onChange,
  value,
}: {
  label: string;
  nullable?: boolean;
  onChange(value: number | null): void;
  value: number | null;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        inputMode="decimal"
        min="0"
        onChange={(event) =>
          onChange(
            nullable
              ? readOptionalNumber(event.currentTarget.value)
              : Number(event.currentTarget.value),
          )
        }
        step="0.125"
        type="number"
        value={value ?? ''}
      />
    </label>
  );
}

export function formatLifecycle(status: PlantingLifecycleStatus) {
  const labels: Record<PlantingLifecycleStatus, string> = {
    growing: 'Growing',
    'harvest-ready': 'Harvest-ready',
    harvested: 'Harvested',
    planned: 'Planned',
    planted: 'Planted',
    removed: 'Removed',
  };

  return labels[status];
}

function describeItemMobility(item: GardenPlant | Structure | null) {
  if (!item) {
    return 'No selection';
  }

  if ('status' in item) {
    return describePlantingMobility(item);
  }

  return item.locked ? 'Installed and locked' : 'Unlocked structure';
}

function groupWarnings(warnings: PlanWarning[]) {
  const groups = new Map<
    ReturnType<typeof getPlanWarningDecisionCategory>,
    string[]
  >();

  for (const warning of warnings) {
    const category = getPlanWarningDecisionCategory(warning);
    groups.set(category, [...(groups.get(category) ?? []), warning.message]);
  }

  return [...groups.entries()].map(([category, messages]) => {
    const meta = getPlanWarningDecisionCategoryMeta(category);

    return {
      category,
      label: meta.label,
      messages: messages.slice(0, 2),
    };
  });
}
