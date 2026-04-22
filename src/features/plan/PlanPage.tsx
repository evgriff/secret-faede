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
  SunExposure,
  StructureType,
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
  isCanvasPlanWarning,
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
import { useGarden, type SelectedGardenItem } from '../garden/useGarden';
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
import { PlanFloatingActions } from './components/PlanFloatingActions';
import { PlanSelectionToolbar } from './components/PlanSelectionToolbar';
import { PlanTopBar } from './components/PlanTopBar';
import { usePlanKeyboardShortcuts } from './hooks/usePlanKeyboardShortcuts';
import { usePlanPointerInteractions } from './hooks/usePlanPointerInteractions';
import { syncSetupProfile } from './planPageActions';
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
  const {
    acceptReviewSuggestion,
    acceptReviewSuggestions,
    addPlant,
    addStructure,
    applyAutoLayoutProposal,
    applyPlotSettings,
    approveSuccessionPlanting,
    checkpointGarden,
    completeGardenSetup,
    deleteItems,
    deleteSelectedItem,
    discardDraft,
    dirty,
    duplicateItems,
    duplicatePlanting,
    duplicateStructure,
    error,
    garden,
    paintSunShadeCell,
    publishDraft,
    recalculateSunShade,
    recordSuggestionDecision,
    rejectReviewSuggestion,
    refreshWeatherAndWatering,
    redoGardenChange,
    revertToRevision,
    resizeStructure,
    resizeStructureRect,
    saveGarden,
    saveStatus,
    selectedItem,
    setupRequired,
    setSelectedItem,
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
  const [selectedItems, setSelectedItems] = useState<PlanItemRef[]>([]);
  const [isAddPlantOpen, setIsAddPlantOpen] = useState(false);
  const [isChoosePlantsOpen, setIsChoosePlantsOpen] = useState(false);
  const [autoLayoutCandidates, setAutoLayoutCandidates] = useState<
    AutoLayoutCandidate[]
  >([]);
  const [selectedAutoLayoutCandidateId, setSelectedAutoLayoutCandidateId] =
    useState<string | null>(null);
  const [optimizerStatus, setOptimizerStatus] =
    useState<AutoLayoutRunStatus>('idle');
  const [optimizerMessage, setOptimizerMessage] = useState<string | null>(null);
  const [rejectedAutoLayoutCandidateIds, setRejectedAutoLayoutCandidateIds] =
    useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPlotSettingsOpen, setIsPlotSettingsOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [showDraftChoice, setShowDraftChoice] = useState(true);
  const [structureType, setStructureType] =
    useState<StructureType>('raisedBed');
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
  const canvasPlanWarnings = useMemo(
    () => activePlanWarnings.filter(isCanvasPlanWarning),
    [activePlanWarnings],
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
              warnings: planWarnings,
            }),
          ]
        : [],
    [activeSunLayer, autoLayoutCandidates, garden, planWarnings],
  );
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
    }
  }, [selectedItem]);

  const selectedPlantIds = useMemo(
    () =>
      selectedItems
        .filter((item) => item.type === 'planting')
        .map((item) => item.id),
    [selectedItems],
  );
  const selectedStructureIds = useMemo(
    () =>
      selectedItems
        .filter((item) => item.type === 'structure')
        .map((item) => item.id),
    [selectedItems],
  );

  const handleSelectItem = useCallback(
    (item: SelectedGardenItem, additive: boolean) => {
      setSelectedItems((currentSelection) => {
        const nextSelection = additive
          ? toggleSelection(currentSelection, item)
          : [item];
        const primaryItem = nextSelection.at(-1) ?? null;

        setSelectedItem(primaryItem);
        return nextSelection;
      });
    },
    [setSelectedItem],
  );

  const handleMarqueeSelect = useCallback(
    (items: PlanItemRef[], additive: boolean) => {
      setSelectedItems((currentSelection) => {
        const nextSelection = additive
          ? mergeSelection(currentSelection, items)
          : items;

        setSelectedItem(nextSelection.at(-1) ?? null);
        return nextSelection;
      });
    },
    [setSelectedItem],
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
    setActiveMode,
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
            geocodingApiKey={environment.geocodingApiKey}
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

    if (
      garden &&
      autoLayoutCandidates.length === 0 &&
      garden.seasonPlan.wantedCrops.length > 0
    ) {
      void handleGenerateAutoLayouts(garden);
    }
  }

  async function handleGenerateAutoLayouts(sourceGarden = garden) {
    if (!sourceGarden) {
      setOptimizerStatus('error');
      setOptimizerMessage('The garden is still loading. Try Optimize again.');
      return;
    }

    setOptimizerStatus('running');
    setOptimizerMessage('Generating layout candidates...');
    setRejectedAutoLayoutCandidateIds([]);

    try {
      const { generateAutoLayoutCandidates } =
        await import('./autoLayoutEngine');
      const candidates = generateAutoLayoutCandidates(sourceGarden, {
        sunLayer: activeSunLayer,
      });

      setAutoLayoutCandidates(candidates);
      setSelectedAutoLayoutCandidateId(candidates[0]?.id ?? null);

      if (candidates.length === 0) {
        const hasLayoutRequests =
          sourceGarden.seasonPlan.wantedCrops.length > 0;

        setOptimizerStatus('empty');
        setOptimizerMessage(
          hasLayoutRequests
            ? 'No legal layout candidates were found. Check crop quantities, supports, and anchored plantings.'
            : 'Choose plants before running layout optimization.',
        );
        return;
      }

      setOptimizerStatus('ready');
      setOptimizerMessage(
        `${candidates.length} layout candidates generated. Preview one before applying it.`,
      );
    } catch (generationError) {
      setAutoLayoutCandidates([]);
      setSelectedAutoLayoutCandidateId(null);
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

    if (!selectedCandidate) {
      setOptimizerStatus('error');
      setOptimizerMessage('Select a layout candidate before applying.');
      return;
    }

    if (rejectedAutoLayoutCandidateIds.includes(selectedCandidate.id)) {
      setOptimizerStatus('error');
      setOptimizerMessage('Rejected proposals cannot be applied.');
      return;
    }

    if (selectedCandidate.hardConstraintViolations.length > 0) {
      setOptimizerStatus('error');
      setOptimizerMessage(
        'This proposal still has hard constraint issues and cannot be applied.',
      );
      return;
    }

    applyAutoLayoutProposal(
      selectedCandidate.plantings,
      selectedCandidate.structures,
    );
    recordSuggestionDecision({
      id: getAutoLayoutReviewSuggestionId(selectedCandidate.id),
      label: `Use ${selectedCandidate.label} layout`,
      note: selectedCandidate.explanations[0] ?? null,
      status: 'accepted',
    });
    setOptimizerStatus('applied');
    setOptimizerMessage(
      `${selectedCandidate.label} was applied to the draft. Review the grid before publishing.`,
    );
  }

  function handleRejectAutoLayoutCandidate(candidateId: string) {
    const rejectedCandidate = autoLayoutCandidates.find(
      (candidate) => candidate.id === candidateId,
    );

    if (!rejectedCandidate) {
      setOptimizerStatus('error');
      setOptimizerMessage('That layout candidate is no longer available.');
      return;
    }

    setRejectedAutoLayoutCandidateIds((ids) =>
      ids.includes(candidateId) ? ids : [...ids, candidateId],
    );
    recordSuggestionDecision({
      id: getAutoLayoutReviewSuggestionId(candidateId),
      label: `Reject ${rejectedCandidate.label} layout`,
      note:
        rejectedCandidate.tradeoffs[0] ??
        rejectedCandidate.explanations[0] ??
        null,
      status: 'rejected',
    });

    if (selectedAutoLayoutCandidateId === candidateId) {
      const nextCandidate = autoLayoutCandidates.find(
        (candidate) =>
          candidate.id !== candidateId &&
          !rejectedAutoLayoutCandidateIds.includes(candidate.id),
      );

      setSelectedAutoLayoutCandidateId(nextCandidate?.id ?? null);
    }

    setOptimizerStatus('ready');
    setOptimizerMessage(
      `${rejectedCandidate.label} rejected. Select another proposal or generate again.`,
    );
  }

  function handleAcceptReviewSuggestion(suggestion: ReviewSuggestion) {
    acceptReviewSuggestion(suggestion);
    markSuggestionWarningAcknowledged(suggestion);
  }

  function handleAcceptReviewBatch(suggestions: ReviewSuggestion[]) {
    acceptReviewSuggestions(suggestions);

    for (const suggestion of suggestions) {
      markSuggestionWarningAcknowledged(suggestion);
    }
  }

  function handleRejectReviewSuggestion(suggestion: ReviewSuggestion) {
    rejectReviewSuggestion(suggestion);
    markSuggestionWarningAcknowledged(suggestion);
  }

  function handleSnoozeReviewSuggestion(suggestion: ReviewSuggestion) {
    snoozeReviewSuggestion(suggestion);
    markSuggestionWarningAcknowledged(suggestion);
  }

  function handleJumpToSuggestion(suggestion: ReviewSuggestion) {
    if (!garden) {
      return;
    }

    const selection = getSelectionForItemIds(garden, suggestion.itemIds);

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

  const sidePanelState =
    activeMode !== 'select' ? 'mode' : selectedItem ? 'inspector' : null;
  const hasSidePanel = sidePanelState !== null;

  return (
    <section className={styles.screen} data-route-shell="true">
      <div className={styles.routeChrome}>
        <PlanTopBar
          canPublish={canPublish || dirty}
          dirty={dirty}
          garden={garden}
          isOptimizeActive={activeMode === 'optimize'}
          isOffline={isOffline}
          onOpenChoosePlants={() => setIsChoosePlantsOpen(true)}
          onOpenHistory={() => setIsHistoryOpen(true)}
          onOpenPlot={() => setIsPlotSettingsOpen(true)}
          onOptimize={handleOpenOptimizeMode}
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
        className={`${styles.workspaceGrid} ${
          hasSidePanel ? styles.withSidePanel : styles.fullCanvas
        }`}
      >
        <PlanActionRail activeMode={activeMode} setActiveMode={setActiveMode} />

        <div className={styles.canvasColumn}>
          <PlanCanvas
            activeSunLayer={activeSunLayer}
            draggingPlantId={pointerInteractions.draggingPlantId}
            draggingStructureId={pointerInteractions.draggingStructureId}
            garden={garden}
            manualSunEdit={manualSunEdit}
            manualSunExposure={manualSunExposure}
            marqueeRect={pointerInteractions.marqueeRect}
            mode={activeMode}
            onMarqueePointerDown={pointerInteractions.handleMarqueePointerDown}
            onMarqueePointerEnd={pointerInteractions.handleMarqueePointerEnd}
            onMarqueePointerMove={pointerInteractions.handleMarqueePointerMove}
            onPaintSunShadeCell={paintSunShadeCell}
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
            planWarnings={canvasPlanWarnings}
            plotRef={pointerInteractions.plotRef}
            resizingStructureId={pointerInteractions.resizingStructureId}
            selectedPlantIds={selectedPlantIds}
            selectedStructureIds={selectedStructureIds}
            showSunOverlay={showSunOverlay}
            snapGuides={pointerInteractions.snapGuides}
            sunSeason={sunSeason}
          />
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
          <PlanFloatingActions
            activeMode={activeMode}
            isOptimizeActive={activeMode === 'optimize'}
            onOpenChoosePlants={() => setIsChoosePlantsOpen(true)}
            onOptimize={handleOpenOptimizeMode}
            setActiveMode={setActiveMode}
          />
        </div>

        {sidePanelState ? (
          <aside className={styles.sidePanel} aria-label="Plan context panel">
            <Suspense
              fallback={
                <div className={styles.sidePanelLoading}>Loading controls.</div>
              }
            >
              {sidePanelState === 'mode' ? (
                <>
                  <PlanModeDrawer
                    activeSunLayer={activeSunLayer}
                    garden={garden}
                    manualSunEdit={manualSunEdit}
                    manualSunExposure={manualSunExposure}
                    mode={activeMode}
                    onAddPlant={() => setIsAddPlantOpen(true)}
                    onAddStructure={() => {
                      addStructure(structureType, {
                        accessibleMode: accessiblePathDefaults,
                      });
                      setActiveMode('select');
                      telemetryService.trackEvent('structure_added', {
                        accessible_path_default: accessiblePathDefaults,
                        structure_type: structureType,
                      });
                    }}
                    onClose={() => setActiveMode('select')}
                    onAcceptReviewBatch={handleAcceptReviewBatch}
                    onAcceptReviewSuggestion={handleAcceptReviewSuggestion}
                    onDismissHealthIssue={handleDismissHealthIssue}
                    onGenerateAutoLayoutCandidates={() =>
                      void handleGenerateAutoLayouts()
                    }
                    onJumpToHealthIssue={handleJumpToHealthIssue}
                    onJumpToSuggestion={handleJumpToSuggestion}
                    onRecalculateSun={recalculateSunShade}
                    onRejectReviewSuggestion={handleRejectReviewSuggestion}
                    onRestoreWarning={(warningId) =>
                      setAcknowledgedWarningIds((ids) =>
                        ids.filter((id) => id !== warningId),
                      )
                    }
                    onSnoozeReviewSuggestion={handleSnoozeReviewSuggestion}
                    planHealthReport={planHealthReport}
                    reviewSuggestions={reviewSuggestions}
                    setManualSunEdit={setManualSunEdit}
                    setManualSunExposure={setManualSunExposure}
                    setAccessiblePathDefaults={setAccessiblePathDefaults}
                    setMode={(mode) => {
                      if (mode === 'optimize') {
                        handleOpenOptimizeMode();
                        return;
                      }

                      setActiveMode(mode);
                    }}
                    setShowSunOverlay={setShowSunOverlay}
                    setStructureType={setStructureType}
                    setSunSeason={setSunSeason}
                    showSunOverlay={showSunOverlay}
                    accessiblePathDefaults={accessiblePathDefaults}
                    structureType={structureType}
                    suggestionDecisions={suggestionDecisions}
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
                      onRejectAutoLayoutCandidate={
                        handleRejectAutoLayoutCandidate
                      }
                      onRefresh={() => void handleRefreshOperations()}
                      onSelectAutoLayoutCandidate={
                        setSelectedAutoLayoutCandidateId
                      }
                      optimizerMessage={optimizerMessage}
                      optimizerStatus={optimizerStatus}
                      rejectedAutoLayoutCandidateIds={
                        rejectedAutoLayoutCandidateIds
                      }
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
              )}
            </Suspense>
          </aside>
        ) : null}
      </div>

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
              telemetryService.trackEvent('planting_added', {
                crop_id: request.crop.id,
                mode: request.mode,
              });
              setIsAddPlantOpen(false);
              setActiveMode('select');
            }}
            onClose={() => setIsAddPlantOpen(false)}
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
              void handleGenerateAutoLayouts(optimizedGarden);
            }}
            sunExposureAtPlacement={nextPlacementSunArea?.exposure ?? null}
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
