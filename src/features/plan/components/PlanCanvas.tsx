import {
  memo,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type {
  Garden,
  Planting,
  SunExposure,
  SunShadeArea,
} from '../../../domain/gardens/GardenRepository';
import { pixelsPerFoot } from '../../garden/gardenMath';
import {
  isCanvasPlanWarning,
  type PlanWarning,
} from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type { SelectedGardenItem } from '../../garden/useGarden';
import { usePlanCanvasView } from '../hooks/usePlanCanvasView';
import type { PlanInfluenceOverlayModel } from '../planInfluenceOverlay';
import type { ResizeHandle, SnapGuide } from '../planInteractionGeometry';
import type { PlanMode } from '../planModes';
import type { ProposalDiffOverlayModel } from '../proposalDiffOverlay';
import {
  PlanCanvasControls,
  type PlanCanvasLayers,
} from './PlanCanvasControls';
import { PlanCanvasScene } from './PlanCanvasScene';
import { PlanMiniMap } from './PlanMiniMap';
import styles from './PlanCanvas.module.css';

export const PlanCanvas = memo(function PlanCanvas({
  activeSunLayer,
  draggingPlantId,
  draggingStructureId,
  focusedCropKey,
  garden,
  hoveredPlantGroupId,
  influenceOverlay,
  manualSunEdit,
  manualSunExposure,
  mode,
  onPaintSunShadeCell,
  onPlantHoverChange,
  onPlantLabelHide,
  onPlantLabelShow,
  onPlantEditorOpen,
  onMarqueePointerDown,
  onMarqueePointerEnd,
  onMarqueePointerMove,
  onPlantPointerDown,
  onPlantPointerEnd,
  onPlantPointerMove,
  onResizePointerDown,
  onResizePointerEnd,
  onResizePointerMove,
  onSelectItem,
  onShowSunOverlayChange,
  onStructurePointerDown,
  onStructurePointerEnd,
  onStructurePointerMove,
  plantingPreview,
  planWarnings,
  proposalDiffOverlay,
  plotRef,
  marqueeRect,
  resizingStructureId,
  selectedPlantIds,
  selectedStructureIds,
  showSunOverlay,
  snapGuides,
  sunSeason,
  visiblePlantLabelIds,
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
  mode: PlanMode;
  onPaintSunShadeCell(
    season: SunSeason,
    xFt: number,
    yFt: number,
    exposure: SunExposure,
  ): void;
  onPlantHoverChange(plantId: string | null): void;
  onPlantLabelHide(plantId: string): void;
  onPlantLabelShow(plantId: string): void;
  onPlantEditorOpen(plantId: string): void;
  onMarqueePointerDown(event: PointerEvent<HTMLDivElement>): void;
  onMarqueePointerEnd(event: PointerEvent<HTMLDivElement>): void;
  onMarqueePointerMove(event: PointerEvent<HTMLDivElement>): void;
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
  onShowSunOverlayChange(value: boolean): void;
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
  planWarnings: PlanWarning[];
  proposalDiffOverlay: ProposalDiffOverlayModel | null;
  plotRef: RefObject<HTMLDivElement | null>;
  marqueeRect: {
    depthFt: number;
    widthFt: number;
    xFt: number;
    yFt: number;
  } | null;
  resizingStructureId: string | null;
  selectedPlantIds: string[];
  selectedStructureIds: string[];
  showSunOverlay: boolean;
  snapGuides: SnapGuide[];
  sunSeason: SunSeason;
  visiblePlantLabelIds: string[];
}) {
  const [layers, setLayers] = useState<PlanCanvasLayers>({
    grid: true,
    labels: true,
    miniMap: false,
    sun: showSunOverlay,
    warnings: false,
  });
  const [isPanMode, setIsPanMode] = useState(false);
  const {
    fitView,
    handlePanPointerDown,
    handlePanPointerEnd,
    handlePanPointerMove,
    isPanning,
    pan,
    resetView,
    zoom,
    zoomIn,
    zoomOut,
    zoomState,
  } = usePlanCanvasView({ isPanMode });
  const scrollportRef = useRef<HTMLDivElement | null>(null);
  const didFitInitialView = useRef(false);
  const immediateWarnings = useMemo(
    () => planWarnings.filter(isCanvasPlanWarning),
    [planWarnings],
  );
  const visibleWarnings = layers.warnings ? planWarnings : immediateWarnings;
  const isPointerInteractionActive = Boolean(
    draggingPlantId ||
    draggingStructureId ||
    marqueeRect ||
    resizingStructureId,
  );
  const fitContentSize = useMemo(
    () => ({
      height: garden.plot.depthFt * pixelsPerFoot + 48,
      width: garden.plot.widthFt * pixelsPerFoot + 48,
    }),
    [garden.plot.depthFt, garden.plot.widthFt],
  );
  const getFitBounds = useCallback(() => {
    const viewportRect = scrollportRef.current?.getBoundingClientRect();

    if (!viewportRect) {
      return null;
    }

    return {
      contentHeight: fitContentSize.height,
      contentWidth: fitContentSize.width,
      viewportHeight: viewportRect.height,
      viewportWidth: viewportRect.width,
    };
  }, [fitContentSize.height, fitContentSize.width]);
  const handleFitView = useCallback(() => {
    didFitInitialView.current = true;
    fitView(getFitBounds());
  }, [fitView, getFitBounds]);
  const plotStyle = useMemo(
    () =>
      ({
        '--cell-size': `${pixelsPerFoot}px`,
        '--plot-height': `${garden.plot.depthFt * pixelsPerFoot}px`,
        '--plot-width': `${garden.plot.widthFt * pixelsPerFoot}px`,
      }) as CSSProperties,
    [garden.plot.depthFt, garden.plot.widthFt],
  );
  const sceneStyle = useMemo(
    () =>
      ({
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      }) as CSSProperties,
    [pan.x, pan.y, zoom],
  );
  const viewportClassName = useMemo(
    () =>
      `${styles.viewport} ${styles[`${mode}Mode`] ?? ''} ${
        isPanning ? styles.panning : ''
      } ${isPanMode ? styles.panMode : ''} ${
        isPointerInteractionActive ? styles.pointerInteractionActive : ''
      } ${layers.grid ? '' : styles.gridHidden} ${
        layers.labels ? '' : styles.labelsHidden
      }`,
    [
      isPanMode,
      isPanning,
      isPointerInteractionActive,
      layers.grid,
      layers.labels,
      mode,
    ],
  );

  useEffect(() => {
    if (!didFitInitialView.current || zoomState === 'fit') {
      handleFitView();
    }
  }, [handleFitView, zoomState]);

  useEffect(() => {
    const viewport = scrollportRef.current;

    if (
      !viewport ||
      typeof ResizeObserver === 'undefined' ||
      zoomState !== 'fit'
    ) {
      return;
    }

    const observer = new ResizeObserver(() => {
      fitView(getFitBounds());
    });

    observer.observe(viewport);

    return () => observer.disconnect();
  }, [fitView, getFitBounds, zoomState]);

  useEffect(() => {
    setLayers((current) =>
      current.sun === showSunOverlay
        ? current
        : { ...current, sun: showSunOverlay },
    );
  }, [showSunOverlay]);

  const updateLayers = useCallback(
    (nextLayers: PlanCanvasLayers) => {
      setLayers(nextLayers);

      if (nextLayers.sun !== showSunOverlay) {
        onShowSunOverlayChange(nextLayers.sun);
      }
    },
    [onShowSunOverlayChange, showSunOverlay],
  );

  return (
    <div className={viewportClassName}>
      <PlanCanvasControls
        isPanMode={isPanMode}
        layers={layers}
        onFitView={handleFitView}
        onLayersChange={updateLayers}
        onPanModeChange={setIsPanMode}
        onResetView={resetView}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        zoom={zoom}
        zoomState={zoomState}
      />
      <div
        className={styles.scrollport}
        data-interaction-active={isPointerInteractionActive ? 'true' : 'false'}
        data-pan-mode={isPanMode ? 'true' : 'false'}
        data-plan-scrollport="true"
        data-testid="plot-viewport"
        onPointerCancel={handlePanPointerEnd}
        onPointerDownCapture={handlePanPointerDown}
        onPointerMove={handlePanPointerMove}
        onPointerUp={handlePanPointerEnd}
        onWheel={(event) => {
          if (isPointerInteractionActive) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        ref={scrollportRef}
      >
        <PlanCanvasScene
          activeSunLayer={activeSunLayer}
          draggingPlantId={draggingPlantId}
          draggingStructureId={draggingStructureId}
          focusedCropKey={focusedCropKey}
          garden={garden}
          hoveredPlantGroupId={hoveredPlantGroupId}
          influenceOverlay={influenceOverlay}
          manualSunEdit={manualSunEdit}
          manualSunExposure={manualSunExposure}
          marqueeRect={marqueeRect}
          onMarqueePointerDown={onMarqueePointerDown}
          onMarqueePointerEnd={onMarqueePointerEnd}
          onMarqueePointerMove={onMarqueePointerMove}
          onPaintSunShadeCell={onPaintSunShadeCell}
          onPlantEditorOpen={onPlantEditorOpen}
          onPlantHoverChange={onPlantHoverChange}
          onPlantLabelHide={onPlantLabelHide}
          onPlantLabelShow={onPlantLabelShow}
          onPlantPointerDown={onPlantPointerDown}
          onPlantPointerEnd={onPlantPointerEnd}
          onPlantPointerMove={onPlantPointerMove}
          onResizePointerDown={onResizePointerDown}
          onResizePointerEnd={onResizePointerEnd}
          onResizePointerMove={onResizePointerMove}
          onSelectItem={onSelectItem}
          onStructurePointerDown={onStructurePointerDown}
          onStructurePointerEnd={onStructurePointerEnd}
          onStructurePointerMove={onStructurePointerMove}
          plantingPreview={plantingPreview}
          plotRef={plotRef}
          plotStyle={plotStyle}
          proposalDiffOverlay={proposalDiffOverlay}
          resizingStructureId={resizingStructureId}
          sceneStyle={sceneStyle}
          selectedPlantIds={selectedPlantIds}
          selectedStructureIds={selectedStructureIds}
          showSunLayer={layers.sun}
          snapGuides={snapGuides}
          sunSeason={sunSeason}
          visibleWarnings={visibleWarnings}
          visiblePlantLabelIds={visiblePlantLabelIds}
        />
      </div>
      {layers.miniMap ? (
        <PlanMiniMap
          garden={garden}
          onCollapse={() => updateLayers({ ...layers, miniMap: false })}
        />
      ) : null}
    </div>
  );
});
