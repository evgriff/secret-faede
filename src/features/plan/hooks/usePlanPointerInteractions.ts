import {
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
import { clientPointToPlotFeet, type PlotPoint } from '../../garden/gardenMath';
import type { SelectedGardenItem } from '../../garden/useGarden';
import type { PlanMode } from '../planModes';
import {
  areSamePlanItem,
  calculateResizeRect,
  getItemPointFromRect,
  getItemRect,
  getItemsInRect,
  rectFromPoints,
  snapItemPoint,
  snapResizeRect,
  type PlanItemPositionUpdate,
  type PlanItemRectUpdate,
  type PlanItemRef,
  type ResizeHandle,
  type SnapGuide,
} from '../planInteractionGeometry';

type DragState = {
  checkpointed: boolean;
  item: PlanItemRef;
  moved: boolean;
  originalPoints: PlanItemPositionUpdate[];
  pointerOffset: PlotPoint;
  selection: PlanItemRef[];
  sourceRect: NonNullable<ReturnType<typeof getItemRect>>;
  startClientX: number;
  startClientY: number;
};

type ResizeState = {
  checkpointed: boolean;
  handle: ResizeHandle;
  originalRect: NonNullable<ReturnType<typeof getItemRect>>;
  startClientX: number;
  startClientY: number;
  structureId: string;
};

type MarqueeState = {
  additive: boolean;
  start: PlotPoint;
};

type PlanPointerInteractionContext = {
  garden: Garden | null;
  mode: PlanMode;
  onCheckpoint(): void;
  onMarqueeSelect(items: PlanItemRef[], additive: boolean): void;
  onSelectItem(item: SelectedGardenItem, additive: boolean): void;
  resizeStructureRect(update: PlanItemRectUpdate, trackHistory?: boolean): void;
  selectedItems: PlanItemRef[];
  updateItemPositions(
    updates: PlanItemPositionUpdate[],
    trackHistory?: boolean,
  ): void;
};

type PlanPointerInteractionHandlers = {
  handleMarqueePointerDown(event: PointerEvent<HTMLDivElement>): void;
  handleMarqueePointerEnd(event: PointerEvent<HTMLDivElement>): void;
  handleMarqueePointerMove(event: PointerEvent<HTMLDivElement>): void;
  handlePlantPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ): void;
  handlePlantPointerEnd(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
  ): void;
  handlePlantPointerMove(
    event: PointerEvent<HTMLButtonElement>,
    plantId: string,
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
  onSelectItem(item: SelectedGardenItem, additive: boolean): void;
  resizeStructureRect(update: PlanItemRectUpdate, trackHistory?: boolean): void;
  selectedItems: PlanItemRef[];
  updateItemPositions(
    updates: PlanItemPositionUpdate[],
    trackHistory?: boolean,
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
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const dragStateRef = useRef<DragState | null>(null);
  const marqueeStateRef = useRef<MarqueeState | null>(null);
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

  function beginItemDrag(event: PointerEvent<HTMLElement>, item: PlanItemRef) {
    const { garden, onSelectItem, selectedItems } = contextRef.current;

    event.preventDefault();
    event.stopPropagation();
    onSelectItem(item, event.shiftKey);

    if (!garden || event.shiftKey || isItemLocked(garden, item)) {
      return;
    }

    const rect = plotRef.current?.getBoundingClientRect();
    const sourceRect = getItemRect(garden, item);

    if (!rect || !sourceRect) {
      return;
    }

    const pointerPoint = clientPointToPlotFeet(event, rect, garden.plot);
    const itemPoint = getItemPointFromRect(item, sourceRect);
    const dragSelection =
      selectedItems.some((selected) => areSamePlanItem(selected, item)) &&
      selectedItems.length > 1
        ? selectedItems
        : [item];
    const originalPoints = dragSelection.flatMap((selectedItem) => {
      const selectedRect = getItemRect(garden, selectedItem);

      if (!selectedRect) {
        return [];
      }

      return [
        {
          ...selectedItem,
          ...getItemPointFromRect(selectedItem, selectedRect),
        },
      ];
    });

    if (originalPoints.length === 0) {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragStateRef.current = {
      checkpointed: false,
      item,
      moved: false,
      originalPoints,
      pointerOffset: {
        xFt: pointerPoint.xFt - itemPoint.xFt,
        yFt: pointerPoint.yFt - itemPoint.yFt,
      },
      selection: dragSelection,
      sourceRect,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };

    if (item.type === 'planting') {
      setDraggingPlantId(item.id);
    } else {
      setDraggingStructureId(item.id);
    }
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

    if (!markMoved(event, dragState)) {
      return;
    }

    checkpointDrag(dragState, onCheckpoint);
    updateDraggedItems(event, dragState, false);
  }

  function endItemDrag(event: PointerEvent<HTMLElement>, item: PlanItemRef) {
    const dragState = dragStateRef.current;

    if (!dragState || !areSamePlanItem(dragState.item, item)) {
      return;
    }

    if (dragState.moved) {
      updateDraggedItems(event, dragState, true);
    }

    releasePointerCapture(event);
    dragStateRef.current = null;
    setDraggingPlantId(null);
    setDraggingStructureId(null);
    setSnapGuides([]);
  }

  function updateDraggedItems(
    event: PointerEvent<HTMLElement>,
    dragState: DragState,
    isFinal: boolean,
  ) {
    const { garden, updateItemPositions } = contextRef.current;

    if (!garden) {
      return;
    }

    const rect = plotRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const pointerPoint = clientPointToPlotFeet(event, rect, garden.plot);
    const nextPoint = {
      xFt: pointerPoint.xFt - dragState.pointerOffset.xFt,
      yFt: pointerPoint.yFt - dragState.pointerOffset.yFt,
    };
    const snapResult = snapItemPoint({
      freeMove: event.altKey,
      garden,
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
      return;
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

    updateItemPositions(updates, false);
    setSnapGuides(isFinal || event.altKey ? [] : snapResult.guides);
  }

  function beginResize(
    event: PointerEvent<HTMLSpanElement>,
    structureId: string,
    handle: ResizeHandle,
  ) {
    const { garden, onSelectItem } = contextRef.current;

    event.preventDefault();
    event.stopPropagation();
    onSelectItem({ id: structureId, type: 'structure' }, event.shiftKey);

    if (
      !garden ||
      isItemLocked(garden, { id: structureId, type: 'structure' })
    ) {
      return;
    }

    const originalRect = getItemRect(garden, {
      id: structureId,
      type: 'structure',
    });

    if (!originalRect) {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeStateRef.current = {
      checkpointed: false,
      handle,
      originalRect,
      startClientX: event.clientX,
      startClientY: event.clientY,
      structureId,
    };
    setResizingStructureId(structureId);
  }

  function continueResize(event: PointerEvent<HTMLSpanElement>) {
    const { garden, onCheckpoint } = contextRef.current;

    if (!garden || !resizeStateRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!markMoved(event, resizeStateRef.current)) {
      return;
    }

    if (!resizeStateRef.current.checkpointed) {
      onCheckpoint();
      resizeStateRef.current.checkpointed = true;
    }

    updateResizedStructure(event, resizeStateRef.current, false);
  }

  function endResize(event: PointerEvent<HTMLSpanElement>) {
    if (!resizeStateRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateResizedStructure(event, resizeStateRef.current, true);
    releasePointerCapture(event);
    resizeStateRef.current = null;
    setResizingStructureId(null);
    setSnapGuides([]);
  }

  function updateResizedStructure(
    event: PointerEvent<HTMLSpanElement>,
    resizeState: ResizeState,
    isFinal: boolean,
  ) {
    const { garden, resizeStructureRect } = contextRef.current;

    if (!garden) {
      return;
    }

    const rect = plotRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const point = clientPointToPlotFeet(event, rect, garden.plot);
    const baseRect = calculateResizeRect({
      currentPoint: point,
      garden,
      handle: resizeState.handle,
      originalRect: resizeState.originalRect,
    });
    const snapResult = snapResizeRect({
      freeMove: event.altKey,
      garden,
      handle: resizeState.handle,
      rect: baseRect,
      snapExclusions: [{ id: resizeState.structureId, type: 'structure' }],
    });

    resizeStructureRect(
      {
        depthFt: snapResult.rect.depthFt,
        id: resizeState.structureId,
        type: 'structure',
        widthFt: snapResult.rect.widthFt,
        xFt: snapResult.rect.xFt,
        yFt: snapResult.rect.yFt,
      },
      false,
    );
    setSnapGuides(isFinal || event.altKey ? [] : snapResult.guides);
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

    const rect = plotRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const start = clientPointToPlotFeet(event, rect, garden.plot);
    marqueeStateRef.current = {
      additive: event.shiftKey,
      start,
    };
    setMarqueeRect(rectFromPoints(start, start));
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function continueMarquee(event: PointerEvent<HTMLDivElement>) {
    const { garden } = contextRef.current;

    if (!garden || !marqueeStateRef.current) {
      return;
    }

    const rect = plotRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setMarqueeRect(
      rectFromPoints(
        marqueeStateRef.current.start,
        clientPointToPlotFeet(event, rect, garden.plot),
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
    const rect = plotRef.current?.getBoundingClientRect();
    const state = marqueeStateRef.current;

    if (rect) {
      const selectionRect = rectFromPoints(
        state.start,
        clientPointToPlotFeet(event, rect, garden.plot),
      );
      onMarqueeSelect(getItemsInRect(garden, selectionRect), state.additive);
    }

    releasePointerCapture(event);
    marqueeStateRef.current = null;
    setMarqueeRect(null);
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
      handlePlantPointerDown(event, plantId) {
        beginItemDrag(event, { id: plantId, type: 'planting' });
      },
      handlePlantPointerEnd(event, plantId) {
        endItemDrag(event, { id: plantId, type: 'planting' });
      },
      handlePlantPointerMove(event, plantId) {
        continueItemDrag(event, { id: plantId, type: 'planting' });
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
    draggingPlantId,
    draggingStructureId,
    ...stableHandlers,
    marqueeRect,
    plotRef,
    resizingStructureId,
    snapGuides,
  };
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

function releasePointerCapture(event: PointerEvent<HTMLElement>) {
  if (
    typeof event.currentTarget.hasPointerCapture === 'function' &&
    event.currentTarget.hasPointerCapture(event.pointerId)
  ) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}
