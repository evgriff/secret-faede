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
  SunExposure,
  SunShadeArea,
} from '../../../domain/gardens/GardenRepository';
import { pixelsPerFoot } from '../../garden/gardenMath';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import type { SelectedGardenItem } from '../../garden/useGarden';
import { usePlanCanvasView } from '../hooks/usePlanCanvasView';
import type { ResizeHandle, SnapGuide } from '../planInteractionGeometry';
import type { PlanMode } from '../planModes';
import {
  PlanCanvasControls,
  type PlanCanvasLayers,
} from './PlanCanvasControls';
import { PlanCanvasScene } from './PlanCanvasScene';
import { PlanMiniMap } from './PlanMiniMap';
import styles from './PlanCanvas.module.css';

const emptyPlanWarnings: PlanWarning[] = [];

export const PlanCanvas = memo(function PlanCanvas({
  activeSunLayer,
  draggingPlantId,
  draggingStructureId,
  garden,
  manualSunEdit,
  manualSunExposure,
  mode,
  onPaintSunShadeCell,
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
  planWarnings,
  plotRef,
  marqueeRect,
  resizingStructureId,
  selectedPlantIds,
  selectedStructureIds,
  showSunOverlay,
  snapGuides,
  sunSeason,
}: {
  activeSunLayer: { areas: SunShadeArea[] };
  draggingPlantId: string | null;
  draggingStructureId: string | null;
  garden: Garden;
  manualSunEdit: boolean;
  manualSunExposure: SunExposure;
  mode: PlanMode;
  onPaintSunShadeCell(
    season: SunSeason,
    xFt: number,
    yFt: number,
    exposure: SunExposure,
  ): void;
  onMarqueePointerDown(event: PointerEvent<HTMLDivElement>): void;
  onMarqueePointerEnd(event: PointerEvent<HTMLDivElement>): void;
  onMarqueePointerMove(event: PointerEvent<HTMLDivElement>): void;
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
  planWarnings: PlanWarning[];
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
}) {
  const [layers, setLayers] = useState<PlanCanvasLayers>({
    grid: true,
    labels: true,
    miniMap: false,
    sun: showSunOverlay,
    warnings: false,
  });
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
  } = usePlanCanvasView();
  const scrollportRef = useRef<HTMLDivElement | null>(null);
  const didFitInitialView = useRef(false);
  const visibleWarnings = layers.warnings ? planWarnings : emptyPlanWarnings;
  const fitContentSize = useMemo(
    () => ({
      height: garden.plot.depthFt * pixelsPerFoot + 96,
      width: garden.plot.widthFt * pixelsPerFoot + 96,
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
      } ${layers.grid ? '' : styles.gridHidden} ${
        layers.labels ? '' : styles.labelsHidden
      }`,
    [isPanning, layers.grid, layers.labels, mode],
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
        layers={layers}
        onFitView={handleFitView}
        onLayersChange={updateLayers}
        onResetView={resetView}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        zoom={zoom}
        zoomState={zoomState}
      />
      <div
        className={styles.scrollport}
        data-testid="plot-viewport"
        onPointerCancel={handlePanPointerEnd}
        onPointerDown={handlePanPointerDown}
        onPointerMove={handlePanPointerMove}
        onPointerUp={handlePanPointerEnd}
        ref={scrollportRef}
      >
        <PlanCanvasScene
          activeSunLayer={activeSunLayer}
          draggingPlantId={draggingPlantId}
          draggingStructureId={draggingStructureId}
          garden={garden}
          manualSunEdit={manualSunEdit}
          manualSunExposure={manualSunExposure}
          marqueeRect={marqueeRect}
          mode={mode}
          onMarqueePointerDown={onMarqueePointerDown}
          onMarqueePointerEnd={onMarqueePointerEnd}
          onMarqueePointerMove={onMarqueePointerMove}
          onPaintSunShadeCell={onPaintSunShadeCell}
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
          plotRef={plotRef}
          plotStyle={plotStyle}
          resizingStructureId={resizingStructureId}
          sceneStyle={sceneStyle}
          selectedPlantIds={selectedPlantIds}
          selectedStructureIds={selectedStructureIds}
          showSunLayer={layers.sun}
          snapGuides={snapGuides}
          sunSeason={sunSeason}
          visibleWarnings={visibleWarnings}
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
