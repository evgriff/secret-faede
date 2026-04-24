import {
  memo,
  useMemo,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  Planting,
} from '../../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../../domain/gardens/plantingInstances';
import { isPlantingAnchoredByLifecycle } from '../../garden/gardenImmutability';
import { formatFeet } from '../../garden/gardenMath';
import {
  getPlantingFootprint,
  type PlanWarning,
} from '../../garden/gardenPlanning';
import {
  getCropSupportNeed,
  getPlantSupportKind,
  getSupportLabel,
  hasNearbySupportFootprint,
  hasPlantLevelSupport,
} from '../../garden/gardenStructureRules';
import type { SelectedGardenItem } from '../../garden/useGarden';
import {
  getPlantGroupLabelDecision,
  getPlantGroupVisual,
  type PlantGroupLabelPlacement,
} from '../plantVisuals';
import type { PlanPreviewOffset } from '../planInteractionGeometry';
import { PlantGroupIcon } from './PlantGroupIcon';
import { footprintStyle } from './planCanvasGeometry';
import itemStyles from './PlanCanvasItems.module.css';

const labelPlacementClasses: Record<PlantGroupLabelPlacement, string> = {
  above: itemStyles.plantLabelAbove ?? '',
  inside: itemStyles.plantLabelInside ?? '',
  right: itemStyles.plantLabelRight ?? '',
};

export const PlanPlantGroup = memo(function PlanPlantGroup({
  index,
  isCropFocused,
  isDragging,
  isFocusDimmed,
  isHoverLabelVisible,
  isLabelVisible,
  isSelected,
  onHideLabel,
  onOpenEditor,
  onPlantHoverChange,
  onPlantPointerDown,
  onPlantPointerEnd,
  onPlantPointerMove,
  previewOffset,
  onShowLabel,
  onSelectItem,
  plant,
  structures,
  warnings,
}: {
  index: number;
  isCropFocused: boolean;
  isDragging: boolean;
  isFocusDimmed: boolean;
  isHoverLabelVisible: boolean;
  isLabelVisible: boolean;
  isSelected: boolean;
  onHideLabel(plantId: string): void;
  onOpenEditor(plantId: string): void;
  onPlantHoverChange(plantId: string | null): void;
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
  previewOffset: PlanPreviewOffset | null;
  onShowLabel(plantId: string): void;
  onSelectItem(item: SelectedGardenItem, additive: boolean): void;
  plant: Planting;
  structures: Garden['structures'];
  warnings: PlanWarning[];
}) {
  const crop = plant.cropId ? getCropById(plant.cropId) : null;
  const instances = useMemo(() => getPlantingInstances(plant), [plant]);
  const footprint = useMemo(() => getPlantingFootprint(plant), [plant]);
  const visual = getPlantGroupVisual(crop, plant);
  const label = plant.label || crop?.commonName || `Plant ${index + 1}`;
  const quantity = Math.max(instances.length, plant.plantCount ?? 1, 1);
  const isAnchored = isPlantingAnchoredByLifecycle(plant);
  const showContextSignals = isSelected || isCropFocused;
  const supportState = getSupportState({
    crop,
    footprint,
    plant,
    showContextSignals,
    structures,
    warnings,
  });
  const hasWarning = warnings.some((warning) => warning.kind !== 'trellis');
  const warningReasons = useMemo(
    () =>
      warnings
        .filter((warning) => warning.kind !== 'trellis')
        .slice(0, 2)
        .map((warning) => `${warning.title}: ${warning.message}`),
    [warnings],
  );
  const maxDots = showContextSignals ? 28 : 18;
  const visibleDots = useMemo(
    () => getVisibleDots(instances, maxDots),
    [instances, maxDots],
  );
  const hiddenDotCount = Math.max(instances.length - visibleDots.length, 0);
  const labelId = `plant-group-label-${plant.id}`;
  const labelText = quantity > 1 ? `${label}, ${quantity} plants` : label;
  const quantityLabel = quantity > 1 ? `${quantity} plants` : '1 plant';
  const labelDecision = getPlantGroupLabelDecision({
    dragging: isDragging,
    footprint,
    hovering: isHoverLabelVisible,
    label: labelText,
    pinned: isLabelVisible,
  });
  const showInteriorLabel =
    labelDecision.visible && labelDecision.placement === 'inside';
  const showFloatingLabel =
    labelDecision.visible && labelDecision.placement !== 'inside';
  const shouldExposeLabel = showInteriorLabel || showFloatingLabel;
  const supportId = `plant-group-support-${plant.id}`;
  const warningId = `plant-group-warning-${plant.id}`;
  const describedBy = [
    shouldExposeLabel ? labelId : null,
    supportState?.visible ? supportId : null,
    hasWarning ? warningId : null,
  ]
    .filter(Boolean)
    .join(' ');
  const ariaLabel =
    quantity === 1
      ? `${label} at X: ${formatFeet(plant.xFt)} ft, Y: ${formatFeet(
          plant.yFt,
        )} ft`
      : `${label} group, ${quantity} plants at X: ${formatFeet(
          plant.xFt,
        )} ft, Y: ${formatFeet(plant.yFt)} ft`;
  const style = useMemo(
    () =>
      ({
        ...footprintStyle(footprint),
        '--plant-accent': visual.palette.accent,
        '--plant-accent-strong': visual.palette.strong,
        '--plant-dot': visual.palette.dot,
        '--plant-dot-alt': visual.palette.dotAlt,
        '--plant-label-max-width': `${labelDecision.maxWidthPx}px`,
        '--plant-soft': visual.palette.soft,
        '--preview-offset-x': `${previewOffset?.xPx ?? 0}px`,
        '--preview-offset-y': `${previewOffset?.yPx ?? 0}px`,
      }) as CSSProperties,
    [
      footprint,
      labelDecision.maxWidthPx,
      previewOffset?.xPx,
      previewOffset?.yPx,
      visual.palette.accent,
      visual.palette.dot,
      visual.palette.dotAlt,
      visual.palette.soft,
      visual.palette.strong,
    ],
  );

  return (
    <div
      className={`${itemStyles.plantGroup} ${itemStyles[plant.mode] ?? ''} ${
        itemStyles[plant.status] ?? ''
      } ${isSelected ? itemStyles.selectedPlantGroup : ''} ${
        isDragging ? itemStyles.draggingPlantGroup : ''
      } ${plant.locked ? itemStyles.lockedItem : ''} ${
        isAnchored ? itemStyles.anchoredItem : ''
      } ${isCropFocused ? itemStyles.cropFocusedPlantGroup : ''} ${
        isFocusDimmed ? itemStyles.cropFocusDimmed : ''
      } ${hasWarning ? itemStyles.warningItem : ''} ${
        labelDecision.hasHoverRoom
          ? itemStyles.roomyPlantGroup
          : itemStyles.compactPlantGroup
      } ${isLabelVisible ? itemStyles.labelVisiblePlantGroup : ''} ${
        isHoverLabelVisible ? itemStyles.hoverLabelPlantGroup : ''
      } ${showFloatingLabel ? itemStyles.labelShownPlantGroup : ''} ${
        labelPlacementClasses[labelDecision.placement]
      }`}
      data-plant-group-id={plant.id}
      data-plan-item="true"
      onBlur={(event) => handleGroupBlur(event, onPlantHoverChange)}
      onPointerEnter={() => {
        if (!isDragging) {
          onPlantHoverChange(plant.id);
        }
      }}
      onPointerLeave={() => onPlantHoverChange(null)}
      style={style}
    >
      <button
        aria-describedby={describedBy || undefined}
        aria-label={ariaLabel}
        aria-pressed={isSelected}
        className={itemStyles.plantGroupSurface}
        onClick={(event) => {
          if (event.detail === 0) {
            onShowLabel(plant.id);
            onSelectItem({ id: plant.id, type: 'planting' }, event.shiftKey);
          }
        }}
        onFocus={() => onShowLabel(plant.id)}
        onKeyDown={(event) =>
          handleSurfaceKeyDown(event, plant.id, onHideLabel)
        }
        onPointerCancel={(event) => onPlantPointerEnd(event, plant.id)}
        onPointerDown={(event) => {
          onShowLabel(plant.id);
          onPlantPointerDown(event, plant.id);
        }}
        onPointerMove={(event) => onPlantPointerMove(event, plant.id)}
        onPointerUp={(event) => onPlantPointerEnd(event, plant.id)}
        type="button"
      >
        <span className={itemStyles.plantGroupDots} aria-hidden="true">
          {visibleDots.map((instance, dotIndex) => (
            <span
              className={`${itemStyles.plantGroupDot} ${
                dotIndex % 4 === 0 ? itemStyles.plantGroupDotAlt : ''
              }`}
              data-plant-dot="true"
              key={instance.id}
              style={getDotStyle(instance, footprint)}
            />
          ))}
          {hiddenDotCount > 0 ? (
            <span className={itemStyles.plantGroupMore}>+{hiddenDotCount}</span>
          ) : null}
        </span>
        {showInteriorLabel ? (
          <span
            className={itemStyles.plantGroupInteriorLabel}
            data-plan-label="true"
            id={labelId}
          >
            <span className={itemStyles.plantGroupInteriorMeta}>
              {quantityLabel}
            </span>
            <span className={itemStyles.plantGroupInteriorName}>{label}</span>
          </span>
        ) : null}
        <span className={itemStyles.plantGroupIconWrap} aria-hidden="true">
          <PlantGroupIcon
            className={itemStyles.plantGroupIcon}
            icon={visual.icon}
          />
          <span className={itemStyles.plantGroupMark}>{visual.mark}</span>
        </span>
        {plant.locked || isAnchored || supportState?.visible || hasWarning ? (
          <span className={itemStyles.plantGroupSignals} data-plan-label="true">
            {isAnchored ? (
              <span
                className={`${itemStyles.plantSignal} ${itemStyles.anchorSignal}`}
              >
                Anchored
              </span>
            ) : null}
            {plant.locked ? (
              <span
                className={`${itemStyles.plantSignal} ${itemStyles.lockSignal}`}
              >
                Locked
              </span>
            ) : null}
            {supportState?.visible ? (
              <span
                aria-label={supportState.aria}
                className={`${itemStyles.plantSignal} ${itemStyles.supportSignal} ${
                  supportState.missing ? itemStyles.supportMissingSignal : ''
                }`}
                id={supportId}
                title={supportState.aria}
              >
                {supportState.label}
              </span>
            ) : null}
            {hasWarning ? (
              <span
                className={`${itemStyles.plantSignal} ${itemStyles.warningSignal}`}
              >
                Check
                <span
                  className={itemStyles.signalTooltip}
                  id={warningId}
                  role="tooltip"
                >
                  {warningReasons.join(' ')}
                </span>
              </span>
            ) : null}
          </span>
        ) : null}
      </button>
      {showFloatingLabel ? (
        <span
          className={itemStyles.plantGroupLabel}
          data-plan-label="true"
          id={labelId}
          role="tooltip"
        >
          <span className={itemStyles.plantGroupName}>{labelText}</span>
        </span>
      ) : null}
      <button
        aria-describedby={shouldExposeLabel ? labelId : undefined}
        aria-label={`Edit ${label} group`}
        className={itemStyles.plantGroupWrench}
        data-plan-item="true"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onShowLabel(plant.id);
          onSelectItem({ id: plant.id, type: 'planting' }, event.shiftKey);
          onOpenEditor(plant.id);
        }}
        onFocus={() => onShowLabel(plant.id)}
        onKeyDown={(event) =>
          handleSurfaceKeyDown(event, plant.id, onHideLabel)
        }
        onPointerDown={(event) => event.stopPropagation()}
        type="button"
      >
        <WrenchIcon />
      </button>
    </div>
  );
});

interface SupportSignalState {
  aria: string;
  label: string;
  missing: boolean;
  visible: boolean;
}

function getSupportState({
  crop,
  footprint,
  plant,
  showContextSignals,
  structures,
  warnings,
}: {
  crop: CropProfile | null;
  footprint: ReturnType<typeof getPlantingFootprint>;
  plant: Planting;
  showContextSignals: boolean;
  structures: Garden['structures'];
  warnings: PlanWarning[];
}): SupportSignalState | null {
  const missingSupport = warnings.some((warning) => warning.kind === 'trellis');
  const assignedPlantSupport = getAssignedPlantSupportLabel(plant);
  const supportNeed = crop ? getCropSupportNeed(crop) : null;

  if (supportNeed?.kind === 'trellis') {
    const hasTrellis =
      plant.mode === 'trellisLine' ||
      (plant.trellisLengthFt ?? 0) > 0 ||
      hasNearbySupportFootprint({ structures } as Garden, footprint);
    const label = hasTrellis ? 'Trellis' : 'Needs trellis';

    return {
      aria: hasTrellis ? 'trellis support assigned' : 'trellis support missing',
      label,
      missing: !hasTrellis,
      visible: hasTrellis || missingSupport || showContextSignals,
    };
  }

  if (supportNeed?.kind === 'cage' || supportNeed?.kind === 'stake') {
    const supportLabel = capitalize(getSupportLabel(supportNeed.kind));
    const hasSupport = hasPlantLevelSupport(plant, supportNeed.kind);

    return {
      aria: hasSupport
        ? `${supportLabel.toLowerCase()} support assigned`
        : `${supportLabel.toLowerCase()} support missing`,
      label: hasSupport ? supportLabel : `Needs ${supportLabel.toLowerCase()}`,
      missing: !hasSupport,
      visible: hasSupport || missingSupport || showContextSignals,
    };
  }

  return assignedPlantSupport
    ? {
        aria: `${assignedPlantSupport.toLowerCase()} support assigned`,
        label: assignedPlantSupport,
        missing: false,
        visible: true,
      }
    : null;
}

function getAssignedPlantSupportLabel(plant: Planting) {
  if (plant.support.type === 'none' || plant.support.quantity <= 0) {
    return null;
  }

  const supportKind = getPlantSupportKind(plant.support.type);

  if (supportKind) {
    return capitalize(getSupportLabel(supportKind));
  }

  switch (plant.support.type) {
    case 'custom':
      return 'Support';
    case 'netting':
      return 'Netting';
    case 'rowCover':
      return 'Cover';
    case 'cage':
    case 'stake':
    case 'stakeAndWeave':
      return null;
  }
}

function handleGroupBlur(
  event: FocusEvent<HTMLDivElement>,
  onPlantHoverChange: (plantId: string | null) => void,
) {
  if (
    event.relatedTarget instanceof Node &&
    event.currentTarget.contains(event.relatedTarget)
  ) {
    return;
  }

  onPlantHoverChange(null);
}

function handleSurfaceKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  plantId: string,
  onHideLabel: (plantId: string) => void,
) {
  if (event.key !== 'Escape') {
    return;
  }

  event.preventDefault();
  onHideLabel(plantId);
}

function getVisibleDots<T>(items: T[], maxCount: number) {
  if (items.length <= maxCount) {
    return items;
  }

  const step = Math.ceil(items.length / maxCount);

  return items.filter((_, index) => index % step === 0).slice(0, maxCount);
}

function getDotStyle(
  instance: { xFt: number; yFt: number },
  footprint: ReturnType<typeof getPlantingFootprint>,
): CSSProperties {
  return {
    left: `${clampPercent(
      ((instance.xFt - footprint.xFt) / footprint.widthFt) * 100,
    )}%`,
    top: `${clampPercent(
      ((instance.yFt - footprint.yFt) / footprint.depthFt) * 100,
    )}%`,
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.max(8, Math.min(92, value));
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function WrenchIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path
        d="M14.8 5.2a4.2 4.2 0 0 0 4.7 5.4l-8.8 8.8a2.3 2.3 0 0 1-3.3-3.3l8.8-8.8a4.2 4.2 0 0 0-1.4-2.1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M8.6 17.2h.01"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}
