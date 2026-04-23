import {
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  Garden,
  GardenPlant,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../../domain/gardens/plantingInstances';
import { describePlantingMobility } from '../../garden/gardenImmutability';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import { useDialogScrollLock } from '../../shared/design/dialogDismiss';
import {
  PlantEditorContextDetails,
  PlantEditorRelocationNotice,
} from './PlantEditorSheetContext';
import { trapPlantEditorFocus } from './PlantEditorSheetFocus';
import { PlantEditorBasics } from './PlantEditorCareFields';
import {
  PlantEditorArrangement,
  PlantEditorPhotos,
  PlantEditorSupport,
} from './PlantEditorSheetSections';
import { formatSupportType } from './PlantEditorSheetShared';
import styles from './PlantEditorSheet.module.css';

export function PlantEditorSheet({
  garden,
  isDetailedViewPinned,
  onClose,
  onDeleteSelected,
  onDuplicatePlanting,
  onUpdatePlanting,
  plant,
  sunLayer,
  sunSeason,
  warnings,
}: {
  garden: Garden;
  isDetailedViewPinned: boolean;
  onClose(): void;
  onDeleteSelected(): void;
  onDuplicatePlanting(id: string): void;
  onUpdatePlanting(id: string, values: Partial<GardenPlant>): void;
  plant: GardenPlant;
  sunLayer: SunShadeLayer;
  sunSeason: SunSeason;
  warnings: PlanWarning[];
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const crop = getCropById(plant.cropId);
  const instances = getPlantingInstances(plant);
  const quantity = Math.max(plant.plantCount ?? instances.length, 1);
  const plantStatus = plant.plantStatus;
  const statusSummary = useMemo(
    (): string[] =>
      [
        plantStatus.watered ? 'Watered' : 'Needs water check',
        plantStatus.thinned
          ? 'Thinned'
          : quantity > 1
            ? 'Thin when ready'
            : null,
        plant.support.type !== 'none'
          ? plant.support.installedAtIso
            ? `${formatSupportType(plant.support.type)} installed`
            : `${formatSupportType(plant.support.type)} planned`
          : null,
      ].filter((item): item is string => Boolean(item)),
    [
      plant.support.installedAtIso,
      plant.support.type,
      plantStatus.thinned,
      plantStatus.watered,
      quantity,
    ],
  );

  useDialogScrollLock(!isDetailedViewPinned);

  useEffect(() => {
    if (!isDetailedViewPinned) {
      closeButtonRef.current?.focus();
    }
  }, [isDetailedViewPinned, plant.id]);

  useEffect(() => {
    if (!isDetailedViewPinned) {
      return;
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailedViewPinned, onClose]);

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    onClose();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab' || isDetailedViewPinned) {
      return;
    }

    trapPlantEditorFocus(event, dialogRef.current);
  }

  const layerClassName = isDetailedViewPinned
    ? styles.pinnedLayer
    : styles.backdrop;

  return (
    <div
      className={layerClassName}
      data-testid={
        isDetailedViewPinned ? 'plant-editor-layer' : 'plant-editor-backdrop'
      }
      onMouseDown={isDetailedViewPinned ? undefined : handleBackdropMouseDown}
    >
      <aside
        aria-labelledby="plant-editor-title"
        aria-modal={isDetailedViewPinned ? undefined : true}
        className={`${styles.sheet} ${
          isDetailedViewPinned ? styles.pinnedSheet : ''
        }`}
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>
              {isDetailedViewPinned ? 'Detailed plant view' : 'Plant editor'}
            </span>
            <h2 id="plant-editor-title">Edit {plant.label}</h2>
            <p>{describePlantingMobility(plant)}</p>
          </div>
          <button
            aria-label="Close plant editor"
            className={styles.iconButton}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            x
          </button>
        </header>

        <div className={styles.summaryStrip}>
          {statusSummary.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>

        <PlantEditorBasics
          onUpdatePlanting={onUpdatePlanting}
          plant={plant}
          plantStatus={plantStatus}
        />
        <PlantEditorArrangement
          crop={crop ?? null}
          onUpdatePlanting={onUpdatePlanting}
          plant={plant}
          quantity={quantity}
          warnings={warnings}
        />
        <PlantEditorSupport
          onUpdatePlanting={onUpdatePlanting}
          plant={plant}
          quantity={quantity}
        />
        <PlantEditorPhotos
          onUpdatePlanting={onUpdatePlanting}
          plant={plant}
          plantStatus={plantStatus}
        />
        <PlantEditorContextDetails
          crop={crop ?? null}
          plant={plant}
          sunLayer={sunLayer}
          sunSeason={sunSeason}
          warnings={warnings}
        />
        <PlantEditorRelocationNotice
          onUpdatePlanting={onUpdatePlanting}
          plant={plant}
        />

        <footer className={styles.footer}>
          <span>
            {garden.name} · {quantity} {quantity === 1 ? 'plant' : 'plants'}
          </span>
          <div className={styles.footerActions}>
            <button onClick={() => onDuplicatePlanting(plant.id)} type="button">
              Duplicate
            </button>
            <button
              onClick={() =>
                onUpdatePlanting(plant.id, { locked: !plant.locked })
              }
              type="button"
            >
              {plant.locked ? 'Unlock' : 'Lock'}
            </button>
            <button
              className={styles.dangerButton}
              onClick={onDeleteSelected}
              type="button"
            >
              Delete
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
