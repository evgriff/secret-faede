import type { Garden } from '../../../domain/gardens/GardenRepository';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { InspectorTab } from './PlanInspectorPanels';
import { WarningList } from './PlanInspectorControls';
import styles from './PlanInspector.module.css';

export function NoSelectionInspector({
  garden,
  warnings,
}: {
  garden: Garden;
  warnings: PlanWarning[];
}) {
  return (
    <aside
      className={`${styles.inspector} ${styles.emptyInspector}`}
      aria-label="Selected item inspector"
    >
      <div>
        <span className={styles.kicker}>Inspector</span>
        <h2>No selection</h2>
        <p>
          Select an item, or use Plant and Structure modes to build the plot.
        </p>
      </div>
      <div className={styles.helpList}>
        <p>
          {garden.plantings.length === 0
            ? 'Start with a crop planting.'
            : 'Drag selected plantings by their center.'}
        </p>
        <p>
          {garden.structures.length === 0
            ? 'Add beds or paths to anchor the plan.'
            : 'Resize beds from the corner handle.'}
        </p>
      </div>
      <WarningList warnings={warnings.slice(0, 4)} />
    </aside>
  );
}

export function SharedInspectorTab({
  activeTab,
  garden,
  itemId,
  itemType,
  warnings,
}: {
  activeTab: InspectorTab;
  garden: Garden;
  itemId: string;
  itemType: 'planting' | 'structure';
  warnings: PlanWarning[];
}) {
  if (activeTab === 'alerts') {
    return <WarningList warnings={warnings} />;
  }

  if (activeTab === 'history') {
    const entries = garden.journalEntries.filter((entry) =>
      itemType === 'planting'
        ? entry.plantingId === itemId
        : entry.structureId === itemId,
    );
    const harvests =
      itemType === 'planting'
        ? garden.harvestEvents.filter(
            (harvest) => harvest.plantingId === itemId,
          )
        : [];

    return (
      <section className={styles.section}>
        <p>{entries.length} log entries linked to this item.</p>
        <p>{harvests.length} harvest records linked to this planting.</p>
      </section>
    );
  }

  const tasks = garden.tasks.filter((task) =>
    itemType === 'planting'
      ? task.plantingId === itemId
      : task.structureId === itemId,
  );

  return (
    <section className={styles.section}>
      <p>{tasks.filter((task) => task.status === 'open').length} open tasks.</p>
      <p>
        {tasks.filter((task) => task.status === 'done').length} completed tasks.
      </p>
    </section>
  );
}
