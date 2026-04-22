import {
  memo,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react';

import type {
  Garden,
  SunExposure,
  SunShadeArea,
} from '../../../domain/gardens/GardenRepository';
import { pixelsPerFoot } from '../../garden/gardenMath';
import {
  hasWarningForItem,
  type PlanWarning,
} from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type { SelectedGardenItem } from '../../garden/useGarden';
import type { ResizeHandle, SnapGuide } from '../planInteractionGeometry';
import type { PlanMode } from '../planModes';
import { PlanPlantButton } from './PlanPlantButton';
import { footprintStyle } from './planCanvasGeometry';
import itemStyles from './PlanCanvasItems.module.css';
import styles from './PlanCanvas.module.css';
import { PlanRuler } from './PlanRuler';
import { PlanStructureBox } from './PlanStructureBox';
import { PlanSunOverlay } from './PlanSunOverlay';

export const PlanCanvasScene = memo(function PlanCanvasScene({
  activeSunLayer,
  draggingPlantId,
  draggingStructureId,
  garden,
  manualSunEdit,
  manualSunExposure,
  marqueeRect,
  mode,
  onMarqueePointerDown,
  onMarqueePointerEnd,
  onMarqueePointerMove,
  onPaintSunShadeCell,
  onPlantPointerDown,
  onPlantPointerEnd,
  onPlantPointerMove,
  onResizePointerDown,
  onResizePointerEnd,
  onResizePointerMove,
  onSelectItem,
  onStructurePointerDown,
  onStructurePointerEnd,
  onStructurePointerMove,
  plotRef,
  plotStyle,
  resizingStructureId,
  sceneStyle,
  selectedPlantIds,
  selectedStructureIds,
  showSunLayer,
  snapGuides,
  sunSeason,
  visibleWarnings,
}: {
  activeSunLayer: { areas: SunShadeArea[] };
  draggingPlantId: string | null;
  draggingStructureId: string | null;
  garden: Garden;
  manualSunEdit: boolean;
  manualSunExposure: SunExposure;
  marqueeRect: {
    depthFt: number;
    widthFt: number;
    xFt: number;
    yFt: number;
  } | null;
  mode: PlanMode;
  onMarqueePointerDown(event: PointerEvent<HTMLDivElement>): void;
  onMarqueePointerEnd(event: PointerEvent<HTMLDivElement>): void;
  onMarqueePointerMove(event: PointerEvent<HTMLDivElement>): void;
  onPaintSunShadeCell(
    season: SunSeason,
    xFt: number,
    yFt: number,
    exposure: SunExposure,
  ): void;
  onPlantPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ): void;
  onPlantPointerEnd(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ): void;
  onPlantPointerMove(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ): void;
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
  plotRef: RefObject<HTMLDivElement | null>;
  plotStyle: CSSProperties;
  resizingStructureId: string | null;
  sceneStyle: CSSProperties;
  selectedPlantIds: string[];
  selectedStructureIds: string[];
  showSunLayer: boolean;
  snapGuides: SnapGuide[];
  sunSeason: SunSeason;
  visibleWarnings: PlanWarning[];
}) {
  return (
    <div className={styles.workbench}>
      <div className={styles.sceneTransform} style={sceneStyle}>
        <div
          className={styles.plotShell}
          data-testid="plot-shell"
          style={plotStyle}
        >
          <div className={styles.rulerCorner} aria-hidden="true">
            ft
          </div>
          <PlanRuler axis="top" sizeFt={garden.plot.widthFt} />
          <PlanRuler axis="left" sizeFt={garden.plot.depthFt} />
          <div
            aria-label={`${garden.plot.widthFt} by ${garden.plot.depthFt} foot garden plot`}
            className={styles.plot}
            data-marquee-surface="true"
            data-testid="garden-plot"
            onPointerCancel={onMarqueePointerEnd}
            onPointerDown={onMarqueePointerDown}
            onPointerMove={onMarqueePointerMove}
            onPointerUp={onMarqueePointerEnd}
            ref={plotRef}
            role="group"
          >
            {garden.plantings.length === 0 && garden.structures.length === 0 ? (
              <div className={styles.emptyHint}>
                <strong>Start with a bed or crop.</strong>
                <span>
                  Use Plant or Structure mode to place the first item.
                </span>
              </div>
            ) : null}
            <div className={styles.plotMeta} aria-hidden="true">
              <span>Scale: 1 square = 1 ft</span>
              <span>
                {garden.plot.widthFt} x {garden.plot.depthFt} ft
              </span>
              <span className={styles.northArrow}>
                <span
                  style={{
                    transform: `rotate(${garden.plot.orientationDegrees}deg)`,
                  }}
                >
                  N
                </span>
              </span>
            </div>
            <div className={styles.orientationBadge} aria-hidden="true">
              <span
                style={{
                  transform: `rotate(${garden.plot.orientationDegrees}deg)`,
                }}
              >
                ↑
              </span>
              <small>North</small>
            </div>

            {showSunLayer ? (
              <PlanSunOverlay
                activeSunLayer={activeSunLayer}
                manualSunEdit={manualSunEdit}
                manualSunExposure={manualSunExposure}
                onPaintSunShadeCell={onPaintSunShadeCell}
                sunSeason={sunSeason}
              />
            ) : null}

            {snapGuides.map((guide) => (
              <div
                aria-hidden="true"
                className={`${styles.snapGuide} ${
                  guide.axis === 'x' ? styles.snapGuideX : styles.snapGuideY
                }`}
                key={`${guide.axis}-${guide.label}-${guide.valueFt}`}
                style={snapGuideStyle(guide)}
              />
            ))}

            {marqueeRect ? (
              <div
                aria-hidden="true"
                className={styles.marquee}
                style={footprintStyle({
                  depthFt: marqueeRect.depthFt,
                  id: 'marquee',
                  itemType: 'structure',
                  label: 'Selection',
                  widthFt: marqueeRect.widthFt,
                  xFt: marqueeRect.xFt,
                  yFt: marqueeRect.yFt,
                })}
              />
            ) : null}

            {garden.structures.map((structure) => (
              <PlanStructureBox
                draggingStructureId={draggingStructureId}
                key={structure.id}
                onResizePointerDown={onResizePointerDown}
                onResizePointerEnd={onResizePointerEnd}
                onResizePointerMove={onResizePointerMove}
                onSelectItem={onSelectItem}
                onStructurePointerDown={onStructurePointerDown}
                onStructurePointerEnd={onStructurePointerEnd}
                onStructurePointerMove={onStructurePointerMove}
                planWarnings={visibleWarnings}
                resizingStructureId={resizingStructureId}
                selectedStructureIds={selectedStructureIds}
                structure={structure}
              />
            ))}

            {garden.plantings.map((plant, index) => (
              <PlanPlantButton
                hasWarning={hasWarningForItem(visibleWarnings, plant.id)}
                index={index}
                isDragging={plant.id === draggingPlantId}
                isSelected={selectedPlantIds.includes(plant.id)}
                key={plant.id}
                onPlantPointerDown={onPlantPointerDown}
                onPlantPointerEnd={onPlantPointerEnd}
                onPlantPointerMove={onPlantPointerMove}
                onSelectItem={onSelectItem}
                plant={plant}
              />
            ))}

            {mode === 'measure' ? (
              <div className={itemStyles.measureOverlay} aria-hidden="true">
                <span>{garden.plot.widthFt} ft</span>
                <span>{garden.plot.depthFt} ft</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});

function snapGuideStyle(guide: SnapGuide): CSSProperties {
  if (guide.axis === 'x') {
    return { left: `${guide.valueFt * pixelsPerFoot}px` };
  }

  return { top: `${guide.valueFt * pixelsPerFoot}px` };
}
