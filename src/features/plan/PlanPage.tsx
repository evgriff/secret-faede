import {
  lazy,
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
  hasGardenChanges,
  prepareGardenForUser,
  type GardenPublishConflict,
} from '../../domain/gardens/gardenWorkspace';
import { LoadingState } from '../../shared/ui/LoadingState';
import { useNetworkStatus } from '../../shared/network/networkStatus';
import { useAuth } from '../auth/auth-context';
import {
  findPlanWarnings,
  isInspectorPlanWarning,
} from '../garden/gardenPlanning';
import { PlotSettingsModal } from '../garden/PlotSettingsModal';
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
import { PlanActionRail } from './components/PlanActionRail';
import { PlanCanvas } from './components/PlanCanvas';
import { PlanCropFocusCard } from './components/PlanCropFocusCard';
import { PlanSelectionToolbar } from './components/PlanSelectionToolbar';
import { PlanTopBar } from './components/PlanTopBar';
import { usePlanKeyboardShortcuts } from './hooks/usePlanKeyboardShortcuts';
import { buildCropFocusSummary } from './planCropFocus';
import { buildPlanInfluenceOverlay } from './planInfluenceOverlay';
import { buildLayoutProblemResolutionModel } from './layoutProblemResolution';
import { syncSetupProfile } from './planPageActions';
import {
  buildAutoLayoutProposalDiffOverlay,
  buildReviewSuggestionDiffOverlay,
} from './proposalDiffOverlay';
import { getPlanItemKey, type PlanItemRef } from './planInteractionGeometry';
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
const PlantEditorSheet = lazy(() =>
  import('./components/PlantEditorSheet').then((module) => ({
    default: module.PlantEditorSheet,
  })),
);
const PlanModeDrawer = lazy(() =>
  import('./components/PlanModeDrawer').then((module) => ({
    default: module.PlanModeDrawer,
  })),
);
const PlanOperationsPanel = lazy(() =>
  import('./components/PlanOperationsPanel').then((module) => ({
    default: module.PlanOperationsPanel,
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
    addPlant,
    addStructure,
    applyAutoLayoutProposal,
    applyPlotSettings,
    checkpointGarden,
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
    garden,
    hidePlantGroupLabel,
    hoveredPlantGroupId,
    labelVisibility,
    openDetailedViewForItem,
    openPlantGroupEditor,
    paintSunShadeCell,
    plantEditorState,
    publishDraft,
    recalculateSunShade,
    recordSuggestionDecision,
    redoGardenChange,
    revertToRevision,
    resizeStructure,
    resizeStructureRect,
    saveGarden,
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
  const [optimizerMessage, setOptimizerMessage] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPlotSettingsOpen, setIsPlotSettingsOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [showDraftChoice, setShowDraftChoice] = useState(true);
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
  const [dismissedCropFocusKey, setDismissedCropFocusKey] = useState<
    string | null
  >(null);
  const [suppressedSelectionKey, setSuppressedSelectionKey] = useState<
    string | null
  >(null);
  const [showInfluenceOverlay, setShowInfluenceOverlay] = useState(false);
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
  const activeSunLayer = useMemo(
    () => (garden ? findSunShadeLayer(garden, sunSeason) : null),
    [garden, sunSeason],
  );
  const planWarnings = useMemo(
    () =>
      garden
        ? findPlanWarnings(
            garden,
            activeSunLayer
              ? {
                  sunLayer: activeSunLayer,
                  sunSeason,
                }
              : { sunSeason },
          )
        : [],
    [activeSunLayer, garden, sunSeason],
  );
  const activePlanWarnings = useMemo(
    () =>
      planWarnings.filter(
        (warning) => !acknowledgedWarningIds.includes(warning.id),
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
        currentWarnings: planWarnings,
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
    autoLayoutSuggestion,
    garden,
    planWarnings,
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
  const canPublish = Boolean(draftSummary && hasGardenChanges(draftSummary));
  const workspaceState = workspace?.draftIsStale
    ? 'stale'
    : canPublish || dirty
      ? 'draft'
      : 'published';
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

  const cropFocusSummary = useMemo(
    () =>
      garden && activeSunLayer && cropFocusItem
        ? buildCropFocusSummary({
            garden,
            selectedItem: cropFocusItem,
            sunLayer: activeSunLayer,
            warnings: activePlanWarnings,
          })
        : null,
    [activePlanWarnings, activeSunLayer, cropFocusItem, garden],
  );
  const visibleCropFocusSummary =
    cropFocusSummary?.selectionKey === dismissedCropFocusKey
      ? null
      : cropFocusSummary;
  const focusedCropKey = visibleCropFocusSummary?.focusKey ?? null;
  const influenceOverlay = useMemo(
    () =>
      garden && activeSunLayer && focusedCropKey
        ? buildPlanInfluenceOverlay({
            focusKey: focusedCropKey,
            garden,
            sunLayer: activeSunLayer,
            warnings: activePlanWarnings,
          })
        : null,
    [activePlanWarnings, activeSunLayer, focusedCropKey, garden],
  );
  const visibleInfluenceOverlay = showInfluenceOverlay
    ? influenceOverlay
    : null;
  const isDragLikeInteraction =
    planInteractionState === 'drag' ||
    planInteractionState === 'marquee' ||
    planInteractionState === 'pan' ||
    planInteractionState === 'resize';

  useEffect(() => {
    setShowInfluenceOverlay(false);
  }, [visibleCropFocusSummary?.selectionKey]);

  useEffect(() => {
    if (!isDragLikeInteraction) {
      return;
    }

    setSuppressedSelectionKey(selectedItemKey);
    setShowInfluenceOverlay(false);
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
  const selectedStructureIds = useMemo(
    () =>
      selectedItems
        .filter((item) => item.type === 'structure')
        .map((item) => item.id),
    [selectedItems],
  );
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
      const nextPrimaryKey = primaryItem ? getPlanItemKey(primaryItem) : null;
      const nextPrimaryPlantId =
        primaryItem?.type === 'planting' ? primaryItem.id : null;

      setHoveredPlantGroupId(null);

      if (!shouldOpenSurface) {
        setSuppressedSelectionKey(nextPrimaryKey);

        if (detailedViewState.isOpen) {
          closeDetailedView();
        }

        if (plantEditorState.isOpen) {
          closePlantGroupEditor();
        }

        if (activeMode === 'select') {
          setIsContextPanelOpen(false);
        }

        return;
      }

      setDismissedCropFocusKey(null);
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

      if (activeMode === 'select') {
        setIsContextPanelOpen(false);
      }
    },
    [
      activeMode,
      closeDetailedView,
      closePlantGroupEditor,
      detailedViewState.isOpen,
      openDetailedViewForItem,
      openPlantGroupEditor,
      plantEditorState.isOpen,
      plantEditorState.groupId,
      plantEditorState.tab,
      setHoveredPlantGroupId,
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

        setSelectedItem(primaryItem);
        syncTransientPlantInteraction(nextSelection, primaryItem, {
          openSurface: shouldOpenSurface,
        });
        return nextSelection;
      });
    },
    [setSelectedItem, syncTransientPlantInteraction],
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

        setSelectedItem(primaryItem);
        syncTransientPlantInteraction(nextSelection, primaryItem, {
          openSurface: false,
        });
        return nextSelection;
      });
    },
    [
      detailedViewState.isOpen,
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
    setDismissedCropFocusKey(null);
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
      setDismissedCropFocusKey(null);
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
      setDismissedCropFocusKey(null);
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

  const handleCloseCropFocus = useCallback(() => {
    if (cropFocusSummary) {
      setDismissedCropFocusKey(cropFocusSummary.selectionKey);
    }
  }, [cropFocusSummary]);

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
      <section className={styles.screen} data-route-shell="true">
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
    setActiveMode('optimize');
    setIsContextPanelOpen(true);

    if (
      garden &&
      !autoLayoutSuggestion &&
      garden.seasonPlan.wantedCrops.length > 0
    ) {
      void handleGenerateAutoLayouts(garden);
    }
  }

  function handleOpenReviewProblems() {
    setActiveMode('optimize');
    setIsContextPanelOpen(true);
  }

  function handleOpenSunMode() {
    setActiveMode('sun');
    setShowSunOverlay(true);
    setIsContextPanelOpen(true);
  }

  async function handleGenerateAutoLayouts(sourceGarden = garden) {
    if (!sourceGarden) {
      setOptimizerStatus('error');
      setOptimizerMessage('Garden still loading. Try again.');
      return;
    }

    setOptimizerStatus('running');
    setOptimizerMessage('Checking for a simpler layout...');
    setAutoLayoutSuggestion(null);
    setActiveReviewSuggestionId(null);

    try {
      const { generateAutoLayoutSuggestion } =
        await import('./autoLayoutEngine');
      const nextSuggestion = generateAutoLayoutSuggestion(sourceGarden, {
        ignoredWarningIds: acknowledgedWarningIds,
        sunLayer: activeSunLayer,
        sunSeason,
      });
      setAutoLayoutSuggestion(nextSuggestion);

      if (!nextSuggestion) {
        const hasLayoutRequests =
          sourceGarden.seasonPlan.wantedCrops.length > 0;

        setOptimizerStatus('empty');
        setOptimizerMessage(
          hasLayoutRequests
            ? 'No better layout found right now. Keep the current layout or adjust the plan, then check again.'
            : 'Add plants before generating a layout suggestion.',
        );
        return;
      }

      setOptimizerStatus('ready');
      setOptimizerMessage('One checked layout suggestion is ready to review.');
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
      setShowDraftChoice(false);
    } catch (discardFailure) {
      setOperationsError(
        discardFailure instanceof Error
          ? discardFailure.message
          : 'Unable to sync from published.',
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
      <div className={styles.routeChrome}>
        <PlanTopBar
          canPublish={canPublish || dirty}
          dirty={dirty}
          garden={garden}
          isOffline={isOffline}
          onAddPlants={() => setIsChoosePlantsOpen(true)}
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
        {workspace?.hasDraft &&
        showDraftChoice &&
        (workspace.draftChanged || dirty) ? (
          <div className={styles.draftChoice}>
            <div>
              <strong>Continue working draft?</strong>
              <p>
                This draft is private until it is published. Syncing from
                published discards local draft edits.
              </p>
            </div>
            <div className={styles.draftChoiceActions}>
              <button
                className={styles.secondaryButton}
                onClick={() => setShowDraftChoice(false)}
                type="button"
              >
                Continue draft
              </button>
              <button
                className={styles.secondaryButton}
                onClick={() => void handleDiscardDraft()}
                type="button"
              >
                Sync from published
              </button>
            </div>
          </div>
        ) : null}
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

      <div
        className={styles.workspaceGrid}
        data-panel-open={sidePanelState ? 'true' : 'false'}
      >
        <PlanActionRail
          activeMode={activeMode}
          avoidFocusCard={Boolean(visibleCropFocusSummary)}
          hasSelection={Boolean(selectedItem)}
          isDetailedViewOpen={detailedViewState.isOpen}
          onOpenDetails={handleOpenInspector}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenOptimize={handleOpenOptimizeMode}
          onOpenSun={handleOpenSunMode}
          setActiveMode={handleSetActiveMode}
        />

        <div className={styles.canvasColumn}>
          <PlanCanvas
            activeSunLayer={activeSunLayer}
            garden={garden}
            focusedCropKey={focusedCropKey}
            hoveredPlantGroupId={planCanvasHoveredPlantGroupId}
            influenceOverlay={visibleInfluenceOverlay}
            manualSunEdit={manualSunEdit}
            manualSunExposure={manualSunExposure}
            mode={activeMode}
            onCheckpoint={checkpointGarden}
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
            resizeStructureRect={resizeStructureRect}
            selectedItems={selectedItems}
            selectedPlantIds={selectedPlantIds}
            selectedStructureIds={selectedStructureIds}
            showSunOverlay={showSunOverlay}
            sunSeason={sunSeason}
            updateItemPositions={updateItemPositions}
            visiblePlantLabelIds={planCanvasVisiblePlantLabelIds}
          />
          {visibleCropFocusSummary ? (
            <PlanCropFocusCard
              influenceSummary={influenceOverlay?.summary ?? null}
              onClose={handleCloseCropFocus}
              onOpenDetails={handleOpenInspector}
              onShowInfluenceChange={setShowInfluenceOverlay}
              showInfluence={showInfluenceOverlay}
              summary={visibleCropFocusSummary}
            />
          ) : null}
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
          />
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
            onClose={handleClosePlantEditor}
            onDeleteSelected={handleDeleteFromPlantEditor}
            onDuplicatePlanting={handleDuplicateFromPlantEditor}
            onUpdatePlanting={updatePlanting}
            plant={plantEditorPlant}
            sunLayer={activeSunLayer}
            sunSeason={sunSeason}
            warnings={plantEditorWarnings}
          />
        </Suspense>
      ) : null}

      {isPlotSettingsOpen ? (
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

              updateSeasonCropSelections(wantedCrops);
              telemetryService.trackEvent('season_crop_list_updated', {
                crop_count: wantedCrops.length,
              });
              setIsChoosePlantsOpen(false);
              setActiveMode('optimize');
              setIsContextPanelOpen(true);
              void handleGenerateAutoLayouts(optimizedGarden);
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
