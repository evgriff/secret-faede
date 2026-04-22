import type { CSSProperties } from 'react';

import type { Garden } from '../../../domain/gardens/GardenRepository';
import styles from './PlanCanvasTools.module.css';

export function PlanMiniMap({
  garden,
  onCollapse,
}: {
  garden: Garden;
  onCollapse(): void;
}) {
  const ratio = garden.plot.widthFt / garden.plot.depthFt;

  return (
    <aside
      className={styles.miniMap}
      style={{ '--mini-map-ratio': String(ratio) } as CSSProperties}
      aria-label="Plot mini map"
    >
      <button
        aria-label="Collapse mini map"
        className={styles.miniMapClose}
        onClick={onCollapse}
        type="button"
      >
        Map
      </button>
      <div className={styles.miniPlot}>
        {garden.structures.map((structure) => (
          <span
            className={styles.miniStructure}
            key={structure.id}
            style={{
              height: `${(structure.depthFt / garden.plot.depthFt) * 100}%`,
              left: `${(structure.xFt / garden.plot.widthFt) * 100}%`,
              top: `${(structure.yFt / garden.plot.depthFt) * 100}%`,
              width: `${(structure.widthFt / garden.plot.widthFt) * 100}%`,
            }}
          />
        ))}
        {garden.plantings.map((planting) => (
          <span
            className={styles.miniPlant}
            key={planting.id}
            style={{
              left: `${(planting.xFt / garden.plot.widthFt) * 100}%`,
              top: `${(planting.yFt / garden.plot.depthFt) * 100}%`,
            }}
          />
        ))}
        <span
          className={styles.miniNorth}
          style={{
            transform: `rotate(${garden.plot.orientationDegrees}deg)`,
          }}
        >
          N
        </span>
      </div>
    </aside>
  );
}
