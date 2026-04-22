import { memo, type PointerEvent } from 'react';

import type { Structure } from '../../../domain/gardens/GardenRepository';
import { formatFeet } from '../../garden/gardenMath';
import {
  getStructureFootprint,
  hasWarningForItem,
  type PlanWarning,
} from '../../garden/gardenPlanning';
import type { SelectedGardenItem } from '../../garden/useGarden';
import type { ResizeHandle } from '../planInteractionGeometry';
import { footprintStyle } from './planCanvasGeometry';
import styles from './PlanCanvasItems.module.css';

export const PlanStructureBox = memo(function PlanStructureBox({
  draggingStructureId,
  onResizePointerDown,
  onResizePointerEnd,
  onResizePointerMove,
  onSelectItem,
  onStructurePointerDown,
  onStructurePointerEnd,
  onStructurePointerMove,
  planWarnings,
  resizingStructureId,
  selectedStructureIds,
  structure,
}: {
  draggingStructureId: string | null;
  onResizePointerDown(
    event: PointerEvent<HTMLSpanElement>,
    structureId: string,
    handle: ResizeHandle,
  ): void;
  onResizePointerEnd(event: PointerEvent<HTMLSpanElement>): void;
  onResizePointerMove(event: PointerEvent<HTMLSpanElement>): void;
  onSelectItem(item: SelectedGardenItem, additive: boolean): void;
  onStructurePointerDown(
    event: PointerEvent<HTMLDivElement>,
    structureId: string,
  ): void;
  onStructurePointerEnd(
    event: PointerEvent<HTMLDivElement>,
    structureId: string,
  ): void;
  onStructurePointerMove(
    event: PointerEvent<HTMLDivElement>,
    structureId: string,
  ): void;
  planWarnings: PlanWarning[];
  resizingStructureId: string | null;
  selectedStructureIds: string[];
  structure: Structure;
}) {
  const footprint = getStructureFootprint(structure);
  const isSelected = selectedStructureIds.includes(structure.id);
  const isDragging = structure.id === draggingStructureId;
  const hasWarning = hasWarningForItem(planWarnings, structure.id);
  const showLabel = shouldShowStructureLabel(structure);

  return (
    <div
      aria-label={`${structure.label} at X: ${formatFeet(
        structure.xFt,
      )} ft, Y: ${formatFeet(structure.yFt)} ft`}
      aria-pressed={isSelected}
      className={`${styles.structure} ${styles[structure.type] ?? ''} ${
        isSelected ? styles.selectedStructure : ''
      } ${isDragging ? styles.draggingStructure : ''} ${
        resizingStructureId === structure.id ? styles.resizingStructure : ''
      } ${structure.locked ? styles.lockedItem : ''} ${
        hasWarning ? styles.warningItem : ''
      }`}
      data-plan-item="true"
      onClick={(event) => {
        if (event.detail === 0) {
          onSelectItem({ id: structure.id, type: 'structure' }, event.shiftKey);
        }
      }}
      onPointerCancel={(event) => onStructurePointerEnd(event, structure.id)}
      onPointerDown={(event) => onStructurePointerDown(event, structure.id)}
      onPointerMove={(event) => onStructurePointerMove(event, structure.id)}
      onPointerUp={(event) => onStructurePointerEnd(event, structure.id)}
      role="button"
      style={footprintStyle(footprint)}
      tabIndex={0}
    >
      {showLabel ? (
        <span>{structure.label}</span>
      ) : (
        <span aria-hidden="true" className={styles.structureGlyph}>
          {getStructureGlyph(structure)}
        </span>
      )}
      {structure.locked ? <small>locked</small> : null}
      {isSelected ? (
        <ResizeHandles
          onPointerCancel={onResizePointerEnd}
          onPointerDown={(event, handle) =>
            onResizePointerDown(event, structure.id, handle)
          }
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerEnd}
          structureLabel={structure.label}
        />
      ) : null}
    </div>
  );
});

function shouldShowStructureLabel(structure: Structure) {
  if (
    structure.type === 'fence' ||
    structure.type === 'fenceWall' ||
    structure.type === 'compost' ||
    structure.type === 'hoseBib' ||
    structure.type === 'path' ||
    structure.type === 'pathway' ||
    structure.type === 'treeObstacle' ||
    structure.type === 'trellis' ||
    structure.type === 'waterSource'
  ) {
    return false;
  }

  return structure.widthFt * structure.depthFt >= 2;
}

function getStructureGlyph(structure: Structure) {
  switch (structure.type) {
    case 'fence':
    case 'fenceWall':
      return 'F';
    case 'hoseBib':
      return 'H';
    case 'path':
    case 'pathway':
      return 'A';
    case 'compost':
      return 'C';
    case 'treeObstacle':
      return 'S';
    case 'trellis':
      return 'T';
    case 'waterSource':
      return 'W';
    default:
      return '';
  }
}

const resizeHandles: Array<{
  className: string;
  handle: ResizeHandle;
  label: string;
}> = [
  { className: 'resizeNorthWest', handle: 'northWest', label: 'northwest' },
  { className: 'resizeNorth', handle: 'north', label: 'north' },
  { className: 'resizeNorthEast', handle: 'northEast', label: 'northeast' },
  { className: 'resizeEast', handle: 'east', label: 'east' },
  { className: 'resizeSouthEast', handle: 'southEast', label: 'southeast' },
  { className: 'resizeSouth', handle: 'south', label: 'south' },
  { className: 'resizeSouthWest', handle: 'southWest', label: 'southwest' },
  { className: 'resizeWest', handle: 'west', label: 'west' },
];

function ResizeHandles({
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  structureLabel,
}: {
  onPointerCancel(event: PointerEvent<HTMLSpanElement>): void;
  onPointerDown(
    event: PointerEvent<HTMLSpanElement>,
    handle: ResizeHandle,
  ): void;
  onPointerMove(event: PointerEvent<HTMLSpanElement>): void;
  onPointerUp(event: PointerEvent<HTMLSpanElement>): void;
  structureLabel: string;
}) {
  return (
    <>
      {resizeHandles.map((entry) => (
        <span
          aria-label={`Resize ${structureLabel} ${entry.label} handle`}
          className={`${styles.resizeHandle} ${styles[entry.className]}`}
          data-resize-handle={entry.handle}
          key={entry.handle}
          onPointerCancel={onPointerCancel}
          onPointerDown={(event) => onPointerDown(event, entry.handle)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          role="button"
          tabIndex={-1}
        />
      ))}
    </>
  );
}
