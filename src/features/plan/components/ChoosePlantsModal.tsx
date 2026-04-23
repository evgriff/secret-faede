import { useRef, useState, type KeyboardEvent } from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  PlantingMode,
  SeasonCropSelection,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import {
  closeOnBackdropMouseDown,
  trapDialogFocus,
  useDialogScrollLock,
  useEscapeToClose,
  useInitialDialogFocus,
} from '../../shared/design/dialogDismiss';
import { buildSeasonCropLayoutRequests } from '../seasonCropPlan';
import { needsSeasonCropReview } from '../seasonCropFitDisplay';
import sharedStyles from '../PlanModal.module.css';
import { SeasonCropBoard } from './ChoosePlantsBoard';
import { CropComparePanel } from './ChoosePlantsCompare';
import { ChoosePlantsLibrary } from './ChoosePlantsLibrary';
import styles from './ChoosePlantsModal.module.css';
import {
  createSeasonCropSelection,
  normalizeSeasonCropSelections,
} from './choosePlantsSelection';

type MobileTab = 'board' | 'compare' | 'library';
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
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
  const plantCount = selections.reduce(
    (total, selection) => total + coerceTargetQuantity(selection.quantity),
    0,
  );
  const reviewCount = layoutRequests.filter((request) =>
    needsSeasonCropReview(request.fit),
  ).length;

  useEscapeToClose(onClose);
  useDialogScrollLock();
  useInitialDialogFocus({
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    trapDialogFocus(event, dialogRef.current);
  }

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
    <div
      className={`${sharedStyles.modalBackdrop} ${styles.backdrop}`}
      onMouseDown={(event) => closeOnBackdropMouseDown(event, onClose)}
    >
      <section
        aria-labelledby="choose-plants-title"
        aria-modal="true"
        className={`${sharedStyles.modal} ${styles.modal}`}
        onKeyDown={handleDialogKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className={`${sharedStyles.modalHeader} ${styles.header}`}>
          <div>
            <h2 id="choose-plants-title">Choose Plants</h2>
            <p className={styles.headerMeta}>
              {selections.length} selected - {plantCount} plants
            </p>
          </div>
          <div
            className={styles.headerSummary}
            aria-label="Season planning summary"
          >
            <span>{layoutRequests.length} crops</span>
            <span>{plantCount} plants</span>
            <span>{reviewCount} review</span>
          </div>
          <button
            aria-label="Close choose plants"
            className={sharedStyles.iconButton}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            x
          </button>
        </div>

        <div
          className={styles.mobileTabs}
          role="tablist"
          aria-label="Choose plants sections"
        >
          <TabButton
            activeTab={activeTab}
            controlsId="choose-plants-library-panel"
            id="choose-plants-library-tab"
            tab="library"
            onSelect={setActiveTab}
          >
            Library
          </TabButton>
          <TabButton
            activeTab={activeTab}
            controlsId="choose-plants-board-panel"
            id="choose-plants-board-tab"
            tab="board"
            onSelect={setActiveTab}
          >
            Season Board
          </TabButton>
          <TabButton
            activeTab={activeTab}
            controlsId="choose-plants-compare-panel"
            id="choose-plants-compare-tab"
            tab="compare"
            onSelect={setActiveTab}
          >
            Compare
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
          </div>

          <CropComparePanel
            explicitCompareCount={compareCropIds.length}
            garden={garden}
            id="choose-plants-compare-panel"
            layoutRequests={compareRequests}
            onClearCompare={() => setCompareSelections([])}
            sunExposureAtPlacement={sunExposureAtPlacement}
          />
        </div>

        <footer className={styles.footer}>
          <p className={styles.footerSummary}>
            {layoutRequests.length} crops - {plantCount} plants - {reviewCount}{' '}
            review
          </p>
          <div className={styles.footerActions}>
            <button
              className={sharedStyles.secondaryButton}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={sharedStyles.secondaryButton}
              disabled={!hasSelections}
              onClick={() => setSelections([])}
              type="button"
            >
              Clear list
            </button>
            <button
              className={sharedStyles.secondaryButton}
              onClick={handleSave}
              type="button"
            >
              Save list
            </button>
            <button
              className={sharedStyles.primaryButton}
              disabled={!hasSelections}
              onClick={handleOptimize}
              type="button"
            >
              Save + Optimize
            </button>
          </div>
        </footer>
      </section>
    </div>
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
