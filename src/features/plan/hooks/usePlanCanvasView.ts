import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';

const minZoom = 0.35;
const maxZoom = 2;
const zoomStep = 0.15;

export type CanvasZoomState = 'actual' | 'custom' | 'fit';

export interface CanvasFitBounds {
  contentHeight: number;
  contentWidth: number;
  viewportHeight: number;
  viewportWidth: number;
}

interface PanState {
  active: boolean;
  lastX: number;
  lastY: number;
}

export function usePlanCanvasView({ isPanMode }: { isPanMode: boolean }) {
  const [isPanning, setIsPanning] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [zoomState, setZoomState] = useState<CanvasZoomState>('actual');
  const animationFrameRef = useRef<number | null>(null);
  const pendingPanDeltaRef = useRef({ x: 0, y: 0 });
  const panRef = useRef<PanState | null>(null);

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

  const zoomIn = useCallback(() => {
    setZoom((value) => clampZoom(value + zoomStep));
    setZoomState('custom');
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((value) => clampZoom(value - zoomStep));
    setZoomState('custom');
  }, []);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setZoomState('actual');
  }, []);

  const fitView = useCallback(
    (bounds: CanvasFitBounds | null) => {
      if (!bounds) {
        resetView();
        return;
      }

      const horizontalFit = (bounds.viewportWidth - 48) / bounds.contentWidth;
      const verticalFit = (bounds.viewportHeight - 48) / bounds.contentHeight;
      const nextZoom = clampZoom(Math.min(1, horizontalFit, verticalFit));

      setPan({ x: 0, y: 0 });
      setZoom(nextZoom);
      setZoomState('fit');
    },
    [resetView],
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

    if (delta.x === 0 && delta.y === 0) {
      return;
    }

    pendingPanDeltaRef.current = { x: 0, y: 0 };
    setPan((current) => ({
      x: current.x + delta.x,
      y: current.y + delta.y,
    }));
  }

  return {
    handlePanPointerDown,
    handlePanPointerEnd,
    handlePanPointerMove,
    isPanning,
    fitView,
    pan,
    resetView,
    zoom,
    zoomIn,
    zoomOut,
    zoomState,
  };
}

function clampZoom(value: number) {
  return Number(Math.min(Math.max(value, minZoom), maxZoom).toFixed(2));
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
