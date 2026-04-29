import { useEffect, useMemo, useRef } from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  Garden,
  GardenPlant,
  SunShadeLayer,
} from '../../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../../domain/gardens/plantingInstances';
import { describePlantingMobility } from '../../garden/gardenImmutability';
import { getCropSupportNeed } from '../../garden/gardenStructureRules';
import type { PlanWarning } from '../../garden/gardenPlanning';
import type { SunSeason } from '../../garden/sunShadeEngine';
import { Drawer } from '../../shared/design/DesignPrimitives';
import {
  PlantEditorContextDetails,
  PlantEditorRelocationNotice,
} from './PlantEditorSheetContext';
import { PlantEditorBasics } from './PlantEditorCareFields';
import {
  PlantEditorArrangement,
  PlantEditorSupport,
} from './PlantEditorSheetSections';
import { formatLifecycle, formatSupportType } from './PlantEditorSheetShared';
import styles from './PlantEditorSheet.module.css';

export function PlantEditorSheet({
  garden,
  isDetailedViewPinned,
  onAddLinkedSupportStructure,
  onClose,
  onDeleteSelected,
  onDuplicatePlanting,
  onLinkSupportStructure,
  onUnlinkSupportStructure,
  onUpdatePlanting,
  plant,
  sunLayer,
  sunSeason,
  warnings,
}: {
  garden: Garden;
  isDetailedViewPinned: boolean;
  onAddLinkedSupportStructure(plantingId: string): void;
  onClose(): void;
  onDeleteSelected(): void;
  onDuplicatePlanting(id: string): void;
  onLinkSupportStructure(plantingId: string, structureId: string): void;
  onUnlinkSupportStructure(plantingId: string, structureId: string): void;
  onUpdatePlanting(id: string, values: Partial<GardenPlant>): void;
  plant: GardenPlant;
  sunLayer: SunShadeLayer;
  sunSeason: SunSeason;
  warnings: PlanWarning[];
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const crop = getCropById(plant.cropId);
  const instances = getPlantingInstances(plant);
  const quantity = Math.max(plant.plantCount ?? instances.length, 1);
  const plantStatus = plant.plantStatus;
  const showSupportSection =
    plant.support.type !== 'none' ||
    Boolean(crop && getCropSupportNeed(crop)) ||
    warnings.some((warning) => warning.kind === 'trellis');
  const statusSummary = useMemo(
    (): string[] =>
      [
        formatLifecycle(plant.status),
        plant.plantedOn ? `Planted ${plant.plantedOn}` : null,
        !plant.plantedOn && plant.plannedFor
          ? `Planned ${plant.plannedFor}`
          : null,
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
      plant.plannedFor,
      plant.plantedOn,
      plant.support.installedAtIso,
      plant.support.type,
      plant.status,
      plantStatus.thinned,
      plantStatus.watered,
      quantity,
    ],
  );

  useEffect(() => {
    if (isDetailedViewPinned) {
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

  const editorContent = (
    <>
      <div className={styles.summaryStrip}>
        {statusSummary.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <PlantEditorBasics
        onUpdatePlanting={onUpdatePlanting}
        plant={plant}
        plantStatus={plantStatus}
        timezone={garden.plot.location.timezone}
      />
      <PlantEditorArrangement
        crop={crop ?? null}
        onUpdatePlanting={onUpdatePlanting}
        plant={plant}
        quantity={quantity}
        warnings={warnings}
      />
      {showSupportSection ? (
        <PlantEditorSupport
          crop={crop ?? null}
          garden={garden}
          onAddLinkedSupportStructure={onAddLinkedSupportStructure}
          onLinkSupportStructure={onLinkSupportStructure}
          onUnlinkSupportStructure={onUnlinkSupportStructure}
          onUpdatePlanting={onUpdatePlanting}
          plant={plant}
          quantity={quantity}
        />
      ) : null}
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
    </>
  );

  const editorFooter = (
    <>
      <span>
        {garden.name} · {quantity} {quantity === 1 ? 'plant' : 'plants'}
      </span>
      <div className={styles.footerActions}>
        <button onClick={() => onDuplicatePlanting(plant.id)} type="button">
          Duplicate
        </button>
        <button
          onClick={() => onUpdatePlanting(plant.id, { locked: !plant.locked })}
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
    </>
  );

  if (!isDetailedViewPinned) {
    return (
      <Drawer
        backdropTestId="plant-editor-backdrop"
        className={styles.overlayDrawer}
        closeLabel="Close plant editor"
        description={describePlantingMobility(plant)}
        footer={editorFooter}
        footerClassName={styles.overlayFooter}
        kicker="Plant editor"
        onClose={onClose}
        title={`Edit ${plant.label}`}
      >
        {editorContent}
      </Drawer>
    );
  }

  return (
    <div className={styles.pinnedLayer} data-testid="plant-editor-layer">
      <aside
        aria-labelledby="plant-editor-title"
        className={`${styles.sheet} ${styles.pinnedSheet}`}
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
        {editorContent}

        <footer className={styles.footer}>{editorFooter}</footer>
      </aside>
    </div>
  );
}
