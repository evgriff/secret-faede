import {
  lazy,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useServices } from '../../app/providers';
import type {
  Garden,
  AuthorableStructureType,
  LayoutProblem,
  LayoutResolutionOption,
  Planting,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import {
  createGardenChangesetSummary,
  prepareGardenForUser,
  type GardenChangesetSummary,
  type GardenPublishConflict,
} from '../../domain/gardens/gardenWorkspace';
import { LoadingState } from '../../shared/ui/LoadingState';
import { useNetworkStatus } from '../../shared/network/networkStatus';
import { useAuth } from '../auth/auth-context';
import {
  findPlanWarnings,
  isInspectorPlanWarning,
  isUserFacingPlanWarning,
  type PlanWarning,
} from '../garden/gardenPlanning';
import {
  buildReviewSuggestions,
  type ReviewSuggestion,
} from '../garden/reviewSuggestions';
import {
  findSunShadeLayer,
  getSunAreaAtPoint,
  type SunSeason,
} from '../garden/sunShadeEngine';
import {
  createAddPlantingPreview,
  useGarden,
  type AddPlantingRequest,
  type SelectedGardenItem,
} from '../garden/useGarden';
import {
  buildAutoLayoutReviewSuggestions,
  getAutoLayoutReviewSuggestionId,
} from './autoLayoutReviewSuggestions';
import type {
  AutoLayoutCandidate,
  AutoLayoutRunStatus,
} from './autoLayoutTypes';
import { allowAutoLayoutStagePaint } from './autoLayoutRunState';
import { PlanCanvas } from './components/PlanCanvas';
import { PlanTopBar } from './components/PlanTopBar';
import { usePlanKeyboardShortcuts } from './hooks/usePlanKeyboardShortcuts';
import { buildLayoutProblemResolutionModel } from './layoutProblemResolution';
import { syncSetupProfile } from './planPageActions';
import {
  buildAutoLayoutProposalDiffOverlay,
  buildReviewSuggestionDiffOverlay,
} from './proposalDiffOverlay';
import {
  areSamePlanItem,
  getPlanItemKey,
  type PlanItemRef,
} from './planInteractionGeometry';
import {
  buildAlignUpdates,
  buildDistributeHorizontalUpdates,
  buildNudgeUpdates,
  filterExistingSelection,
  mergeSelection,
  selectAllForMode,
  toggleSelection,
  type PlanAlignment,
} from './planSelectionActions';
import type { PlanMode } from './planModes';
import styles from './PlanPage.module.css';

const FirstRunSetupWizard = lazy(() =>
  import('./components/FirstRunSetupWizard').then((module) => ({
    default: module.FirstRunSetupWizard,
  })),
);
const AddPlantModal = lazy(() =>
  import('../garden/AddPlantModal').then((module) => ({
    default: module.AddPlantModal,
  })),
);
const PlotSettingsModal = lazy(() =>
  import('../garden/PlotSettingsModal').then((module) => ({
    default: module.PlotSettingsModal,
  })),
);
const ChoosePlantsModal = lazy(() =>
  import('./components/ChoosePlantsModal').then((module) => ({
    default: module.ChoosePlantsModal,
  })),
);
const PlanInspector = lazy(() =>
  import('./components/PlanInspector').then((module) => ({
    default: module.PlanInspector,
  })),
);
const PlanModeDrawer = lazy(() =>
  import('./components/PlanModeDrawer').then((module) => ({
    default: module.PlanModeDrawer,
  })),
);
const PlanActionRail = lazy(() =>
  import('./components/PlanActionRail').then((module) => ({
    default: module.PlanActionRail,
  })),
);
const PlanSelectionToolbar = lazy(() =>
  import('./components/PlanSelectionToolbar').then((module) => ({
    default: module.PlanSelectionToolbar,
  })),
);
const loadPlanOperationsPanel = () =>
  import('./components/PlanOperationsPanel');
const PlanOperationsPanel = lazy(() =>
  loadPlanOperationsPanel().then((module) => ({
    default: module.PlanOperationsPanel,
  })),
);
const PlantEditorSheet = lazy(() =>
  import('./components/PlantEditorSheet').then((module) => ({
    default: module.PlantEditorSheet,
  })),
);
const PlanPublishModal = lazy(() =>
  import('./components/PlanPublishModal').then((module) => ({
    default: module.PlanPublishModal,
  })),
);
const RevisionHistoryModal = lazy(() =>
  import('./components/PlanPublishModal').then((module) => ({
    default: module.RevisionHistoryModal,
  })),
);

export function PlanPage() {
  const { state } = useAuth();
  const { environment, telemetryService, userProfileRepository } =
    useServices();
  const networkStatus = useNetworkStatus();
  const isOffline = networkStatus === 'offline';
  const userId = state.user?.uid ?? null;
  const routeTargetId =
    window.location.search.match(/[?&]p=([^&]+)/)?.[1] ?? null;
  const {
    acceptReviewSuggestion,
    addLinkedSupportStructure,
    addPlant,
    addStructure,
    applyAutoLayoutProposal,
    applyPlotSettings,
    closeDetailedView,
    closePlantGroupEditor,
    completeGardenSetup,
    deleteItems,
    deleteSelectedItem,
    detailedViewState,
    discardDraft,
    dirty,
    duplicateItems,
    duplicatePlanting,
    duplicateStructure,
    error,
    flushInteractionCommits,
    garden,
    hidePlantGroupLabel,
    hoveredPlantGroupId,
    interactionSavePending,
    labelVisibility,
    linkSupportStructure,
    markPlantingsPlanted,
    openDetailedViewForItem,
    openPlantGroupEditor,
    paintSunShadeCell,
    plantEditorState,
    publishDraft,
    queueInteractionPositionCommit,
    queueInteractionRectCommit,
    recalculateSunShade,
    recordSuggestionDecision,
    redoGardenChange,
    revertToRevision,
    resizePlantingRect,
    resizeStructure,
    resizeStructureRect,
    saveGarden,
    saveDraftGarden,
    saveStatus,
    selectLayoutProblem,
    selectedItem,
    setupRequired,
    setHoveredPlantGroupId,
    setPlantLabelVisibility,
    setLayoutReviewState,
    setLocationMatchSunExposure,
    setSelectedItem,
    showPlantGroupLabel,
    snoozeReviewSuggestion,
    status,
    undoGardenChange,
    unlinkSupportStructure,
    updateItemPositions,
    updatePlanting,
    updateSeasonCropSelections,
    updateStructure,
    updateStructureShade,
    workspace,
    suggestionDecisions,
  } = useGarden(userId);
  const [activeMode, setActiveMode] = useState<PlanMode>('select');
  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<PlanItemRef[]>([]);
  const [isAddPlantOpen, setIsAddPlantOpen] = useState(false);
  const [addPlantPreview, setAddPlantPreview] = useState<Planting | null>(null);
  const [isChoosePlantsOpen, setIsChoosePlantsOpen] = useState(false);
  const [autoLayoutSuggestion, setAutoLayoutSuggestion] =
    useState<AutoLayoutCandidate | null>(null);
  const [activeReviewSuggestionId, setActiveReviewSuggestionId] = useState<
    string | null
  >(null);
  const [selectedLayoutProblemId, setSelectedLayoutProblemId] = useState<
    string | null
  >(null);
  const [optimizerStatus, setOptimizerStatus] =
    useState<AutoLayoutRunStatus>('idle');
  const [optimizerIncludesDraftSave, setOptimizerIncludesDraftSave] =
    useState(false);
  const [optimizerMessage, setOptimizerMessage] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPlotSettingsOpen, setIsPlotSettingsOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [structureType, setStructureType] =
    useState<AuthorableStructureType>('raisedBed');
  const [accessiblePathDefaults, setAccessiblePathDefaults] = useState(false);
  const [showSunOverlay, setShowSunOverlay] = useState(false);
  const [sunSeason, setSunSeason] = useState<SunSeason>('summer');
  const [manualSunEdit, setManualSunEdit] = useState(false);
  const [manualSunExposure, setManualSunExposure] =
    useState<SunExposure>('partShade');
  const [acknowledgedWarningIds, setAcknowledgedWarningIds] = useState<
    string[]
  >([]);
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [suppressedSelectionKey, setSuppressedSelectionKey] = useState<
    string | null
  >(null);
  const [publishConflict, setPublishConflict] =
    useState<GardenPublishConflict | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<
    'idle' | 'publishing' | 'reverting'
  >('idle');
  const [planInteractionState, setPlanInteractionState] = useState<
    'drag' | 'idle' | 'marquee' | 'pan' | 'press' | 'resize'
  >('idle');
  const trackedWarningIds = useRef<Set<string>>(new Set());
  const [planWarnings, setPlanWarnings] = useState<PlanWarning[]>([]);
  const activeSunLayer = useMemo(
    () => (garden ? findSunShadeLayer(garden, sunSeason) : null),
    [garden, sunSeason],
  );

  useEffect(() => {
    if (!garden) {
      setPlanWarnings([]);
      return undefined;
    }

    if (planInteractionState !== 'idle') {
      return undefined;
    }

    let canceled = false;
    const cancelWarningTask = scheduleIdlePlanTask(() => {
      if (canceled) {
        return;
      }

      setPlanWarnings(
        findPlanWarnings(
          garden,
          activeSunLayer
            ? {
                sunLayer: activeSunLayer,
                sunSeason,
              }
            : { sunSeason },
        ),
      );
    });

    return () => {
      canceled = true;
      cancelWarningTask();
    };
  }, [activeSunLayer, garden, planInteractionState, sunSeason]);
  const activePlanWarnings = useMemo(
    () =>
      planWarnings.filter(
        (warning) =>
          isUserFacingPlanWarning(warning) &&
          !acknowledgedWarningIds.includes(warning.id),
      ),
    [acknowledgedWarningIds, planWarnings],
  );
  const inspectorPlanWarnings = useMemo(
    () => activePlanWarnings.filter(isInspectorPlanWarning),
    [activePlanWarnings],
  );
  const reviewSuggestions = useMemo(
    () =>
      garden
        ? [
            ...buildAutoLayoutReviewSuggestions(autoLayoutSuggestion),
            ...buildReviewSuggestions({
              garden,
              sunLayer: activeSunLayer,
              warnings: activePlanWarnings,
            }),
          ]
        : [],
    [activePlanWarnings, activeSunLayer, autoLayoutSuggestion, garden],
  );
  const activeReviewSuggestion =
    reviewSuggestions.find(
      (suggestion) => suggestion.id === activeReviewSuggestionId,
    ) ?? null;
  const layoutProblemResolutionModel = useMemo(
    () =>
      garden
        ? buildLayoutProblemResolutionModel({
            candidate: autoLayoutSuggestion,
            garden,
            reviewSuggestions,
            suggestionDecisions,
            warnings: activePlanWarnings,
          })
        : {
            problems: [],
            resolutionOptions: [],
            resolutions: [],
            suggestion: null,
          },
    [
      activePlanWarnings,
      autoLayoutSuggestion,
      garden,
      reviewSuggestions,
      suggestionDecisions,
    ],
  );
  const proposalDiffOverlay = useMemo(() => {
    if (!garden || activeMode !== 'optimize') {
      return null;
    }

    if (activeReviewSuggestion) {
      return buildReviewSuggestionDiffOverlay({
        garden,
        suggestion: activeReviewSuggestion,
      });
    }

    if (autoLayoutSuggestion) {
      return buildAutoLayoutProposalDiffOverlay({
        candidate: autoLayoutSuggestion,
        currentWarnings: activePlanWarnings,
        garden,
        sunLayer: activeSunLayer,
        sunSeason,
      });
    }

    return null;
  }, [
    activeMode,
    activeReviewSuggestion,
    activeSunLayer,
    activePlanWarnings,
    autoLayoutSuggestion,
    garden,
    sunSeason,
  ]);

  useEffect(() => {
    setLayoutReviewState({
      problems: layoutProblemResolutionModel.problems,
      resolutionOptions: layoutProblemResolutionModel.resolutionOptions,
      resolutions: layoutProblemResolutionModel.resolutions,
      selectedProblemId: selectedLayoutProblemId,
    });
  }, [
    layoutProblemResolutionModel.problems,
    layoutProblemResolutionModel.resolutionOptions,
    layoutProblemResolutionModel.resolutions,
    selectedLayoutProblemId,
    setLayoutReviewState,
  ]);
  const draftSummary = useMemo(
    () =>
      garden && workspace
        ? createGardenChangesetSummary(
            prepareGardenForUser(workspace.published.garden, garden.userId),
            garden,
            suggestionDecisions,
          )
        : null,
    [garden, suggestionDecisions, workspace],
  );
  const hasPlanChanges = Boolean(
    draftSummary && hasPlanWorkspaceChanges(draftSummary),
  );
  const canPublish = hasPlanChanges;
  const workspaceState =
    workspace?.draftIsStale && hasPlanChanges
      ? 'stale'
      : hasPlanChanges || dirty
        ? 'draft'
        : 'published';
  const topBarDirty = dirty && !interactionSavePending;
  const nextPlacementSunArea = useMemo(() => {
    if (!garden || !activeSunLayer) {
      return null;
    }

    return getSunAreaAtPoint(activeSunLayer, {
      xFt: garden.plot.widthFt / 2,
      yFt: garden.plot.depthFt / 2,
    });
  }, [activeSunLayer, garden]);

  useEffect(() => {
    setLocationMatchSunExposure(nextPlacementSunArea?.exposure ?? null);
  }, [nextPlacementSunArea?.exposure, setLocationMatchSunExposure]);

  useEffect(() => {
    setAcknowledgedWarningIds((currentIds) =>
      currentIds.filter((id) =>
        planWarnings.some((warning) => warning.id === id),
      ),
    );
  }, [planWarnings]);

  useEffect(() => {
    planWarnings.forEach((warning) => {
      if (trackedWarningIds.current.has(warning.id)) {
        return;
      }

      trackedWarningIds.current.add(warning.id);
      telemetryService.trackEvent('warning_shown', {
        kind: warning.kind,
        severity: warning.severity,
      });
    });
  }, [planWarnings, telemetryService]);

  useEffect(() => {
    if (!garden) {
      setSelectedItems([]);
      return;
    }

    setSelectedItems((currentSelection) =>
      filterExistingSelection(garden, currentSelection),
    );
  }, [garden]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedItems([]);
      setPlantLabelVisibility({ groupIds: [], mode: 'auto' });

      if (!detailedViewState.isOpen) {
        closePlantGroupEditor();
      }
    }
  }, [
    closePlantGroupEditor,
    detailedViewState.isOpen,
    selectedItem,
    setPlantLabelVisibility,
  ]);

  const selectedItemKey = useMemo(
    () => (selectedItem ? getPlanItemKey(selectedItem) : null),
    [selectedItem],
  );

  useEffect(() => {
    if (suppressedSelectionKey && selectedItemKey !== suppressedSelectionKey) {
      setSuppressedSelectionKey(null);
    }
  }, [selectedItemKey, suppressedSelectionKey]);

  useEffect(() => {
    if (!garden || !routeTargetId) {
      return;
    }

    const routeSelection: PlanItemRef | null = garden.plantings.some(
      (planting) => planting.id === routeTargetId,
    )
      ? { id: routeTargetId, type: 'planting' }
      : garden.structures.some((structure) => structure.id === routeTargetId)
        ? { id: routeTargetId, type: 'structure' }
        : null;

    if (!routeSelection) {
      return;
    }

    setSelectedItem(routeSelection);
    setSelectedItems([routeSelection]);
    setSuppressedSelectionKey(null);
  }, [garden, routeTargetId, setSelectedItem]);
  const isSelectionSurfaceSuppressed =
    selectedItemKey !== null && suppressedSelectionKey === selectedItemKey;
  const isPointerInteractionActive = planInteractionState !== 'idle';
  const isSelectionSurfaceVisible =
    selectedItems.length <= 1 &&
    selectedItem !== null &&
    !isSelectionSurfaceSuppressed &&
    !isPointerInteractionActive;
  const cropFocusItem =
    isSelectionSurfaceVisible && selectedItem?.type === 'planting'
      ? selectedItem
      : null;
  const contextSurfaceItem =
    isSelectionSurfaceVisible && selectedItem?.type === 'structure'
      ? selectedItem
      : null;

  useEffect(() => {
    setPlantLabelVisibility({
      groupIds: cropFocusItem ? [cropFocusItem.id] : [],
      mode: 'auto',
    });
  }, [cropFocusItem, setPlantLabelVisibility]);

  const isDragLikeInteraction =
    planInteractionState === 'drag' ||
    planInteractionState === 'marquee' ||
    planInteractionState === 'pan' ||
    planInteractionState === 'resize';

  useEffect(() => {
    if (!isDragLikeInteraction) {
      return;
    }

    setSuppressedSelectionKey(selectedItemKey);
    setHoveredPlantGroupId(null);
    setPlantLabelVisibility({ groupIds: [], mode: 'auto' });
    closePlantGroupEditor();

    if (detailedViewState.isOpen) {
      closeDetailedView();
    }

    if (activeMode === 'select') {
      setIsContextPanelOpen(false);
    }
  }, [
    activeMode,
    closeDetailedView,
    closePlantGroupEditor,
    detailedViewState.isOpen,
    isDragLikeInteraction,
    selectedItemKey,
    setHoveredPlantGroupId,
    setPlantLabelVisibility,
  ]);

  useEffect(() => {
    if (activeMode !== 'select') {
      setIsContextPanelOpen(true);
      return;
    }

    if (contextSurfaceItem?.type === 'structure') {
      setIsContextPanelOpen(true);
      return;
    }

    setIsContextPanelOpen(false);
  }, [activeMode, contextSurfaceItem]);

  const selectedPlantIds = useMemo(
    () => [
      ...new Set(
        selectedItems
          .filter((item) => item.type === 'planting')
          .map((item) => item.id),
      ),
    ],
    [selectedItems],
  );
  const selectedPlantCount = selectedPlantIds.length;
  const selectedStructureIds = useMemo(
    () =>
      selectedItems
        .filter((item) => item.type === 'structure')
        .map((item) => item.id),
    [selectedItems],
  );
  const selectedStructureCount = selectedStructureIds.length;
  const visiblePlantLabelIds = useMemo(() => {
    if (!garden || labelVisibility.mode === 'hidden') {
      return [];
    }

    if (labelVisibility.mode === 'visible') {
      return garden.plantings.map((planting) => planting.id);
    }

    return [...new Set(labelVisibility.groupIds)];
  }, [garden, labelVisibility]);
  const planCanvasHoveredPlantGroupId = isPointerInteractionActive
    ? null
    : hoveredPlantGroupId;
  const planCanvasVisiblePlantLabelIds = isPointerInteractionActive
    ? []
    : visiblePlantLabelIds;

  const syncTransientPlantInteraction = useCallback(
    (
      nextSelection: PlanItemRef[],
      primaryItem: SelectedGardenItem | null,
      options?: { openSurface?: boolean },
    ) => {
      const shouldOpenSurface =
        Boolean(options?.openSurface) && nextSelection.length === 1;
      const effectiveMode = shouldOpenSurface ? 'select' : activeMode;
      const nextPrimaryKey = primaryItem ? getPlanItemKey(primaryItem) : null;
      const nextPrimaryPlantId =
        primaryItem?.type === 'planting' ? primaryItem.id : null;

      setHoveredPlantGroupId(null);

      if (!shouldOpenSurface) {
        setSuppressedSelectionKey(nextPrimaryKey);

        if (labelVisibility.mode !== 'visible') {
          setPlantLabelVisibility({
            groupIds: nextSelection
              .filter((item) => item.type === 'planting')
              .map((item) => item.id),
            mode: 'auto',
          });
        }

        if (detailedViewState.isOpen && primaryItem) {
          openDetailedViewForItem(primaryItem);

          if (primaryItem.type === 'planting') {
            setIsContextPanelOpen(false);

            if (plantEditorState.isOpen) {
              openPlantGroupEditor(primaryItem.id, 'detailedView', {
                tab: plantEditorState.tab,
              });
            }

            return;
          }

          closePlantGroupEditor();
          setIsContextPanelOpen(true);
          return;
        }

        if (plantEditorState.isOpen) {
          closePlantGroupEditor();
        }

        if (effectiveMode === 'select') {
          setIsContextPanelOpen(false);
        }

        return;
      }

      setSuppressedSelectionKey(null);

      if (detailedViewState.isOpen && primaryItem) {
        openDetailedViewForItem(primaryItem);

        if (primaryItem.type === 'planting') {
          setIsContextPanelOpen(false);
          openPlantGroupEditor(primaryItem.id, 'detailedView', {
            tab: plantEditorState.tab,
          });
          return;
        }

        closePlantGroupEditor();
        setIsContextPanelOpen(true);
        return;
      }

      if (
        plantEditorState.isOpen &&
        plantEditorState.groupId !== nextPrimaryPlantId
      ) {
        closePlantGroupEditor();
      }

      if (primaryItem?.type === 'structure') {
        setIsContextPanelOpen(true);
        return;
      }

      if (effectiveMode === 'select') {
        setIsContextPanelOpen(false);
      }
    },
    [
      activeMode,
      closePlantGroupEditor,
      detailedViewState.isOpen,
      labelVisibility.mode,
      openDetailedViewForItem,
      openPlantGroupEditor,
      plantEditorState.isOpen,
      plantEditorState.groupId,
      plantEditorState.tab,
      setHoveredPlantGroupId,
      setPlantLabelVisibility,
    ],
  );

  const handleSelectItem = useCallback(
    (
      item: SelectedGardenItem,
      additive: boolean,
      options?: { openSurface?: boolean },
    ) => {
      setSelectedItems((currentSelection) => {
        const nextSelection = additive
          ? toggleSelection(currentSelection, item)
          : [item];
        const primaryItem = nextSelection.at(-1) ?? null;
        const shouldOpenSurface =
          Boolean(options?.openSurface) &&
          !additive &&
          nextSelection.length === 1;

        if (
          !shouldOpenSurface &&
          areSelectionsEqual(currentSelection, nextSelection) &&
          selectedItem &&
          primaryItem &&
          areSamePlanItem(selectedItem, primaryItem)
        ) {
          return currentSelection;
        }

        if (shouldOpenSurface) {
          setActiveMode('select');
        }

        setSelectedItem(primaryItem);
        syncTransientPlantInteraction(nextSelection, primaryItem, {
          openSurface: shouldOpenSurface,
        });
        return nextSelection;
      });
    },
    [selectedItem, setSelectedItem, syncTransientPlantInteraction],
  );

  const handleMarqueeSelect = useCallback(
    (items: PlanItemRef[], additive: boolean) => {
      setSelectedItems((currentSelection) => {
        const nextSelection = additive
          ? mergeSelection(currentSelection, items)
          : items;
        const primaryItem = nextSelection.at(-1) ?? null;

        if (nextSelection.length === 0 && detailedViewState.isOpen) {
          setHoveredPlantGroupId(null);
          setPlantLabelVisibility({ groupIds: [], mode: 'auto' });
          setSuppressedSelectionKey(selectedItemKey);
          return currentSelection;
        }

        if (
          nextSelection.length === 0 &&
          currentSelection.length === 0 &&
          !selectedItem
        ) {
          return currentSelection;
        }

        if (areSelectionsEqual(currentSelection, nextSelection)) {
          return currentSelection;
        }

        setSelectedItem(primaryItem);
        syncTransientPlantInteraction(nextSelection, primaryItem, {
          openSurface: false,
        });
        return nextSelection;
      });
    },
    [
      detailedViewState.isOpen,
      selectedItem,
      selectedItemKey,
      setHoveredPlantGroupId,
      setPlantLabelVisibility,
      setSelectedItem,
      syncTransientPlantInteraction,
    ],
  );

  const handleDeleteSelection = useCallback(() => {
    const selection = selectedItems.length
      ? selectedItems
      : selectedItem
        ? [selectedItem]
        : [];

    if (selection.length > 0) {
      deleteItems(selection);
      setSelectedItems([]);
      return;
    }

    deleteSelectedItem();
  }, [deleteItems, deleteSelectedItem, selectedItem, selectedItems]);

  const handleDuplicateSelection = useCallback(() => {
    const selection = selectedItems.length
      ? selectedItems
      : selectedItem
        ? [selectedItem]
        : [];
    const duplicatedItems = duplicateItems(selection);

    if (duplicatedItems.length > 0) {
      const primaryItem = duplicatedItems[0] ?? null;

      setSelectedItems(duplicatedItems);
      setSelectedItem(primaryItem);
      syncTransientPlantInteraction(duplicatedItems, primaryItem, {
        openSurface: false,
      });
    }
  }, [
    duplicateItems,
    selectedItem,
    selectedItems,
    setSelectedItem,
    syncTransientPlantInteraction,
  ]);

  const handleMarkSelectedPlanted = useCallback(
    (plantedOn: string) => {
      if (selectedPlantIds.length === 0) {
        return;
      }

      markPlantingsPlanted(selectedPlantIds, plantedOn);
    },
    [markPlantingsPlanted, selectedPlantIds],
  );

  const handleNudgeSelection = useCallback(
    (deltaXFt: number, deltaYFt: number) => {
      if (!garden || selectedItems.length === 0) {
        return;
      }

      updateItemPositions(
        buildNudgeUpdates(garden, selectedItems, deltaXFt, deltaYFt),
      );
    },
    [garden, selectedItems, updateItemPositions],
  );

  const handleSelectAllForCurrentLayer = useCallback(() => {
    if (!garden) {
      return;
    }

    const nextSelection = selectAllForMode(garden, activeMode);
    const primaryItem = nextSelection[0] ?? null;
    setSelectedItems(nextSelection);
    setSelectedItem(primaryItem);
    syncTransientPlantInteraction(nextSelection, primaryItem, {
      openSurface: false,
    });
  }, [activeMode, garden, setSelectedItem, syncTransientPlantInteraction]);

  const handleSetActiveMode = useCallback(
    (mode: PlanMode) => {
      setActiveMode(mode);
      setIsContextPanelOpen(mode !== 'select' || Boolean(selectedItem));
    },
    [selectedItem],
  );

  const handleAddPlantPreviewChange = useCallback(
    (request: AddPlantingRequest | null) => {
      setAddPlantPreview(
        garden && request ? createAddPlantingPreview(garden, request) : null,
      );
    },
    [garden],
  );

  const handleCloseAddPlantModal = useCallback(() => {
    setAddPlantPreview(null);
    setIsAddPlantOpen(false);
  }, []);

  const handleOpenInspector = useCallback(() => {
    if (!selectedItem) {
      return;
    }

    setActiveMode('select');
    setSuppressedSelectionKey(null);

    if (
      selectedItem.type === 'planting' &&
      detailedViewState.isOpen &&
      detailedViewState.subject?.type === 'plantGroup' &&
      detailedViewState.subject.groupId === selectedItem.id
    ) {
      closeDetailedView();
      closePlantGroupEditor();
      setPlantLabelVisibility({ groupIds: [], mode: 'auto' });
      return;
    }

    if (
      selectedItem.type === 'structure' &&
      detailedViewState.isOpen &&
      detailedViewState.subject?.type === 'structure' &&
      detailedViewState.subject.structureId === selectedItem.id
    ) {
      closeDetailedView();
      setIsContextPanelOpen(false);
      return;
    }

    openDetailedViewForItem(selectedItem);

    if (selectedItem.type === 'planting') {
      setIsContextPanelOpen(false);
      showPlantGroupLabel(selectedItem.id);
      openPlantGroupEditor(selectedItem.id, 'detailedView', { tab: 'summary' });
      return;
    }

    setIsContextPanelOpen(true);
  }, [
    closeDetailedView,
    closePlantGroupEditor,
    detailedViewState.isOpen,
    detailedViewState.subject,
    openDetailedViewForItem,
    openPlantGroupEditor,
    selectedItem,
    setPlantLabelVisibility,
    showPlantGroupLabel,
  ]);

  const handleOpenPlantGroupEditor = useCallback(
    (plantId: string) => {
      const item = { id: plantId, type: 'planting' as const };

      setActiveMode('select');
      setIsContextPanelOpen(false);
      setSuppressedSelectionKey(null);
      setSelectedItems([item]);
      setSelectedItem(item);
      showPlantGroupLabel(plantId);

      if (detailedViewState.isOpen) {
        openDetailedViewForItem(item);
        openPlantGroupEditor(plantId, 'detailedView', { tab: 'summary' });
        return;
      }

      closeDetailedView();
      openPlantGroupEditor(plantId, 'wrench', { tab: 'summary' });
    },
    [
      closeDetailedView,
      detailedViewState.isOpen,
      openDetailedViewForItem,
      openPlantGroupEditor,
      setSelectedItem,
      showPlantGroupLabel,
    ],
  );

  const handleClosePlantEditor = useCallback(() => {
    closePlantGroupEditor();
    setIsContextPanelOpen(false);
    setPlantLabelVisibility({ groupIds: [], mode: 'auto' });

    if (detailedViewState.subject?.type === 'plantGroup') {
      closeDetailedView();
    }
  }, [
    closeDetailedView,
    closePlantGroupEditor,
    detailedViewState.subject,
    setPlantLabelVisibility,
  ]);

  const handleDeleteFromPlantEditor = useCallback(() => {
    handleDeleteSelection();
    closePlantGroupEditor();
    closeDetailedView();
    setPlantLabelVisibility({ groupIds: [], mode: 'auto' });
    setIsContextPanelOpen(false);
  }, [
    closeDetailedView,
    closePlantGroupEditor,
    handleDeleteSelection,
    setPlantLabelVisibility,
  ]);

  const handleDuplicateFromPlantEditor = useCallback(
    (plantId: string) => {
      const duplicateId = duplicatePlanting(plantId);

      if (!duplicateId) {
        return;
      }

      const item = { id: duplicateId, type: 'planting' as const };
      setSelectedItems([item]);
      setSelectedItem(item);
      setSuppressedSelectionKey(null);
      showPlantGroupLabel(duplicateId);
      if (plantEditorState.source === 'detailedView') {
        openDetailedViewForItem(item);
      }
      openPlantGroupEditor(duplicateId, plantEditorState.source ?? 'wrench', {
        tab: plantEditorState.tab,
      });
    },
    [
      duplicatePlanting,
      openDetailedViewForItem,
      openPlantGroupEditor,
      plantEditorState.source,
      plantEditorState.tab,
      setSelectedItem,
      showPlantGroupLabel,
    ],
  );

  const handleCloseContextPanel = useCallback(() => {
    setIsContextPanelOpen(false);
    closeDetailedView();
    closePlantGroupEditor();
  }, [closeDetailedView, closePlantGroupEditor]);

  const handleAlignSelection = useCallback(
    (alignment: PlanAlignment) => {
      if (!garden) {
        return;
      }

      updateItemPositions(buildAlignUpdates(garden, selectedItems, alignment));
    },
    [garden, selectedItems, updateItemPositions],
  );

  const handleDistributeSelection = useCallback(() => {
    if (!garden) {
      return;
    }

    updateItemPositions(
      buildDistributeHorizontalUpdates(garden, selectedItems),
    );
  }, [garden, selectedItems, updateItemPositions]);

  usePlanKeyboardShortcuts({
    deleteSelectedItem: handleDeleteSelection,
    nudgeSelection: handleNudgeSelection,
    redoGardenChange,
    saveGarden: () => void saveGarden(),
    selectAllForCurrentLayer: handleSelectAllForCurrentLayer,
    setActiveMode: handleSetActiveMode,
    undoGardenChange,
  });

  if (status === 'error') {
    return (
      <section className="pageShell pageCard stack">
        <h1 className="pageTitle">Plan</h1>
        <p className={styles.error} role="alert">
          {error ?? 'Unable to load your garden.'}
        </p>
      </section>
    );
  }

  if (status === 'loading' || !garden || !activeSunLayer) {
    return (
      <LoadingState message="Loading your saved plot." title="Loading plan" />
    );
  }

  if (setupRequired) {
    return (
      <section className={styles.setupScreen} data-route-shell="true">
        <Suspense
          fallback={
            <LoadingState
              message="Loading setup."
              title="Preparing garden setup"
            />
          }
        >
          <FirstRunSetupWizard
            garden={garden}
            onComplete={(request) => {
              completeGardenSetup(request);
              telemetryService.trackEvent('garden_setup_complete', {
                plot_type: request.plotType,
                template_id: request.templateId,
              });
              telemetryService.trackEvent('template_selected', {
                template_id: request.templateId,
              });
              void syncSetupProfile({
                authUser: state.user,
                request,
                userProfileRepository,
              }).catch(() =>
                setOperationsError('Plan created, but settings did not sync.'),
              );
            }}
          />
        </Suspense>
      </section>
    );
  }

  function handleOpenOptimizeMode() {
    void loadPlanOperationsPanel();
    setActiveMode('optimize');
    setIsContextPanelOpen(true);

    if (
      garden &&
      !autoLayoutSuggestion &&
      garden.seasonPlan.wantedCrops.length > 0
    ) {
      queueAutoLayoutGeneration(garden);
    }
  }

  function handleOpenReviewProblems() {
    void loadPlanOperationsPanel();
    setActiveMode('optimize');
    setIsContextPanelOpen(true);
  }

  function handleOpenSunMode() {
    setActiveMode('sun');
    setShowSunOverlay(true);
    setIsContextPanelOpen(true);
  }

  function queueAutoLayoutGeneration(sourceGarden = garden) {
    if (typeof window === 'undefined') {
      void handleGenerateAutoLayouts(sourceGarden);
      return;
    }

    window.requestAnimationFrame(() => {
      void handleGenerateAutoLayouts(sourceGarden);
    });
  }

  async function handleGenerateAutoLayouts(sourceGarden = garden) {
    if (!sourceGarden) {
      setOptimizerStatus('error');
      setOptimizerMessage('Garden still loading. Try again.');
      return;
    }

    setAutoLayoutSuggestion(null);
    setActiveReviewSuggestionId(null);

    try {
      const { runPlanAutoLayoutGeneration } =
        await import('./planAutoLayoutGeneration');
      const result = await runPlanAutoLayoutGeneration({
        acknowledgedWarningIds,
        currentGarden: garden,
        dirty,
        onStage: async (status, message) => {
          setOptimizerStatus(status);
          setOptimizerMessage(message);
          await allowAutoLayoutStagePaint();
        },
        saveDraftGarden,
        sourceGarden,
        suggestionDecisions,
        sunLayer: activeSunLayer,
        sunSeason,
      });
      setOptimizerIncludesDraftSave(result.includesDraftSave);

      if (!result.suggestion) {
        setOptimizerStatus(result.status);
        setOptimizerMessage(result.message);
        return;
      }

      startTransition(() => {
        setAutoLayoutSuggestion(result.suggestion);
        setOptimizerStatus(result.status);
        setOptimizerMessage(result.message);
      });
    } catch (generationError) {
      setAutoLayoutSuggestion(null);
      setOptimizerStatus('error');
      setOptimizerMessage(
        generationError instanceof Error
          ? generationError.message
          : 'Unable to generate a layout suggestion.',
      );
    }
  }

  function handleApplyAutoLayoutCandidate() {
    if (!autoLayoutSuggestion) {
      setOptimizerStatus('error');
      setOptimizerMessage('Generate a layout suggestion first.');
      return;
    }

    const selectedVariant = layoutProblemResolutionModel.suggestion;

    if (selectedVariant?.downstreamValidation.status === 'failed') {
      setOptimizerStatus('error');
      setOptimizerMessage(
        selectedVariant.downstreamValidation.message ??
          'This layout suggestion still leaves a must-fix problem.',
      );
      return;
    }

    if (autoLayoutSuggestion.hardConstraintViolations.length > 0) {
      setOptimizerStatus('error');
      setOptimizerMessage(
        'Resolve the remaining layout constraints before applying this suggestion.',
      );
      return;
    }

    applyAutoLayoutProposal(
      autoLayoutSuggestion.plantings,
      autoLayoutSuggestion.structures,
    );
    recordSuggestionDecision({
      id: getAutoLayoutReviewSuggestionId(autoLayoutSuggestion.id),
      label: 'Apply layout suggestion',
      note: autoLayoutSuggestion.explanations[0] ?? null,
      status: 'accepted',
    });
    setAutoLayoutSuggestion(null);
    setOptimizerStatus('applied');
    setOptimizerMessage(
      'Layout suggestion applied to the draft. Today was refreshed from the new plan. Review before publishing.',
    );
  }

  function handleDismissAutoLayoutSuggestion() {
    if (!autoLayoutSuggestion) {
      setOptimizerStatus('error');
      setOptimizerMessage('No layout suggestion is open.');
      return;
    }

    recordSuggestionDecision({
      id: getAutoLayoutReviewSuggestionId(autoLayoutSuggestion.id),
      label: 'Keep current layout',
      note:
        autoLayoutSuggestion.tradeoffs[0] ??
        autoLayoutSuggestion.explanations[0] ??
        null,
      status: 'rejected',
    });
    setAutoLayoutSuggestion(null);
    setOptimizerStatus('idle');
    setOptimizerMessage(
      'Keeping the current layout. Generate another suggestion if the plan changes.',
    );
  }

  function handleAcceptReviewSuggestion(suggestion: ReviewSuggestion) {
    acceptReviewSuggestion(suggestion);
    markSuggestionWarningAcknowledged(suggestion);
    setActiveReviewSuggestionId((id) => (id === suggestion.id ? null : id));
    setSelectedLayoutProblemId(null);
  }

  function handleIgnoreReviewSuggestion(suggestion: ReviewSuggestion) {
    snoozeReviewSuggestion(suggestion);
    markSuggestionWarningAcknowledged(suggestion);
    setActiveReviewSuggestionId((id) => (id === suggestion.id ? null : id));
    setSelectedLayoutProblemId(null);
  }

  function handlePreviewReviewSuggestion(suggestion: ReviewSuggestion) {
    setActiveMode('optimize');
    setIsContextPanelOpen(true);
    setActiveReviewSuggestionId(suggestion.id);
  }

  function handleSelectLayoutProblem(problemId: string | null) {
    setSelectedLayoutProblemId(problemId);
    setActiveReviewSuggestionId(null);
    selectLayoutProblem(problemId);
  }

  function handleApplyResolutionOption(option: LayoutResolutionOption) {
    const suggestion = getSuggestionForResolutionOption(option);

    if (!suggestion) {
      recordSuggestionDecision({
        id: option.id,
        label: option.label,
        note: option.description,
        status: 'snoozed',
      });
      setSelectedLayoutProblemId(null);
      return;
    }

    handleAcceptReviewSuggestion(suggestion);
  }

  function handlePreviewResolutionOption(option: LayoutResolutionOption) {
    setSelectedLayoutProblemId(option.problemId);
    selectLayoutProblem(option.problemId);

    const suggestion = getSuggestionForResolutionOption(option);

    if (suggestion) {
      handlePreviewReviewSuggestion(suggestion);
    }
  }

  function handleIgnoreProblem(problem: LayoutProblem) {
    const suggestions = layoutProblemResolutionModel.resolutionOptions
      .filter(
        (option) =>
          option.problemId === problem.id &&
          !option.actions.some((action) => action.type === 'useLayoutVariant'),
      )
      .flatMap((option) => {
        const suggestion = getSuggestionForResolutionOption(option);
        return suggestion ? [suggestion] : [];
      });

    if (suggestions.length > 0) {
      for (const suggestion of suggestions) {
        handleIgnoreReviewSuggestion(suggestion);
      }
    } else {
      acknowledgeProblemWarning(problem);
      recordSuggestionDecision({
        id: problem.id,
        label: `Ignore ${problem.title}`,
        note: problem.description,
        status: 'snoozed',
      });
    }

    setSelectedLayoutProblemId(null);
    selectLayoutProblem(null);
  }

  function handleJumpToProblem(problem: LayoutProblem) {
    handleSelectLayoutProblem(problem.id);

    if (!garden) {
      return;
    }

    const targetIds = problem.targets.map((target) => target.id);
    const selection = getSelectionForItemIds(garden, targetIds);

    if (selection) {
      setSelectedItems([selection]);
      setSelectedItem(selection);
      syncTransientPlantInteraction([selection], selection, {
        openSurface: true,
      });
    }
  }

  function markSuggestionWarningAcknowledged(suggestion: ReviewSuggestion) {
    const warningId = suggestion.sourceWarningId;

    if (!warningId) {
      return;
    }

    setAcknowledgedWarningIds((ids) =>
      ids.includes(warningId) ? ids : [...ids, warningId],
    );
  }

  function acknowledgeProblemWarning(problem: LayoutProblem) {
    const warningId = getWarningIdFromLayoutProblem(problem);

    if (!warningId) {
      return;
    }

    setAcknowledgedWarningIds((ids) =>
      ids.includes(warningId) ? ids : [...ids, warningId],
    );
  }

  function getSuggestionForResolutionOption(option: LayoutResolutionOption) {
    return (
      reviewSuggestions.find(
        (suggestion) => suggestion.id === option.sourceId,
      ) ?? null
    );
  }

  async function handlePublish(force = false) {
    if (!state.user?.email) {
      return;
    }

    setPublishStatus('publishing');
    setPublishError(null);

    try {
      const result = await publishDraft(state.user.email, force);

      if (!result) {
        setPublishError('Unable to publish this draft.');
        return;
      }

      if (result.status === 'conflict') {
        setPublishConflict(result.conflict);
        return;
      }

      setPublishConflict(null);
      setIsPublishOpen(false);
    } catch (publishFailure) {
      setPublishError(
        publishFailure instanceof Error
          ? publishFailure.message
          : 'Unable to publish this draft.',
      );
    } finally {
      setPublishStatus('idle');
    }
  }

  async function handleDiscardDraft() {
    try {
      await discardDraft();
    } catch (discardFailure) {
      setOperationsError(
        discardFailure instanceof Error
          ? discardFailure.message
          : 'Unable to abandon draft changes.',
      );
    }
  }

  async function handleRevert(revisionId: string) {
    if (!state.user?.email) {
      return;
    }

    setPublishStatus('reverting');
    setPublishError(null);

    try {
      await revertToRevision(revisionId, state.user.email);
      setIsHistoryOpen(false);
    } catch (revertFailure) {
      setPublishError(
        revertFailure instanceof Error
          ? revertFailure.message
          : 'Unable to revert the published garden.',
      );
    } finally {
      setPublishStatus('idle');
    }
  }

  const plantEditorPlant =
    plantEditorState.isOpen && plantEditorState.groupId
      ? (garden.plantings.find(
          (planting) => planting.id === plantEditorState.groupId,
        ) ?? null)
      : null;
  const plantEditorWarnings = plantEditorPlant
    ? inspectorPlanWarnings.filter((warning) =>
        warning.itemIds.includes(plantEditorPlant.id),
      )
    : [];
  const isPlantEditorDetailedView =
    Boolean(plantEditorPlant) &&
    detailedViewState.isOpen &&
    detailedViewState.subject?.type === 'plantGroup' &&
    detailedViewState.subject.groupId === plantEditorPlant?.id;
  const contextPanelState =
    activeMode !== 'select'
      ? 'mode'
      : selectedItem?.type === 'structure'
        ? 'inspector'
        : null;
  const sidePanelState = isContextPanelOpen ? contextPanelState : null;

  return (
    <section className={styles.screen} data-route-shell="true">
      <div
        className={styles.workspaceGrid}
        data-panel-open={sidePanelState ? 'true' : 'false'}
      >
        <div className={styles.floatingChrome}>
          <PlanTopBar
            canDiscardDraft={Boolean(workspace?.hasDraft && hasPlanChanges)}
            canPublish={canPublish || dirty}
            dirty={topBarDirty}
            garden={garden}
            isOffline={isOffline}
            onAddPlants={() => {
              void loadPlanOperationsPanel();
              setIsChoosePlantsOpen(true);
            }}
            onDiscardDraft={() => void handleDiscardDraft()}
            onOpenPlot={() => setIsPlotSettingsOpen(true)}
            onPublish={() => {
              setPublishConflict(
                workspace?.draftIsStale
                  ? {
                      currentRevisionId: workspace.published.id,
                      draftBaseRevisionId: workspace.draft.baseRevisionId,
                      message:
                        'The published garden changed after this draft was started.',
                    }
                  : null,
              );
              setPublishError(null);
              setIsPublishOpen(true);
            }}
            onReviewProblems={handleOpenReviewProblems}
            onSave={() => void saveGarden()}
            saveStatus={saveStatus}
            workspaceState={workspaceState}
          />
          {saveStatus === 'error' && error ? (
            <div className={styles.errorPanel}>
              <p className={styles.error} role="alert">
                {error}
              </p>
            </div>
          ) : null}
          {operationsError ? (
            <div className={styles.errorPanel}>
              <p className={styles.error} role="alert">
                {operationsError}
              </p>
            </div>
          ) : null}
        </div>
        <Suspense fallback={null}>
          <PlanActionRail
            activeMode={activeMode}
            avoidFocusCard={false}
            hasSelection={Boolean(selectedItem)}
            isDetailedViewOpen={detailedViewState.isOpen}
            onOpenDetails={handleOpenInspector}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onOpenOptimize={handleOpenOptimizeMode}
            onOpenSun={handleOpenSunMode}
            setActiveMode={handleSetActiveMode}
          />
        </Suspense>

        <div className={styles.canvasColumn}>
          <PlanCanvas
            activeSunLayer={activeSunLayer}
            flushInteractionCommits={flushInteractionCommits}
            garden={garden}
            focusedCropKey={null}
            hoveredPlantGroupId={planCanvasHoveredPlantGroupId}
            influenceOverlay={null}
            manualSunEdit={manualSunEdit}
            manualSunExposure={manualSunExposure}
            mode={activeMode}
            onInteractionStateChange={setPlanInteractionState}
            onMarqueeSelect={handleMarqueeSelect}
            onPaintSunShadeCell={paintSunShadeCell}
            onPlantEditorOpen={handleOpenPlantGroupEditor}
            onPlantHoverChange={setHoveredPlantGroupId}
            onPlantLabelHide={hidePlantGroupLabel}
            onSelectItem={handleSelectItem}
            onShowSunOverlayChange={setShowSunOverlay}
            plantingPreview={addPlantPreview}
            planWarnings={activePlanWarnings}
            proposalDiffOverlay={proposalDiffOverlay}
            queueInteractionPositionCommit={queueInteractionPositionCommit}
            queueInteractionRectCommit={queueInteractionRectCommit}
            resizePlantingRect={resizePlantingRect}
            resizeStructureRect={resizeStructureRect}
            selectedItems={selectedItems}
            selectedPlantIds={selectedPlantIds}
            selectedStructureIds={selectedStructureIds}
            showSunOverlay={showSunOverlay}
            sunSeason={sunSeason}
            updateItemPositions={updateItemPositions}
            visiblePlantLabelIds={planCanvasVisiblePlantLabelIds}
          />
          {selectedItems.length >= 2 ? (
            <Suspense fallback={null}>
              <PlanSelectionToolbar
                count={selectedItems.length}
                onAlignBottom={() => handleAlignSelection('bottom')}
                onAlignCenter={() => handleAlignSelection('center')}
                onAlignLeft={() => handleAlignSelection('left')}
                onAlignRight={() => handleAlignSelection('right')}
                onAlignTop={() => handleAlignSelection('top')}
                onDelete={handleDeleteSelection}
                onDistributeHorizontal={handleDistributeSelection}
                onDuplicate={handleDuplicateSelection}
                onMarkSelectedPlanted={handleMarkSelectedPlanted}
                selectedPlantCount={selectedPlantCount}
                selectedStructureCount={selectedStructureCount}
                timezone={garden.plot.location.timezone}
              />
            </Suspense>
          ) : null}
        </div>

        {sidePanelState ? (
          <aside
            className={styles.sidePanel}
            data-panel-state={sidePanelState}
            aria-label="Plan context panel"
          >
            <Suspense
              fallback={
                <div className={styles.sidePanelLoading}>Loading controls.</div>
              }
            >
              {sidePanelState === 'mode' ? (
                <>
                  <PlanModeDrawer
                    activeSunLayer={activeSunLayer}
                    manualSunEdit={manualSunEdit}
                    manualSunExposure={manualSunExposure}
                    mode={activeMode}
                    onAddPlant={() => setIsAddPlantOpen(true)}
                    onAddStructure={() => {
                      addStructure(structureType, {
                        accessibleMode: accessiblePathDefaults,
                      });
                      setActiveMode('select');
                      setIsContextPanelOpen(false);
                      telemetryService.trackEvent('structure_added', {
                        accessible_path_default: accessiblePathDefaults,
                        structure_type: structureType,
                      });
                    }}
                    onClose={handleCloseContextPanel}
                    activeProblemId={selectedLayoutProblemId}
                    layoutProblemResolutionModel={layoutProblemResolutionModel}
                    onApplyResolutionOption={handleApplyResolutionOption}
                    onIgnoreProblem={handleIgnoreProblem}
                    onJumpToProblem={handleJumpToProblem}
                    onPreviewResolutionOption={handlePreviewResolutionOption}
                    onRecalculateSun={recalculateSunShade}
                    onSelectProblem={handleSelectLayoutProblem}
                    setManualSunEdit={setManualSunEdit}
                    setManualSunExposure={setManualSunExposure}
                    setAccessiblePathDefaults={setAccessiblePathDefaults}
                    setShowSunOverlay={setShowSunOverlay}
                    setStructureType={setStructureType}
                    setSunSeason={setSunSeason}
                    showSunOverlay={showSunOverlay}
                    accessiblePathDefaults={accessiblePathDefaults}
                    structureType={structureType}
                    sunSeason={sunSeason}
                  />
                  {activeMode === 'optimize' ? (
                    <PlanOperationsPanel
                      autoLayoutSuggestion={autoLayoutSuggestion}
                      currentWarnings={planWarnings}
                      garden={garden}
                      onApplyAutoLayoutCandidate={
                        handleApplyAutoLayoutCandidate
                      }
                      onDismissAutoLayoutSuggestion={
                        handleDismissAutoLayoutSuggestion
                      }
                      onGenerateAutoLayoutSuggestion={() =>
                        void handleGenerateAutoLayouts()
                      }
                      optimizerIncludesDraftSave={optimizerIncludesDraftSave}
                      optimizerMessage={optimizerMessage}
                      optimizerStatus={optimizerStatus}
                      suggestion={layoutProblemResolutionModel.suggestion}
                      sunLayer={activeSunLayer}
                      sunSeason={sunSeason}
                    />
                  ) : null}
                </>
              ) : (
                <div className={styles.inspectorDock}>
                  <div className={styles.dockHeader}>
                    <span>Selection</span>
                    <button
                      aria-label="Close selected item panel"
                      onClick={handleCloseContextPanel}
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                  <PlanInspector
                    garden={garden}
                    onDeleteSelected={deleteSelectedItem}
                    onDuplicatePlanting={duplicatePlanting}
                    onDuplicateStructure={duplicateStructure}
                    onResizeStructure={resizeStructure}
                    onUpdatePlanting={updatePlanting}
                    onUpdateStructure={updateStructure}
                    onUpdateStructureShade={updateStructureShade}
                    selectedItem={selectedItem}
                    sunLayer={activeSunLayer}
                    sunSeason={sunSeason}
                    warnings={inspectorPlanWarnings}
                  />
                </div>
              )}
            </Suspense>
          </aside>
        ) : null}
      </div>

      {planInteractionState === 'idle' && plantEditorPlant ? (
        <Suspense fallback={null}>
          <PlantEditorSheet
            garden={garden}
            isDetailedViewPinned={isPlantEditorDetailedView}
            onAddLinkedSupportStructure={addLinkedSupportStructure}
            onClose={handleClosePlantEditor}
            onDeleteSelected={handleDeleteFromPlantEditor}
            onDuplicatePlanting={handleDuplicateFromPlantEditor}
            onLinkSupportStructure={linkSupportStructure}
            onUnlinkSupportStructure={unlinkSupportStructure}
            onUpdatePlanting={updatePlanting}
            plant={plantEditorPlant}
            sunLayer={activeSunLayer}
            sunSeason={sunSeason}
            warnings={plantEditorWarnings}
          />
        </Suspense>
      ) : null}

      {isPlotSettingsOpen ? (
        <Suspense fallback={null}>
          <PlotSettingsModal
            geocodingApiKey={environment.geocodingApiKey}
            climateProfile={garden.climateProfile}
            onApply={(widthFt, depthFt, orientationDegrees, location) => {
              applyPlotSettings(widthFt, depthFt, orientationDegrees, location);
              setIsPlotSettingsOpen(false);
            }}
            onClose={() => setIsPlotSettingsOpen(false)}
            plot={garden.plot}
          />
        </Suspense>
      ) : null}

      {isAddPlantOpen ? (
        <Suspense fallback={null}>
          <AddPlantModal
            garden={garden}
            onAddPlant={(request) => {
              addPlant(request);
              setAddPlantPreview(null);
              telemetryService.trackEvent('planting_added', {
                crop_id: request.crop.id,
                mode: request.mode,
              });
              setIsAddPlantOpen(false);
              setActiveMode('select');
              setIsContextPanelOpen(false);
            }}
            onClose={handleCloseAddPlantModal}
            onPreviewChange={handleAddPlantPreviewChange}
            sunExposureAtPlacement={nextPlacementSunArea?.exposure ?? null}
            sunSeason={sunSeason}
          />
        </Suspense>
      ) : null}

      {isChoosePlantsOpen ? (
        <Suspense fallback={null}>
          <ChoosePlantsModal
            garden={garden}
            onClose={() => setIsChoosePlantsOpen(false)}
            onSave={(wantedCrops) => {
              updateSeasonCropSelections(wantedCrops);
              telemetryService.trackEvent('season_crop_list_updated', {
                crop_count: wantedCrops.length,
              });
              setIsChoosePlantsOpen(false);
            }}
            onOptimize={(wantedCrops) => {
              const optimizedGarden = {
                ...garden,
                seasonPlan: {
                  updatedAtIso: new Date().toISOString(),
                  wantedCrops,
                },
              };

              void loadPlanOperationsPanel();
              updateSeasonCropSelections(wantedCrops);
              telemetryService.trackEvent('season_crop_list_updated', {
                crop_count: wantedCrops.length,
              });
              setOptimizerIncludesDraftSave(true);
              setAutoLayoutSuggestion(null);
              setActiveReviewSuggestionId(null);
              setOptimizerStatus('savingDraft');
              setOptimizerMessage(
                'Saving the current draft before checking another arrangement.',
              );
              setIsChoosePlantsOpen(false);
              setActiveMode('optimize');
              setIsContextPanelOpen(true);
              queueAutoLayoutGeneration(optimizedGarden);
            }}
            sunExposureAtPlacement={null}
          />
        </Suspense>
      ) : null}
      {isPublishOpen && draftSummary ? (
        <Suspense fallback={null}>
          <PlanPublishModal
            conflict={publishConflict}
            error={publishError}
            isPublishing={publishStatus === 'publishing'}
            onClose={() => setIsPublishOpen(false)}
            onPublish={() => void handlePublish(false)}
            onPublishAnyway={() => void handlePublish(true)}
            suggestionDecisions={suggestionDecisions}
            summary={draftSummary}
          />
        </Suspense>
      ) : null}
      {isHistoryOpen && workspace ? (
        <Suspense fallback={null}>
          <RevisionHistoryModal
            currentRevisionId={workspace.published.id}
            error={publishError}
            isReverting={publishStatus === 'reverting'}
            onClose={() => setIsHistoryOpen(false)}
            onRevert={(revisionId) => void handleRevert(revisionId)}
            revisions={workspace.revisions}
            timezone={garden.plot.location.timezone}
          />
        </Suspense>
      ) : null}
    </section>
  );
}

function getSelectionForItemIds(
  garden: Garden,
  itemIds: string[],
): SelectedGardenItem | null {
  for (const id of itemIds) {
    if (garden.plantings.some((planting) => planting.id === id)) {
      return { id, type: 'planting' };
    }

    if (garden.structures.some((structure) => structure.id === id)) {
      return { id, type: 'structure' };
    }
  }

  return null;
}

function getWarningIdFromLayoutProblem(problem: LayoutProblem) {
  const sourceId = problem.evidence
    .map((entry) => entry.sourceId)
    .find((id): id is string => Boolean(id));

  if (sourceId?.startsWith('warning:')) {
    return sourceId;
  }

  const warningPrefix = 'layout:problem:warning:';

  return problem.id.startsWith(warningPrefix)
    ? problem.id.slice(warningPrefix.length)
    : null;
}

function hasPlanWorkspaceChanges(summary: GardenChangesetSummary) {
  return (
    summary.plotChanged ||
    summary.plantingsAdded > 0 ||
    summary.plantingsChanged > 0 ||
    summary.plantingsRemoved > 0 ||
    summary.structuresAdded > 0 ||
    summary.structuresChanged > 0 ||
    summary.structuresRemoved > 0 ||
    summary.wantedCropsAdded > 0 ||
    summary.wantedCropsChanged > 0 ||
    summary.wantedCropsRemoved > 0
  );
}

function areSelectionsEqual(left: PlanItemRef[], right: PlanItemRef[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const rightItem = right[index];

      return rightItem ? areSamePlanItem(item, rightItem) : false;
    })
  );
}

function scheduleIdlePlanTask(task: () => void) {
  const browserWindow =
    typeof window === 'undefined'
      ? null
      : (window as Window & {
          cancelIdleCallback?(id: number): void;
          requestIdleCallback?(
            callback: () => void,
            options?: { timeout: number },
          ): number;
        });

  if (browserWindow?.requestIdleCallback) {
    const idleId = browserWindow.requestIdleCallback(task, { timeout: 250 });

    return () => browserWindow.cancelIdleCallback?.(idleId);
  }

  const timeoutId = globalThis.setTimeout(task, 0);

  return () => globalThis.clearTimeout(timeoutId);
}
