import {
  memo,
  useMemo,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from 'react';

import {
  isPageStructureType,
  type Garden,
  type Planting,
  type SunExposure,
  type SunShadeArea,
} from '../../../domain/gardens/GardenRepository';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type { SelectedGardenItem } from '../../garden/useGarden';
import type { PlanInfluenceOverlayModel } from '../planInfluenceOverlay';
import type { ResizeHandle } from '../planInteractionGeometry';
import { getPlantingFocusKey } from '../planCropFocus';
import type { ProposalDiffOverlayModel } from '../proposalDiffOverlay';
import { PlanInfluenceOverlay } from './PlanInfluenceOverlay';
import { PlanPlantGroup } from './PlanPlantGroup';
import { PlanPlantingPreview } from './PlanPlantingPreview';
import { PlanProposalDiffOverlay } from './PlanProposalDiffOverlay';
import { footprintStyle } from './planCanvasGeometry';
import styles from './PlanCanvas.module.css';
import { PlanRuler } from './PlanRuler';
import { PlanStructureBox } from './PlanStructureBox';
import { PlanSunOverlay } from './PlanSunOverlay';

const emptyPlanWarnings: PlanWarning[] = [];

export const PlanCanvasScene = memo(function PlanCanvasScene({
  activeSunLayer,
  draggingPlantId,
  draggingStructureId,
  focusedCropKey,
  garden,
  hoveredPlantGroupId,
  influenceOverlay,
  manualSunEdit,
  manualSunExposure,
  marqueeRect,
  onMarqueePointerDown,
  onMarqueePointerEnd,
  onMarqueePointerMove,
  onPaintSunShadeCell,
  onPlantHoverChange,
  onPlantLabelHide,
  onPlantEditorOpen,
  onPlantPointerDown,
  onPlantPointerEnd,
  onPlantPointerMove,
  onPlantResizePointerDown,
  onResizePointerDown,
  onResizePointerEnd,
  onResizePointerMove,
  onSelectItem,
  onStructurePointerDown,
  onStructurePointerEnd,
  onStructurePointerMove,
  plantingPreview,
  plotRef,
  plotStyle,
  proposalDiffOverlay,
  resizingPlantId,
  resizingStructureId,
  sceneStyle,
  selectedPlantIds,
  selectedStructureIds,
  showSunLayer,
  sunSeason,
  visibleWarnings,
  visiblePlantLabelIds,
  workbenchStyle,
}: {
  activeSunLayer: { areas: SunShadeArea[] };
  draggingPlantId: string | null;
  draggingStructureId: string | null;
  focusedCropKey: string | null;
  garden: Garden;
  hoveredPlantGroupId: string | null;
  influenceOverlay: PlanInfluenceOverlayModel | null;
  manualSunEdit: boolean;
  manualSunExposure: SunExposure;
  marqueeRect: {
    depthFt: number;
    widthFt: number;
    xFt: number;
    yFt: number;
  } | null;
  onMarqueePointerDown(event: PointerEvent<HTMLDivElement>): void;
  onMarqueePointerEnd(event: PointerEvent<HTMLDivElement>): void;
  onMarqueePointerMove(event: PointerEvent<HTMLDivElement>): void;
  onPaintSunShadeCell(
    season: SunSeason,
    xFt: number,
    yFt: number,
    exposure: SunExposure,
  ): void;
  onPlantHoverChange(plantId: string | null): void;
  onPlantLabelHide(plantId: string): void;
  onPlantEditorOpen(plantId: string): void;
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
  onPlantResizePointerDown(
    event: PointerEvent<HTMLSpanElement>,
    plantId: string,
    handle: ResizeHandle,
  ): void;
  onResizePointerDown(
    event: PointerEvent<HTMLSpanElement>,
    structureId: string,
    handle: ResizeHandle,
  ): void;
  onResizePointerEnd(event: PointerEvent<HTMLSpanElement>): void;
  onResizePointerMove(event: PointerEvent<HTMLSpanElement>): void;
  onSelectItem(
    item: SelectedGardenItem,
    additive: boolean,
    options?: { openSurface?: boolean },
  ): void;
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
  plantingPreview: Planting | null;
  plotRef: RefObject<HTMLDivElement | null>;
  plotStyle: CSSProperties;
  proposalDiffOverlay: ProposalDiffOverlayModel | null;
  resizingPlantId: string | null;
  resizingStructureId: string | null;
  sceneStyle: CSSProperties;
  selectedPlantIds: string[];
  selectedStructureIds: string[];
  showSunLayer: boolean;
  sunSeason: SunSeason;
  visibleWarnings: PlanWarning[];
  visiblePlantLabelIds: string[];
  workbenchStyle: CSSProperties;
}) {
  const visiblePlantLabelIdSet = useMemo(
    () => new Set(visiblePlantLabelIds),
    [visiblePlantLabelIds],
  );
  const pageStructures = useMemo(
    () =>
      garden.structures.filter((structure) =>
        isPageStructureType(structure.type),
      ),
    [garden.structures],
  );
  const warningsByPlantId = useMemo(() => {
    const byPlantId = new Map<string, PlanWarning[]>();

    visibleWarnings.forEach((warning) => {
      warning.itemIds.forEach((itemId) => {
        const current = byPlantId.get(itemId);

        if (current) {
          current.push(warning);
          return;
        }

        byPlantId.set(itemId, [warning]);
      });
    });

    return byPlantId;
  }, [visibleWarnings]);

  return (
    <div className={styles.workbench} style={workbenchStyle}>
      <div className={styles.sceneBounds}>
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
              {garden.plantings.length === 0 &&
              garden.structures.length === 0 ? (
                <div className={styles.emptyHint}>
                  <strong>Start with the parts you really need.</strong>
                  <ol>
                    <li>Set the plot, beds, and paths you actually use</li>
                    <li>Add plants or save a crop list</li>
                    <li>Review problems if something feels tight</li>
                    <li>
                      Generate a layout suggestion only when you want another
                      arrangement
                    </li>
                  </ol>
                </div>
              ) : null}
              <div
                aria-label="Plot scale and dimensions"
                className={styles.plotMeta}
              >
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

              {pageStructures.map((structure) => (
                <PlanStructureBox
                  isDragging={draggingStructureId === structure.id}
                  isResizing={resizingStructureId === structure.id}
                  key={structure.id}
                  onResizePointerDown={onResizePointerDown}
                  onResizePointerEnd={onResizePointerEnd}
                  onResizePointerMove={onResizePointerMove}
                  onSelectItem={onSelectItem}
                  onStructurePointerDown={onStructurePointerDown}
                  onStructurePointerEnd={onStructurePointerEnd}
                  onStructurePointerMove={onStructurePointerMove}
                  planWarnings={visibleWarnings}
                  selectedStructureIds={selectedStructureIds}
                  structure={structure}
                />
              ))}

              {plantingPreview ? (
                <PlanPlantingPreview plant={plantingPreview} />
              ) : null}

              {garden.plantings.map((plant, index) => {
                const plantFocusKey = getPlantingFocusKey(plant);

                return (
                  <PlanPlantGroup
                    index={index}
                    isCropFocused={plantFocusKey === focusedCropKey}
                    isFocusDimmed={Boolean(
                      focusedCropKey && plantFocusKey !== focusedCropKey,
                    )}
                    isHoverLabelVisible={hoveredPlantGroupId === plant.id}
                    isLabelVisible={visiblePlantLabelIdSet.has(plant.id)}
                    isDragging={draggingPlantId === plant.id}
                    isResizing={resizingPlantId === plant.id}
                    isSelected={selectedPlantIds.includes(plant.id)}
                    key={plant.id}
                    onHideLabel={onPlantLabelHide}
                    onOpenEditor={onPlantEditorOpen}
                    onPlantPointerDown={onPlantPointerDown}
                    onPlantPointerEnd={onPlantPointerEnd}
                    onPlantPointerMove={onPlantPointerMove}
                    onPlantResizePointerDown={onPlantResizePointerDown}
                    onResizePointerEnd={onResizePointerEnd}
                    onResizePointerMove={onResizePointerMove}
                    onPlantHoverChange={onPlantHoverChange}
                    onSelectItem={onSelectItem}
                    plant={plant}
                    structures={garden.structures}
                    warnings={
                      warningsByPlantId.get(plant.id) ?? emptyPlanWarnings
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
