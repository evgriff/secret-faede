import { useCallback, useEffect, useRef, useState } from 'react';

import { useServices } from '../../app/providers';
import { getCropById } from '../../domain/crops/cropCatalog';
import {
  createDefaultPlanting,
  createDefaultPlantStatus,
  createDefaultStructure,
  type CropProfile,
  type Garden,
  type GardenLocation,
  type GardenPlot,
  type GardenPlant,
  getSharedGardenOperations,
  getCropSupportNeed,
  overlaySharedGardenOperations,
  fitPlantingToAreaRect,
  type Planting,
  getDerivedPlantingDimensions,
  type LayoutProblem,
  type LayoutResolution,
  type LayoutResolutionOption,
  normalizePlantSupportPlanForQuantity,
  type PlantEditorEntryPoint,
  type PlantEditorTab,
  type PlantingInstance,
  type PlantingMode,
  type PlantPlacementMode,
  type PlantSupportPlan,
  type SeasonCropSelection,
  type SunExposure,
  type Structure,
  type StructureType,
  type UserProfile,
} from '../../domain/gardens/GardenRepository';
import {
  createPlantingInstances,
  getPlantingInstances,
  movePlantingInstance,
  movePlantingWithInstances,
  normalizePlantingFromInstances,
  offsetPlantingInstances,
} from '../../domain/gardens/plantingInstances';
import type {
  GardenSuggestionDecision,
  GardenWorkspace,
} from '../../domain/gardens/gardenWorkspace';
import {
  createGardenFromSetup,
  type GardenSetupRequest,
} from '../../domain/gardens/gardenTemplates';
import {
  clampPlantToPlot,
  clampPlotDimension,
  clampStructureToPlot,
  normalizePointToPlot,
  snapFeet,
  type PlotPoint,
} from './gardenMath';
import {
  canManuallyMovePlanting,
  canOptimizerMovePlanting,
} from './gardenImmutability';
import {
  buildSunShadeLayers,
  createManualSunArea,
  findSunShadeLayer,
  type SunSeason,
} from './sunShadeEngine';
import {
  rebuildGardenWateringFromLatestSnapshot,
  refreshGardenWateringFromWeather,
} from './wateringScheduleRefresh';
import { markPlantingsPlantedInGarden } from './gardenPlantingLifecycle';
import { applyPlantingEventEffects } from './plantingEventEffects';
import {
  applyReviewSuggestionActions,
  describeSuggestionDecision,
  type ReviewSuggestion,
} from './reviewSuggestions';
import {
  closedDetailedViewState,
  closedPlantEditorState,
  createDefaultGardenPlanningState,
  openPlantDetailedView,
  openPlantEditor,
  syncGardenPlanningStateWithGarden,
  type GardenPlanningState,
  type PlantLabelVisibilityState,
  type PlantLayoutReviewState,
  type PlantLocationMatchState,
} from './gardenPlanningState';
import {
  getGardenPlanningStorageSignature,
  readGardenPlanningState,
  writeGardenPlanningState,
} from './gardenPlanningStorage';
import { isBrowserOffline } from '../../shared/network/networkStatus';
import {
  addSuccessionPlanting,
  getSuccessionPlantingId,
  type SuccessionRecommendation,
} from '../tasks/taskEngine';
import { useAuth } from '../auth/auth-context';

type GardenLoadStatus = 'error' | 'loading' | 'ready';
type SaveStatus = 'error' | 'idle' | 'queued' | 'saved' | 'saving';
export type SelectedGardenItem =
  | { id: string; instanceId?: string; type: 'planting' }
  | { id: string; type: 'structure' };

export type GardenItemPositionUpdate = SelectedGardenItem & {
  xFt: number;
  yFt: number;
};

export interface GardenPositionUpdateOptions {
  saveAfterCommit?: boolean;
}

type QueuedDraftSave = {
  garden: Garden;
  resolvers: Array<(saved: boolean) => void>;
  revision: number;
};

const arrangementFields: Array<keyof GardenPlant> = [
  'blockDepthFt',
  'blockWidthFt',
  'clusterRadiusFt',
  'mode',
  'plantCount',
  'rowLengthFt',
  'spacingInches',
];

export interface GardenStructureRectUpdate {
  depthFt: number;
  id: string;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface GardenPlantingRectUpdate {
  depthFt: number;
  id: string;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface AddPlantingRequest {
  blockDepthFt: number | null;
  blockWidthFt: number | null;
  clusterRadiusFt: number | null;
  crop: CropProfile;
  mode: PlantingMode;
  plantCount: number | null;
  rowLengthFt: number | null;
}

export function useGarden(userId: string | null) {
  const { state } = useAuth();
  const {
    gardenOperationsService,
    gardenRepository,
    userProfileRepository,
    weatherProvider,
  } = useServices();
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [garden, setGarden] = useState<Garden | null>(null);
  const [gardenPlanningState, setGardenPlanningState] =
    useState<GardenPlanningState | null>(null);
  const latestGardenPlanningState = useRef<GardenPlanningState | null>(null);
  const [redoStack, setRedoStack] = useState<Garden[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selectedItem, setSelectedItem] = useState<SelectedGardenItem | null>(
    null,
  );
  const [setupRequired, setSetupRequired] = useState(false);
  const [status, setStatus] = useState<GardenLoadStatus>('loading');
  const [undoStack, setUndoStack] = useState<Garden[]>([]);
  const [workspace, setWorkspace] = useState<GardenWorkspace | null>(null);
  const [suggestionDecisions, setSuggestionDecisions] = useState<
    GardenSuggestionDecision[]
  >([]);
  const [wateringProfile, setWateringProfile] = useState<UserProfile | null>(
    null,
  );
  const selectedPlantId =
    selectedItem?.type === 'planting' ? selectedItem.id : null;
  const selectedStructureId =
    selectedItem?.type === 'structure' ? selectedItem.id : null;
  const gardenPlanningStorageSignature = gardenPlanningState
    ? getGardenPlanningStorageSignature(gardenPlanningState)
    : null;
  const draftSaveContextRef = useRef({
    gardenRepository,
    suggestionDecisions,
    userId,
    workspace,
  });
  const gardenEditRevisionRef = useRef(0);
  const isMountedRef = useRef(true);
  const queuedDraftSaveRef = useRef<QueuedDraftSave | null>(null);
  const scheduledDraftSaveRef = useRef<{
    garden: Garden;
    revision: number;
  } | null>(null);
  const saveTaskScheduledRef = useRef(false);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    draftSaveContextRef.current = {
      gardenRepository,
      suggestionDecisions,
      userId,
      workspace,
    };
  }, [gardenRepository, suggestionDecisions, userId, workspace]);

  useEffect(() => {
    if (!userId) {
      setGarden(null);
      setGardenPlanningState(null);
      setStatus('loading');
      return;
    }

    let active = true;
    setStatus('loading');
    setError(null);

    void gardenRepository
      .getWorkspace(userId)
      .then((loadedWorkspace) => {
        if (!active) {
          return;
        }

        const loadedGarden = loadedWorkspace.draft.garden;
        const planningHydration = readGardenPlanningState(userId, loadedGarden);

        setGarden(loadedGarden);
        setGardenPlanningState(planningHydration.state);
        setDirty(false);
        gardenEditRevisionRef.current = 0;
        queuedDraftSaveRef.current = null;
        setRedoStack([]);
        setSaveStatus('idle');
        setSetupRequired(needsProfileSetup(loadedGarden));
        setSelectedItem(null);
        setSuggestionDecisions(loadedWorkspace.draft.suggestionDecisions);
        setStatus('ready');
        setUndoStack([]);
        setWorkspace(loadedWorkspace);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(toErrorMessage(loadError, 'Unable to load your garden.'));
        setStatus('error');
      });

    const unsubscribe = gardenRepository.subscribeWorkspace(
      userId,
      (liveWorkspace) => {
        if (!active) {
          return;
        }

        setWorkspace(liveWorkspace);
        setGarden((currentGarden) =>
          currentGarden && !needsProfileSetup(currentGarden)
            ? overlaySharedGardenOperations(
                currentGarden,
                getSharedGardenOperations(liveWorkspace.draft.garden),
              )
            : currentGarden,
        );
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gardenRepository, userId]);

  useEffect(() => {
    const email = state.user?.email;

    if (!userId || !email) {
      setWateringProfile(null);
      return;
    }

    let active = true;

    void userProfileRepository
      .getUserProfile(userId, email)
      .then((savedProfile) => {
        if (active) {
          setWateringProfile(savedProfile);
        }
      })
      .catch(() => {
        if (active) {
          setWateringProfile(null);
        }
      });

    return () => {
      active = false;
    };
  }, [state.user?.email, userId, userProfileRepository]);

  useEffect(() => {
    if (!garden) {
      setGardenPlanningState(null);
      return;
    }

    setGardenPlanningState((currentState) =>
      syncGardenPlanningStateWithGarden(currentState, garden),
    );
  }, [garden]);

  useEffect(() => {
    setGardenPlanningState((currentState) => {
      if (!currentState) {
        return currentState;
      }

      const selectedPlantGroupId =
        selectedItem?.type === 'planting' ? selectedItem.id : null;

      return currentState.selectedPlantGroupId === selectedPlantGroupId
        ? currentState
        : {
            ...currentState,
            selectedPlantGroupId,
          };
    });
  }, [selectedItem]);

  useEffect(() => {
    latestGardenPlanningState.current = gardenPlanningState;
  }, [gardenPlanningState]);

  useEffect(() => {
    const stateToPersist = latestGardenPlanningState.current;

    if (!gardenPlanningStorageSignature || !stateToPersist || !userId) {
      return;
    }

    writeGardenPlanningState(userId, stateToPersist);
  }, [gardenPlanningStorageSignature, userId]);

  const writeQueuedDraftSave = useCallback(async (job: QueuedDraftSave) => {
    const {
      gardenRepository: currentGardenRepository,
      suggestionDecisions: currentSuggestionDecisions,
      userId: currentUserId,
      workspace: currentWorkspace,
    } = draftSaveContextRef.current;

    if (!currentUserId || !currentWorkspace) {
      job.resolvers.forEach((resolve) => resolve(false));
      return false;
    }

    if (isMountedRef.current) {
      setSaveStatus('saving');
      setError(null);
    }

    try {
      const wasOffline = isBrowserOffline();
      await currentGardenRepository.saveDraft({
        ...currentWorkspace.draft,
        garden: job.garden,
        suggestionDecisions: currentSuggestionDecisions,
        updatedAtIso: new Date().toISOString(),
        userId: currentUserId,
      });
      const nextWorkspace =
        await currentGardenRepository.getWorkspace(currentUserId);

      if (isMountedRef.current) {
        if (job.revision === gardenEditRevisionRef.current) {
          setDirty(false);
          setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
          setSuggestionDecisions(nextWorkspace.draft.suggestionDecisions);
          setWorkspace(nextWorkspace);
        } else if (!queuedDraftSaveRef.current) {
          setSaveStatus('idle');
        }
      }

      job.resolvers.forEach((resolve) => resolve(true));
      return true;
    } catch (saveError) {
      if (isMountedRef.current) {
        setError(toErrorMessage(saveError, 'Unable to save your garden.'));
        setSaveStatus('error');
      }

      job.resolvers.forEach((resolve) => resolve(false));
      return false;
    }
  }, []);

  const flushQueuedDraftSaves = useCallback(async () => {
    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;

    try {
      while (queuedDraftSaveRef.current) {
        const nextSave = queuedDraftSaveRef.current;
        queuedDraftSaveRef.current = null;
        await writeQueuedDraftSave(nextSave);
      }
    } finally {
      saveInFlightRef.current = false;
    }
  }, [writeQueuedDraftSave]);

  const enqueueDraftSave = useCallback(
    (draftGarden: Garden, revision = gardenEditRevisionRef.current) =>
      new Promise<boolean>((resolve) => {
        const queuedSave = queuedDraftSaveRef.current;

        queuedDraftSaveRef.current = {
          garden: draftGarden,
          resolvers: queuedSave
            ? [...queuedSave.resolvers, resolve]
            : [resolve],
          revision,
        };

        if (isMountedRef.current) {
          setSaveStatus('saving');
          setError(null);
        }

        void flushQueuedDraftSaves();
      }),
    [flushQueuedDraftSaves],
  );

  const scheduleDraftAutosave = useCallback(
    (draftGarden: Garden, revision: number) => {
      scheduledDraftSaveRef.current = {
        garden: draftGarden,
        revision,
      };

      if (saveTaskScheduledRef.current) {
        return;
      }

      saveTaskScheduledRef.current = true;

      const run = () => {
        const nextSave = scheduledDraftSaveRef.current;

        scheduledDraftSaveRef.current = null;
        saveTaskScheduledRef.current = false;

        if (nextSave) {
          void enqueueDraftSave(nextSave.garden, nextSave.revision);
        }
      };

      void Promise.resolve().then(run);
    },
    [enqueueDraftSave],
  );

  const saveCurrentDraft = useCallback(
    async (draftGarden: Garden, revision = gardenEditRevisionRef.current) => {
      if (!userId || !workspace) {
        return false;
      }

      return enqueueDraftSave(draftGarden, revision);
    },
    [enqueueDraftSave, userId, workspace],
  );

  const commitGardenUpdate = useCallback(
    (
      updateGarden: (currentGarden: Garden) => Garden,
      selection?: SelectedGardenItem | null,
      trackHistory = true,
      refreshWateringFromSnapshot = false,
      afterCommit?: (updatedGarden: Garden, revision: number) => void,
    ) => {
      const now = new Date();

      setGarden((currentGarden) => {
        if (!currentGarden) {
          return currentGarden;
        }

        const updatedGarden = refreshWateringFromSnapshot
          ? rebuildGardenWateringFromLatestSnapshot(
              updateGarden(currentGarden),
              {
                now,
                profile: wateringProfile,
              },
            )
          : updateGarden(currentGarden);

        if (updatedGarden === currentGarden) {
          return currentGarden;
        }

        if (trackHistory) {
          setUndoStack((stack) => [...stack.slice(-24), currentGarden]);
          setRedoStack([]);
        }

        setDirty(true);
        setSaveStatus('idle');
        gardenEditRevisionRef.current += 1;
        const revision = gardenEditRevisionRef.current;

        if (selection !== undefined) {
          setSelectedItem(selection);
        }

        afterCommit?.(updatedGarden, revision);
        return updatedGarden;
      });
    },
    [wateringProfile],
  );

  const checkpointGarden = useCallback(() => {
    setGarden((currentGarden) => {
      if (!currentGarden) {
        return currentGarden;
      }

      setUndoStack((stack) => [...stack.slice(-24), currentGarden]);
      setRedoStack([]);
      setDirty(true);
      setSaveStatus('idle');
      gardenEditRevisionRef.current += 1;
      return currentGarden;
    });
  }, []);

  const updateGardenPlanningState = useCallback(
    (
      updateState: (currentState: GardenPlanningState) => GardenPlanningState,
    ) => {
      setGardenPlanningState((currentState) => {
        const baseState =
          currentState ??
          (garden ? createDefaultGardenPlanningState(garden) : null);

        return baseState ? updateState(baseState) : baseState;
      });
    },
    [garden],
  );

  const setHoveredPlantGroupId = useCallback(
    (groupId: string | null) => {
      updateGardenPlanningState((currentState) =>
        currentState.hoveredPlantGroupId === groupId
          ? currentState
          : {
              ...currentState,
              hoveredPlantGroupId: groupId,
            },
      );
    },
    [updateGardenPlanningState],
  );

  const setPlantLabelVisibility = useCallback(
    (labelVisibility: PlantLabelVisibilityState) => {
      updateGardenPlanningState((currentState) => ({
        ...currentState,
        labelVisibility,
      }));
    },
    [updateGardenPlanningState],
  );

  const showPlantGroupLabel = useCallback(
    (groupId: string) => {
      updateGardenPlanningState((currentState) => ({
        ...currentState,
        labelVisibility: {
          ...currentState.labelVisibility,
          groupIds: currentState.labelVisibility.groupIds.includes(groupId)
            ? currentState.labelVisibility.groupIds
            : [...currentState.labelVisibility.groupIds, groupId],
          mode:
            currentState.labelVisibility.mode === 'hidden'
              ? 'auto'
              : currentState.labelVisibility.mode,
        },
      }));
    },
    [updateGardenPlanningState],
  );

  const hidePlantGroupLabel = useCallback(
    (groupId: string) => {
      updateGardenPlanningState((currentState) => ({
        ...currentState,
        labelVisibility: {
          ...currentState.labelVisibility,
          groupIds: currentState.labelVisibility.groupIds.filter(
            (visibleGroupId) => visibleGroupId !== groupId,
          ),
        },
      }));
    },
    [updateGardenPlanningState],
  );

  const openPlantGroupEditor = useCallback(
    (
      groupId: string,
      source: PlantEditorEntryPoint = 'detailedView',
      options: {
        dotId?: string | null;
        problemId?: string | null;
        tab?: PlantEditorTab;
      } = {},
    ) => {
      setSelectedItem({ id: groupId, type: 'planting' });
      updateGardenPlanningState((currentState) => ({
        ...currentState,
        editor: openPlantEditor(groupId, source, options),
        selectedPlantGroupId: groupId,
      }));
    },
    [updateGardenPlanningState],
  );

  const closePlantGroupEditor = useCallback(() => {
    updateGardenPlanningState((currentState) => ({
      ...currentState,
      editor: closedPlantEditorState,
    }));
  }, [updateGardenPlanningState]);

  const openDetailedViewForItem = useCallback(
    (item: SelectedGardenItem | null = selectedItem) => {
      if (!item) {
        return;
      }

      setSelectedItem(item);
      updateGardenPlanningState((currentState) => ({
        ...currentState,
        detailedView:
          item.type === 'planting'
            ? openPlantDetailedView(item.id)
            : {
                isOpen: true,
                presentation: 'sidePanel',
                subject: {
                  structureId: item.id,
                  type: 'structure',
                },
              },
      }));
    },
    [selectedItem, updateGardenPlanningState],
  );

  const closeDetailedView = useCallback(() => {
    updateGardenPlanningState((currentState) => ({
      ...currentState,
      detailedView: closedDetailedViewState,
    }));
  }, [updateGardenPlanningState]);

  const toggleDetailedViewForSelection = useCallback(() => {
    if (gardenPlanningState?.detailedView.isOpen) {
      closeDetailedView();
      return;
    }

    openDetailedViewForItem(selectedItem);
  }, [
    closeDetailedView,
    gardenPlanningState?.detailedView.isOpen,
    openDetailedViewForItem,
    selectedItem,
  ]);

  const setLayoutReviewState = useCallback(
    (layoutState: Partial<PlantLayoutReviewState>) => {
      updateGardenPlanningState((currentState) => ({
        ...currentState,
        layout: {
          ...currentState.layout,
          ...layoutState,
        },
      }));
    },
    [updateGardenPlanningState],
  );

  const selectLayoutProblem = useCallback(
    (problemId: string | null) => {
      updateGardenPlanningState((currentState) => ({
        ...currentState,
        detailedView: problemId
          ? {
              isOpen: true,
              presentation: 'sidePanel',
              subject: {
                problemId,
                type: 'layoutProblem',
              },
            }
          : currentState.detailedView,
        layout: {
          ...currentState.layout,
          selectedProblemId: problemId,
        },
      }));
    },
    [updateGardenPlanningState],
  );

  const recordLayoutResolution = useCallback(
    (resolution: LayoutResolution) => {
      updateGardenPlanningState((currentState) => ({
        ...currentState,
        layout: {
          ...currentState.layout,
          resolutions: [
            ...currentState.layout.resolutions.filter(
              (currentResolution) => currentResolution.id !== resolution.id,
            ),
            resolution,
          ],
        },
      }));
    },
    [updateGardenPlanningState],
  );

  const setLocationMatchState = useCallback(
    (locationMatchState: Partial<PlantLocationMatchState>) => {
      updateGardenPlanningState((currentState) => ({
        ...currentState,
        locationMatch: {
          ...currentState.locationMatch,
          ...locationMatchState,
        },
      }));
    },
    [updateGardenPlanningState],
  );

  const setLocationMatchSunExposure = useCallback(
    (sunExposureAtPlacement: SunExposure | null) => {
      setLocationMatchState({
        sunExposureAtPlacement,
        updatedAtIso: garden?.updatedAtIso ?? new Date().toISOString(),
      });
    },
    [garden?.updatedAtIso, setLocationMatchState],
  );

  const recordSuggestionDecision = useCallback(
    ({
      impact = 'planned',
      id,
      label,
      note = null,
      status: decisionStatus,
    }: {
      impact?: GardenSuggestionDecision['impact'];
      id: string;
      label: string;
      note?: string | null;
      status: GardenSuggestionDecision['status'];
    }) => {
      const decision: GardenSuggestionDecision = {
        decidedAtIso: new Date().toISOString(),
        id,
        impact,
        label,
        note,
        status: decisionStatus,
      };

      setSuggestionDecisions((currentDecisions) => [
        ...currentDecisions.filter(
          (currentDecision) => currentDecision.id !== id,
        ),
        decision,
      ]);
      setDirty(true);
      setSaveStatus('idle');
    },
    [],
  );

  const recordReviewSuggestionDecision = useCallback(
    (
      suggestion: ReviewSuggestion,
      status: GardenSuggestionDecision['status'],
    ) => {
      const decision = describeSuggestionDecision(suggestion);

      recordSuggestionDecision({
        ...decision,
        status,
      });
    },
    [recordSuggestionDecision],
  );

  const acceptReviewSuggestion = useCallback(
    (suggestion: ReviewSuggestion) => {
      commitGardenUpdate(
        (currentGarden) =>
          applyReviewSuggestionActions(currentGarden, suggestion.actions),
        suggestion.itemIds[0]
          ? resolveSelectionFromId(garden, suggestion.itemIds[0])
          : undefined,
        true,
        true,
      );
      recordReviewSuggestionDecision(suggestion, 'accepted');
    },
    [commitGardenUpdate, garden, recordReviewSuggestionDecision],
  );

  const acceptReviewSuggestions = useCallback(
    (suggestions: ReviewSuggestion[]) => {
      if (suggestions.length === 0) {
        return;
      }

      commitGardenUpdate(
        (currentGarden) =>
          suggestions.reduce(
            (nextGarden, suggestion) =>
              applyReviewSuggestionActions(nextGarden, suggestion.actions),
            currentGarden,
          ),
        undefined,
        true,
        true,
      );

      for (const suggestion of suggestions) {
        recordReviewSuggestionDecision(suggestion, 'accepted');
      }
    },
    [commitGardenUpdate, recordReviewSuggestionDecision],
  );

  const rejectReviewSuggestion = useCallback(
    (suggestion: ReviewSuggestion) => {
      recordReviewSuggestionDecision(suggestion, 'rejected');
    },
    [recordReviewSuggestionDecision],
  );

  const snoozeReviewSuggestion = useCallback(
    (suggestion: ReviewSuggestion) => {
      recordReviewSuggestionDecision(suggestion, 'snoozed');
    },
    [recordReviewSuggestionDecision],
  );

  const addPlant = useCallback(
    (request: AddPlantingRequest) => {
      if (!garden) {
        return;
      }

      const basePlant = createPlanting(garden, request);
      const linkedTrellis = createLinkedTrellisStructure(
        garden,
        basePlant,
        request.crop,
      );
      const addedPlant = linkedTrellis
        ? {
            ...basePlant,
            supportStructureIds: [linkedTrellis.id],
            trellisLengthFt: linkedTrellis.widthFt,
          }
        : basePlant;
      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: [...currentGarden.plantings, addedPlant],
          structures: linkedTrellis
            ? [...currentGarden.structures, linkedTrellis]
            : currentGarden.structures,
        }),
        { id: addedPlant.id, type: 'planting' },
        true,
        true,
      );
    },
    [commitGardenUpdate, garden],
  );

  const completeGardenSetup = useCallback(
    (request: GardenSetupRequest) => {
      if (!garden) {
        return;
      }

      const setupGarden = createGardenFromSetup(garden, request);
      const updatedGarden = {
        ...setupGarden,
        sunShadeLayers: buildSunShadeLayers(setupGarden),
      };

      setGarden(updatedGarden);
      setDirty(true);
      setRedoStack([]);
      setSaveStatus('idle');
      setSelectedItem(null);
      setSetupRequired(false);
      setUndoStack([]);
    },
    [garden],
  );

  const addStructure = useCallback(
    (type: StructureType, options: { accessibleMode?: boolean } = {}) => {
      if (!garden) {
        return;
      }

      const structure = clampStructureToPlot(
        createDefaultStructure({
          accessibleMode: options.accessibleMode ?? false,
          id: createItemId('structure'),
          type,
          ...findNextStructureLocation(garden),
        }),
        garden.plot,
      );

      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          structures: [...currentGarden.structures, structure],
        }),
        { id: structure.id, type: 'structure' },
        true,
        true,
      );
    },
    [commitGardenUpdate, garden],
  );

  const addLinkedSupportStructure = useCallback(
    (plantingId: string) => {
      if (!garden) {
        return;
      }

      commitGardenUpdate(
        (currentGarden) => {
          const planting = currentGarden.plantings.find(
            (candidate) => candidate.id === plantingId,
          );
          const crop = getCropById(planting?.cropId);

          if (!planting || !crop) {
            return currentGarden;
          }

          const support = createLinkedTrellisStructure(
            currentGarden,
            planting,
            crop,
          );

          if (!support) {
            return currentGarden;
          }

          return {
            ...currentGarden,
            plantings: currentGarden.plantings.map((candidate) =>
              candidate.id === planting.id
                ? {
                    ...candidate,
                    supportStructureIds: [
                      ...new Set([
                        ...candidate.supportStructureIds,
                        support.id,
                      ]),
                    ],
                    trellisLengthFt: support.widthFt,
                  }
                : candidate,
            ),
            structures: [...currentGarden.structures, support],
          };
        },
        { id: plantingId, type: 'planting' },
        true,
        true,
      );
    },
    [commitGardenUpdate, garden],
  );

  const linkSupportStructure = useCallback(
    (plantingId: string, structureId: string) => {
      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: currentGarden.plantings.map((planting) =>
            planting.id === plantingId
              ? {
                  ...planting,
                  supportStructureIds: [
                    ...new Set([...planting.supportStructureIds, structureId]),
                  ],
                }
              : planting,
          ),
        }),
        { id: plantingId, type: 'planting' },
        true,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const unlinkSupportStructure = useCallback(
    (plantingId: string, structureId: string) => {
      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: currentGarden.plantings.map((planting) =>
            planting.id === plantingId
              ? {
                  ...planting,
                  supportStructureIds: planting.supportStructureIds.filter(
                    (id) => id !== structureId,
                  ),
                }
              : planting,
          ),
        }),
        { id: plantingId, type: 'planting' },
        true,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const approveSuccessionPlanting = useCallback(
    (recommendation: SuccessionRecommendation) => {
      const plantingId = getSuccessionPlantingId(recommendation);

      recordSuggestionDecision({
        id: plantingId,
        label: `${recommendation.cropName} succession`,
        note: recommendation.reason,
        status: 'accepted',
      });
      commitGardenUpdate(
        (currentGarden) =>
          addSuccessionPlanting(currentGarden, recommendation, new Date()),
        { id: plantingId, type: 'planting' },
        true,
        true,
      );
    },
    [commitGardenUpdate, recordSuggestionDecision],
  );

  const movePlant = useCallback(
    (
      plantId: string,
      point: PlotPoint,
      snap: boolean,
      trackHistory = true,
      instanceId?: string,
    ) => {
      commitGardenUpdate(
        (currentGarden) => {
          if (!currentGarden) {
            return currentGarden;
          }

          const normalizedPoint = normalizePointToPlot(
            point,
            currentGarden.plot,
            snap,
          );

          return {
            ...currentGarden,
            plantings: currentGarden.plantings.map((plant) =>
              plant.id === plantId
                ? !canManuallyMovePlanting(plant)
                  ? plant
                  : instanceId
                    ? movePlantingInstance(plant, instanceId, normalizedPoint)
                    : movePlantingWithInstances(plant, normalizedPoint)
                : plant,
            ),
          };
        },
        createSelectedPlantingItem(plantId, instanceId),
        trackHistory,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const moveStructure = useCallback(
    (
      structureId: string,
      point: PlotPoint,
      snap: boolean,
      trackHistory = true,
    ) => {
      commitGardenUpdate(
        (currentGarden) => {
          if (!currentGarden) {
            return currentGarden;
          }

          const normalizedPoint = normalizePointToPlot(
            point,
            currentGarden.plot,
            snap,
          );

          return {
            ...currentGarden,
            structures: currentGarden.structures.map((structure) =>
              structure.id === structureId
                ? structure.locked
                  ? structure
                  : clampStructureToPlot(
                      {
                        ...structure,
                        xFt: normalizedPoint.xFt,
                        yFt: normalizedPoint.yFt,
                      },
                      currentGarden.plot,
                      snap,
                    )
                : structure,
            ),
          };
        },
        { id: structureId, type: 'structure' },
        trackHistory,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const updateItemPositions = useCallback(
    (
      updates: GardenItemPositionUpdate[],
      trackHistory = true,
      options: GardenPositionUpdateOptions = {},
    ) => {
      if (updates.length === 0) {
        return;
      }

      const plantUpdatesById = groupPlantingPositionUpdates(updates);
      const structureUpdates = new Map(
        updates
          .filter((update) => update.type === 'structure')
          .map((update) => [update.id, update]),
      );

      const applyPositionUpdates = (currentGarden: Garden): Garden => ({
        ...currentGarden,
        plantings: currentGarden.plantings.map((planting) => {
          const plantingUpdates = plantUpdatesById.get(planting.id);

          if (!plantingUpdates || !canManuallyMovePlanting(planting)) {
            return planting;
          }

          return plantingUpdates.reduce((nextPlanting, update) => {
            const point = normalizePointToPlot(
              { xFt: update.xFt, yFt: update.yFt },
              currentGarden.plot,
              false,
            );

            return update.instanceId
              ? movePlantingInstance(nextPlanting, update.instanceId, point)
              : movePlantingWithInstances(nextPlanting, point);
          }, planting);
        }),
        structures: currentGarden.structures.map((structure) => {
          const update = structureUpdates.get(structure.id);

          if (!update || structure.locked) {
            return structure;
          }

          return clampStructureToPlot(
            {
              ...structure,
              xFt: update.xFt,
              yFt: update.yFt,
            },
            currentGarden.plot,
            false,
          );
        }),
      });
      const autosaveRevision = gardenEditRevisionRef.current + 1;
      const autosaveGarden =
        options.saveAfterCommit && garden ? applyPositionUpdates(garden) : null;

      commitGardenUpdate(
        applyPositionUpdates,
        updates.at(0) ?? undefined,
        trackHistory,
        false,
        options.saveAfterCommit ? scheduleDraftAutosave : undefined,
      );

      if (autosaveGarden) {
        scheduleDraftAutosave(autosaveGarden, autosaveRevision);
      }
    },
    [commitGardenUpdate, garden, scheduleDraftAutosave],
  );

  const resizeStructure = useCallback(
    (
      structureId: string,
      widthFt: number,
      depthFt: number,
      trackHistory = true,
    ) => {
      commitGardenUpdate(
        (currentGarden) => {
          if (!currentGarden) {
            return currentGarden;
          }

          return {
            ...currentGarden,
            structures: currentGarden.structures.map((structure) =>
              structure.id === structureId
                ? structure.locked
                  ? structure
                  : clampStructureToPlot(
                      {
                        ...structure,
                        depthFt,
                        widthFt,
                      },
                      currentGarden.plot,
                    )
                : structure,
            ),
          };
        },
        { id: structureId, type: 'structure' },
        trackHistory,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const resizeStructureRect = useCallback(
    (update: GardenStructureRectUpdate, trackHistory = true) => {
      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          structures: currentGarden.structures.map((structure) =>
            structure.id === update.id
              ? structure.locked
                ? structure
                : clampStructureToPlot(
                    {
                      ...structure,
                      depthFt: update.depthFt,
                      widthFt: update.widthFt,
                      xFt: update.xFt,
                      yFt: update.yFt,
                    },
                    currentGarden.plot,
                    false,
                  )
              : structure,
          ),
        }),
        { id: update.id, type: 'structure' },
        trackHistory,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const resizePlantingRect = useCallback(
    (update: GardenPlantingRectUpdate, trackHistory = true) => {
      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: currentGarden.plantings.map((planting) =>
            planting.id === update.id
              ? planting.locked
                ? planting
                : fitPlantingToAreaRect(
                    planting,
                    clampAreaRectToPlot(update, currentGarden.plot),
                  ).planting
              : planting,
          ),
        }),
        { id: update.id, type: 'planting' },
        trackHistory,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const applyPlotSettings = useCallback(
    (
      widthFt: number,
      depthFt: number,
      orientationDegrees: number,
      location?: GardenLocation,
    ) => {
      commitGardenUpdate(
        (currentGarden) => {
          if (!currentGarden) {
            return currentGarden;
          }

          const plot: GardenPlot = {
            ...currentGarden.plot,
            depthFt: clampPlotDimension(depthFt),
            location: location ?? currentGarden.plot.location,
            orientationDegrees: normalizeOrientation(orientationDegrees),
            widthFt: clampPlotDimension(widthFt),
          };
          const plantings = currentGarden.plantings.map((plant) =>
            clampPlantingToPlot(plant, plot),
          );
          const structures = currentGarden.structures.map((structure) =>
            clampStructureToPlot(structure, plot),
          );
          const changed =
            plot.widthFt !== currentGarden.plot.widthFt ||
            plot.depthFt !== currentGarden.plot.depthFt ||
            plot.location.latitude !== currentGarden.plot.location.latitude ||
            plot.location.longitude !== currentGarden.plot.location.longitude ||
            plot.location.locationQuery !==
              currentGarden.plot.location.locationQuery ||
            plot.orientationDegrees !== currentGarden.plot.orientationDegrees ||
            plantings.some(
              (plant, index) =>
                plant.xFt !== currentGarden.plantings[index]?.xFt ||
                plant.yFt !== currentGarden.plantings[index]?.yFt,
            ) ||
            structures.some(
              (structure, index) =>
                structure.xFt !== currentGarden.structures[index]?.xFt ||
                structure.yFt !== currentGarden.structures[index]?.yFt ||
                structure.widthFt !==
                  currentGarden.structures[index]?.widthFt ||
                structure.depthFt !== currentGarden.structures[index]?.depthFt,
            );

          if (!changed) {
            return currentGarden;
          }

          return {
            ...currentGarden,
            plantings,
            plot,
            structures,
          };
        },
        undefined,
        true,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const saveGarden = useCallback(async () => {
    if (!garden || !dirty) {
      return;
    }

    await saveCurrentDraft(garden);
  }, [dirty, garden, saveCurrentDraft]);

  const saveDraftGarden = useCallback(
    async (draftGarden: Garden) => saveCurrentDraft(draftGarden),
    [saveCurrentDraft],
  );

  const publishDraft = useCallback(
    async (userEmail: string, force = false) => {
      if (!garden || !userId) {
        return null;
      }

      if (dirty) {
        const saved = await saveCurrentDraft(garden);

        if (!saved) {
          return null;
        }
      }

      const result = await gardenRepository.publishDraft({
        force,
        userEmail,
        userId,
      });

      if (result.status === 'published') {
        setGarden(result.workspace.draft.garden);
        setDirty(false);
        setRedoStack([]);
        setSaveStatus('saved');
        setSelectedItem(null);
        setSuggestionDecisions(result.workspace.draft.suggestionDecisions);
        setUndoStack([]);
        setWorkspace(result.workspace);
      } else {
        setWorkspace(result.workspace);
      }

      return result;
    },
    [dirty, garden, gardenRepository, saveCurrentDraft, userId],
  );

  const discardDraft = useCallback(async () => {
    if (!userId) {
      return;
    }

    const draft = await gardenRepository.discardDraft(userId);
    const nextWorkspace = await gardenRepository.getWorkspace(userId);

    setGarden(draft.garden);
    setDirty(false);
    setRedoStack([]);
    setSaveStatus('saved');
    setSelectedItem(null);
    setSetupRequired(needsProfileSetup(draft.garden));
    setSuggestionDecisions(draft.suggestionDecisions);
    setUndoStack([]);
    setWorkspace(nextWorkspace);
  }, [gardenRepository, userId]);

  const revertToRevision = useCallback(
    async (revisionId: string, userEmail: string) => {
      if (!userId) {
        return null;
      }

      const result = await gardenRepository.revertToRevision({
        revisionId,
        userEmail,
        userId,
      });

      setGarden(result.workspace.draft.garden);
      setDirty(false);
      setRedoStack([]);
      setSaveStatus('saved');
      setSelectedItem(null);
      setSetupRequired(needsProfileSetup(result.workspace.draft.garden));
      setSuggestionDecisions(result.workspace.draft.suggestionDecisions);
      setUndoStack([]);
      setWorkspace(result.workspace);
      return result;
    },
    [gardenRepository, userId],
  );

  const refreshWeatherAndWatering = useCallback(async () => {
    if (!garden) {
      return;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      const wasOffline = isBrowserOffline();
      const backendResult = userId
        ? await gardenOperationsService
            .refreshGardenOperations(userId)
            .catch(() => null)
        : null;

      if (backendResult?.ok && backendResult.backendAvailable) {
        const savedGarden = userId
          ? await gardenRepository.getGarden(userId)
          : null;

        if (savedGarden) {
          setGarden(savedGarden);
          setDirty(false);
          setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
          return;
        }
      }

      const updatedGarden = await refreshGardenWateringFromWeather(
        garden,
        weatherProvider,
        {
          forceWeatherRefresh: true,
          profile: wateringProfile,
        },
      );

      const authUser = state.user;
      const savedGarden = authUser?.email
        ? await gardenRepository.saveSharedOperations({
            actor: {
              displayName: authUser.displayName,
              email: authUser.email,
              userId: authUser.uid,
            },
            baseGarden: garden,
            updatedGarden,
            userId: authUser.uid,
          })
        : updatedGarden;

      setGarden(savedGarden);
      setDirty(false);
      setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
    } catch (weatherError) {
      setError(
        toErrorMessage(
          weatherError,
          'Unable to refresh weather and watering schedule.',
        ),
      );
      setSaveStatus('error');
      throw weatherError;
    }
  }, [
    garden,
    gardenOperationsService,
    gardenRepository,
    state.user,
    userId,
    wateringProfile,
    weatherProvider,
  ]);

  const updateStructureShade = useCallback(
    (
      structureId: string,
      values: {
        canopyRadiusFt?: number | null;
        heightFt?: number | null;
      },
    ) => {
      commitGardenUpdate(
        (currentGarden) => {
          if (!currentGarden) {
            return currentGarden;
          }

          return {
            ...currentGarden,
            structures: currentGarden.structures.map((structure) =>
              structure.id === structureId
                ? {
                    ...structure,
                    canopyRadiusFt:
                      values.canopyRadiusFt === undefined
                        ? structure.canopyRadiusFt
                        : values.canopyRadiusFt,
                    heightFt:
                      values.heightFt === undefined
                        ? structure.heightFt
                        : values.heightFt,
                  }
                : structure,
            ),
          };
        },
        { id: structureId, type: 'structure' },
      );
    },
    [commitGardenUpdate],
  );

  const recalculateSunShade = useCallback(() => {
    commitGardenUpdate((currentGarden) => {
      if (!currentGarden) {
        return currentGarden;
      }

      return {
        ...currentGarden,
        sunShadeLayers: buildSunShadeLayers(currentGarden),
      };
    });
  }, [commitGardenUpdate]);

  const paintSunShadeCell = useCallback(
    (season: SunSeason, xFt: number, yFt: number, exposure: SunExposure) => {
      commitGardenUpdate((currentGarden) => {
        if (!currentGarden) {
          return currentGarden;
        }

        const existingLayer = findSunShadeLayer(currentGarden, season);
        const existingArea = existingLayer.areas.find(
          (area) =>
            area.xFt === Math.floor(xFt) && area.yFt === Math.floor(yFt),
        );
        const manualArea = createManualSunArea(season, xFt, yFt, exposure, {
          microclimateNotes: existingArea?.microclimateNotes,
          shadeSources: existingArea?.shadeSources,
        });
        const updatedAreas = existingLayer.areas.some(
          (area) => area.xFt === manualArea.xFt && area.yFt === manualArea.yFt,
        )
          ? existingLayer.areas.map((area) =>
              area.xFt === manualArea.xFt && area.yFt === manualArea.yFt
                ? manualArea
                : area,
            )
          : [...existingLayer.areas, manualArea];
        const updatedLayer = {
          ...existingLayer,
          areas: updatedAreas,
          generatedAtIso:
            existingLayer.generatedAtIso ?? new Date().toISOString(),
          observedOn: new Date().toISOString().slice(0, 10),
        };

        return {
          ...currentGarden,
          sunShadeLayers: [
            ...currentGarden.sunShadeLayers.filter(
              (layer) => layer.season !== season,
            ),
            updatedLayer,
          ],
        };
      });
    },
    [commitGardenUpdate],
  );

  const updatePlanting = useCallback(
    (plantingId: string, values: Partial<GardenPlant>) => {
      commitGardenUpdate(
        (currentGarden) => {
          const nextPlantings = currentGarden.plantings.map((planting) => {
            if (planting.id !== plantingId) {
              return planting;
            }

            const nextPlanting = {
              ...planting,
              ...values,
              id: planting.id,
            };
            const nextPlantStatus = values.plantStatus ?? {
              ...planting.plantStatus,
              lifecycle:
                values.status ??
                planting.plantStatus.lifecycle ??
                nextPlanting.status,
              notes:
                values.notes ??
                planting.plantStatus.notes ??
                nextPlanting.notes,
            };
            const shouldRebuildInstances = arrangementFields.some(
              (field) => field in values,
            );
            const nextInstances = shouldRebuildInstances
              ? createPlantingInstances(nextPlanting)
              : values.label
                ? nextPlanting.instances.map((instance, index) => ({
                    ...instance,
                    label:
                      nextPlanting.instances.length === 1
                        ? (values.label ?? instance.label)
                        : `${values.label} ${index + 1}`,
                  }))
                : nextPlanting.instances;
            const normalizedPlanting = normalizePlantingFromInstances({
              ...nextPlanting,
              instances: nextInstances,
              plantStatus: nextPlantStatus,
            });

            return {
              ...normalizedPlanting,
              support: normalizePlantSupportPlanForQuantity(
                normalizedPlanting.support,
                normalizedPlanting.plantCount ??
                  normalizedPlanting.instances.length,
              ),
            };
          });

          return applyPlantingEventEffects({
            garden: currentGarden,
            nextPlantings,
            now: new Date(),
          });
        },
        { id: plantingId, type: 'planting' },
        true,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const updatePlantGroupQuantity = useCallback(
    (groupId: string, quantity: number) => {
      const planting = garden?.plantings.find((plant) => plant.id === groupId);
      const plantCount = clampPlantGroupQuantity(quantity);

      updatePlanting(groupId, {
        ...(planting
          ? getDerivedPlantingDimensions({
              ...planting,
              quantity: plantCount,
            })
          : {}),
        plantCount,
      });
    },
    [garden?.plantings, updatePlanting],
  );

  const updatePlantGroupPlacementMode = useCallback(
    (groupId: string, placementMode: PlantPlacementMode) => {
      const planting = garden?.plantings.find((plant) => plant.id === groupId);
      const mode = toPlantingMode(placementMode);

      updatePlanting(groupId, {
        ...(planting
          ? getDerivedPlantingDimensions({
              ...planting,
              mode,
              quantity: planting.plantCount ?? planting.instances.length,
            })
          : {}),
        mode,
      });
    },
    [garden?.plantings, updatePlanting],
  );

  const updatePlantGroupSupport = useCallback(
    (groupId: string, support: PlantSupportPlan) => {
      const group = gardenPlanningState?.plantGroups.find(
        (plantGroup) => plantGroup.id === groupId,
      );

      updatePlanting(groupId, {
        support: normalizePlantSupportPlanForQuantity(
          support,
          group?.quantity ?? 1,
        ),
      });
    },
    [gardenPlanningState?.plantGroups, updatePlanting],
  );

  const markPlantingsPlanted = useCallback(
    (plantingIds: string[], plantedOn: string) => {
      const primaryPlantingId = plantingIds[0];

      if (!primaryPlantingId) {
        return;
      }

      commitGardenUpdate(
        (currentGarden) =>
          markPlantingsPlantedInGarden({
            garden: currentGarden,
            now: new Date(),
            plantedOn,
            plantingIds,
          }),
        { id: primaryPlantingId, type: 'planting' },
        true,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const updateStructure = useCallback(
    (structureId: string, values: Partial<Structure>) => {
      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          structures: currentGarden.structures.map((structure) =>
            structure.id === structureId
              ? clampStructureToPlot(
                  {
                    ...structure,
                    ...values,
                    id: structure.id,
                  },
                  currentGarden.plot,
                )
              : structure,
          ),
        }),
        { id: structureId, type: 'structure' },
        true,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const updateSeasonCropSelections = useCallback(
    (wantedCrops: SeasonCropSelection[]) => {
      commitGardenUpdate((currentGarden) => ({
        ...currentGarden,
        seasonPlan: {
          updatedAtIso: new Date().toISOString(),
          wantedCrops,
        },
      }));
    },
    [commitGardenUpdate],
  );

  const applyAutoLayoutProposal = useCallback(
    (plantings: GardenPlant[], structures: Structure[]) => {
      const proposalMarker = '[auto-layout]';

      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: [
            ...currentGarden.plantings.filter(
              (planting) =>
                !isAutoLayoutProposalItem(planting, proposalMarker) ||
                !canOptimizerMovePlanting(planting),
            ),
            ...plantings,
          ],
          structures: [
            ...currentGarden.structures.filter(
              (structure) =>
                !isAutoLayoutProposalItem(structure, proposalMarker) ||
                structure.locked,
            ),
            ...structures,
          ],
        }),
        plantings[0] ? { id: plantings[0].id, type: 'planting' } : null,
        true,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const duplicatePlanting = useCallback(
    (plantingId: string) => {
      if (!garden) {
        return;
      }

      const source = garden.plantings.find(
        (planting) => planting.id === plantingId,
      );

      if (!source) {
        return;
      }

      const point = normalizePointToPlot(
        {
          xFt: source.xFt + 0.5,
          yFt: source.yFt + 0.5,
        },
        garden.plot,
        true,
      );
      const duplicateId = createPlantId();
      const duplicate = normalizePlantingFromInstances({
        ...source,
        id: duplicateId,
        instances: relabelPlantingInstances(
          offsetPlantingInstances(source, duplicateId, {
            xFt: point.xFt - source.xFt,
            yFt: point.yFt - source.yFt,
          }),
          `${source.label} copy`,
        ),
        label: `${source.label} copy`,
        locked: false,
        supportStructureIds: [],
        xFt: point.xFt,
        yFt: point.yFt,
      });

      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: [...currentGarden.plantings, duplicate],
        }),
        { id: duplicate.id, type: 'planting' },
        true,
        true,
      );
      return duplicate.id;
    },
    [commitGardenUpdate, garden],
  );

  const duplicateStructure = useCallback(
    (structureId: string) => {
      if (!garden) {
        return;
      }

      const source = garden.structures.find(
        (structure) => structure.id === structureId,
      );

      if (!source) {
        return;
      }

      const duplicate = clampStructureToPlot(
        {
          ...source,
          id: createItemId('structure'),
          label: `${source.label} copy`,
          locked: false,
          xFt: source.xFt + 0.5,
          yFt: source.yFt + 0.5,
        },
        garden.plot,
      );

      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          structures: [...currentGarden.structures, duplicate],
        }),
        { id: duplicate.id, type: 'structure' },
        true,
        true,
      );
    },
    [commitGardenUpdate, garden],
  );

  const duplicateItems = useCallback(
    (items: SelectedGardenItem[]) => {
      if (!garden || items.length === 0) {
        return [];
      }

      const selectedKeys = new Set(
        items.map((item) => `${item.type}:${item.id}`),
      );
      const duplicatedPlantings = garden.plantings
        .filter((planting) => selectedKeys.has(`planting:${planting.id}`))
        .map((source) => {
          const duplicateId = createPlantId();
          const offsetFt = getDuplicateOffsetFt(garden.plot);
          const point = normalizePointToPlot(
            {
              xFt: source.xFt + offsetFt,
              yFt: source.yFt + offsetFt,
            },
            garden.plot,
            true,
          );

          return normalizePlantingFromInstances({
            ...source,
            id: duplicateId,
            instances: relabelPlantingInstances(
              offsetPlantingInstances(source, duplicateId, {
                xFt: point.xFt - source.xFt,
                yFt: point.yFt - source.yFt,
              }),
              `${source.label} copy`,
            ),
            label: `${source.label} copy`,
            locked: false,
            xFt: point.xFt,
            yFt: point.yFt,
          });
        });
      const duplicatedStructures = garden.structures
        .filter((structure) => selectedKeys.has(`structure:${structure.id}`))
        .map((source) => {
          const offsetFt = getDuplicateOffsetFt(garden.plot);

          return clampStructureToPlot(
            {
              ...source,
              id: createItemId('structure'),
              label: `${source.label} copy`,
              locked: false,
              xFt: source.xFt + offsetFt,
              yFt: source.yFt + offsetFt,
            },
            garden.plot,
          );
        });
      const duplicatedItems: SelectedGardenItem[] = [
        ...duplicatedPlantings.map((planting) => ({
          id: planting.id,
          type: 'planting' as const,
        })),
        ...duplicatedStructures.map((structure) => ({
          id: structure.id,
          type: 'structure' as const,
        })),
      ];

      if (duplicatedItems.length === 0) {
        return [];
      }

      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: [...currentGarden.plantings, ...duplicatedPlantings],
          structures: [...currentGarden.structures, ...duplicatedStructures],
        }),
        duplicatedItems[0],
        true,
        true,
      );

      return duplicatedItems;
    },
    [commitGardenUpdate, garden],
  );

  const deleteItems = useCallback(
    (items: SelectedGardenItem[]) => {
      if (items.length === 0) {
        return;
      }

      const plantingIds = new Set(
        items
          .filter(
            (item): item is SelectedGardenItem & { type: 'planting' } =>
              item.type === 'planting' && !item.instanceId,
          )
          .map((item) => item.id),
      );
      const plantingInstanceIds = groupSelectedPlantingInstances(items);
      const structureIds = new Set(
        items
          .filter((item) => item.type === 'structure')
          .map((item) => item.id),
      );

      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: currentGarden.plantings.flatMap((planting) => {
            if (plantingIds.has(planting.id)) {
              return [];
            }

            const instanceIds = plantingInstanceIds.get(planting.id);
            const plantingWithoutDeletedLinks =
              structureIds.size > 0
                ? {
                    ...planting,
                    supportStructureIds: planting.supportStructureIds.filter(
                      (id) => !structureIds.has(id),
                    ),
                  }
                : planting;

            if (!instanceIds) {
              return [plantingWithoutDeletedLinks];
            }

            const instances = getPlantingInstances(
              plantingWithoutDeletedLinks,
            ).filter((instance) => !instanceIds.has(instance.id));

            return instances.length > 0
              ? [
                  normalizePlantingFromInstances({
                    ...plantingWithoutDeletedLinks,
                    instances,
                  }),
                ]
              : [];
          }),
          structures: currentGarden.structures.filter(
            (structure) => !structureIds.has(structure.id),
          ),
          tasks: currentGarden.tasks.filter(
            (task) =>
              !(
                (task.plantingId && plantingIds.has(task.plantingId)) ||
                (task.structureId && structureIds.has(task.structureId))
              ),
          ),
          wateringSchedule: currentGarden.wateringSchedule.filter(
            (entry) =>
              !(
                entry.targetKind === 'planting' &&
                plantingIds.has(entry.targetId)
              ) &&
              !(entry.targetKind === 'bed' && structureIds.has(entry.targetId)),
          ),
        }),
        null,
        true,
        true,
      );
    },
    [commitGardenUpdate],
  );

  const deleteSelectedItem = useCallback(() => {
    if (!selectedItem) {
      return;
    }

    deleteItems([selectedItem]);
  }, [deleteItems, selectedItem]);

  const undoGardenChange = useCallback(() => {
    if (!garden || undoStack.length === 0) {
      return;
    }

    const previousGarden = undoStack.at(-1);

    if (!previousGarden) {
      return;
    }

    setGarden(previousGarden);
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack((stack) => [...stack.slice(-24), garden]);
    setDirty(true);
    setSaveStatus('idle');
    setSelectedItem(null);
  }, [garden, undoStack]);

  const redoGardenChange = useCallback(() => {
    if (!garden || redoStack.length === 0) {
      return;
    }

    const nextGarden = redoStack.at(-1);

    if (!nextGarden) {
      return;
    }

    setGarden(nextGarden);
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(-24), garden]);
    setDirty(true);
    setSaveStatus('idle');
    setSelectedItem(null);
  }, [garden, redoStack]);

  return {
    acceptReviewSuggestion,
    acceptReviewSuggestions,
    addLinkedSupportStructure,
    addPlant,
    addStructure,
    applyPlotSettings,
    applyPlotSize: (widthFt: number, depthFt: number) =>
      applyPlotSettings(widthFt, depthFt, garden?.plot.orientationDegrees ?? 0),
    applyAutoLayoutProposal,
    approveSuccessionPlanting,
    canRedo: redoStack.length > 0,
    canUndo: undoStack.length > 0,
    checkpointGarden,
    closeDetailedView,
    closePlantGroupEditor,
    completeGardenSetup,
    deleteItems,
    deleteSelectedItem,
    detailedViewState:
      gardenPlanningState?.detailedView ?? closedDetailedViewState,
    dirty,
    discardDraft,
    duplicateItems,
    duplicatePlanting,
    duplicateStructure,
    error,
    garden,
    hoveredPlantGroupId: gardenPlanningState?.hoveredPlantGroupId ?? null,
    hidePlantGroupLabel,
    labelVisibility: gardenPlanningState?.labelVisibility ?? {
      groupIds: [],
      mode: 'auto' as const,
    },
    layoutReviewState: gardenPlanningState?.layout ?? {
      problems: [] as LayoutProblem[],
      resolutionOptions: [] as LayoutResolutionOption[],
      resolutions: [] as LayoutResolution[],
      selectedProblemId: null,
    },
    locationMatchState:
      gardenPlanningState?.locationMatch ??
      (garden ? createDefaultGardenPlanningState(garden).locationMatch : null),
    linkSupportStructure,
    movePlant,
    moveStructure,
    markPlantingsPlanted,
    openDetailedViewForItem,
    openPlantGroupEditor,
    paintSunShadeCell,
    plantEditorState: gardenPlanningState?.editor ?? closedPlantEditorState,
    plantGroups: gardenPlanningState?.plantGroups ?? [],
    recalculateSunShade,
    refreshWeatherAndWatering,
    resizePlantingRect,
    resizeStructure,
    resizeStructureRect,
    redoGardenChange,
    publishDraft,
    recordSuggestionDecision,
    recordLayoutResolution,
    rejectReviewSuggestion,
    revertToRevision,
    saveGarden,
    saveDraftGarden,
    saveStatus,
    selectLayoutProblem,
    selectedItem,
    selectedPlantGroupId: gardenPlanningState?.selectedPlantGroupId ?? null,
    selectedPlantId,
    selectedStructureId,
    setupRequired,
    setHoveredPlantGroupId,
    setLayoutReviewState,
    setLocationMatchState,
    setLocationMatchSunExposure,
    setPlantLabelVisibility,
    setSelectedItem,
    setSelectedPlantId: (plantId: string | null) =>
      setSelectedItem(plantId ? { id: plantId, type: 'planting' } : null),
    showPlantGroupLabel,
    status,
    snoozeReviewSuggestion,
    toggleDetailedViewForSelection,
    undoGardenChange,
    unlinkSupportStructure,
    updatePlantGroupPlacementMode,
    updatePlantGroupQuantity,
    updatePlantGroupSupport,
    updateItemPositions,
    updatePlanting,
    updateSeasonCropSelections,
    updateStructure,
    updateStructureShade,
    workspace,
    suggestionDecisions,
  };
}

function isAutoLayoutProposalItem(
  item: { id: string; notes?: string },
  proposalMarker: string,
) {
  return (
    item.id.includes(proposalMarker) ||
    Boolean(item.notes?.includes(proposalMarker))
  );
}

export function createAddPlantingPreview(
  garden: Garden,
  request: AddPlantingRequest,
): Planting {
  return createPlanting(garden, request, {
    id: 'add-plant-preview',
    point: findNextPlantLocation(garden),
  });
}

function createPlanting(
  garden: Garden,
  request: AddPlantingRequest,
  options: { id?: string; point?: PlotPoint } = {},
): Planting {
  const point = options.point ?? findNextPlantLocation(garden);

  const planting = {
    ...createDefaultPlanting({
      id: options.id ?? createPlantId(),
      label: request.crop.commonName,
      xFt: point.xFt,
      yFt: point.yFt,
    }),
    blockDepthFt: request.blockDepthFt,
    blockWidthFt: request.blockWidthFt,
    cropId: request.crop.id,
    matureHeightInches: request.crop.matureHeightInches,
    matureSpreadInches: request.crop.matureSpreadInches,
    mode: request.mode,
    notes: request.crop.notes,
    plantStatus: createDefaultPlantStatus({
      lifecycle: 'planned',
      notes: request.crop.notes,
    }),
    plantCount: request.plantCount,
    clusterRadiusFt:
      request.mode === 'cluster'
        ? (request.clusterRadiusFt ??
          calculateClusterRadiusFt(request.crop, request.plantCount))
        : null,
    rowLengthFt: request.rowLengthFt,
    rowCount:
      request.mode === 'row' ||
      request.mode === 'block' ||
      request.mode === 'trellisLine'
        ? 1
        : null,
    rowSpacingInches: request.crop.rowSpacingInches,
    spacingInches: request.crop.spacingInches,
    sunRequirement: request.crop.sunRequirement,
    trellisLengthFt:
      request.mode === 'trellisLine' ? request.rowLengthFt : null,
    weeklyWaterNeedInches: request.crop.weeklyWaterNeedInches,
  };

  return normalizePlantingFromInstances({
    ...planting,
    instances: createPlantingInstances(planting),
  });
}

function createLinkedTrellisStructure(
  garden: Garden,
  planting: Planting,
  crop: CropProfile,
): Structure | null {
  const supportNeed = getCropSupportNeed(crop);

  if (supportNeed?.kind !== 'trellis') {
    return null;
  }

  const dimensions = getDerivedPlantingDimensions(planting);
  const footprintWidthFt =
    planting.rowLengthFt ??
    dimensions.rowLengthFt ??
    planting.blockWidthFt ??
    dimensions.blockWidthFt ??
    (planting.clusterRadiusFt ?? dimensions.clusterRadiusFt ?? 0.5) * 2;
  const footprintDepthFt =
    planting.blockDepthFt ??
    dimensions.blockDepthFt ??
    (planting.clusterRadiusFt ?? dimensions.clusterRadiusFt ?? 0.5) * 2;
  const widthFt = Math.min(
    Math.max(
      planting.rowLengthFt ??
        planting.trellisLengthFt ??
        footprintWidthFt ??
        (crop.spacingInches ?? 24) / 12,
      2,
    ),
    garden.plot.widthFt,
  );
  const depthFt = 0.5;
  const xFt = Math.max(
    0,
    Math.min(planting.xFt - widthFt / 2, garden.plot.widthFt - widthFt),
  );
  const aboveYFt = planting.yFt - footprintDepthFt / 2 - depthFt;
  const belowYFt = planting.yFt + footprintDepthFt / 2;
  const yFt =
    aboveYFt >= 0
      ? aboveYFt
      : Math.min(Math.max(belowYFt, 0), garden.plot.depthFt - depthFt);

  return clampStructureToPlot(
    {
      ...createDefaultStructure({
        id: createItemId('structure'),
        type: 'trellis',
        xFt,
        yFt,
      }),
      depthFt,
      heightFt: Math.max((crop.matureHeightInches ?? 72) / 12, 5),
      label: `${planting.label} trellis`,
      material: 'wire',
      notes: 'Linked trellis created with the planting.',
      widthFt,
      workingClearanceFt: 1,
    },
    garden.plot,
  );
}

function resolveSelectionFromId(
  garden: Garden | null,
  itemId: string,
): SelectedGardenItem | undefined {
  if (!garden) {
    return undefined;
  }

  if (garden.plantings.some((planting) => planting.id === itemId)) {
    return { id: itemId, type: 'planting' };
  }

  if (garden.structures.some((structure) => structure.id === itemId)) {
    return { id: itemId, type: 'structure' };
  }

  return undefined;
}

function createSelectedPlantingItem(
  id: string,
  instanceId?: string,
): SelectedGardenItem {
  return instanceId
    ? { id, instanceId, type: 'planting' }
    : { id, type: 'planting' };
}

function findNextStructureLocation(garden: Garden): PlotPoint {
  const offset = garden.structures.length % 5;

  return normalizePointToPlot(
    {
      xFt: 1 + offset,
      yFt: 1 + offset,
    },
    garden.plot,
    true,
  );
}

function calculateClusterRadiusFt(
  crop: CropProfile,
  plantCount: number | null,
) {
  const spacingFt = (crop.spacingInches ?? crop.matureSpreadInches ?? 12) / 12;
  return Math.max(
    (Math.sqrt(Math.max(plantCount ?? 1, 1)) * spacingFt) / 2,
    0.5,
  );
}

function findNextPlantLocation(garden: Garden): PlotPoint {
  const { plot, plantings } = garden;
  const occupied = new Set(
    plantings.map(
      (planting) => `${planting.xFt.toFixed(3)},${planting.yFt.toFixed(3)}`,
    ),
  );
  const center = normalizePointToPlot(
    {
      xFt: snapFeet(plot.widthFt / 2, plot.snapUnitFt),
      yFt: snapFeet(plot.depthFt / 2, plot.snapUnitFt),
    },
    plot,
    true,
  );
  const step = Math.max(plot.snapUnitFt, 0.5);
  const limit = Math.max(plot.widthFt, plot.depthFt);

  for (let radius = 0; radius <= limit; radius += step) {
    for (let yOffset = -radius; yOffset <= radius; yOffset += step) {
      for (let xOffset = -radius; xOffset <= radius; xOffset += step) {
        const point = normalizePointToPlot(
          {
            xFt: center.xFt + xOffset,
            yFt: center.yFt + yOffset,
          },
          plot,
          true,
        );
        const key = `${point.xFt.toFixed(3)},${point.yFt.toFixed(3)}`;

        if (!occupied.has(key)) {
          return point;
        }
      }
    }
  }

  return center;
}

function getDuplicateOffsetFt(plot: GardenPlot) {
  return Math.max(plot.snapUnitFt, 0.5);
}

function groupPlantingPositionUpdates(updates: GardenItemPositionUpdate[]) {
  const grouped = new Map<
    string,
    Extract<GardenItemPositionUpdate, { type: 'planting' }>[]
  >();

  for (const update of updates) {
    if (update.type !== 'planting') {
      continue;
    }

    const existing = grouped.get(update.id) ?? [];
    existing.push(update);
    grouped.set(update.id, existing);
  }

  return grouped;
}

function groupSelectedPlantingInstances(items: SelectedGardenItem[]) {
  const grouped = new Map<string, Set<string>>();

  for (const item of items) {
    if (item.type !== 'planting' || !item.instanceId) {
      continue;
    }

    const existing = grouped.get(item.id) ?? new Set<string>();
    existing.add(item.instanceId);
    grouped.set(item.id, existing);
  }

  return grouped;
}

function relabelPlantingInstances(
  instances: PlantingInstance[],
  label: string,
) {
  return instances.map((instance, index) => ({
    ...instance,
    label: instances.length === 1 ? label : `${label} ${index + 1}`,
  }));
}

function clampPlantingToPlot(
  planting: GardenPlant,
  plot: GardenPlot,
): GardenPlant {
  const clampedPlanting = clampPlantToPlot(planting, plot);
  const instances = getPlantingInstances(clampedPlanting).map((instance) => {
    const point = normalizePointToPlot(
      { xFt: instance.xFt, yFt: instance.yFt },
      plot,
      true,
    );

    return {
      ...instance,
      xFt: point.xFt,
      yFt: point.yFt,
    };
  });

  return normalizePlantingFromInstances({
    ...clampedPlanting,
    instances,
  });
}

function createItemId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}`;
}

function needsProfileSetup(garden: Garden) {
  return (
    garden.climateProfile.source === 'demoDefault' &&
    garden.plantings.length === 0 &&
    garden.structures.length === 0
  );
}

function createPlantId() {
  return createItemId('planting');
}

function clampPlantGroupQuantity(quantity: number) {
  return Math.max(Math.min(Math.round(quantity), 500), 1);
}

function clampAreaRectToPlot(rect: GardenPlantingRectUpdate, plot: GardenPlot) {
  const widthFt = Math.min(Math.max(rect.widthFt, 0.25), plot.widthFt);
  const depthFt = Math.min(Math.max(rect.depthFt, 0.25), plot.depthFt);

  return {
    depthFt,
    widthFt,
    xFt: Math.min(Math.max(rect.xFt, 0), plot.widthFt - widthFt),
    yFt: Math.min(Math.max(rect.yFt, 0), plot.depthFt - depthFt),
  };
}

function toPlantingMode(placementMode: PlantPlacementMode): PlantingMode {
  return placementMode === 'block'
    ? 'block'
    : placementMode === 'row'
      ? 'row'
      : 'cluster';
}

function normalizeOrientation(value: number) {
  const normalized = Number.isFinite(value) ? value % 360 : 0;
  return normalized < 0 ? normalized + 360 : normalized;
}

function toErrorMessage(error: unknown, fallback: string) {
  if (isPermissionDeniedError(error)) {
    return 'Firestore rules are blocking this garden. Deploy the latest firestore.rules or use the Firebase emulators.';
  }

  return error instanceof Error ? error.message : fallback;
}

function isPermissionDeniedError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: unknown; message?: unknown };

  return (
    maybeError.code === 'permission-denied' ||
    (typeof maybeError.message === 'string' &&
      maybeError.message.includes('Missing or insufficient permissions'))
  );
}
