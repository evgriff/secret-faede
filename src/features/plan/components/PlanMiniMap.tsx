import type { CSSProperties } from 'react';

import {
  isPageStructureType,
  type Garden,
} from '../../../domain/gardens/GardenRepository';
import { getPlantingFootprint } from '../../garden/gardenPlanning';
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
      aria-label="Plot overview"
    >
      <button
        aria-label="Collapse overview"
        className={styles.miniMapClose}
        onClick={onCollapse}
        type="button"
      >
        Overview
      </button>
      <div className={styles.miniPlot}>
        {garden.structures
          .filter((structure) => isPageStructureType(structure.type))
          .map((structure) => {
            const isPath =
              structure.type === 'path' || structure.type === 'pathway';

            return (
              <span
                className={`${styles.miniStructure} ${
                  isPath ? styles.miniPath : ''
                }`}
                key={structure.id}
                style={{
                  height: `${(structure.depthFt / garden.plot.depthFt) * 100}%`,
                  left: `${(structure.xFt / garden.plot.widthFt) * 100}%`,
                  top: `${(structure.yFt / garden.plot.depthFt) * 100}%`,
                  width: `${(structure.widthFt / garden.plot.widthFt) * 100}%`,
                }}
              />
            );
          })}
        {garden.plantings.map((planting) => {
          const footprint = getPlantingFootprint(planting);

          return (
            <span
              className={styles.miniPlant}
              key={planting.id}
              style={{
                height: `${(footprint.depthFt / garden.plot.depthFt) * 100}%`,
                left: `${(footprint.xFt / garden.plot.widthFt) * 100}%`,
                top: `${(footprint.yFt / garden.plot.depthFt) * 100}%`,
                width: `${(footprint.widthFt / garden.plot.widthFt) * 100}%`,
              }}
            />
          );
        })}
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
