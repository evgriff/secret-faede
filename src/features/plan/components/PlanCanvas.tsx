import {
  memo,
  type CSSProperties,
  type PointerEvent,
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
import type {
  GardenPositionUpdateOptions,
  SelectedGardenItem,
} from '../../garden/useGarden';
import {
  usePlanCanvasView,
  type CanvasFitBounds,
} from '../hooks/usePlanCanvasView';
import {
  usePlanPointerInteractions,
  type PlanPointerInteractionState,
} from '../hooks/usePlanPointerInteractions';
import type { PlanInfluenceOverlayModel } from '../planInfluenceOverlay';
import type {
  PlanItemPositionUpdate,
  PlanItemRectUpdate,
  PlanItemRef,
} from '../planInteractionGeometry';
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
  focusedCropKey,
  garden,
  hoveredPlantGroupId,
  influenceOverlay,
  manualSunEdit,
  manualSunExposure,
  mode,
  onCheckpoint,
  onMarqueeSelect,
  onPaintSunShadeCell,
  onPlantHoverChange,
  onPlantLabelHide,
  onPlantEditorOpen,
  onInteractionStateChange,
  onSelectItem,
  onShowSunOverlayChange,
  plantingPreview,
  planWarnings,
  proposalDiffOverlay,
  resizePlantingRect,
  resizeStructureRect,
  selectedItems,
  selectedPlantIds,
  selectedStructureIds,
  showSunOverlay,
  sunSeason,
  updateItemPositions,
  visiblePlantLabelIds,
}: {
  activeSunLayer: { areas: SunShadeArea[] };
  focusedCropKey: string | null;
  garden: Garden;
  hoveredPlantGroupId: string | null;
  influenceOverlay: PlanInfluenceOverlayModel | null;
  manualSunEdit: boolean;
  manualSunExposure: SunExposure;
  mode: PlanMode;
  onCheckpoint(): void;
  onMarqueeSelect(items: PlanItemRef[], additive: boolean): void;
  onPaintSunShadeCell(
    season: SunSeason,
    xFt: number,
    yFt: number,
    exposure: SunExposure,
  ): void;
  onPlantHoverChange(plantId: string | null): void;
  onPlantLabelHide(plantId: string): void;
  onPlantEditorOpen(plantId: string): void;
  onInteractionStateChange(state: PlanPointerInteractionState | 'pan'): void;
  onSelectItem(
    item: SelectedGardenItem,
    additive: boolean,
    options?: { openSurface?: boolean },
  ): void;
  onShowSunOverlayChange(value: boolean): void;
  plantingPreview: Planting | null;
  planWarnings: PlanWarning[];
  proposalDiffOverlay: ProposalDiffOverlayModel | null;
  resizePlantingRect(update: PlanItemRectUpdate, trackHistory?: boolean): void;
  resizeStructureRect(update: PlanItemRectUpdate, trackHistory?: boolean): void;
  selectedItems: PlanItemRef[];
  selectedPlantIds: string[];
  selectedStructureIds: string[];
  showSunOverlay: boolean;
  sunSeason: SunSeason;
  updateItemPositions(
    updates: PlanItemPositionUpdate[],
    trackHistory?: boolean,
    options?: GardenPositionUpdateOptions,
  ): void;
  visiblePlantLabelIds: string[];
}) {
  const [layers, setLayers] = useState<PlanCanvasLayers>({
    grid: true,
    labels: true,
    miniMap: false,
    sun: showSunOverlay,
  });
  const [isPanMode, setIsPanMode] = useState(false);
  const pointerInteractions = usePlanPointerInteractions({
    garden,
    mode,
    onCheckpoint,
    onMarqueeSelect,
    onSelectItem,
    resizePlantingRect,
    resizeStructureRect,
    selectedItems,
    updateItemPositions,
  });
  const {
    fitView,
    handlePanPointerDown,
    handlePanPointerEnd,
    handlePanPointerMove,
    handleViewportWheel,
    isPanning,
    resetView,
    scrollportRef,
    zoom,
    zoomIn,
    zoomOut,
    zoomState,
    zoomToPoint,
  } = usePlanCanvasView({ isPanMode });
  const didFitInitialView = useRef(false);
  const pinchGestureRef = useRef<{
    distance: number;
    zoom: number;
  } | null>(null);
  const immediateWarnings = useMemo(
    () => planWarnings.filter(isCanvasPlanWarning),
    [planWarnings],
  );
  const isPointerInteractionActive = Boolean(
    pointerInteractions.interactionState !== 'idle' || isPanning,
  );
  const plotHeightPx = garden.plot.depthFt * pixelsPerFoot;
  const plotWidthPx = garden.plot.widthFt * pixelsPerFoot;
  const framePadding = useMemo(
    () => ({
      x: Math.max(560, plotWidthPx * 0.8),
      y: Math.max(360, plotHeightPx * 0.8),
    }),
    [plotHeightPx, plotWidthPx],
  );
  const handleFitView = () => {
    didFitInitialView.current = true;
    fitView(
      readCanvasFitBounds(
        scrollportRef.current,
        pointerInteractions.plotRef.current,
      ),
    );
  };
  const handleResetView = () => {
    resetView(
      readCanvasFitBounds(
        scrollportRef.current,
        pointerInteractions.plotRef.current,
      ),
    );
  };
  const handleZoomIn = () => {
    zoomIn(
      readCanvasFitBounds(
        scrollportRef.current,
        pointerInteractions.plotRef.current,
      ),
    );
  };
  const handleZoomOut = () => {
    zoomOut(
      readCanvasFitBounds(
        scrollportRef.current,
        pointerInteractions.plotRef.current,
      ),
    );
  };

  const handleNativeWheel = useCallback(
    (event: WheelEvent) => {
      if (isPointerInteractionActive) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      handleViewportWheel(
        event,
        readCanvasFitBoundsFromRefs(scrollportRef, pointerInteractions.plotRef),
      );
    },
    [
      handleViewportWheel,
      isPointerInteractionActive,
      pointerInteractions.plotRef,
      scrollportRef,
    ],
  );
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (event.touches.length !== 2) {
        pinchGestureRef.current = null;
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (isPointerInteractionActive) {
        pinchGestureRef.current = null;
        return;
      }

      pinchGestureRef.current = {
        distance: getTouchDistance(event.touches),
        zoom,
      };
    },
    [isPointerInteractionActive, zoom],
  );
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      const gesture = pinchGestureRef.current;

      if (event.touches.length === 2) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (!gesture || event.touches.length !== 2) {
        return;
      }

      const distance = getTouchDistance(event.touches);
      const center = getTouchCenter(event.touches);

      zoomToPoint(
        readCanvasFitBoundsFromRefs(scrollportRef, pointerInteractions.plotRef),
        gesture.zoom * (distance / gesture.distance),
        center,
      );
    },
    [pointerInteractions.plotRef, scrollportRef, zoomToPoint],
  );
  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (event.touches.length < 2) {
      pinchGestureRef.current = null;
    }
  }, []);
  const handleNativeGesture = useCallback((event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    const scrollport = scrollportRef.current;

    if (!scrollport) {
      return;
    }

    const listenerOptions: AddEventListenerOptions = {
      capture: true,
      passive: false,
    };

    scrollport.addEventListener('wheel', handleNativeWheel, listenerOptions);
    scrollport.addEventListener(
      'touchstart',
      handleTouchStart,
      listenerOptions,
    );
    scrollport.addEventListener('touchmove', handleTouchMove, listenerOptions);
    scrollport.addEventListener('touchend', handleTouchEnd, listenerOptions);
    scrollport.addEventListener('touchcancel', handleTouchEnd, listenerOptions);
    scrollport.addEventListener(
      'gesturestart',
      handleNativeGesture,
      listenerOptions,
    );
    scrollport.addEventListener(
      'gesturechange',
      handleNativeGesture,
      listenerOptions,
    );
    scrollport.addEventListener(
      'gestureend',
      handleNativeGesture,
      listenerOptions,
    );

    return () => {
      scrollport.removeEventListener('wheel', handleNativeWheel, {
        capture: true,
      });
      scrollport.removeEventListener('touchstart', handleTouchStart, {
        capture: true,
      });
      scrollport.removeEventListener('touchmove', handleTouchMove, {
        capture: true,
      });
      scrollport.removeEventListener('touchend', handleTouchEnd, {
        capture: true,
      });
      scrollport.removeEventListener('touchcancel', handleTouchEnd, {
        capture: true,
      });
      scrollport.removeEventListener('gesturestart', handleNativeGesture, {
        capture: true,
      });
      scrollport.removeEventListener('gesturechange', handleNativeGesture, {
        capture: true,
      });
      scrollport.removeEventListener('gestureend', handleNativeGesture, {
        capture: true,
      });
    };
  }, [
    handleNativeGesture,
    handleNativeWheel,
    handleTouchEnd,
    handleTouchMove,
    handleTouchStart,
    scrollportRef,
  ]);

  const workbenchStyle = useMemo(
    () =>
      ({
        '--cell-size': `${pixelsPerFoot}px`,
        '--canvas-zoom': String(zoom),
        '--frame-padding-x': `${framePadding.x}px`,
        '--frame-padding-y': `${framePadding.y}px`,
        '--plot-height': `${plotHeightPx}px`,
        '--plot-width': `${plotWidthPx}px`,
      }) as CSSProperties,
    [framePadding.x, framePadding.y, plotHeightPx, plotWidthPx, zoom],
  );
  const sceneStyle = useMemo(
    () =>
      ({
        transform: `scale(${zoom})`,
      }) as CSSProperties,
    [zoom],
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
      didFitInitialView.current = true;
      fitView(
        readCanvasFitBounds(
          scrollportRef.current,
          pointerInteractions.plotRef.current,
        ),
      );
    }
  }, [
    fitView,
    garden.plot.depthFt,
    garden.plot.widthFt,
    pointerInteractions.plotRef,
    scrollportRef,
    zoomState,
  ]);

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
      fitView(
        readCanvasFitBounds(
          scrollportRef.current,
          pointerInteractions.plotRef.current,
        ),
      );
    });

    observer.observe(viewport);

    return () => observer.disconnect();
  }, [
    fitView,
    garden.plot.depthFt,
    garden.plot.widthFt,
    pointerInteractions.plotRef,
    scrollportRef,
    zoomState,
  ]);

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
  const syncInteractionState = useCallback(
    (state: PlanPointerInteractionState | 'pan') => {
      onInteractionStateChange(state);
    },
    [onInteractionStateChange],
  );
  const {
    handleMarqueePointerDown: handleMarqueePointerDownInternal,
    handleMarqueePointerEnd: handleMarqueePointerEndInternal,
    handlePlantPointerDown: handlePlantPointerDownInternal,
    handlePlantPointerEnd: handlePlantPointerEndInternal,
    handlePlantResizePointerDown: handlePlantResizePointerDownInternal,
    handleResizePointerDown: handleResizePointerDownInternal,
    handleResizePointerEnd: handleResizePointerEndInternal,
    handleStructurePointerDown: handleStructurePointerDownInternal,
    handleStructurePointerEnd: handleStructurePointerEndInternal,
  } = pointerInteractions;
  const handlePanPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (isPanMode) {
        syncInteractionState('pan');
      }

      handlePanPointerDown(event);
    },
    [handlePanPointerDown, isPanMode, syncInteractionState],
  );
  const handlePanPointerEndCapture = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      handlePanPointerEnd(event);
      syncInteractionState('idle');
    },
    [handlePanPointerEnd, syncInteractionState],
  );
  const handleMarqueePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      syncInteractionState('press');
      handleMarqueePointerDownInternal(event);
    },
    [handleMarqueePointerDownInternal, syncInteractionState],
  );
  const handleMarqueePointerEnd = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      handleMarqueePointerEndInternal(event);
      syncInteractionState('idle');
    },
    [handleMarqueePointerEndInternal, syncInteractionState],
  );
  const handlePlantPointerDown = useCallback(
    (
      event: PointerEvent<HTMLButtonElement>,
      plantId: string,
      instanceId?: string,
    ) => {
      syncInteractionState('press');
      handlePlantPointerDownInternal(event, plantId, instanceId);
    },
    [handlePlantPointerDownInternal, syncInteractionState],
  );
  const handlePlantPointerEnd = useCallback(
    (
      event: PointerEvent<HTMLButtonElement>,
      plantId: string,
      instanceId?: string,
    ) => {
      handlePlantPointerEndInternal(event, plantId, instanceId);
      syncInteractionState('idle');
    },
    [handlePlantPointerEndInternal, syncInteractionState],
  );
  const handleResizePointerDown = useCallback(
    (
      event: PointerEvent<HTMLSpanElement>,
      structureId: string,
      handle: Parameters<typeof handleResizePointerDownInternal>[2],
    ) => {
      syncInteractionState('press');
      handleResizePointerDownInternal(event, structureId, handle);
    },
    [handleResizePointerDownInternal, syncInteractionState],
  );
  const handlePlantResizePointerDown = useCallback(
    (
      event: PointerEvent<HTMLSpanElement>,
      plantId: string,
      handle: Parameters<typeof handlePlantResizePointerDownInternal>[2],
    ) => {
      syncInteractionState('press');
      handlePlantResizePointerDownInternal(event, plantId, handle);
    },
    [handlePlantResizePointerDownInternal, syncInteractionState],
  );
  const handleResizePointerEnd = useCallback(
    (event: PointerEvent<HTMLSpanElement>) => {
      handleResizePointerEndInternal(event);
      syncInteractionState('idle');
    },
    [handleResizePointerEndInternal, syncInteractionState],
  );
  const handleStructurePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, structureId: string) => {
      syncInteractionState('press');
      handleStructurePointerDownInternal(event, structureId);
    },
    [handleStructurePointerDownInternal, syncInteractionState],
  );
  const handleStructurePointerEnd = useCallback(
    (event: PointerEvent<HTMLDivElement>, structureId: string) => {
      handleStructurePointerEndInternal(event, structureId);
      syncInteractionState('idle');
    },
    [handleStructurePointerEndInternal, syncInteractionState],
  );

  return (
    <div className={viewportClassName}>
      <PlanCanvasControls
        isPanMode={isPanMode}
        layers={layers}
        onFitView={handleFitView}
        onLayersChange={updateLayers}
        onPanModeChange={setIsPanMode}
        onResetView={handleResetView}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        zoom={zoom}
        zoomState={zoomState}
      />
      <div
        className={styles.scrollport}
        data-interaction-active={isPointerInteractionActive ? 'true' : 'false'}
        data-pan-mode={isPanMode ? 'true' : 'false'}
        data-plan-scrollport="true"
        data-testid="plot-viewport"
        onPointerCancel={handlePanPointerEndCapture}
        onPointerDownCapture={handlePanPointerDownCapture}
        onPointerMove={handlePanPointerMove}
        onPointerUp={handlePanPointerEndCapture}
        ref={scrollportRef}
      >
        <PlanCanvasScene
          activeSunLayer={activeSunLayer}
          draggingPlantId={pointerInteractions.draggingPlantId}
          draggingStructureId={pointerInteractions.draggingStructureId}
          focusedCropKey={focusedCropKey}
          garden={garden}
          hoveredPlantGroupId={hoveredPlantGroupId}
          influenceOverlay={influenceOverlay}
          manualSunEdit={manualSunEdit}
          manualSunExposure={manualSunExposure}
          marqueeRect={pointerInteractions.marqueeRect}
          onMarqueePointerDown={handleMarqueePointerDown}
          onMarqueePointerEnd={handleMarqueePointerEnd}
          onMarqueePointerMove={pointerInteractions.handleMarqueePointerMove}
          onPaintSunShadeCell={onPaintSunShadeCell}
          onPlantEditorOpen={onPlantEditorOpen}
          onPlantHoverChange={onPlantHoverChange}
          onPlantLabelHide={onPlantLabelHide}
          onPlantPointerDown={handlePlantPointerDown}
          onPlantPointerEnd={handlePlantPointerEnd}
          onPlantPointerMove={pointerInteractions.handlePlantPointerMove}
          onPlantResizePointerDown={handlePlantResizePointerDown}
          onResizePointerDown={handleResizePointerDown}
          onResizePointerEnd={handleResizePointerEnd}
          onResizePointerMove={pointerInteractions.handleResizePointerMove}
          onSelectItem={onSelectItem}
          onStructurePointerDown={handleStructurePointerDown}
          onStructurePointerEnd={handleStructurePointerEnd}
          onStructurePointerMove={
            pointerInteractions.handleStructurePointerMove
          }
          plantingPreview={plantingPreview}
          plotRef={pointerInteractions.plotRef}
          plotStyle={workbenchStyle}
          proposalDiffOverlay={proposalDiffOverlay}
          resizingPlantId={pointerInteractions.resizingPlantId}
          resizingStructureId={pointerInteractions.resizingStructureId}
          sceneStyle={sceneStyle}
          selectedPlantIds={selectedPlantIds}
          selectedStructureIds={selectedStructureIds}
          showSunLayer={layers.sun}
          sunSeason={sunSeason}
          visibleWarnings={immediateWarnings}
          visiblePlantLabelIds={visiblePlantLabelIds}
          workbenchStyle={workbenchStyle}
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

function getElementOffsetWithinAncestor(
  element: HTMLElement,
  ancestor: HTMLElement,
) {
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = element;

  while (current && current !== ancestor) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  return { left, top };
}

function readCanvasFitBounds(
  viewport: HTMLDivElement | null,
  plot: HTMLDivElement | null,
): CanvasFitBounds | null {
  if (!viewport || !plot) {
    return null;
  }

  const plotOffset = getElementOffsetWithinAncestor(plot, viewport);

  return {
    framePaddingX: plotOffset.left,
    framePaddingY: plotOffset.top,
    plotHeight: plot.clientHeight,
    plotWidth: plot.clientWidth,
    viewportHeight: viewport.clientHeight,
    viewportWidth: viewport.clientWidth,
  };
}

function readCanvasFitBoundsFromRefs(
  viewportRef: { current: HTMLDivElement | null },
  plotRef: { current: HTMLDivElement | null },
) {
  return readCanvasFitBounds(viewportRef.current, plotRef.current);
}

function getTouchDistance(touches: TouchList) {
  const first = touches.item(0);
  const second = touches.item(1);

  if (!first || !second) {
    return 1;
  }

  return Math.hypot(
    first.clientX - second.clientX,
    first.clientY - second.clientY,
  );
}

function getTouchCenter(touches: TouchList) {
  const first = touches.item(0);
  const second = touches.item(1);

  if (!first || !second) {
    return { clientX: 0, clientY: 0 };
  }

  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
  };
}
