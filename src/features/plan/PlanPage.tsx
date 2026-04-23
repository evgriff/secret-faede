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
import {
  buildPlanHealthReport,
  type PlanHealthIssue,
} from '../garden/planHealthRules';
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
import { buildSuccessionRecommendations } from '../tasks/taskEngine';
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
import { usePlanPointerInteractions } from './hooks/usePlanPointerInteractions';
import { buildCropFocusSummary } from './planCropFocus';
import { buildPlanInfluenceOverlay } from './planInfluenceOverlay';
import { buildLayoutProblemResolutionModel } from './layoutProblemResolution';
import { syncSetupProfile } from './planPageActions';
import {
  buildAutoLayoutProposalDiffOverlay,
  buildReviewSuggestionDiffOverlay,
} from './proposalDiffOverlay';
import type { PlanItemRef } from './planInteractionGeometry';
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
    approveSuccessionPlanting,
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
    refreshWeatherAndWatering,
    redoGardenChange,
    revertToRevision,
    resizeStructure,
    resizeStructureRect,
    saveGarden,
    saveStatus,
    selectLayoutProblem,
    selectLayoutVariant,
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
  const [autoLayoutCandidates, setAutoLayoutCandidates] = useState<
    AutoLayoutCandidate[]
  >([]);
  const [selectedAutoLayoutCandidateId, setSelectedAutoLayoutCandidateId] =
    useState<string | null>(null);
  const [activeReviewSuggestionId, setActiveReviewSuggestionId] = useState<
    string | null
  >(null);
  const [selectedLayoutProblemId, setSelectedLayoutProblemId] = useState<
    string | null
  >(null);
  const [optimizerStatus, setOptimizerStatus] =
    useState<AutoLayoutRunStatus>('idle');
  const [optimizerMessage, setOptimizerMessage] = useState<string | null>(null);
  const [snoozedAutoLayoutCandidateIds, setSnoozedAutoLayoutCandidateIds] =
    useState<string[]>([]);
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
  const [operationsStatus, setOperationsStatus] = useState<'idle' | 'loading'>(
    'idle',
  );
  const [dismissedCropFocusKey, setDismissedCropFocusKey] = useState<
    string | null
  >(null);
  const [showInfluenceOverlay, setShowInfluenceOverlay] = useState(false);
  const [publishConflict, setPublishConflict] =
    useState<GardenPublishConflict | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<
    'idle' | 'publishing' | 'reverting'
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
            ...buildAutoLayoutReviewSuggestions(autoLayoutCandidates),
            ...buildReviewSuggestions({
              garden,
              sunLayer: activeSunLayer,
              warnings: activePlanWarnings,
            }),
          ]
        : [],
    [activePlanWarnings, activeSunLayer, autoLayoutCandidates, garden],
  );
  const activeReviewSuggestion =
    reviewSuggestions.find(
      (suggestion) => suggestion.id === activeReviewSuggestionId,
    ) ?? null;
  const selectedAutoLayoutCandidate =
    autoLayoutCandidates.find(
      (candidate) => candidate.id === selectedAutoLayoutCandidateId,
    ) ?? null;
  const layoutProblemResolutionModel = useMemo(
    () =>
      garden
        ? buildLayoutProblemResolutionModel({
            candidates: autoLayoutCandidates,
            garden,
            reviewSuggestions,
            suggestionDecisions,
            warnings: activePlanWarnings,
          })
        : {
            problems: [],
            resolutionOptions: [],
            resolutions: [],
            variants: [],
          },
    [
      autoLayoutCandidates,
      activePlanWarnings,
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

    if (
      selectedAutoLayoutCandidate &&
      !snoozedAutoLayoutCandidateIds.includes(selectedAutoLayoutCandidate.id)
    ) {
      return buildAutoLayoutProposalDiffOverlay({
        candidate: selectedAutoLayoutCandidate,
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
    garden,
    planWarnings,
    selectedAutoLayoutCandidate,
    snoozedAutoLayoutCandidateIds,
    sunSeason,
  ]);
  const planHealthReport = useMemo(
    () =>
      garden
        ? buildPlanHealthReport({
            dismissedWarningIds: acknowledgedWarningIds,
            garden,
            suggestionDecisions,
            warnings: planWarnings,
          })
        : null,
    [acknowledgedWarningIds, garden, planWarnings, suggestionDecisions],
  );

  useEffect(() => {
    setLayoutReviewState({
      problems: layoutProblemResolutionModel.problems,
      resolutionOptions: layoutProblemResolutionModel.resolutionOptions,
      resolutions: layoutProblemResolutionModel.resolutions,
      selectedProblemId: selectedLayoutProblemId,
      selectedVariantId: selectedAutoLayoutCandidateId,
      variants: layoutProblemResolutionModel.variants,
    });
  }, [
    layoutProblemResolutionModel.problems,
    layoutProblemResolutionModel.resolutionOptions,
    layoutProblemResolutionModel.resolutions,
    layoutProblemResolutionModel.variants,
    selectedAutoLayoutCandidateId,
    selectedLayoutProblemId,
    setLayoutReviewState,
  ]);
  const reviewProblemCount = countCurrentOpenLayoutProblems(
    layoutProblemResolutionModel,
  );
  const successionRecommendations = useMemo(
    () => (garden ? buildSuccessionRecommendations(garden) : []),
    [garden],
  );
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

  useEffect(() => {
    if (selectedItem?.type !== 'planting') {
      return;
    }

    setPlantLabelVisibility({ groupIds: [selectedItem.id], mode: 'auto' });
  }, [selectedItem, setPlantLabelVisibility]);

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
  }, [garden, routeTargetId, setSelectedItem]);

  const cropFocusSummary = useMemo(
    () =>
      garden && activeSunLayer
        ? buildCropFocusSummary({
            garden,
            selectedItem,
            sunLayer: activeSunLayer,
            warnings: activePlanWarnings,
          })
        : null,
    [activePlanWarnings, activeSunLayer, garden, selectedItem],
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

  useEffect(() => {
    setShowInfluenceOverlay(false);
  }, [visibleCropFocusSummary?.selectionKey]);

  useEffect(() => {
    if (selectedItem?.type === 'structure' || activeMode !== 'select') {
      setIsContextPanelOpen(true);
      return;
    }

    if (!selectedItem && activeMode === 'select') {
      setIsContextPanelOpen(false);
    }
  }, [activeMode, selectedItem]);

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

  const syncTransientPlantInteraction = useCallback(
    (nextSelection: PlanItemRef[], primaryItem: SelectedGardenItem | null) => {
      const labelGroupIds = nextSelection.flatMap((item) =>
        item.type === 'planting' ? [item.id] : [],
      );
      const nextPrimaryPlantId =
        primaryItem?.type === 'planting' ? primaryItem.id : null;

      setHoveredPlantGroupId(null);
      setPlantLabelVisibility({
        groupIds: [...new Set(labelGroupIds)],
        mode: 'auto',
      });

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
        !detailedViewState.isOpen &&
        plantEditorState.isOpen &&
        plantEditorState.groupId !== nextPrimaryPlantId
      ) {
        closePlantGroupEditor();

        if (activeMode === 'select') {
          setIsContextPanelOpen(false);
        }
      }
    },
    [
      activeMode,
      closePlantGroupEditor,
      detailedViewState.isOpen,
      openDetailedViewForItem,
      openPlantGroupEditor,
      plantEditorState.groupId,
      plantEditorState.isOpen,
      plantEditorState.tab,
      setHoveredPlantGroupId,
      setPlantLabelVisibility,
    ],
  );

  const handleSelectItem = useCallback(
    (item: SelectedGardenItem, additive: boolean) => {
      setSelectedItems((currentSelection) => {
        const nextSelection = additive
          ? toggleSelection(currentSelection, item)
          : [item];
        const primaryItem = nextSelection.at(-1) ?? null;

        setSelectedItem(primaryItem);
        syncTransientPlantInteraction(nextSelection, primaryItem);
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
          return currentSelection;
        }

        setSelectedItem(primaryItem);
        syncTransientPlantInteraction(nextSelection, primaryItem);
        return nextSelection;
      });
    },
    [
      detailedViewState.isOpen,
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
      setSelectedItems(duplicatedItems);
      setSelectedItem(duplicatedItems[0] ?? null);
    }
  }, [duplicateItems, selectedItem, selectedItems, setSelectedItem]);

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
    setSelectedItems(nextSelection);
    setSelectedItem(nextSelection[0] ?? null);
  }, [activeMode, garden, setSelectedItem]);

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

  const pointerInteractions = usePlanPointerInteractions({
    garden,
    mode: activeMode,
    onCheckpoint: checkpointGarden,
    onMarqueeSelect: handleMarqueeSelect,
    onSelectItem: handleSelectItem,
    resizeStructureRect,
    selectedItems,
    updateItemPositions,
  });

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

  if (status === 'loading' || !garden || !activeSunLayer || !planHealthReport) {
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

  async function handleRefreshOperations() {
    if (isOffline) {
      setOperationsError('Weather updates need a connection.');
      return;
    }

    setOperationsStatus('loading');
    setOperationsError(null);

    try {
      await refreshWeatherAndWatering();
      telemetryService.trackEvent('watering_recommendation_generated', {
        source: 'manual_refresh',
      });
    } catch (refreshError) {
      setOperationsError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Unable to update garden operations.',
      );
    } finally {
      setOperationsStatus('idle');
    }
  }

  function handleOpenOptimizeMode() {
    setActiveMode('optimize');
    setIsContextPanelOpen(true);

    if (
      garden &&
      autoLayoutCandidates.length === 0 &&
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

  function handleSelectAutoLayoutCandidate(candidateId: string) {
    setSelectedAutoLayoutCandidateId(candidateId);
    setActiveReviewSuggestionId(null);
    selectLayoutVariant(candidateId);
  }

  async function handleGenerateAutoLayouts(sourceGarden = garden) {
    if (!sourceGarden) {
      setOptimizerStatus('error');
      setOptimizerMessage('Garden still loading. Try again.');
      return;
    }

    setOptimizerStatus('running');
    setOptimizerMessage('Checking layout variants...');
    setSnoozedAutoLayoutCandidateIds([]);
    setActiveReviewSuggestionId(null);

    try {
      const { generateAutoLayoutCandidates } =
        await import('./autoLayoutEngine');
      const candidates = generateAutoLayoutCandidates(sourceGarden, {
        ignoredWarningIds: acknowledgedWarningIds,
        sunLayer: activeSunLayer,
        sunSeason,
      });
      const nextCandidateId = candidates[0]?.id ?? null;

      setAutoLayoutCandidates(candidates);
      setSelectedAutoLayoutCandidateId(nextCandidateId);
      selectLayoutVariant(nextCandidateId);

      if (candidates.length === 0) {
        const hasLayoutRequests =
          sourceGarden.seasonPlan.wantedCrops.length > 0;

        setOptimizerStatus('empty');
        setOptimizerMessage(
          hasLayoutRequests
            ? 'No legal layouts found. Check quantities, supports, and anchored crops.'
            : 'Add plants before optimizing layouts.',
        );
        return;
      }

      setOptimizerStatus('ready');
      setOptimizerMessage(
        `${candidates.length} checked variant${candidates.length === 1 ? '' : 's'} ready. Compare before applying.`,
      );
    } catch (generationError) {
      setAutoLayoutCandidates([]);
      setSelectedAutoLayoutCandidateId(null);
      selectLayoutVariant(null);
      setOptimizerStatus('error');
      setOptimizerMessage(
        generationError instanceof Error
          ? generationError.message
          : 'Unable to generate layout candidates.',
      );
    }
  }

  function handleApplyAutoLayoutCandidate() {
    const selectedCandidate = autoLayoutCandidates.find(
      (candidate) => candidate.id === selectedAutoLayoutCandidateId,
    );
    const selectedVariant = layoutProblemResolutionModel.variants.find(
      (variant) => variant.id === selectedAutoLayoutCandidateId,
    );

    if (!selectedCandidate) {
      setOptimizerStatus('error');
      setOptimizerMessage('Select a checked variant first.');
      return;
    }

    if (snoozedAutoLayoutCandidateIds.includes(selectedCandidate.id)) {
      setOptimizerStatus('error');
      setOptimizerMessage('Ignored variants cannot be applied.');
      return;
    }

    if (selectedVariant?.downstreamValidation.status === 'failed') {
      setOptimizerStatus('error');
      setOptimizerMessage(
        selectedVariant.downstreamValidation.message ??
          'This variant still has unresolved must-fix problems.',
      );
      return;
    }

    if (selectedCandidate.hardConstraintViolations.length > 0) {
      setOptimizerStatus('error');
      setOptimizerMessage(
        'Resolve hard constraints before applying a variant.',
      );
      return;
    }

    applyAutoLayoutProposal(
      selectedCandidate.plantings,
      selectedCandidate.structures,
    );
    recordSuggestionDecision({
      id: getAutoLayoutReviewSuggestionId(selectedCandidate.id),
      label: `Use ${selectedCandidate.label} variant`,
      note: selectedCandidate.explanations[0] ?? null,
      status: 'accepted',
    });
    setOptimizerStatus('applied');
    setOptimizerMessage(
      `${selectedCandidate.label} variant applied to the draft. Review before publishing.`,
    );
  }

  function handleIgnoreAutoLayoutCandidate(candidateId: string) {
    const ignoredCandidate = autoLayoutCandidates.find(
      (candidate) => candidate.id === candidateId,
    );

    if (!ignoredCandidate) {
      setOptimizerStatus('error');
      setOptimizerMessage('That checked variant is no longer available.');
      return;
    }

    setSnoozedAutoLayoutCandidateIds((ids) =>
      ids.includes(candidateId) ? ids : [...ids, candidateId],
    );
    recordSuggestionDecision({
      id: getAutoLayoutReviewSuggestionId(candidateId),
      label: `Ignore ${ignoredCandidate.label} variant`,
      note:
        ignoredCandidate.tradeoffs[0] ??
        ignoredCandidate.explanations[0] ??
        null,
      status: 'snoozed',
    });

    if (selectedAutoLayoutCandidateId === candidateId) {
      const nextCandidate = autoLayoutCandidates.find(
        (candidate) =>
          candidate.id !== candidateId &&
          !snoozedAutoLayoutCandidateIds.includes(candidate.id),
      );

      setSelectedAutoLayoutCandidateId(nextCandidate?.id ?? null);
      selectLayoutVariant(nextCandidate?.id ?? null);
    }

    setOptimizerStatus('ready');
    setOptimizerMessage(
      `${ignoredCandidate.label} ignored for this draft. Select another checked variant or generate again.`,
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
    }
  }

  function handleJumpToHealthIssue(issue: PlanHealthIssue) {
    if (!garden) {
      return;
    }

    const selection = getSelectionForItemIds(garden, issue.itemIds);

    if (selection) {
      setSelectedItems([selection]);
      setSelectedItem(selection);
    }
  }

  function handleDismissHealthIssue(issue: PlanHealthIssue) {
    const warningId = issue.sourceWarningId;

    if (!warningId) {
      return;
    }

    setAcknowledgedWarningIds((ids) =>
      ids.includes(warningId) ? ids : [...ids, warningId],
    );
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
          activeMode={activeMode}
          canPublish={canPublish || dirty}
          dirty={dirty}
          garden={garden}
          hasSelection={Boolean(selectedItem)}
          isDetailedViewOpen={detailedViewState.isOpen}
          isOffline={isOffline}
          onAddPlants={() => setIsChoosePlantsOpen(true)}
          onOpenDetails={handleOpenInspector}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenPlot={() => setIsPlotSettingsOpen(true)}
          onOptimize={handleOpenOptimizeMode}
          onReviewProblems={handleOpenReviewProblems}
          onSun={handleOpenSunMode}
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
          onSave={() => void saveGarden()}
          problemCount={reviewProblemCount}
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
      </div>

      <div
        className={styles.workspaceGrid}
        data-panel-open={sidePanelState ? 'true' : 'false'}
      >
        <PlanActionRail
          activeMode={activeMode}
          avoidFocusCard={Boolean(visibleCropFocusSummary)}
          setActiveMode={handleSetActiveMode}
        />

        <div className={styles.canvasColumn}>
          <PlanCanvas
            activeSunLayer={activeSunLayer}
            draggingPlantId={pointerInteractions.draggingPlantId}
            draggingStructureId={pointerInteractions.draggingStructureId}
            garden={garden}
            focusedCropKey={focusedCropKey}
            hoveredPlantGroupId={hoveredPlantGroupId}
            influenceOverlay={visibleInfluenceOverlay}
            manualSunEdit={manualSunEdit}
            manualSunExposure={manualSunExposure}
            marqueeRect={pointerInteractions.marqueeRect}
            mode={activeMode}
            onMarqueePointerDown={pointerInteractions.handleMarqueePointerDown}
            onMarqueePointerEnd={pointerInteractions.handleMarqueePointerEnd}
            onMarqueePointerMove={pointerInteractions.handleMarqueePointerMove}
            onPaintSunShadeCell={paintSunShadeCell}
            onPlantEditorOpen={handleOpenPlantGroupEditor}
            onPlantHoverChange={setHoveredPlantGroupId}
            onPlantLabelHide={hidePlantGroupLabel}
            onPlantLabelShow={showPlantGroupLabel}
            onPlantPointerDown={pointerInteractions.handlePlantPointerDown}
            onPlantPointerEnd={pointerInteractions.handlePlantPointerEnd}
            onPlantPointerMove={pointerInteractions.handlePlantPointerMove}
            onResizePointerDown={pointerInteractions.handleResizePointerDown}
            onResizePointerEnd={pointerInteractions.handleResizePointerEnd}
            onResizePointerMove={pointerInteractions.handleResizePointerMove}
            onSelectItem={handleSelectItem}
            onShowSunOverlayChange={setShowSunOverlay}
            onStructurePointerDown={
              pointerInteractions.handleStructurePointerDown
            }
            onStructurePointerEnd={
              pointerInteractions.handleStructurePointerEnd
            }
            onStructurePointerMove={
              pointerInteractions.handleStructurePointerMove
            }
            plantingPreview={addPlantPreview}
            planWarnings={activePlanWarnings}
            proposalDiffOverlay={proposalDiffOverlay}
            plotRef={pointerInteractions.plotRef}
            resizingStructureId={pointerInteractions.resizingStructureId}
            selectedPlantIds={selectedPlantIds}
            selectedStructureIds={selectedStructureIds}
            showSunOverlay={showSunOverlay}
            snapGuides={pointerInteractions.snapGuides}
            sunSeason={sunSeason}
            visiblePlantLabelIds={visiblePlantLabelIds}
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
                    onDismissHealthIssue={handleDismissHealthIssue}
                    onGenerateAutoLayoutCandidates={() =>
                      void handleGenerateAutoLayouts()
                    }
                    onIgnoreProblem={handleIgnoreProblem}
                    onJumpToHealthIssue={handleJumpToHealthIssue}
                    onJumpToProblem={handleJumpToProblem}
                    onPreviewResolutionOption={handlePreviewResolutionOption}
                    onRecalculateSun={recalculateSunShade}
                    onRestoreWarning={(warningId) =>
                      setAcknowledgedWarningIds((ids) =>
                        ids.filter((id) => id !== warningId),
                      )
                    }
                    onSelectProblem={handleSelectLayoutProblem}
                    planHealthReport={planHealthReport}
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
                      autoLayoutCandidates={autoLayoutCandidates}
                      currentWarnings={planWarnings}
                      garden={garden}
                      isLoading={operationsStatus === 'loading'}
                      isOffline={isOffline}
                      onApplyAutoLayoutCandidate={
                        handleApplyAutoLayoutCandidate
                      }
                      onApproveSuccession={approveSuccessionPlanting}
                      onGenerateAutoLayoutCandidates={() =>
                        void handleGenerateAutoLayouts()
                      }
                      ignoredAutoLayoutCandidateIds={
                        snoozedAutoLayoutCandidateIds
                      }
                      layoutVariants={layoutProblemResolutionModel.variants}
                      onIgnoreAutoLayoutCandidate={
                        handleIgnoreAutoLayoutCandidate
                      }
                      onRefresh={() => void handleRefreshOperations()}
                      onSelectAutoLayoutCandidate={
                        handleSelectAutoLayoutCandidate
                      }
                      optimizerMessage={optimizerMessage}
                      optimizerStatus={optimizerStatus}
                      refreshError={operationsError}
                      selectedAutoLayoutCandidateId={
                        selectedAutoLayoutCandidateId
                      }
                      successionRecommendations={successionRecommendations}
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

      {plantEditorPlant ? (
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

function countCurrentOpenLayoutProblems({
  problems,
  resolutionOptions,
}: {
  problems: LayoutProblem[];
  resolutionOptions: LayoutResolutionOption[];
}) {
  const variantProblemIds = new Set(
    resolutionOptions
      .filter((option) =>
        option.actions.some((action) => action.type === 'useLayoutVariant'),
      )
      .map((option) => option.problemId),
  );

  return problems.filter(
    (problem) =>
      problem.status === 'open' && !variantProblemIds.has(problem.id),
  ).length;
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
