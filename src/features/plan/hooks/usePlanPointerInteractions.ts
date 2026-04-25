import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react';

import type { Garden } from '../../../domain/gardens/GardenRepository';
import {
  canManuallyMovePlanting,
  canManuallyMoveStructure,
} from '../../garden/gardenImmutability';
import {
  clientPointToPlotFeet,
  pixelsPerFoot,
  type PlotClientRect,
  type PlotPoint,
} from '../../garden/gardenMath';
import type {
  GardenPositionUpdateOptions,
  SelectedGardenItem,
} from '../../garden/useGarden';
import type { PlanMode } from '../planModes';
import {
  areSamePlanItem,
  calculateResizeRect,
  getPlanItemKey,
  getItemPointFromRect,
  getItemRect,
  getItemsInRect,
  rectFromPoints,
  rectFromItemPoint,
  snapItemPoint,
  snapResizeRect,
  type PlanItemPositionUpdate,
  type PlanPreviewOffset,
  type PlanItemRectUpdate,
  type PlanItemRef,
  type ResizeHandle,
  type SnapGuide,
} from '../planInteractionGeometry';

type ItemRect = NonNullable<ReturnType<typeof getItemRect>>;

type DragState = {
  checkpointed: boolean;
  item: PlanItemRef;
  moved: boolean;
  originalPoints: PlanItemPositionUpdate[];
  originalRects: Array<{ item: PlanItemRef; rect: ItemRect }>;
  plotRect: PlotClientRect;
  pointerOffset: PlotPoint;
  scrollLock: ScrollLock | null;
  selection: PlanItemRef[];
  sourceRect: ItemRect;
  startClientX: number;
  startClientY: number;
};

type ResizeState = {
  checkpointed: boolean;
  handle: ResizeHandle;
  moved: boolean;
  originalRect: ItemRect;
  plotRect: PlotClientRect;
  scrollLock: ScrollLock | null;
  startClientX: number;
  startClientY: number;
  structureId: string;
};

type MarqueeState = {
  additive: boolean;
  moved: boolean;
  plotRect: PlotClientRect;
  scrollLock: ScrollLock | null;
  start: PlotPoint;
  startClientX: number;
  startClientY: number;
};

type ItemPressState = {
  additive: boolean;
  item: PlanItemRef;
  moved: boolean;
  startClientX: number;
  startClientY: number;
};

type ScrollLock = {
  element: HTMLElement;
  release(): void;
  scrollLeft: number;
  scrollTop: number;
};

type PlanPointerInteractionContext = {
  garden: Garden | null;
  mode: PlanMode;
  onCheckpoint(): void;
  onMarqueeSelect(items: PlanItemRef[], additive: boolean): void;
  onSelectItem(
    item: SelectedGardenItem,
    additive: boolean,
    options?: { openSurface?: boolean },
  ): void;
  resizeStructureRect(update: PlanItemRectUpdate, trackHistory?: boolean): void;
  selectedItems: PlanItemRef[];
  updateItemPositions(
    updates: PlanItemPositionUpdate[],
    trackHistory?: boolean,
    options?: GardenPositionUpdateOptions,
  ): void;
};

type PlanPointerInteractionHandlers = {
  handleMarqueePointerDown(event: PointerEvent<HTMLDivElement>): void;
  handleMarqueePointerEnd(event: PointerEvent<HTMLDivElement>): void;
  handleMarqueePointerMove(event: PointerEvent<HTMLDivElement>): void;
  handlePlantPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
    instanceId?: string,
  ): void;
  handlePlantPointerEnd(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
    instanceId?: string,
  ): void;
  handlePlantPointerMove(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
    instanceId?: string,
  ): void;
  handleResizePointerDown(
    event: PointerEvent<HTMLSpanElement>,
    structureId: string,
    handle: ResizeHandle,
  ): void;
  handleResizePointerEnd(event: PointerEvent<HTMLSpanElement>): void;
  handleResizePointerMove(event: PointerEvent<HTMLSpanElement>): void;
  handleStructurePointerDown(
    event: PointerEvent<HTMLDivElement>,
    structureId: string,
  ): void;
  handleStructurePointerEnd(
    event: PointerEvent<HTMLDivElement>,
    structureId: string,
  ): void;
  handleStructurePointerMove(
    event: PointerEvent<HTMLDivElement>,
    structureId: string,
  ): void;
};

type DragPreview = {
  guides: SnapGuide[];
  hasChanged: boolean;
  offsetsByItemKey: Record<string, PlanPreviewOffset>;
  updates: PlanItemPositionUpdate[];
};

type ResizePreview = {
  guides: SnapGuide[];
  hasChanged: boolean;
  rect: ItemRect;
  update: PlanItemRectUpdate;
};

type InteractionPreviewState = {
  dragOffsetsByItemKey: Record<string, PlanPreviewOffset>;
  resizePreview: {
    rect: ItemRect;
    structureId: string;
  } | null;
  snapGuides: SnapGuide[];
};

const emptyInteractionPreviewState: InteractionPreviewState = {
  dragOffsetsByItemKey: {},
  resizePreview: null,
  snapGuides: [],
};

export type PlanPointerInteractionState =
  | 'drag'
  | 'idle'
  | 'marquee'
  | 'press'
  | 'resize';

export function usePlanPointerInteractions({
  garden,
  mode,
  onCheckpoint,
  onMarqueeSelect,
  onSelectItem,
  resizeStructureRect,
  selectedItems,
  updateItemPositions,
}: {
  garden: Garden | null;
  mode: PlanMode;
  onCheckpoint(): void;
  onMarqueeSelect(items: PlanItemRef[], additive: boolean): void;
  onSelectItem(
    item: SelectedGardenItem,
    additive: boolean,
    options?: { openSurface?: boolean },
  ): void;
  resizeStructureRect(update: PlanItemRectUpdate, trackHistory?: boolean): void;
  selectedItems: PlanItemRef[];
  updateItemPositions(
    updates: PlanItemPositionUpdate[],
    trackHistory?: boolean,
    options?: GardenPositionUpdateOptions,
  ): void;
}) {
  const [draggingPlantId, setDraggingPlantId] = useState<string | null>(null);
  const [draggingStructureId, setDraggingStructureId] = useState<string | null>(
    null,
  );
  const [marqueeRect, setMarqueeRect] = useState<ReturnType<
    typeof rectFromPoints
  > | null>(null);
  const [resizingStructureId, setResizingStructureId] = useState<string | null>(
    null,
  );
  const [interactionState, setInteractionState] =
    useState<PlanPointerInteractionState>('idle');
  const [interactionPreviewState, setInteractionPreviewState] =
    useState<InteractionPreviewState>(emptyInteractionPreviewState);
  const dragStateRef = useRef<DragState | null>(null);
  const dragPreviewRef = useRef<DragPreview | null>(null);
  const itemPressRef = useRef<ItemPressState | null>(null);
  const marqueeStateRef = useRef<MarqueeState | null>(null);
  const pendingPreviewStateRef = useRef<InteractionPreviewState>(
    emptyInteractionPreviewState,
  );
  const previewFrameRef = useRef<number | null>(null);
  const resizePreviewRef = useRef<ResizePreview | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<PlanPointerInteractionContext>({
    garden,
    mode,
    onCheckpoint,
    onMarqueeSelect,
    onSelectItem,
    resizeStructureRect,
    selectedItems,
    updateItemPositions,
  });

  useEffect(
    () => () => {
      if (
        previewFrameRef.current !== null &&
        typeof cancelAnimationFrame === 'function'
      ) {
        cancelAnimationFrame(previewFrameRef.current);
      }
    },
    [],
  );

  useLayoutEffect(() => {
    contextRef.current = {
      garden,
      mode,
      onCheckpoint,
      onMarqueeSelect,
      onSelectItem,
      resizeStructureRect,
      selectedItems,
      updateItemPositions,
    };
  }, [
    garden,
    mode,
    onCheckpoint,
    onMarqueeSelect,
    onSelectItem,
    resizeStructureRect,
    selectedItems,
    updateItemPositions,
  ]);

  function queueInteractionPreview(nextState: InteractionPreviewState) {
    pendingPreviewStateRef.current = nextState;

    if (previewFrameRef.current !== null) {
      return;
    }

    if (typeof requestAnimationFrame !== 'function') {
      setInteractionPreviewState(nextState);
      return;
    }

    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      setInteractionPreviewState(pendingPreviewStateRef.current);
    });
  }

  function clearInteractionPreview() {
    dragPreviewRef.current = null;
    itemPressRef.current = null;
    resizePreviewRef.current = null;
    pendingPreviewStateRef.current = emptyInteractionPreviewState;

    if (
      previewFrameRef.current !== null &&
      typeof cancelAnimationFrame === 'function'
    ) {
      cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }

    setInteractionPreviewState(emptyInteractionPreviewState);
  }

  function syncDragPreviewState(preview: DragPreview) {
    queueInteractionPreview({
      dragOffsetsByItemKey: preview.hasChanged ? preview.offsetsByItemKey : {},
      resizePreview: null,
      snapGuides: preview.hasChanged ? preview.guides : [],
    });
  }

  function syncResizePreviewState(preview: ResizePreview, structureId: string) {
    queueInteractionPreview({
      dragOffsetsByItemKey: {},
      resizePreview: preview.hasChanged
        ? {
            rect: preview.rect,
            structureId,
          }
        : null,
      snapGuides: preview.hasChanged ? preview.guides : [],
    });
  }

  function buildDragPreview(
    event: PointerEvent<HTMLElement>,
    dragState: DragState,
    currentGarden: Garden,
  ): DragPreview {
    const pointerPoint = clientPointToPlotFeet(
      event,
      dragState.plotRect,
      currentGarden.plot,
    );
    const nextPoint = {
      xFt: pointerPoint.xFt - dragState.pointerOffset.xFt,
      yFt: pointerPoint.yFt - dragState.pointerOffset.yFt,
    };
    const snapResult = snapItemPoint({
      freeMove: event.altKey,
      garden: currentGarden,
      item: dragState.item,
      point: nextPoint,
      sourceRect: dragState.sourceRect,
      snap: true,
      snapExclusions: dragState.selection,
    });
    const sourcePoint =
      dragState.originalPoints.find((point) =>
        areSamePlanItem(point, dragState.item),
      ) ?? dragState.originalPoints[0];

    if (!sourcePoint) {
      return {
        guides: [],
        hasChanged: false,
        offsetsByItemKey: {},
        updates: dragState.originalPoints,
      };
    }

    const delta = {
      xFt: snapResult.point.xFt - sourcePoint.xFt,
      yFt: snapResult.point.yFt - sourcePoint.yFt,
    };
    const updates = dragState.originalPoints.map((point) => ({
      ...point,
      xFt: roundFeet(point.xFt + delta.xFt),
      yFt: roundFeet(point.yFt + delta.yFt),
    }));
    const updatesByKey = new Map(
      updates.map((update) => [getPlanItemKey(update), update]),
    );
    const offsetsByItemKey = dragState.originalRects.reduce<
      Record<string, PlanPreviewOffset>
    >((offsets, entry) => {
      const nextPoint = updatesByKey.get(getPlanItemKey(entry.item));

      if (!nextPoint) {
        return offsets;
      }

      const previewRect = rectFromItemPoint(entry.item, nextPoint, entry.rect);
      const xPx = roundPixels(
        (previewRect.xFt - entry.rect.xFt) * pixelsPerFoot,
      );
      const yPx = roundPixels(
        (previewRect.yFt - entry.rect.yFt) * pixelsPerFoot,
      );

      if (xPx === 0 && yPx === 0) {
        return offsets;
      }

      offsets[getPlanItemKey(entry.item)] = { xPx, yPx };
      return offsets;
    }, {});
    const hasChanged = updates.some((update, index) => {
      const original = dragState.originalPoints[index];

      return (
        original && (update.xFt !== original.xFt || update.yFt !== original.yFt)
      );
    });

    return {
      guides: event.altKey ? [] : snapResult.guides,
      hasChanged,
      offsetsByItemKey,
      updates,
    };
  }

  function buildResizePreview(
    event: PointerEvent<HTMLSpanElement>,
    resizeState: ResizeState,
    currentGarden: Garden,
  ): ResizePreview {
    const point = clientPointToPlotFeet(
      event,
      resizeState.plotRect,
      currentGarden.plot,
    );
    const baseRect = calculateResizeRect({
      currentPoint: point,
      garden: currentGarden,
      handle: resizeState.handle,
      originalRect: resizeState.originalRect,
    });
    const snapResult = snapResizeRect({
      freeMove: event.altKey,
      garden: currentGarden,
      handle: resizeState.handle,
      rect: baseRect,
      snapExclusions: [{ id: resizeState.structureId, type: 'structure' }],
    });

    return {
      guides: event.altKey ? [] : snapResult.guides,
      hasChanged: !areRectsEqual(snapResult.rect, resizeState.originalRect),
      rect: snapResult.rect,
      update: {
        depthFt: snapResult.rect.depthFt,
        id: resizeState.structureId,
        type: 'structure',
        widthFt: snapResult.rect.widthFt,
        xFt: snapResult.rect.xFt,
        yFt: snapResult.rect.yFt,
      },
    };
  }

  function beginItemDrag(event: PointerEvent<HTMLElement>, item: PlanItemRef) {
    const { garden, selectedItems } = contextRef.current;

    event.preventDefault();
    event.stopPropagation();
    itemPressRef.current = {
      additive: event.shiftKey,
      item,
      moved: false,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    setInteractionState('press');

    if (!garden || event.shiftKey || isItemLocked(garden, item)) {
      return;
    }

    const rect = getFrozenPlotRect(plotRef.current);
    const sourceRect = getItemRect(garden, item);

    if (!rect || !sourceRect) {
      return;
    }

    const scrollLock = captureScrollLock(event.currentTarget);
    const pointerPoint = clientPointToPlotFeet(event, rect, garden.plot);
    const itemPoint = getItemPointFromRect(item, sourceRect);
    const dragSelection =
      selectedItems.some((selected) => areSamePlanItem(selected, item)) &&
      selectedItems.length > 1
        ? selectedItems.filter(
            (selectedItem) => !isItemLocked(garden, selectedItem),
          )
        : [item];
    const originalRects = dragSelection.flatMap((selectedItem) => {
      const selectedRect = getItemRect(garden, selectedItem);

      if (!selectedRect) {
        return [];
      }

      return [{ item: selectedItem, rect: selectedRect }];
    });
    const originalPoints = originalRects.map(
      ({ item: selectedItem, rect }) => ({
        ...selectedItem,
        ...getItemPointFromRect(selectedItem, rect),
      }),
    );

    if (originalPoints.length === 0) {
      releaseScrollLock(scrollLock);
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStateRef.current = {
      checkpointed: false,
      item,
      moved: false,
      originalPoints,
      originalRects,
      plotRect: rect,
      pointerOffset: {
        xFt: pointerPoint.xFt - itemPoint.xFt,
        yFt: pointerPoint.yFt - itemPoint.yFt,
      },
      scrollLock,
      selection: dragSelection,
      sourceRect,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
  }

  function continueItemDrag(
    event: PointerEvent<HTMLElement>,
    item: PlanItemRef,
  ) {
    const { garden, onCheckpoint } = contextRef.current;

    if (!garden) {
      return;
    }

    const dragState = dragStateRef.current;

    if (!dragState || !areSamePlanItem(dragState.item, item)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    restoreScrollLock(dragState.scrollLock);

    const wasMoved = dragState.moved;

    if (!markMoved(event, dragState)) {
      const pressState = itemPressRef.current;

      if (pressState && areSamePlanItem(pressState.item, item)) {
        markMoved(event, pressState);
      }

      return;
    }

    if (!wasMoved) {
      setInteractionState('drag');
      if (item.type === 'planting') {
        setDraggingPlantId(item.instanceId ?? item.id);
      } else {
        setDraggingStructureId(item.id);
      }
    }

    const preview = buildDragPreview(event, dragState, garden);

    dragPreviewRef.current = preview;
    restoreScrollLock(dragState.scrollLock);
    syncDragPreviewState(preview);

    if (preview.hasChanged) {
      checkpointDrag(dragState, onCheckpoint);
    }
  }

  function endItemDrag(event: PointerEvent<HTMLElement>, item: PlanItemRef) {
    const { garden, onCheckpoint, onSelectItem, updateItemPositions } =
      contextRef.current;
    const dragState = dragStateRef.current;
    const pressState = itemPressRef.current;

    if (
      !garden ||
      ((!dragState || !areSamePlanItem(dragState.item, item)) &&
        (!pressState || !areSamePlanItem(pressState.item, item)))
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const canceled = event.type === 'pointercancel';

    if (!canceled && dragState?.moved) {
      const preview = buildDragPreview(event, dragState, garden);

      dragPreviewRef.current = preview;

      if (preview.hasChanged) {
        checkpointDrag(dragState, onCheckpoint);
        updateItemPositions(preview.updates, false, { saveAfterCommit: true });
      }

      if (dragState.selection.length === 1) {
        onSelectItem(item, false, { openSurface: false });
      }
    } else if (!canceled && pressState && !pressState.moved) {
      onSelectItem(item, pressState.additive, { openSurface: true });
    }

    restoreScrollLock(dragState?.scrollLock ?? null);
    restoreScrollLockAfterPaint(dragState?.scrollLock ?? null);
    releaseScrollLock(dragState?.scrollLock ?? null);
    releasePointerCapture(event);
    dragStateRef.current = null;
    setDraggingPlantId(null);
    setDraggingStructureId(null);
    setInteractionState('idle');
    clearInteractionPreview();
  }

  function beginResize(
    event: PointerEvent<HTMLSpanElement>,
    structureId: string,
    handle: ResizeHandle,
  ) {
    const { garden } = contextRef.current;

    event.preventDefault();
    event.stopPropagation();
    setInteractionState('press');

    if (
      !garden ||
      isItemLocked(garden, { id: structureId, type: 'structure' })
    ) {
      return;
    }

    const plotRect = getFrozenPlotRect(plotRef.current);
    const originalRect = getItemRect(garden, {
      id: structureId,
      type: 'structure',
    });

    if (!plotRect || !originalRect) {
      return;
    }

    const scrollLock = captureScrollLock(event.currentTarget);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeStateRef.current = {
      checkpointed: false,
      handle,
      moved: false,
      originalRect,
      plotRect,
      scrollLock,
      startClientX: event.clientX,
      startClientY: event.clientY,
      structureId,
    };
  }

  function continueResize(event: PointerEvent<HTMLSpanElement>) {
    const { garden, onCheckpoint } = contextRef.current;

    if (!garden || !resizeStateRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    restoreScrollLock(resizeStateRef.current.scrollLock);

    const wasMoved = resizeStateRef.current.moved;

    if (!markMoved(event, resizeStateRef.current)) {
      return;
    }

    if (!wasMoved) {
      setInteractionState('resize');
      setResizingStructureId(resizeStateRef.current.structureId);
    }

    const preview = buildResizePreview(event, resizeStateRef.current, garden);

    resizePreviewRef.current = preview;
    restoreScrollLock(resizeStateRef.current.scrollLock);
    syncResizePreviewState(preview, resizeStateRef.current.structureId);

    if (preview.hasChanged && !resizeStateRef.current.checkpointed) {
      onCheckpoint();
      resizeStateRef.current.checkpointed = true;
    }
  }

  function endResize(event: PointerEvent<HTMLSpanElement>) {
    const { garden, onCheckpoint, onSelectItem, resizeStructureRect } =
      contextRef.current;

    if (!garden || !resizeStateRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const canceled = event.type === 'pointercancel';

    const preview = buildResizePreview(event, resizeStateRef.current, garden);

    resizePreviewRef.current = preview;

    if (!canceled && preview.hasChanged) {
      if (!resizeStateRef.current.checkpointed) {
        onCheckpoint();
        resizeStateRef.current.checkpointed = true;
      }

      resizeStructureRect(preview.update, false);
    }

    if (!canceled) {
      onSelectItem(
        { id: resizeStateRef.current.structureId, type: 'structure' },
        false,
        { openSurface: false },
      );
    }

    restoreScrollLock(resizeStateRef.current.scrollLock);
    restoreScrollLockAfterPaint(resizeStateRef.current.scrollLock);
    releaseScrollLock(resizeStateRef.current.scrollLock);
    releasePointerCapture(event);
    resizeStateRef.current = null;
    setResizingStructureId(null);
    setInteractionState('idle');
    clearInteractionPreview();
  }

  function beginMarquee(event: PointerEvent<HTMLDivElement>) {
    const { garden, mode } = contextRef.current;

    if (mode !== 'select' || !garden) {
      return;
    }

    if (event.pointerType === 'touch') {
      return;
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest('[data-plan-item="true"]')
    ) {
      return;
    }

    const rect = getFrozenPlotRect(plotRef.current);

    if (!rect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const scrollLock = captureScrollLock(event.currentTarget);
    const start = clientPointToPlotFeet(event, rect, garden.plot);
    marqueeStateRef.current = {
      additive: event.shiftKey,
      moved: false,
      plotRect: rect,
      scrollLock,
      start,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    setInteractionState('press');
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function continueMarquee(event: PointerEvent<HTMLDivElement>) {
    const { garden } = contextRef.current;

    if (!garden || !marqueeStateRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    restoreScrollLock(marqueeStateRef.current.scrollLock);

    if (!markMoved(event, marqueeStateRef.current)) {
      return;
    }

    setInteractionState('marquee');
    setMarqueeRect(
      rectFromPoints(
        marqueeStateRef.current.start,
        clientPointToPlotFeet(
          event,
          marqueeStateRef.current.plotRect,
          garden.plot,
        ),
      ),
    );
  }

  function endMarquee(event: PointerEvent<HTMLDivElement>) {
    const { garden, onMarqueeSelect } = contextRef.current;

    if (!garden || !marqueeStateRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const canceled = event.type === 'pointercancel';
    const state = marqueeStateRef.current;

    restoreScrollLock(state.scrollLock);
    restoreScrollLockAfterPaint(state.scrollLock);
    releaseScrollLock(state.scrollLock);

    if (!canceled && state.moved) {
      const selectionRect = rectFromPoints(
        state.start,
        clientPointToPlotFeet(event, state.plotRect, garden.plot),
      );
      onMarqueeSelect(getItemsInRect(garden, selectionRect), state.additive);
    } else if (!canceled) {
      onMarqueeSelect([], false);
    }

    releasePointerCapture(event);
    marqueeStateRef.current = null;
    setMarqueeRect(null);
    setInteractionState('idle');
  }

  // The wrappers stay stable for memoized canvas items; the helpers read latest state from contextRef.
  const stableHandlers = useMemo<PlanPointerInteractionHandlers>(
    () => ({
      handleMarqueePointerDown(event) {
        beginMarquee(event);
      },
      handleMarqueePointerEnd(event) {
        endMarquee(event);
      },
      handleMarqueePointerMove(event) {
        continueMarquee(event);
      },
      handlePlantPointerDown(event, plantId, instanceId) {
        beginItemDrag(event, createPlantingRef(plantId, instanceId));
      },
      handlePlantPointerEnd(event, plantId, instanceId) {
        endItemDrag(event, createPlantingRef(plantId, instanceId));
      },
      handlePlantPointerMove(event, plantId, instanceId) {
        continueItemDrag(event, createPlantingRef(plantId, instanceId));
      },
      handleResizePointerDown(event, structureId, handle) {
        beginResize(event, structureId, handle);
      },
      handleResizePointerEnd(event) {
        endResize(event);
      },
      handleResizePointerMove(event) {
        continueResize(event);
      },
      handleStructurePointerDown(event, structureId) {
        beginItemDrag(event, { id: structureId, type: 'structure' });
      },
      handleStructurePointerEnd(event, structureId) {
        endItemDrag(event, { id: structureId, type: 'structure' });
      },
      handleStructurePointerMove(event, structureId) {
        continueItemDrag(event, { id: structureId, type: 'structure' });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    dragPreviewOffsetsByItemKey: interactionPreviewState.dragOffsetsByItemKey,
    draggingPlantId,
    draggingStructureId,
    ...stableHandlers,
    interactionState,
    marqueeRect,
    plotRef,
    resizePreview: interactionPreviewState.resizePreview,
    resizingStructureId,
    snapGuides: interactionPreviewState.snapGuides,
  };
}

function createPlantingRef(plantId: string, instanceId?: string): PlanItemRef {
  return instanceId
    ? { id: plantId, instanceId, type: 'planting' }
    : { id: plantId, type: 'planting' };
}

function markMoved(
  event: PointerEvent<HTMLElement>,
  state: {
    moved?: boolean;
    startClientX: number;
    startClientY: number;
  },
) {
  const threshold = event.pointerType === 'touch' ? 8 : 3;
  const hasMoved =
    Math.abs(event.clientX - state.startClientX) > threshold ||
    Math.abs(event.clientY - state.startClientY) > threshold;

  if (!hasMoved && !state.moved) {
    return false;
  }

  state.moved = true;
  return true;
}

function checkpointDrag(dragState: DragState, onCheckpoint: () => void) {
  if (dragState.checkpointed) {
    return;
  }

  onCheckpoint();
  dragState.checkpointed = true;
}

function isItemLocked(garden: Garden, item: PlanItemRef) {
  return item.type === 'planting'
    ? !canPlantingBeMoved(garden, item.id)
    : !canStructureBeMoved(garden, item.id);
}

function canPlantingBeMoved(garden: Garden, plantingId: string) {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === plantingId,
  );

  return planting ? canManuallyMovePlanting(planting) : false;
}

function canStructureBeMoved(garden: Garden, structureId: string) {
  const structure = garden.structures.find(
    (candidate) => candidate.id === structureId,
  );

  return structure ? canManuallyMoveStructure(structure) : false;
}

function roundFeet(value: number) {
  return Number(value.toFixed(3));
}

function roundPixels(value: number) {
  return Number(value.toFixed(3));
}

function areRectsEqual(left: ItemRect, right: ItemRect) {
  return (
    left.xFt === right.xFt &&
    left.yFt === right.yFt &&
    left.widthFt === right.widthFt &&
    left.depthFt === right.depthFt
  );
}

function getFrozenPlotRect(element: HTMLElement | null): PlotClientRect | null {
  const rect = element?.getBoundingClientRect();

  if (!rect) {
    return null;
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

function captureScrollLock(element: HTMLElement): ScrollLock | null {
  const scrollport = element.closest<HTMLElement>('[data-plan-scrollport]');

  if (!scrollport) {
    return null;
  }

  let restoring = false;
  const scrollLock: ScrollLock = {
    element: scrollport,
    release() {
      scrollport.removeEventListener('scroll', handleScrollLockChange);
    },
    scrollLeft: scrollport.scrollLeft,
    scrollTop: scrollport.scrollTop,
  };

  function handleScrollLockChange() {
    if (restoring) {
      return;
    }

    restoring = true;
    restoreScrollLock(scrollLock);
    restoring = false;
  }

  scrollport.addEventListener('scroll', handleScrollLockChange, {
    passive: true,
  });

  return scrollLock;
}

function restoreScrollLock(scrollLock: ScrollLock | null) {
  if (!scrollLock) {
    return;
  }

  if (scrollLock.element.scrollLeft !== scrollLock.scrollLeft) {
    scrollLock.element.scrollLeft = scrollLock.scrollLeft;
  }

  if (scrollLock.element.scrollTop !== scrollLock.scrollTop) {
    scrollLock.element.scrollTop = scrollLock.scrollTop;
  }
}

function restoreScrollLockAfterPaint(scrollLock: ScrollLock | null) {
  if (!scrollLock || typeof requestAnimationFrame !== 'function') {
    return;
  }

  requestAnimationFrame(() => {
    restoreScrollLock(scrollLock);
  });
}

function releaseScrollLock(scrollLock: ScrollLock | null) {
  scrollLock?.release();
}

function releasePointerCapture(event: PointerEvent<HTMLElement>) {
  if (
    typeof event.currentTarget.hasPointerCapture === 'function' &&
    event.currentTarget.hasPointerCapture(event.pointerId)
  ) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}
