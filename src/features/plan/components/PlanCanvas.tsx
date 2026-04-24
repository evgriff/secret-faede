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
import { flushSync } from 'react-dom';

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
  resizeStructureRect(update: PlanItemRectUpdate, trackHistory?: boolean): void;
  selectedItems: PlanItemRef[];
  selectedPlantIds: string[];
  selectedStructureIds: string[];
  showSunOverlay: boolean;
  sunSeason: SunSeason;
  updateItemPositions(
    updates: PlanItemPositionUpdate[],
    trackHistory?: boolean,
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
    resizeStructureRect,
    selectedItems,
    updateItemPositions,
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
  } = usePlanCanvasView({ isPanMode });
  const scrollportRef = useRef<HTMLDivElement | null>(null);
  const didFitInitialView = useRef(false);
  const immediateWarnings = useMemo(
    () => planWarnings.filter(isCanvasPlanWarning),
    [planWarnings],
  );
  const isPointerInteractionActive = Boolean(
    pointerInteractions.interactionState !== 'idle' || isPanning,
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
  const syncInteractionState = useCallback(
    (state: PlanPointerInteractionState | 'pan') => {
      flushSync(() => {
        onInteractionStateChange(state);
      });
    },
    [onInteractionStateChange],
  );
  const {
    handleMarqueePointerDown: handleMarqueePointerDownInternal,
    handleMarqueePointerEnd: handleMarqueePointerEndInternal,
    handlePlantPointerDown: handlePlantPointerDownInternal,
    handlePlantPointerEnd: handlePlantPointerEndInternal,
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
        onPointerCancel={handlePanPointerEndCapture}
        onPointerDownCapture={handlePanPointerDownCapture}
        onPointerMove={handlePanPointerMove}
        onPointerUp={handlePanPointerEndCapture}
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
          dragPreviewOffsetsByItemKey={
            pointerInteractions.dragPreviewOffsetsByItemKey
          }
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
          plotStyle={plotStyle}
          proposalDiffOverlay={proposalDiffOverlay}
          resizePreview={pointerInteractions.resizePreview}
          resizingStructureId={pointerInteractions.resizingStructureId}
          sceneStyle={sceneStyle}
          selectedPlantIds={selectedPlantIds}
          selectedStructureIds={selectedStructureIds}
          showSunLayer={layers.sun}
          snapGuides={pointerInteractions.snapGuides}
          sunSeason={sunSeason}
          visibleWarnings={immediateWarnings}
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
