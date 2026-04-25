import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react';

const minZoom = 0.35;
const maxZoom = 2;
const zoomStep = 0.15;
const fitViewportInsetPx = 48;

export type CanvasZoomState = 'actual' | 'custom' | 'fit';

export interface CanvasFitBounds {
  framePaddingX: number;
  framePaddingY: number;
  plotHeight: number;
  plotWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}

interface PanState {
  active: boolean;
  lastX: number;
  lastY: number;
}

interface PendingCentering {
  left: number;
  top: number;
}

interface PlotPoint {
  x: number;
  y: number;
}

export function usePlanCanvasView({ isPanMode }: { isPanMode: boolean }) {
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [zoomState, setZoomState] = useState<CanvasZoomState>('actual');
  const animationFrameRef = useRef<number | null>(null);
  const pendingPanDeltaRef = useRef({ x: 0, y: 0 });
  const pendingCenteringRef = useRef<PendingCentering | null>(null);
  const panRef = useRef<PanState | null>(null);
  const scrollportRef = useRef<HTMLDivElement | null>(null);
  const queueCenteredScroll = useCallback(
    (bounds: CanvasFitBounds, nextZoom: number) => {
      pendingCenteringRef.current = getCenteredScroll(bounds, nextZoom);
    },
    [],
  );
  const applyAbsoluteScroll = useCallback((left: number, top: number) => {
    const scrollport = scrollportRef.current;

    if (!scrollport) {
      pendingCenteringRef.current = { left, top };
      return;
    }

    scrollport.scrollLeft = clampScrollValue(
      left,
      scrollport.scrollWidth - scrollport.clientWidth,
    );
    scrollport.scrollTop = clampScrollValue(
      top,
      scrollport.scrollHeight - scrollport.clientHeight,
    );
  }, []);

  useEffect(
    () => () => {
      if (
        animationFrameRef.current !== null &&
        typeof window !== 'undefined' &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    const pendingCentering = pendingCenteringRef.current;

    if (!pendingCentering) {
      return;
    }

    applyAbsoluteScroll(pendingCentering.left, pendingCentering.top);
    pendingCenteringRef.current = null;
  }, [applyAbsoluteScroll, zoom]);

  const zoomIn = useCallback(
    (bounds: CanvasFitBounds | null) => {
      const nextZoom = clampZoom(zoom + zoomStep);

      if (nextZoom === zoom) {
        return;
      }

      pendingCenteringRef.current = getPreservedViewportCentering(
        bounds,
        zoom,
        nextZoom,
        scrollportRef.current,
      );
      setZoom(nextZoom);
      setZoomState('custom');
    },
    [zoom],
  );

  const zoomOut = useCallback(
    (bounds: CanvasFitBounds | null) => {
      const nextZoom = clampZoom(zoom - zoomStep);

      if (nextZoom === zoom) {
        return;
      }

      pendingCenteringRef.current = getPreservedViewportCentering(
        bounds,
        zoom,
        nextZoom,
        scrollportRef.current,
      );
      setZoom(nextZoom);
      setZoomState('custom');
    },
    [zoom],
  );

  const resetView = useCallback(
    (bounds: CanvasFitBounds | null) => {
      if (!bounds) {
        setZoom(1);
        setZoomState('actual');
        applyAbsoluteScroll(0, 0);
        return;
      }

      queueCenteredScroll(bounds, 1);
      setZoom(1);
      setZoomState('actual');
    },
    [applyAbsoluteScroll, queueCenteredScroll],
  );

  const fitView = useCallback(
    (bounds: CanvasFitBounds | null) => {
      if (!bounds) {
        resetView(bounds);
        return;
      }

      const horizontalFit =
        (bounds.viewportWidth - fitViewportInsetPx) / bounds.plotWidth;
      const verticalFit =
        (bounds.viewportHeight - fitViewportInsetPx) / bounds.plotHeight;
      const nextZoom = clampZoom(Math.min(1, horizontalFit, verticalFit));
      const centeredScroll = getCenteredScroll(bounds, nextZoom);

      if (nextZoom === zoom) {
        applyAbsoluteScroll(centeredScroll.left, centeredScroll.top);
        setZoomState('fit');
        return;
      }

      pendingCenteringRef.current = centeredScroll;
      setZoom(nextZoom);
      setZoomState('fit');
    },
    [applyAbsoluteScroll, resetView, zoom],
  );

  const handleViewportWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      const scrollport = scrollportRef.current;

      if (!scrollport || isPanning) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      scrollport.scrollLeft += event.deltaX;
      scrollport.scrollTop += event.deltaY;
    },
    [isPanning],
  );

  function handlePanPointerDown(event: PointerEvent<HTMLDivElement>) {
    const isMiddleButtonPan = event.button === 1;
    const isExplicitPan = isPanMode && event.button === 0;

    if (
      (!isMiddleButtonPan && !isExplicitPan) ||
      shouldIgnorePanTarget(event.target)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    setIsPanning(true);
  }

  function handlePanPointerMove(event: PointerEvent<HTMLDivElement>) {
    const state = panRef.current;

    if (!state?.active) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const deltaX = event.clientX - state.lastX;
    const deltaY = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;

    schedulePanUpdate(deltaX, deltaY);
  }

  function handlePanPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!panRef.current?.active) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    panRef.current = null;
    flushPanDelta();
    setIsPanning(false);
  }

  function schedulePanUpdate(deltaX: number, deltaY: number) {
    setZoomState('custom');
    pendingPanDeltaRef.current = {
      x: pendingPanDeltaRef.current.x + deltaX,
      y: pendingPanDeltaRef.current.y + deltaY,
    };

    if (
      typeof window === 'undefined' ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      flushPanDelta();
      return;
    }

    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      flushPanDelta();
    });
  }

  function flushPanDelta() {
    const delta = pendingPanDeltaRef.current;
    const scrollport = scrollportRef.current;

    if (!scrollport || (delta.x === 0 && delta.y === 0)) {
      return;
    }

    pendingPanDeltaRef.current = { x: 0, y: 0 };
    scrollport.scrollLeft -= delta.x;
    scrollport.scrollTop -= delta.y;
  }

  return {
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
  };
}

function clampZoom(value: number) {
  return Number(Math.min(Math.max(value, minZoom), maxZoom).toFixed(2));
}

function clampScrollValue(value: number, maxValue: number) {
  return Math.min(Math.max(value, 0), Math.max(maxValue, 0));
}

function getCenteredScroll(bounds: CanvasFitBounds, zoom: number) {
  return {
    left:
      bounds.framePaddingX +
      (bounds.plotWidth * zoom) / 2 -
      bounds.viewportWidth / 2,
    top:
      bounds.framePaddingY +
      (bounds.plotHeight * zoom) / 2 -
      bounds.viewportHeight / 2,
  };
}

function getPreservedViewportCentering(
  bounds: CanvasFitBounds | null,
  currentZoom: number,
  nextZoom: number,
  scrollport: HTMLDivElement | null,
) {
  if (!bounds || !scrollport) {
    return null;
  }

  const centerX = scrollport.scrollLeft + scrollport.clientWidth / 2;
  const centerY = scrollport.scrollTop + scrollport.clientHeight / 2;
  const plotPoint = getPlotPointFromViewportCenter(
    bounds,
    centerX,
    centerY,
    currentZoom,
  );

  return {
    left:
      bounds.framePaddingX +
      plotPoint.x * nextZoom -
      scrollport.clientWidth / 2,
    top:
      bounds.framePaddingY +
      plotPoint.y * nextZoom -
      scrollport.clientHeight / 2,
  };
}

function getPlotPointFromViewportCenter(
  bounds: CanvasFitBounds,
  centerX: number,
  centerY: number,
  zoom: number,
): PlotPoint {
  return {
    x: (centerX - bounds.framePaddingX) / zoom,
    y: (centerY - bounds.framePaddingY) / zoom,
  };
}

function shouldIgnorePanTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  return Boolean(
    target.closest(
      [
        'button',
        '[role="button"]',
        'input',
        'select',
        'textarea',
        'a',
        '[data-layer-control="true"]',
        '[data-plan-item="true"]',
        '[data-resize-handle]',
      ].join(', '),
    ),
  );
}
