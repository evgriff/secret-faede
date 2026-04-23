import { memo, type PointerEvent } from 'react';

import type { Structure } from '../../../domain/gardens/GardenRepository';
import { formatFeet } from '../../garden/gardenMath';
import {
  getWalkablePathWidthFt,
  isPathStructure,
} from '../../garden/gardenStructureRules';
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
  const isPath = isPathStructure(structure);
  const isTrellis = structure.type === 'trellis';
  const showLabel = shouldShowStructureLabel(structure);
  const walkablePathWidthFt = isPath ? getWalkablePathWidthFt(structure) : null;

  return (
    <div
      aria-label={getStructureAriaLabel(structure, walkablePathWidthFt)}
      aria-pressed={isSelected}
      className={`${styles.structure} ${styles[structure.type] ?? ''} ${
        isSelected ? styles.selectedStructure : ''
      } ${isDragging ? styles.draggingStructure : ''} ${
        resizingStructureId === structure.id ? styles.resizingStructure : ''
      } ${structure.locked ? styles.lockedItem : ''} ${
        hasWarning ? styles.warningItem : ''
      } ${isPath ? styles.accessPath : ''} ${
        isTrellis ? styles.trellisStructure : ''
      } ${
        isPath && structure.widthFt <= structure.depthFt
          ? styles.verticalPath
          : ''
      } ${
        isPath && structure.widthFt > structure.depthFt
          ? styles.horizontalPath
          : ''
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
      {isPath ? (
        <div className={styles.pathContent} data-plan-label="true">
          <span>{structure.label}</span>
          <small>{formatFeet(walkablePathWidthFt ?? 0)} ft walkable</small>
        </div>
      ) : isTrellis ? (
        <div className={styles.trellisContent} data-plan-label="true">
          <span>{structure.label}</span>
          <small>{formatFeet(structure.widthFt)} ft support</small>
        </div>
      ) : showLabel ? (
        <span data-plan-label="true">{structure.label}</span>
      ) : (
        <span
          aria-hidden="true"
          className={styles.structureGlyph}
          data-plan-label="true"
        >
          {getStructureGlyph(structure)}
        </span>
      )}
      {structure.locked ? <small data-plan-label="true">locked</small> : null}
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

function getStructureAriaLabel(
  structure: Structure,
  walkablePathWidthFt: number | null,
) {
  const position = `at X: ${formatFeet(structure.xFt)} ft, Y: ${formatFeet(
    structure.yFt,
  )} ft`;

  if (walkablePathWidthFt !== null) {
    return `${structure.label}, walkable width ${formatFeet(
      walkablePathWidthFt,
    )} ft, ${position}`;
  }

  return `${structure.label} ${position}`;
}

function shouldShowStructureLabel(structure: Structure) {
  if (structure.type === 'trellis') {
    return false;
  }

  return structure.widthFt * structure.depthFt >= 2;
}

function getStructureGlyph(structure: Structure) {
  switch (structure.type) {
    case 'path':
    case 'pathway':
      return 'P';
    case 'trellis':
      return 'T';
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
