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
import { getPlantingInstances } from '../../../domain/gardens/plantingInstances';
import { pixelsPerFoot } from '../../garden/gardenMath';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type { SelectedGardenItem } from '../../garden/useGarden';
import type { PlanInfluenceOverlayModel } from '../planInfluenceOverlay';
import type { ResizeHandle, SnapGuide } from '../planInteractionGeometry';
import type { PlanMode } from '../planModes';
import { getPlantingFocusKey } from '../planCropFocus';
import type { ProposalDiffOverlayModel } from '../proposalDiffOverlay';
import { PlanInfluenceOverlay } from './PlanInfluenceOverlay';
import { PlanPlantButton } from './PlanPlantButton';
import { PlanProposalDiffOverlay } from './PlanProposalDiffOverlay';
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
  focusedCropKey,
  garden,
  influenceOverlay,
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
  proposalDiffOverlay,
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
  focusedCropKey: string | null;
  garden: Garden;
  influenceOverlay: PlanInfluenceOverlayModel | null;
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
    instanceId?: string,
  ): void;
  onPlantPointerEnd(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
    instanceId?: string,
  ): void;
  onPlantPointerMove(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
    instanceId?: string,
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
  proposalDiffOverlay: ProposalDiffOverlayModel | null;
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

            {influenceOverlay ? (
              <PlanInfluenceOverlay overlay={influenceOverlay} />
            ) : null}

            {proposalDiffOverlay ? (
              <PlanProposalDiffOverlay
                overlay={proposalDiffOverlay}
                plotDepthFt={garden.plot.depthFt}
                plotWidthFt={garden.plot.widthFt}
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

            {garden.plantings.flatMap((plant, index) =>
              getPlantingInstances(plant).map((instance) => (
                <PlanPlantButton
                  index={index}
                  instance={instance}
                  isCropFocused={getPlantingFocusKey(plant) === focusedCropKey}
                  isFocusDimmed={Boolean(
                    focusedCropKey &&
                    getPlantingFocusKey(plant) !== focusedCropKey,
                  )}
                  isDragging={isPlantInstanceDragging(
                    draggingPlantId,
                    plant.id,
                    instance.id,
                  )}
                  isSelected={selectedPlantIds.includes(
                    getPlantSelectionKey(plant.id, instance.id),
                  )}
                  key={`${plant.id}:${instance.id}`}
                  onPlantPointerDown={onPlantPointerDown}
                  onPlantPointerEnd={onPlantPointerEnd}
                  onPlantPointerMove={onPlantPointerMove}
                  onSelectItem={onSelectItem}
                  plant={plant}
                  warnings={visibleWarnings.filter((warning) =>
                    warning.itemIds.includes(plant.id),
                  )}
                />
              )),
            )}

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

function getPlantSelectionKey(plantingId: string, instanceId: string) {
  return `${plantingId}:${instanceId}`;
}

function isPlantInstanceDragging(
  draggingPlantId: string | null,
  plantingId: string,
  instanceId: string,
) {
  return draggingPlantId === plantingId || draggingPlantId === instanceId;
}
