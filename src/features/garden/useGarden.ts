import { useCallback, useEffect, useState } from 'react';

import { useServices } from '../../app/providers';
import {
  createDefaultPlanting,
  createDefaultStructure,
  type CropProfile,
  type Garden,
  type GardenLocation,
  type GardenPlot,
  type GardenPlant,
  type PlantingMode,
  type SeasonCropSelection,
  type SunExposure,
  type Structure,
  type StructureType,
  type WaterRecommendation,
} from '../../domain/gardens/GardenRepository';
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
  buildWaterRecommendations,
  createWeatherSnapshot,
  loadWeatherWateringContext,
} from './wateringEngine';
import {
  applyReviewSuggestionActions,
  describeSuggestionDecision,
  type ReviewSuggestion,
} from './reviewSuggestions';
import { isBrowserOffline } from '../../shared/network/networkStatus';
import {
  addSuccessionPlanting,
  getSuccessionPlantingId,
  type SuccessionRecommendation,
} from '../tasks/taskEngine';

type GardenLoadStatus = 'error' | 'loading' | 'ready';
type SaveStatus = 'error' | 'idle' | 'queued' | 'saved' | 'saving';
export type SelectedGardenItem =
  | { id: string; type: 'planting' }
  | { id: string; type: 'structure' };

export type GardenItemPositionUpdate = SelectedGardenItem & {
  xFt: number;
  yFt: number;
};

export interface GardenStructureRectUpdate {
  depthFt: number;
  id: string;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface AddPlantingRequest {
  blockDepthFt: number | null;
  blockWidthFt: number | null;
  crop: CropProfile;
  mode: PlantingMode;
  plantCount: number | null;
  rowLengthFt: number | null;
}

export function useGarden(userId: string | null) {
  const { gardenOperationsService, gardenRepository, weatherProvider } =
    useServices();
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [garden, setGarden] = useState<Garden | null>(null);
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
  const selectedPlantId =
    selectedItem?.type === 'planting' ? selectedItem.id : null;
  const selectedStructureId =
    selectedItem?.type === 'structure' ? selectedItem.id : null;

  useEffect(() => {
    if (!userId) {
      setGarden(null);
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

        setGarden(loadedGarden);
        setDirty(false);
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

    return () => {
      active = false;
    };
  }, [gardenRepository, userId]);

  const saveCurrentDraft = useCallback(
    async (draftGarden: Garden) => {
      if (!userId || !workspace) {
        return false;
      }

      setSaveStatus('saving');
      setError(null);

      try {
        const wasOffline = isBrowserOffline();
        await gardenRepository.saveDraft({
          ...workspace.draft,
          garden: draftGarden,
          suggestionDecisions,
          updatedAtIso: new Date().toISOString(),
          userId,
        });
        const nextWorkspace = await gardenRepository.getWorkspace(userId);

        setDirty(false);
        setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
        setSuggestionDecisions(nextWorkspace.draft.suggestionDecisions);
        setWorkspace(nextWorkspace);
        return true;
      } catch (saveError) {
        setError(toErrorMessage(saveError, 'Unable to save your garden.'));
        setSaveStatus('error');
        return false;
      }
    },
    [gardenRepository, suggestionDecisions, userId, workspace],
  );

  const commitGardenUpdate = useCallback(
    (
      updateGarden: (currentGarden: Garden) => Garden,
      selection?: SelectedGardenItem | null,
      trackHistory = true,
    ) => {
      setGarden((currentGarden) => {
        if (!currentGarden) {
          return currentGarden;
        }

        const updatedGarden = updateGarden(currentGarden);

        if (updatedGarden === currentGarden) {
          return currentGarden;
        }

        if (trackHistory) {
          setUndoStack((stack) => [...stack.slice(-24), currentGarden]);
          setRedoStack([]);
        }

        setDirty(true);
        setSaveStatus('idle');

        if (selection !== undefined) {
          setSelectedItem(selection);
        }

        return updatedGarden;
      });
    },
    [],
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
      return currentGarden;
    });
  }, []);

  const recordSuggestionDecision = useCallback(
    ({
      id,
      label,
      note = null,
      status: decisionStatus,
    }: {
      id: string;
      label: string;
      note?: string | null;
      status: GardenSuggestionDecision['status'];
    }) => {
      const decision: GardenSuggestionDecision = {
        decidedAtIso: new Date().toISOString(),
        id,
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

      commitGardenUpdate((currentGarden) =>
        suggestions.reduce(
          (nextGarden, suggestion) =>
            applyReviewSuggestionActions(nextGarden, suggestion.actions),
          currentGarden,
        ),
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

      const addedPlant = createPlanting(garden, request);
      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: [...currentGarden.plantings, addedPlant],
        }),
        { id: addedPlant.id, type: 'planting' },
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
      );
    },
    [commitGardenUpdate, garden],
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
      );
    },
    [commitGardenUpdate, recordSuggestionDecision],
  );

  const movePlant = useCallback(
    (plantId: string, point: PlotPoint, snap: boolean, trackHistory = true) => {
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
                  : {
                      ...plant,
                      xFt: normalizedPoint.xFt,
                      yFt: normalizedPoint.yFt,
                    }
                : plant,
            ),
          };
        },
        { id: plantId, type: 'planting' },
        trackHistory,
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
      );
    },
    [commitGardenUpdate],
  );

  const updateItemPositions = useCallback(
    (updates: GardenItemPositionUpdate[], trackHistory = true) => {
      if (updates.length === 0) {
        return;
      }

      const plantUpdates = new Map(
        updates
          .filter((update) => update.type === 'planting')
          .map((update) => [update.id, update]),
      );
      const structureUpdates = new Map(
        updates
          .filter((update) => update.type === 'structure')
          .map((update) => [update.id, update]),
      );

      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: currentGarden.plantings.map((planting) => {
            const update = plantUpdates.get(planting.id);

            if (!update || !canManuallyMovePlanting(planting)) {
              return planting;
            }

            const point = normalizePointToPlot(
              { xFt: update.xFt, yFt: update.yFt },
              currentGarden.plot,
              false,
            );

            return {
              ...planting,
              xFt: point.xFt,
              yFt: point.yFt,
            };
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
        }),
        updates.at(0) ?? undefined,
        trackHistory,
      );
    },
    [commitGardenUpdate],
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
      commitGardenUpdate((currentGarden) => {
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
          clampPlantToPlot(plant, plot),
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
              structure.widthFt !== currentGarden.structures[index]?.widthFt ||
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
      });
    },
    [commitGardenUpdate],
  );

  const saveGarden = useCallback(async () => {
    if (!garden || !dirty) {
      return;
    }

    await saveCurrentDraft(garden);
  }, [dirty, garden, saveCurrentDraft]);

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
      if (userId && !wasOffline) {
        try {
          const backendResult =
            await gardenOperationsService.refreshGardenOperations(userId);

          if (backendResult.backendAvailable && backendResult.ok) {
            const refreshedGarden = await gardenRepository.getGarden(userId);

            if (refreshedGarden) {
              setGarden(refreshedGarden);
              setDirty(false);
              setSaveStatus(isBrowserOffline() ? 'queued' : 'saved');
              return;
            }
          }
        } catch (backendError) {
          console.warn(
            'Backend garden operations refresh failed; using client fallback.',
            backendError,
          );
        }
      }

      const context = await loadWeatherWateringContext(
        weatherProvider,
        garden.plot.location,
      );
      const snapshot = createWeatherSnapshot(garden, context);
      const recommendations = buildWaterRecommendations(
        garden,
        context,
        snapshot,
      );
      const { buildInAppNotificationLogs } =
        await import('./notificationDecisions');
      const notificationLogs = buildInAppNotificationLogs(
        garden,
        recommendations,
        snapshot,
      );
      const updatedGarden: Garden = {
        ...garden,
        notificationLogs: [
          ...garden.notificationLogs,
          ...notificationLogs,
        ].slice(-60),
        updatedAtIso: new Date().toISOString(),
        waterRecommendations: mergeWaterRecommendations(
          garden.waterRecommendations,
          recommendations,
        ),
        weatherSnapshots: [...garden.weatherSnapshots, snapshot].slice(-8),
      };

      await gardenRepository.saveGarden(updatedGarden);
      setGarden(updatedGarden);
      setDirty(false);
      setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
    } catch (weatherError) {
      setError(
        toErrorMessage(
          weatherError,
          'Unable to update weather and watering recommendations.',
        ),
      );
      setSaveStatus('error');
      throw weatherError;
    }
  }, [
    garden,
    gardenOperationsService,
    gardenRepository,
    userId,
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
        (currentGarden) => ({
          ...currentGarden,
          plantings: currentGarden.plantings.map((planting) =>
            planting.id === plantingId
              ? {
                  ...planting,
                  ...values,
                  id: planting.id,
                }
              : planting,
          ),
        }),
        { id: plantingId, type: 'planting' },
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
      const duplicate = {
        ...source,
        id: createPlantId(),
        label: `${source.label} copy`,
        locked: false,
        xFt: point.xFt,
        yFt: point.yFt,
      };

      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: [...currentGarden.plantings, duplicate],
        }),
        { id: duplicate.id, type: 'planting' },
      );
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
          const offsetFt = getDuplicateOffsetFt(garden.plot);
          const point = normalizePointToPlot(
            {
              xFt: source.xFt + offsetFt,
              yFt: source.yFt + offsetFt,
            },
            garden.plot,
            true,
          );

          return {
            ...source,
            id: createPlantId(),
            label: `${source.label} copy`,
            locked: false,
            xFt: point.xFt,
            yFt: point.yFt,
          };
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
        items.filter((item) => item.type === 'planting').map((item) => item.id),
      );
      const structureIds = new Set(
        items
          .filter((item) => item.type === 'structure')
          .map((item) => item.id),
      );

      commitGardenUpdate(
        (currentGarden) => ({
          ...currentGarden,
          plantings: currentGarden.plantings.filter(
            (planting) => !plantingIds.has(planting.id),
          ),
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
          waterRecommendations: currentGarden.waterRecommendations.filter(
            (recommendation) =>
              !(
                recommendation.plantingId &&
                plantingIds.has(recommendation.plantingId)
              ),
          ),
        }),
        null,
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
    addPlant,
    addStructure,
    applyPlotSettings,
    applyPlotSize: (widthFt: number, depthFt: number) =>
      applyPlotSettings(widthFt, depthFt, garden?.plot.orientationDegrees ?? 0),
    applyAutoLayoutProposal,
    approveSuccessionPlanting,
    dirty,
    canRedo: redoStack.length > 0,
    canUndo: undoStack.length > 0,
    checkpointGarden,
    completeGardenSetup,
    deleteItems,
    deleteSelectedItem,
    discardDraft,
    duplicateItems,
    duplicatePlanting,
    duplicateStructure,
    error,
    garden,
    movePlant,
    moveStructure,
    paintSunShadeCell,
    recalculateSunShade,
    refreshWeatherAndWatering,
    resizeStructure,
    resizeStructureRect,
    redoGardenChange,
    publishDraft,
    recordSuggestionDecision,
    rejectReviewSuggestion,
    revertToRevision,
    saveGarden,
    saveStatus,
    selectedItem,
    selectedPlantId,
    selectedStructureId,
    setupRequired,
    setSelectedItem,
    setSelectedPlantId: (plantId: string | null) =>
      setSelectedItem(plantId ? { id: plantId, type: 'planting' } : null),
    status,
    snoozeReviewSuggestion,
    undoGardenChange,
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

function createPlanting(garden: Garden, request: AddPlantingRequest) {
  const point = findNextPlantLocation(garden);

  return {
    ...createDefaultPlanting({
      id: createPlantId(),
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
    plantCount: request.plantCount,
    clusterRadiusFt:
      request.mode === 'cluster'
        ? calculateClusterRadiusFt(request.crop, request.plantCount)
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

function normalizeOrientation(value: number) {
  const normalized = Number.isFinite(value) ? value % 360 : 0;
  return normalized < 0 ? normalized + 360 : normalized;
}

function mergeWaterRecommendations(
  existing: WaterRecommendation[],
  generated: WaterRecommendation[],
) {
  const generatedIds = new Set(
    generated.map((recommendation) => recommendation.id),
  );
  const preserved = existing.filter(
    (recommendation) =>
      !generatedIds.has(recommendation.id) &&
      recommendation.status !== 'active' &&
      recommendation.status !== 'suppressed',
  );

  return [...preserved.slice(-20), ...generated];
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
