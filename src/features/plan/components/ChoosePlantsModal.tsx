import { useMemo, useState } from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  PlantingMode,
  SeasonCropSelection,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import { getCalendarDateInTimeZone } from '../../../shared/lib/timezoneDate';
import { Button, Modal } from '../../shared/design/DesignPrimitives';
import { buildSeasonCropLayoutRequests } from '../seasonCropPlan';
import {
  SeasonCropBoard,
  type CurrentPlanCropOption,
} from './ChoosePlantsBoard';
import { CropComparePanel } from './ChoosePlantsCompare';
import { ChoosePlantsLibrary } from './ChoosePlantsLibrary';
import styles from './ChoosePlantsModal.module.css';
import {
  createSeasonCropSelection,
  normalizeSeasonCropSelections,
  normalizeSeasonPlantingForm,
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
  const [isPickedPanelExpanded, setIsPickedPanelExpanded] = useState(false);
  const [analysisDate] = useState(() =>
    getCalendarDateInTimeZone(new Date(), garden.plot.location.timezone),
  );
  const currentPlanCropOptions = useMemo(
    () => buildCurrentPlanCropOptions(garden),
    [garden],
  );
  const currentPlanCropIds = useMemo(
    () => new Set(currentPlanCropOptions.map((option) => option.cropId)),
    [currentPlanCropOptions],
  );
  const [selections, setSelections] = useState<SeasonCropSelection[]>(() =>
    getInitialSelections(garden.seasonPlan.wantedCrops, currentPlanCropIds),
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
    analysisDate,
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
    analysisDate,
  );
  const hasSelections = selections.length > 0;
  const pickedPanelState = isPickedPanelExpanded ? 'expanded' : 'collapsed';

  function addCrop(
    crop: CropProfile,
    quantity = 1,
    plantingForm?: PlantingMode,
  ) {
    setSelections((currentSelections) => {
      const existingSelection = currentSelections.find(
        (selection) => selection.cropId === crop.id,
      );

      if (!existingSelection) {
        return normalizeSeasonCropSelections([
          ...currentSelections,
          createSeasonCropSelection(crop, quantity, plantingForm),
        ]);
      }

      const nextQuantity = coerceTargetQuantity(
        existingSelection.quantity + quantity,
      );

      return normalizeSeasonCropSelections(
        currentSelections.map((selection) =>
          selection.cropId === crop.id
            ? {
                ...selection,
                plantingForm: normalizeSeasonPlantingForm(
                  crop,
                  nextQuantity,
                  selection.plantingForm,
                ),
                quantity: nextQuantity,
              }
            : selection,
        ),
      );
    });
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

      <div
        className={styles.layout}
        data-active-tab={activeTab}
        data-board-state={pickedPanelState}
      >
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
            today={analysisDate}
          />
        </div>

        <div
          aria-labelledby="choose-plants-board-tab"
          className={`${styles.panelSlot} ${styles.boardSlot}`}
          id="choose-plants-board-panel"
          role="tabpanel"
        >
          <button
            aria-label="Expand picked plants"
            aria-controls="choose-plants-board-content"
            aria-expanded={isPickedPanelExpanded}
            className={styles.collapsedBoard}
            onClick={() => setIsPickedPanelExpanded(true)}
            type="button"
          >
            <span className={styles.collapsedKicker}>Picked</span>
            <strong>{selections.length}</strong>
            <span>
              {plantCountLabel(selections)}
              {compareCropIds.length > 0
                ? ` · ${compareCropIds.length} compare`
                : ''}
            </span>
          </button>
          <div className={styles.boardStack} id="choose-plants-board-content">
            <div className={styles.boardPanelToolbar}>
              <button
                aria-controls="choose-plants-board-content"
                aria-expanded={isPickedPanelExpanded}
                className={styles.collapseBoardButton}
                onClick={() => setIsPickedPanelExpanded(false)}
                type="button"
              >
                Collapse picked side
              </button>
            </div>
            <SeasonCropBoard
              currentPlanCropOptions={currentPlanCropOptions}
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
              today={analysisDate}
            />
            {compareCropIds.length > 0 ? (
              <CropComparePanel
                explicitCompareCount={compareCropIds.length}
                garden={garden}
                id="choose-plants-compare-panel"
                layoutRequests={compareRequests}
                onClearCompare={() => setCompareSelections([])}
                sunExposureAtPlacement={sunExposureAtPlacement}
                today={analysisDate}
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

function plantCountLabel(selections: SeasonCropSelection[]) {
  const count = selections.reduce(
    (total, selection) => total + coerceTargetQuantity(selection.quantity),
    0,
  );

  return `${count} ${count === 1 ? 'plant' : 'plants'}`;
}

function buildCompareSelections(compareSelections: CompareCropSelection[]) {
  return compareSelections.flatMap((selection): SeasonCropSelection[] => {
    const crop = getCropById(selection.cropId);

    return crop ? [createSeasonCropSelection(crop, selection.quantity)] : [];
  });
}

function getInitialSelections(
  wantedCrops: SeasonCropSelection[],
  currentPlanCropIds: Set<string>,
) {
  return wantedCrops.filter(
    (selection) => !currentPlanCropIds.has(selection.cropId),
  );
}

function buildCurrentPlanCropOptions(garden: Garden): CurrentPlanCropOption[] {
  const optionsByCropId = new Map<
    string,
    Omit<CurrentPlanCropOption, 'label'>
  >();

  for (const planting of garden.plantings) {
    if (!planting.cropId) {
      continue;
    }

    const plantedQuantity = Math.max(
      planting.plantCount ?? planting.instances.length,
      1,
    );
    const existingOption = optionsByCropId.get(planting.cropId);
    const cropName =
      getCropById(planting.cropId)?.commonName ??
      planting.label ??
      'Unknown crop';

    optionsByCropId.set(planting.cropId, {
      cropId: planting.cropId,
      cropName,
      plantedQuantity: (existingOption?.plantedQuantity ?? 0) + plantedQuantity,
    });
  }

  return [...optionsByCropId.values()]
    .sort((left, right) => left.cropName.localeCompare(right.cropName))
    .map((option) => ({
      ...option,
      label: `${option.cropName} · ${option.plantedQuantity} on plot`,
    }));
}
