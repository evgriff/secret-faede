import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

import type { GardenPlan, PlantingGroup } from '../../domain';
import styles from './PlanPage.module.css';

export function PlotCanvas({
  plan,
  selectedId,
  showGrid,
  onMove,
  onSelect,
}: {
  onMove(id: string, position: { xFt: number; yFt: number }): void;
  onSelect(id: string | null): void;
  plan: GardenPlan;
  selectedId: string | null;
  showGrid: boolean;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    element: HTMLElement;
    group: PlantingGroup;
    pointerId: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  function beginDrag(
    event: PointerEvent<HTMLButtonElement>,
    group: PlantingGroup,
  ) {
    if (group.locked || event.button !== 0) return;
    dragRef.current = {
      element: event.currentTarget,
      group,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function previewDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.element.style.translate = `${event.clientX - drag.startClientX}px ${
      event.clientY - drag.startClientY
    }px`;
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const plot = plotRef.current;
    if (!drag || !plot || drag.pointerId !== event.pointerId) return;
    const bounds = plot.getBoundingClientRect();
    const deltaXFt =
      ((event.clientX - drag.startClientX) / bounds.width) * plan.plot.widthFt;
    const deltaYFt =
      ((event.clientY - drag.startClientY) / bounds.height) * plan.plot.depthFt;
    drag.element.style.translate = '';
    drag.element.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    onMove(drag.group.id, {
      xFt: drag.group.xFt + deltaXFt,
      yFt: drag.group.yFt + deltaYFt,
    });
  }

  function nudge(
    event: KeyboardEvent<HTMLButtonElement>,
    group: PlantingGroup,
  ) {
    if (group.locked || !event.key.startsWith('Arrow')) return;
    event.preventDefault();
    const distance = event.shiftKey ? 1 : plan.plot.snapFt;
    onMove(group.id, {
      xFt:
        group.xFt +
        (event.key === 'ArrowLeft'
          ? -distance
          : event.key === 'ArrowRight'
            ? distance
            : 0),
      yFt:
        group.yFt +
        (event.key === 'ArrowUp'
          ? -distance
          : event.key === 'ArrowDown'
            ? distance
            : 0),
    });
  }

  return (
    <section aria-label="Garden plot editor" className={styles.canvasFrame}>
      <div className={styles.axisTop} aria-hidden="true">
        {plan.plot.widthFt} ft wide
      </div>
      <div
        aria-label={`${plan.plot.widthFt} by ${plan.plot.depthFt} foot garden plot`}
        className={`${styles.plot} ${showGrid ? styles.grid : ''}`.trim()}
        onClick={(event) => {
          if (event.currentTarget === event.target) onSelect(null);
        }}
        ref={plotRef}
        role="group"
        style={{ aspectRatio: `${plan.plot.widthFt} / ${plan.plot.depthFt}` }}
      >
        <span
          aria-label={`North points ${plan.plot.northDegrees} degrees clockwise from the top of the plan`}
          className={styles.northMarker}
          role="img"
        >
          <span
            aria-hidden="true"
            className={styles.northArrow}
            style={{ transform: `rotate(${plan.plot.northDegrees}deg)` }}
          >
            ↑
          </span>
          <span aria-hidden="true">N · {plan.plot.northDegrees}°</span>
        </span>
        {plan.structures.map((structure) => (
          <button
            aria-label={`${structure.label}, ${structure.widthFt} by ${structure.depthFt} feet, top left at X ${structure.xFt}, Y ${structure.yFt}, rotated ${structure.rotationDegrees} degrees clockwise`}
            aria-pressed={selectedId === structure.id}
            className={`${styles.structure} ${styles[`structure_${structure.type}`]} ${
              selectedId === structure.id ? styles.selected : ''
            }`.trim()}
            key={structure.id}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(structure.id);
            }}
            style={{
              height: `${(structure.depthFt / plan.plot.depthFt) * 100}%`,
              left: `${(structure.xFt / plan.plot.widthFt) * 100}%`,
              top: `${(structure.yFt / plan.plot.depthFt) * 100}%`,
              transform: `rotate(${structure.rotationDegrees}deg)`,
              width: `${(structure.widthFt / plan.plot.widthFt) * 100}%`,
            }}
            type="button"
          >
            <span>{structure.label}</span>
          </button>
        ))}
        {plan.plantings.map((group) => (
          <button
            aria-label={`${group.cropName} group, ${group.instances.length} plants at X ${group.xFt.toFixed(
              2,
            )} feet, Y ${group.yFt.toFixed(2)} feet${group.locked ? ', locked' : ''}`}
            aria-pressed={selectedId === group.id}
            className={`${styles.plantingGroup} ${
              selectedId === group.id ? styles.selected : ''
            }`.trim()}
            data-lifecycle={group.lifecycle}
            key={group.id}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(group.id);
            }}
            onKeyDown={(event) => nudge(event, group)}
            onPointerCancel={finishDrag}
            onPointerDown={(event) => beginDrag(event, group)}
            onPointerMove={previewDrag}
            onPointerUp={finishDrag}
            style={{
              height: `${(group.depthFt / plan.plot.depthFt) * 100}%`,
              left: `${((group.xFt - group.widthFt / 2) / plan.plot.widthFt) * 100}%`,
              top: `${((group.yFt - group.depthFt / 2) / plan.plot.depthFt) * 100}%`,
              width: `${(group.widthFt / plan.plot.widthFt) * 100}%`,
            }}
            type="button"
          >
            <strong>{group.cropName}</strong>
            <small>{group.instances.length} plants</small>
            <span aria-hidden="true" className={styles.instanceField}>
              {group.instances.slice(0, 36).map((instance) => (
                <i
                  key={instance.id}
                  style={{
                    left: `${
                      ((instance.xFt - (group.xFt - group.widthFt / 2)) /
                        group.widthFt) *
                      100
                    }%`,
                    top: `${
                      ((instance.yFt - (group.yFt - group.depthFt / 2)) /
                        group.depthFt) *
                      100
                    }%`,
                  }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
      <p className={styles.canvasHint}>
        Drag crop groups or select one and use arrow keys. Positions are saved
        in feet; hold Shift with an arrow to move one foot.
      </p>
    </section>
  );
}
