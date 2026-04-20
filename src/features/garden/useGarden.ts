import { useCallback, useEffect, useState } from 'react';

import { useServices } from '../../app/providers';
import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type CropProfile,
  type Garden,
  type GardenLocation,
  type GardenPlot,
  type PlantingMode,
  type SunExposure,
  type StructureType,
  type WaterRecommendation,
} from '../../domain/gardens/GardenRepository';
import {
  clampPlantToPlot,
  clampPlotDimension,
  clampStructureToPlot,
  normalizePointToPlot,
  snapFeet,
  type PlotPoint,
} from './gardenMath';
import {
  buildSunShadeLayers,
  createManualSunArea,
  findSunShadeLayer,
  type SunSeason,
} from './sunShadeEngine';
import { buildInAppNotificationLogs } from './notificationDecisions';
import {
  buildWaterRecommendations,
  createWeatherSnapshot,
  loadWeatherWateringContext,
} from './wateringEngine';
import { isBrowserOffline } from '../../shared/network/networkStatus';

type GardenLoadStatus = 'error' | 'loading' | 'ready';
type SaveStatus = 'error' | 'idle' | 'queued' | 'saved' | 'saving';
export type SelectedGardenItem =
  | { id: string; type: 'planting' }
  | { id: string; type: 'structure' };

export interface AddPlantingRequest {
  blockDepthFt: number | null;
  blockWidthFt: number | null;
  crop: CropProfile;
  mode: PlantingMode;
  plantCount: number | null;
  rowLengthFt: number | null;
}

export function useGarden(userId: string | null) {
  const { gardenRepository, weatherProvider } = useServices();
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [garden, setGarden] = useState<Garden | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selectedItem, setSelectedItem] = useState<SelectedGardenItem | null>(
    null,
  );
  const [status, setStatus] = useState<GardenLoadStatus>('loading');
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
      .getGarden(userId)
      .then((savedGarden) => {
        if (!active) {
          return;
        }

        setGarden(savedGarden ?? createDefaultGarden(userId));
        setDirty(false);
        setSaveStatus('idle');
        setSelectedItem(null);
        setStatus('ready');
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

  const addPlant = useCallback(
    (request: AddPlantingRequest) => {
      if (!garden) {
        return;
      }

      const addedPlant = createPlanting(garden, request);
      setGarden({
        ...garden,
        plantings: [...garden.plantings, addedPlant],
      });
      setDirty(true);
      setSaveStatus('idle');
      setSelectedItem({ id: addedPlant.id, type: 'planting' });
    },
    [garden],
  );

  const addStructure = useCallback(
    (type: StructureType) => {
      if (!garden) {
        return;
      }

      const structure = clampStructureToPlot(
        createDefaultStructure({
          id: createItemId('structure'),
          type,
          ...findNextStructureLocation(garden),
        }),
        garden.plot,
      );

      setGarden({
        ...garden,
        structures: [...garden.structures, structure],
      });
      setDirty(true);
      setSaveStatus('idle');
      setSelectedItem({ id: structure.id, type: 'structure' });
    },
    [garden],
  );

  const movePlant = useCallback(
    (plantId: string, point: PlotPoint, snap: boolean) => {
      setGarden((currentGarden) => {
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
              ? {
                  ...plant,
                  xFt: normalizedPoint.xFt,
                  yFt: normalizedPoint.yFt,
                }
              : plant,
          ),
        };
      });
      setDirty(true);
      setSaveStatus('idle');
      setSelectedItem({ id: plantId, type: 'planting' });
    },
    [],
  );

  const moveStructure = useCallback(
    (structureId: string, point: PlotPoint, snap: boolean) => {
      setGarden((currentGarden) => {
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
              ? clampStructureToPlot(
                  {
                    ...structure,
                    xFt: normalizedPoint.xFt,
                    yFt: normalizedPoint.yFt,
                  },
                  currentGarden.plot,
                )
              : structure,
          ),
        };
      });
      setDirty(true);
      setSaveStatus('idle');
      setSelectedItem({ id: structureId, type: 'structure' });
    },
    [],
  );

  const resizeStructure = useCallback(
    (structureId: string, widthFt: number, depthFt: number) => {
      setGarden((currentGarden) => {
        if (!currentGarden) {
          return currentGarden;
        }

        return {
          ...currentGarden,
          structures: currentGarden.structures.map((structure) =>
            structure.id === structureId
              ? clampStructureToPlot(
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
      });
      setDirty(true);
      setSaveStatus('idle');
      setSelectedItem({ id: structureId, type: 'structure' });
    },
    [],
  );

  const applyPlotSettings = useCallback(
    (
      widthFt: number,
      depthFt: number,
      orientationDegrees: number,
      location?: GardenLocation,
    ) => {
      setGarden((currentGarden) => {
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

        if (changed) {
          setDirty(true);
          setSaveStatus('idle');
        }

        return {
          ...currentGarden,
          plantings,
          plot,
          structures,
        };
      });
    },
    [],
  );

  const saveGarden = useCallback(async () => {
    if (!garden || !dirty) {
      return;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      const wasOffline = isBrowserOffline();
      await gardenRepository.saveGarden(garden);
      setDirty(false);
      setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Unable to save your garden.'));
      setSaveStatus('error');
    }
  }, [dirty, garden, gardenRepository]);

  const refreshWeatherAndWatering = useCallback(async () => {
    if (!garden) {
      return;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      const wasOffline = isBrowserOffline();
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
  }, [garden, gardenRepository, weatherProvider]);

  const updateStructureShade = useCallback(
    (
      structureId: string,
      values: {
        canopyRadiusFt?: number | null;
        heightFt?: number | null;
      },
    ) => {
      setGarden((currentGarden) => {
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
      });
      setDirty(true);
      setSaveStatus('idle');
      setSelectedItem({ id: structureId, type: 'structure' });
    },
    [],
  );

  const recalculateSunShade = useCallback(() => {
    setGarden((currentGarden) => {
      if (!currentGarden) {
        return currentGarden;
      }

      return {
        ...currentGarden,
        sunShadeLayers: buildSunShadeLayers(currentGarden),
      };
    });
    setDirty(true);
    setSaveStatus('idle');
  }, []);

  const paintSunShadeCell = useCallback(
    (season: SunSeason, xFt: number, yFt: number, exposure: SunExposure) => {
      setGarden((currentGarden) => {
        if (!currentGarden) {
          return currentGarden;
        }

        const existingLayer = findSunShadeLayer(currentGarden, season);
        const manualArea = createManualSunArea(season, xFt, yFt, exposure);
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
      setDirty(true);
      setSaveStatus('idle');
    },
    [],
  );

  return {
    addPlant,
    addStructure,
    applyPlotSettings,
    applyPlotSize: (widthFt: number, depthFt: number) =>
      applyPlotSettings(widthFt, depthFt, garden?.plot.orientationDegrees ?? 0),
    dirty,
    error,
    garden,
    movePlant,
    moveStructure,
    paintSunShadeCell,
    recalculateSunShade,
    refreshWeatherAndWatering,
    resizeStructure,
    saveGarden,
    saveStatus,
    selectedItem,
    selectedPlantId,
    selectedStructureId,
    setSelectedItem,
    setSelectedPlantId: (plantId: string | null) =>
      setSelectedItem(plantId ? { id: plantId, type: 'planting' } : null),
    status,
    updateStructureShade,
  };
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
      (planting) => `${planting.xFt.toFixed(1)},${planting.yFt.toFixed(1)}`,
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
  const step = plot.snapUnitFt;
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
        const key = `${point.xFt.toFixed(1)},${point.yFt.toFixed(1)}`;

        if (!occupied.has(key)) {
          return point;
        }
      }
    }
  }

  return center;
}

function createItemId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}`;
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
