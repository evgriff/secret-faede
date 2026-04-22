import { useState } from 'react';

import { getCropById } from '../../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  SeasonCropSelection,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import {
  buildSeasonCropLayoutRequests,
  type SeasonCropFitLevel,
  type SeasonCropLayoutRequest,
} from '../seasonCropPlan';
import sharedStyles from '../PlanModal.module.css';
import { SeasonCropBoard } from './ChoosePlantsBoard';
import { CropComparePanel } from './ChoosePlantsCompare';
import { ChoosePlantsLibrary } from './ChoosePlantsLibrary';
import styles from './ChoosePlantsModal.module.css';
import {
  createSeasonCropSelection,
  normalizeSelectionRanks,
} from './choosePlantsSelection';

type MobileTab = 'board' | 'compare' | 'library';
const maxCompareCrops = 3;

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
  const [compareCropIds, setCompareCropIds] = useState<string[]>([]);
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
        wantedCrops: buildCompareSelections(compareCropIds),
      },
    },
    sunExposureAtPlacement,
  );
  const fitSummary = getFitSummary(layoutRequests);
  const hasSelections = selections.length > 0;

  function addCrop(crop: CropProfile) {
    if (selectedCropIds.has(crop.id)) {
      return;
    }

    setSelections((currentSelections) => [
      ...currentSelections,
      createSeasonCropSelection(crop, currentSelections.length),
    ]);
  }

  function toggleCompareCrop(crop: CropProfile) {
    setCompareCropIds((currentCropIds) => {
      if (currentCropIds.includes(crop.id)) {
        return currentCropIds.filter((cropId) => cropId !== crop.id);
      }

      if (currentCropIds.length >= maxCompareCrops) {
        return currentCropIds;
      }

      return [...currentCropIds, crop.id];
    });
  }

  function handleSave() {
    onSave(normalizeSelectionRanks(selections));
  }

  function handleOptimize() {
    onOptimize(normalizeSelectionRanks(selections));
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
              targetQuantity:
                values.targetQuantity === undefined
                  ? selection.targetQuantity
                  : coerceTargetQuantity(values.targetQuantity),
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
      return normalizeSelectionRanks(nextSelections);
    });
  }

  return (
    <div className={`${sharedStyles.modalBackdrop} ${styles.backdrop}`}>
      <section
        aria-labelledby="choose-plants-title"
        aria-modal="true"
        className={`${sharedStyles.modal} ${styles.modal}`}
        role="dialog"
      >
        <div className={`${sharedStyles.modalHeader} ${styles.header}`}>
          <div>
            <h2 id="choose-plants-title">Choose Plants</h2>
            <p className={styles.headerMeta}>
              {selections.length} selected - {fitSummary.confidence}
            </p>
          </div>
          <div className={styles.headerSummary} aria-label="Season fit summary">
            <span>{layoutRequests.length} crop candidates</span>
            <span>{fitSummary.good} great fit</span>
            <span>{fitSummary.workable} workable</span>
            <span>{fitSummary.caution + fitSummary.unlikely} need review</span>
          </div>
          <button
            aria-label="Close"
            className={sharedStyles.iconButton}
            onClick={onClose}
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
            tab="library"
            onSelect={setActiveTab}
          >
            Library
          </TabButton>
          <TabButton activeTab={activeTab} tab="board" onSelect={setActiveTab}>
            Season Board
          </TabButton>
          <TabButton
            activeTab={activeTab}
            tab="compare"
            onSelect={setActiveTab}
          >
            Compare
          </TabButton>
        </div>

        <div className={styles.layout} data-active-tab={activeTab}>
          <div className={`${styles.panelSlot} ${styles.librarySlot}`}>
            <ChoosePlantsLibrary
              compareCropIds={compareCropIds}
              garden={garden}
              onAddCrop={addCrop}
              onToggleCompare={toggleCompareCrop}
              selectedCropIds={selectedCropIds}
              sunExposureAtPlacement={sunExposureAtPlacement}
            />
          </div>

          <div className={`${styles.panelSlot} ${styles.boardSlot}`}>
            <SeasonCropBoard
              garden={garden}
              layoutRequests={layoutRequests}
              onMoveSelection={moveSelection}
              onRemoveSelection={(selectionId) =>
                setSelections((currentSelections) =>
                  normalizeSelectionRanks(
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
            layoutRequests={
              compareRequests.length > 0 ? compareRequests : layoutRequests
            }
            onClearCompare={() => setCompareCropIds([])}
          />
        </div>

        <div className={`${sharedStyles.modalActions} ${styles.footer}`}>
          <p className={styles.footerSummary}>
            {layoutRequests.length} crop candidates - {fitSummary.confidence}
          </p>
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
      </section>
    </div>
  );
}

function TabButton({
  activeTab,
  children,
  onSelect,
  tab,
}: {
  activeTab: MobileTab;
  children: string;
  onSelect(tab: MobileTab): void;
  tab: MobileTab;
}) {
  return (
    <button
      aria-selected={activeTab === tab}
      onClick={() => onSelect(tab)}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}

function getFitSummary(layoutRequests: SeasonCropLayoutRequest[]) {
  const counts = layoutRequests.reduce(
    (summary, request) => ({
      ...summary,
      [toFitBucket(request.fit.level)]:
        summary[toFitBucket(request.fit.level)] + 1,
    }),
    { caution: 0, good: 0, unlikely: 0, workable: 0 },
  );

  return {
    ...counts,
    confidence:
      layoutRequests.length === 0
        ? 'No crops selected'
        : counts.unlikely > 0
          ? 'Needs fit review'
          : counts.caution > 0
            ? 'Mixed confidence'
            : 'High confidence',
  };
}

function toFitBucket(
  level: SeasonCropFitLevel,
): 'caution' | 'good' | 'unlikely' | 'workable' {
  if (level === 'greatFit') {
    return 'good';
  }

  if (level === 'unlikelyFit') {
    return 'unlikely';
  }

  return level;
}

function coerceTargetQuantity(value: number) {
  return Math.max(1, Math.min(999, Math.round(value || 1)));
}

function buildCompareSelections(cropIds: string[]) {
  return cropIds.flatMap((cropId, index): SeasonCropSelection[] => {
    const crop = getCropById(cropId);

    return crop ? [createSeasonCropSelection(crop, index)] : [];
  });
}
