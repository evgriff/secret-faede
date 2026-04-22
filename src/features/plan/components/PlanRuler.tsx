import { pixelsPerFoot } from '../../garden/gardenMath';
import { createRulerTicks } from './planCanvasGeometry';
import styles from './PlanCanvas.module.css';

export function PlanRuler({
  axis,
  sizeFt,
}: {
  axis: 'left' | 'top';
  sizeFt: number;
}) {
  const ticks = createRulerTicks(sizeFt);

  return (
    <div
      className={axis === 'top' ? styles.topRuler : styles.leftRuler}
      aria-hidden="true"
    >
      {ticks.map((tick) => (
        <span
          className={getTickClass(axis, tick, sizeFt)}
          key={`${axis}-${tick}`}
          style={
            axis === 'top'
              ? { left: `${tick * pixelsPerFoot}px` }
              : { top: `${tick * pixelsPerFoot}px` }
          }
        >
          {tick}
        </span>
      ))}
    </div>
  );
}

function getTickClass(axis: 'left' | 'top', tick: number, sizeFt: number) {
  if (axis === 'top') {
    return `${styles.topTick} ${tick === 0 ? styles.startTopTick : ''} ${
      tick === sizeFt ? styles.endTopTick : ''
    }`;
  }

  return `${styles.leftTick} ${tick === 0 ? styles.startLeftTick : ''} ${
    tick === sizeFt ? styles.endLeftTick : ''
  }`;
}
