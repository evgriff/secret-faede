import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  Garden,
  GardenPlant,
  PlantingLifecycleStatus,
  Structure,
  StructureMaterial,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import { formatFeet } from '../../garden/gardenMath';
import {
  describePlantingOptimizerMobility,
  isRealWorldPlantingStatus,
} from '../../garden/gardenImmutability';
import type { PlanWarning } from '../../garden/gardenPlanning';
import {
  describeFootprint,
  getPlantingFootprint,
  getStructureFootprint,
} from '../../garden/gardenPlanning';
import { getSunAreaAtPoint, type SunSeason } from '../../garden/sunShadeEngine';
import {
  describeCropSunFit,
  describeShadeSourceSummary,
} from '../../garden/sunShadeFit';
import {
  formatMode,
  formatNullableInches,
  formatSeason,
  formatStructureType,
  formatSun,
} from './planFormatters';
import {
  formatLifecycle,
  InspectorGrid,
  ItemActions,
  plantingLifecycleStates,
  StructureNumberField,
  TextArea,
  TextField,
} from './PlanInspectorControls';
import { SharedInspectorTab } from './PlanInspectorSecondaryPanels';
import styles from './PlanInspector.module.css';

export type InspectorTab =
  | 'alerts'
  | 'care'
  | 'details'
  | 'history'
  | 'schedule';

export function PlantingPanel({
  activeTab,
  garden,
  onDeleteSelected,
  onDuplicatePlanting,
  onUpdatePlanting,
  plant,
  sunLayer,
  sunSeason,
  warnings,
}: {
  activeTab: InspectorTab;
  garden: Garden;
  onDeleteSelected(): void;
  onDuplicatePlanting(id: string): void;
  onUpdatePlanting(id: string, values: Partial<GardenPlant>): void;
  plant: GardenPlant;
  sunLayer: SunShadeLayer;
  sunSeason: SunSeason;
  warnings: PlanWarning[];
}) {
  if (activeTab === 'details') {
    return (
      <PlantingDetails
        onDeleteSelected={onDeleteSelected}
        onDuplicatePlanting={onDuplicatePlanting}
        onUpdatePlanting={onUpdatePlanting}
        plant={plant}
      />
    );
  }

  if (activeTab === 'care') {
    return (
      <PlantingCare
        onUpdatePlanting={onUpdatePlanting}
        plant={plant}
        sunLayer={sunLayer}
        sunSeason={sunSeason}
      />
    );
  }

  return (
    <SharedInspectorTab
      activeTab={activeTab}
      garden={garden}
      itemId={plant.id}
      itemType="planting"
      warnings={warnings}
    />
  );
}

export function StructurePanel({
  activeTab,
  garden,
  onDeleteSelected,
  onDuplicateStructure,
  onResizeStructure,
  onUpdateStructure,
  onUpdateStructureShade,
  structure,
  warnings,
}: {
  activeTab: InspectorTab;
  garden: Garden;
  onDeleteSelected(): void;
  onDuplicateStructure(id: string): void;
  onResizeStructure(id: string, widthFt: number, depthFt: number): void;
  onUpdateStructure(id: string, values: Partial<Structure>): void;
  onUpdateStructureShade(
    id: string,
    values: { canopyRadiusFt?: number | null; heightFt?: number | null },
  ): void;
  structure: Structure;
  warnings: PlanWarning[];
}) {
  if (activeTab === 'details') {
    return (
      <StructureDetails
        onDeleteSelected={onDeleteSelected}
        onDuplicateStructure={onDuplicateStructure}
        onUpdateStructure={onUpdateStructure}
        structure={structure}
      />
    );
  }

  if (activeTab === 'care') {
    return (
      <StructureCare
        onResizeStructure={onResizeStructure}
        onUpdateStructure={onUpdateStructure}
        onUpdateStructureShade={onUpdateStructureShade}
        structure={structure}
      />
    );
  }

  return (
    <SharedInspectorTab
      activeTab={activeTab}
      garden={garden}
      itemId={structure.id}
      itemType="structure"
      warnings={warnings}
    />
  );
}

function PlantingDetails({
  onDeleteSelected,
  onDuplicatePlanting,
  onUpdatePlanting,
  plant,
}: {
  onDeleteSelected(): void;
  onDuplicatePlanting(id: string): void;
  onUpdatePlanting(id: string, values: Partial<GardenPlant>): void;
  plant: GardenPlant;
}) {
  const crop = getCropById(plant.cropId);
  const footprint = getPlantingFootprint(plant);

  return (
    <section className={styles.section}>
      <TextField
        label="Name"
        onChange={(value) => onUpdatePlanting(plant.id, { label: value })}
        value={plant.label}
      />
      <TextArea
        label="Notes"
        onChange={(value) => onUpdatePlanting(plant.id, { notes: value })}
        value={plant.notes}
      />
      <InspectorGrid
        rows={[
          ['Crop', crop?.commonName ?? 'Custom planting'],
          ['Mode', formatMode(plant.mode)],
          ['Lifecycle', formatLifecycle(plant.status)],
          ['Optimizer', describePlantingOptimizerMobility(plant)],
          [
            'Position',
            `X ${formatFeet(plant.xFt)} ft, Y ${formatFeet(plant.yFt)} ft`,
          ],
          ['Footprint', describeFootprint(footprint)],
        ]}
      />
      <ItemActions
        isLocked={plant.locked}
        onDelete={onDeleteSelected}
        onDuplicate={() => onDuplicatePlanting(plant.id)}
        onToggleLock={() =>
          onUpdatePlanting(plant.id, { locked: !plant.locked })
        }
      />
      <PlantingRelocationControl
        onUpdatePlanting={onUpdatePlanting}
        plant={plant}
      />
    </section>
  );
}

function PlantingRelocationControl({
  onUpdatePlanting,
  plant,
}: {
  onUpdatePlanting(id: string, values: Partial<GardenPlant>): void;
  plant: GardenPlant;
}) {
  if (!isRealWorldPlantingStatus(plant.status)) {
    return null;
  }

  return (
    <div className={styles.relocationNotice}>
      <strong>
        {plant.allowRelocation ? 'Relocation allowed' : 'Real-world anchor'}
      </strong>
      <p>
        {plant.allowRelocation
          ? 'Optimizer and Review may move this crop after explicit approval.'
          : 'Optimizer and Review keep this crop fixed unless relocation is allowed.'}
      </p>
      <button
        disabled={plant.locked}
        onClick={() =>
          onUpdatePlanting(plant.id, {
            allowRelocation: !plant.allowRelocation,
          })
        }
        type="button"
      >
        {plant.allowRelocation ? 'Stop relocation' : 'Allow relocation'}
      </button>
    </div>
  );
}

function PlantingCare({
  onUpdatePlanting,
  plant,
  sunLayer,
  sunSeason,
}: {
  onUpdatePlanting(id: string, values: Partial<GardenPlant>): void;
  plant: GardenPlant;
  sunLayer: SunShadeLayer;
  sunSeason: SunSeason;
}) {
  const sunArea = getSunAreaAtPoint(sunLayer, plant);
  const sunFit = describeCropSunFit(plant.sunRequirement, sunArea);
  const microclimateNotes = sunArea?.microclimateNotes ?? [];
  const shadeSourceSummary = describeShadeSourceSummary(sunArea?.shadeSources);

  return (
    <section className={styles.section}>
      <label className={styles.field}>
        <span>Lifecycle</span>
        <select
          onChange={(event) =>
            onUpdatePlanting(plant.id, {
              status: event.currentTarget.value as PlantingLifecycleStatus,
            })
          }
          value={plant.status}
        >
          {plantingLifecycleStates.map((status) => (
            <option key={status} value={status}>
              {formatLifecycle(status)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.checkbox}>
        <input
          checked={plant.mulched}
          onChange={(event) =>
            onUpdatePlanting(plant.id, { mulched: event.currentTarget.checked })
          }
          type="checkbox"
        />
        Mulched
      </label>
      <InspectorGrid
        rows={[
          ['Spacing', formatNullableInches(plant.spacingInches)],
          ['Water', formatNullableInches(plant.weeklyWaterNeedInches)],
          ['Sun need', formatSun(plant.sunRequirement)],
          ['Height', formatNullableInches(plant.matureHeightInches)],
          [
            `${formatSeason(sunSeason)} sun`,
            sunArea
              ? `${sunArea.sunHours.toFixed(1)} hr, ${formatSun(
                  sunArea.exposure,
                )}`
              : '-',
          ],
          [
            'Sun source',
            sunArea
              ? sunArea.source === 'manual'
                ? 'manual observation'
                : 'modeled estimate'
              : '-',
          ],
          ['Sun fit', sunFit.label],
          ['Shade source', shadeSourceSummary || '-'],
          [
            'Microclimate',
            microclimateNotes.length > 0
              ? microclimateNotes.map((note) => note.label).join(', ')
              : '-',
          ],
        ]}
      />
      <p
        className={
          sunFit.level === 'good'
            ? styles.saved
            : sunFit.level === 'workable'
              ? styles.workableText
              : styles.warningText
        }
      >
        <strong>{sunFit.label}.</strong> {sunFit.message} {sunFit.action}
      </p>
      {microclimateNotes.length > 0 ? (
        <ul className={styles.helpList}>
          {microclimateNotes.map((note) => (
            <li key={note.id}>{note.description}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function StructureDetails({
  onDeleteSelected,
  onDuplicateStructure,
  onUpdateStructure,
  structure,
}: {
  onDeleteSelected(): void;
  onDuplicateStructure(id: string): void;
  onUpdateStructure(id: string, values: Partial<Structure>): void;
  structure: Structure;
}) {
  const footprint = getStructureFootprint(structure);

  return (
    <section className={styles.section}>
      <TextField
        label="Name"
        onChange={(value) => onUpdateStructure(structure.id, { label: value })}
        value={structure.label}
      />
      <TextArea
        label="Notes"
        onChange={(value) => onUpdateStructure(structure.id, { notes: value })}
        value={structure.notes}
      />
      <InspectorGrid
        rows={[
          ['Type', formatStructureType(structure.type)],
          [
            'Optimizer',
            structure.locked
              ? 'Keeps installed structure'
              : 'Structure movable',
          ],
          [
            'Position',
            `X ${formatFeet(structure.xFt)} ft, Y ${formatFeet(
              structure.yFt,
            )} ft`,
          ],
          ['Footprint', describeFootprint(footprint)],
          ['Material', formatMaterial(structure.material)],
          [
            'Working clearance',
            structure.workingClearanceFt === null
              ? '-'
              : `${formatFeet(structure.workingClearanceFt)} ft`,
          ],
          ...(isPathStructure(structure)
            ? ([
                [
                  'Path standard',
                  structure.accessiblePath ? 'Accessible' : 'Standard',
                ],
                ['Continuity', structure.continuousPath ? 'Continuous' : 'Gap'],
              ] satisfies Array<[string, string]>)
            : []),
        ]}
      />
      <ItemActions
        isLocked={structure.locked}
        onDelete={onDeleteSelected}
        onDuplicate={() => onDuplicateStructure(structure.id)}
        onToggleLock={() =>
          onUpdateStructure(structure.id, { locked: !structure.locked })
        }
      />
    </section>
  );
}

function StructureCare({
  onResizeStructure,
  onUpdateStructure,
  onUpdateStructureShade,
  structure,
}: {
  onResizeStructure(id: string, widthFt: number, depthFt: number): void;
  onUpdateStructure(id: string, values: Partial<Structure>): void;
  onUpdateStructureShade(
    id: string,
    values: { canopyRadiusFt?: number | null; heightFt?: number | null },
  ): void;
  structure: Structure;
}) {
  const isPath = isPathStructure(structure);

  return (
    <section className={styles.section}>
      <div className={styles.sizeControls}>
        <StructureNumberField
          label="Width feet"
          onChange={(value) =>
            value === null
              ? undefined
              : onResizeStructure(structure.id, value, structure.depthFt)
          }
          value={structure.widthFt}
        />
        <StructureNumberField
          label="Depth feet"
          onChange={(value) =>
            value === null
              ? undefined
              : onResizeStructure(structure.id, structure.widthFt, value)
          }
          value={structure.depthFt}
        />
        <StructureNumberField
          label="Height feet"
          nullable
          onChange={(value) =>
            onUpdateStructureShade(structure.id, { heightFt: value })
          }
          value={structure.heightFt}
        />
        {structure.type === 'treeObstacle' ? (
          <StructureNumberField
            label="Canopy radius feet"
            nullable
            onChange={(value) =>
              onUpdateStructureShade(structure.id, { canopyRadiusFt: value })
            }
            value={structure.canopyRadiusFt}
          />
        ) : null}
        <StructureNumberField
          label="Working clearance feet"
          nullable
          onChange={(value) =>
            onUpdateStructure(structure.id, { workingClearanceFt: value })
          }
          value={structure.workingClearanceFt}
        />
      </div>
      <label className={styles.field}>
        <span>Material</span>
        <select
          onChange={(event) =>
            onUpdateStructure(structure.id, {
              material: event.currentTarget.value as StructureMaterial,
            })
          }
          value={structure.material}
        >
          {structureMaterials.map((material) => (
            <option key={material} value={material}>
              {formatMaterial(material)}
            </option>
          ))}
        </select>
      </label>
      {isPath ? (
        <>
          <label className={styles.checkbox}>
            <input
              checked={structure.accessiblePath}
              onChange={(event) =>
                onUpdateStructure(structure.id, {
                  accessiblePath: event.currentTarget.checked,
                })
              }
              type="checkbox"
            />
            Accessible path
          </label>
          <label className={styles.checkbox}>
            <input
              checked={structure.continuousPath}
              onChange={(event) =>
                onUpdateStructure(structure.id, {
                  continuousPath: event.currentTarget.checked,
                })
              }
              type="checkbox"
            />
            Continuous route
          </label>
        </>
      ) : null}
      <label className={styles.checkbox}>
        <input
          checked={structure.mulched}
          onChange={(event) =>
            onUpdateStructure(structure.id, {
              mulched: event.currentTarget.checked,
            })
          }
          type="checkbox"
        />
        Mulched
      </label>
    </section>
  );
}

const structureMaterials: StructureMaterial[] = [
  'woodChips',
  'mulch',
  'gravel',
  'pavers',
  'stone',
  'lumber',
  'wire',
  'metal',
  'soil',
  'mixed',
  'none',
];

function isPathStructure(structure: Structure) {
  return structure.type === 'path' || structure.type === 'pathway';
}

function formatMaterial(material: StructureMaterial) {
  return material
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase());
}
