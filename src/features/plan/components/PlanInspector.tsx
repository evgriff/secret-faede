import { useState } from 'react';

import type {
  Garden,
  GardenPlant,
  Structure,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type { SelectedGardenItem } from '../../garden/useGarden';
import { InspectorHeader } from './PlanInspectorControls';
import {
  PlantingPanel,
  StructurePanel,
  type InspectorTab,
} from './PlanInspectorPanels';
import { NoSelectionInspector } from './PlanInspectorSecondaryPanels';
import styles from './PlanInspector.module.css';

const tabs: Array<{ id: InspectorTab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'care', label: 'Care' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'alerts', label: 'Warnings' },
  { id: 'history', label: 'History' },
];

export function PlanInspector({
  garden,
  onDeleteSelected,
  onDuplicatePlanting,
  onDuplicateStructure,
  onResizeStructure,
  onUpdatePlanting,
  onUpdateStructure,
  onUpdateStructureShade,
  selectedItem,
  sunLayer,
  sunSeason,
  warnings,
}: {
  garden: Garden;
  onDeleteSelected(): void;
  onDuplicatePlanting(id: string): void;
  onDuplicateStructure(id: string): void;
  onResizeStructure(id: string, widthFt: number, depthFt: number): void;
  onUpdatePlanting(id: string, values: Partial<GardenPlant>): void;
  onUpdateStructure(id: string, values: Partial<Structure>): void;
  onUpdateStructureShade(
    id: string,
    values: { canopyRadiusFt?: number | null; heightFt?: number | null },
  ): void;
  selectedItem: SelectedGardenItem | null;
  sunLayer: SunShadeLayer;
  sunSeason: SunSeason;
  warnings: PlanWarning[];
}) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('details');
  const selectedPlant =
    selectedItem?.type === 'planting'
      ? (garden.plantings.find((plant) => plant.id === selectedItem.id) ?? null)
      : null;
  const selectedStructure =
    selectedItem?.type === 'structure'
      ? (garden.structures.find(
          (structure) => structure.id === selectedItem.id,
        ) ?? null)
      : null;

  if (!selectedPlant && !selectedStructure) {
    return <NoSelectionInspector garden={garden} warnings={warnings} />;
  }

  const itemWarnings = warnings.filter((warning) =>
    warning.itemIds.includes(selectedItem?.id ?? ''),
  );

  return (
    <aside className={styles.inspector} aria-label="Selected item inspector">
      <InspectorHeader
        item={selectedPlant ?? selectedStructure}
        selectedType={selectedPlant ? 'Planting' : 'Structure'}
      />
      <div
        className={styles.tabList}
        role="tablist"
        aria-label="Inspector sections"
      >
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? styles.activeTab : ''}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {selectedPlant ? (
        <PlantingPanel
          activeTab={activeTab}
          garden={garden}
          onDeleteSelected={onDeleteSelected}
          onDuplicatePlanting={onDuplicatePlanting}
          onUpdatePlanting={onUpdatePlanting}
          plant={selectedPlant}
          sunLayer={sunLayer}
          sunSeason={sunSeason}
          warnings={itemWarnings}
        />
      ) : selectedStructure ? (
        <StructurePanel
          activeTab={activeTab}
          garden={garden}
          onDeleteSelected={onDeleteSelected}
          onDuplicateStructure={onDuplicateStructure}
          onResizeStructure={onResizeStructure}
          onUpdateStructure={onUpdateStructure}
          onUpdateStructureShade={onUpdateStructureShade}
          structure={selectedStructure}
          warnings={itemWarnings}
        />
      ) : null}
    </aside>
  );
}
