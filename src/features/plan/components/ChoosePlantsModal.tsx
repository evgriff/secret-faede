import { useState } from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  PlantingMode,
  SeasonCropSelection,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import { Button, Modal } from '../../shared/design/DesignPrimitives';
import { buildSeasonCropLayoutRequests } from '../seasonCropPlan';
import { SeasonCropBoard } from './ChoosePlantsBoard';
import { CropComparePanel } from './ChoosePlantsCompare';
import { ChoosePlantsLibrary } from './ChoosePlantsLibrary';
import styles from './ChoosePlantsModal.module.css';
import {
  createSeasonCropSelection,
  normalizeSeasonCropSelections,
} from './choosePlantsSelection';

type MobileTab = 'board' | 'library';
const maxCompareCrops = 3;

interface CompareCropSelection {
  cropId: string;
  quantity: number;
}

export function ChoosePlantsModal({
  garden,
  onClose,
  onOptimize,
  onSave,
  sunExposureAtPlacement,
}: {
  garden: Garden;
  onClose(): void;
  onOptimize(wantedCrops: SeasonCropSelection[]): void;
  onSave(wantedCrops: SeasonCropSelection[]): void;
  sunExposureAtPlacement: SunExposure | null;
}) {
  const [activeTab, setActiveTab] = useState<MobileTab>('library');
  const [selections, setSelections] = useState<SeasonCropSelection[]>(
    () => garden.seasonPlan.wantedCrops,
  );
  const [compareSelections, setCompareSelections] = useState<
    CompareCropSelection[]
  >([]);
  const compareCropIds = compareSelections.map((selection) => selection.cropId);
  const selectedCropIds = new Set(
    selections.map((selection) => selection.cropId),
  );
  const draftGarden = {
    ...garden,
    seasonPlan: {
      ...garden.seasonPlan,
      wantedCrops: selections,
    },
  };
  const layoutRequests = buildSeasonCropLayoutRequests(
    draftGarden,
    sunExposureAtPlacement,
  );
  const compareRequests = buildSeasonCropLayoutRequests(
    {
      ...draftGarden,
      seasonPlan: {
        ...draftGarden.seasonPlan,
        wantedCrops: buildCompareSelections(compareSelections),
      },
    },
    sunExposureAtPlacement,
  );
  const hasSelections = selections.length > 0;

  function addCrop(
    crop: CropProfile,
    quantity = 1,
    plantingForm?: PlantingMode,
  ) {
    if (selectedCropIds.has(crop.id)) {
      return;
    }

    setSelections((currentSelections) => [
      ...currentSelections,
      createSeasonCropSelection(crop, quantity, plantingForm),
    ]);
  }

  function toggleCompareCrop(crop: CropProfile, quantity = 1) {
    setCompareSelections((currentSelections) => {
      if (currentSelections.some((selection) => selection.cropId === crop.id)) {
        return currentSelections.filter(
          (selection) => selection.cropId !== crop.id,
        );
      }

      if (currentSelections.length >= maxCompareCrops) {
        return currentSelections;
      }

      return [
        ...currentSelections,
        { cropId: crop.id, quantity: coerceTargetQuantity(quantity) },
      ];
    });
  }

  function updateCompareQuantity(crop: CropProfile, quantity: number) {
    setCompareSelections((currentSelections) =>
      currentSelections.map((selection) =>
        selection.cropId === crop.id
          ? { ...selection, quantity: coerceTargetQuantity(quantity) }
          : selection,
      ),
    );
  }

  function handleSave() {
    onSave(normalizeSeasonCropSelections(selections));
  }

  function handleOptimize() {
    onOptimize(normalizeSeasonCropSelections(selections));
  }

  function updateSelection(
    selectionId: string,
    values: Partial<SeasonCropSelection>,
  ) {
    setSelections((currentSelections) =>
      currentSelections.map((selection) =>
        selection.id === selectionId
          ? {
              ...selection,
              ...values,
              id: selection.id,
              quantity:
                values.quantity === undefined
                  ? selection.quantity
                  : coerceTargetQuantity(values.quantity),
            }
          : selection,
      ),
    );
  }

  function moveSelection(selectionId: string, delta: -1 | 1) {
    setSelections((currentSelections) => {
      const index = currentSelections.findIndex(
        (selection) => selection.id === selectionId,
      );
      const nextIndex = index + delta;

      if (index < 0 || nextIndex < 0 || nextIndex >= currentSelections.length) {
        return currentSelections;
      }

      const nextSelections = [...currentSelections];
      const [selection] = nextSelections.splice(index, 1);

      if (!selection) {
        return currentSelections;
      }

      nextSelections.splice(nextIndex, 0, selection);
      return normalizeSeasonCropSelections(nextSelections);
    });
  }

  return (
    <Modal
      bodyClassName={styles.modalBody}
      className={styles.modal}
      closeLabel="Close choose plants"
      description="Search the crop library, set quantities, then save the season list."
      footer={
        <>
          <div className={styles.footerActions}>
            {hasSelections ? (
              <Button
                onClick={() => setSelections([])}
                tone="secondary"
                type="button"
              >
                Clear list
              </Button>
            ) : null}
            <Button onClick={handleSave} tone="secondary" type="button">
              Save list
            </Button>
            <Button
              disabled={!hasSelections}
              onClick={handleOptimize}
              tone="primary"
              type="button"
            >
              Save and improve plan
            </Button>
          </div>
        </>
      }
      footerClassName={styles.footer}
      headerClassName={styles.header}
      mobilePresentation="fullScreen"
      onClose={onClose}
      title="Choose Plants"
    >
      <div
        className={styles.mobileTabs}
        aria-label="Choose plants sections"
        role="tablist"
      >
        <TabButton
          activeTab={activeTab}
          controlsId="choose-plants-library-panel"
          id="choose-plants-library-tab"
          tab="library"
          onSelect={setActiveTab}
        >
          Pick plants
        </TabButton>
        <TabButton
          activeTab={activeTab}
          controlsId="choose-plants-board-panel"
          id="choose-plants-board-tab"
          tab="board"
          onSelect={setActiveTab}
        >
          Picked
        </TabButton>
      </div>

      <div className={styles.layout} data-active-tab={activeTab}>
        <div
          aria-labelledby="choose-plants-library-tab"
          className={`${styles.panelSlot} ${styles.librarySlot}`}
          id="choose-plants-library-panel"
          role="tabpanel"
        >
          <ChoosePlantsLibrary
            compareCropIds={compareCropIds}
            garden={garden}
            onAddCrop={addCrop}
            onCompareQuantityChange={updateCompareQuantity}
            onToggleCompare={toggleCompareCrop}
            selectedCropIds={selectedCropIds}
            sunExposureAtPlacement={sunExposureAtPlacement}
          />
        </div>

        <div
          aria-labelledby="choose-plants-board-tab"
          className={`${styles.panelSlot} ${styles.boardSlot}`}
          id="choose-plants-board-panel"
          role="tabpanel"
        >
          <div className={styles.boardStack}>
            <SeasonCropBoard
              garden={garden}
              layoutRequests={layoutRequests}
              onMoveSelection={moveSelection}
              onRemoveSelection={(selectionId) =>
                setSelections((currentSelections) =>
                  normalizeSeasonCropSelections(
                    currentSelections.filter(
                      (selection) => selection.id !== selectionId,
                    ),
                  ),
                )
              }
              onUpdateSelection={updateSelection}
              selections={selections}
              sunExposureAtPlacement={sunExposureAtPlacement}
            />
            {compareCropIds.length > 0 ? (
              <CropComparePanel
                explicitCompareCount={compareCropIds.length}
                garden={garden}
                id="choose-plants-compare-panel"
                layoutRequests={compareRequests}
                onClearCompare={() => setCompareSelections([])}
                sunExposureAtPlacement={sunExposureAtPlacement}
              />
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TabButton({
  activeTab,
  children,
  controlsId,
  id,
  onSelect,
  tab,
}: {
  activeTab: MobileTab;
  children: string;
  controlsId: string;
  id: string;
  onSelect(tab: MobileTab): void;
  tab: MobileTab;
}) {
  return (
    <button
      aria-controls={controlsId}
      aria-selected={activeTab === tab}
      id={id}
      onClick={() => onSelect(tab)}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}

function coerceTargetQuantity(value: number) {
  return Math.max(1, Math.min(999, Math.round(value || 1)));
}

function buildCompareSelections(compareSelections: CompareCropSelection[]) {
  return compareSelections.flatMap((selection): SeasonCropSelection[] => {
    const crop = getCropById(selection.cropId);

    return crop ? [createSeasonCropSelection(crop, selection.quantity)] : [];
  });
}
