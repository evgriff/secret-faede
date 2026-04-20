import { useCallback, useEffect, useState } from 'react';

import { useServices } from '../../app/providers';
import {
  createDefaultGarden,
  type Garden,
  type GardenPlant,
  type GardenPlot,
} from '../../domain/gardens/GardenRepository';
import {
  clampPlantToPlot,
  clampPlotDimension,
  normalizePointToPlot,
  snapFeet,
  type PlotPoint,
} from './gardenMath';

type GardenLoadStatus = 'error' | 'loading' | 'ready';
type SaveStatus = 'error' | 'idle' | 'saved' | 'saving';

export function useGarden(userId: string | null) {
  const { gardenRepository } = useServices();
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [garden, setGarden] = useState<Garden | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [status, setStatus] = useState<GardenLoadStatus>('loading');

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
        setSelectedPlantId(null);
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

  const addPlant = useCallback(() => {
    if (!garden) {
      return;
    }

    const addedPlant = createPlant(garden);
    setGarden({
      ...garden,
      plants: [...garden.plants, addedPlant],
    });
    setDirty(true);
    setSaveStatus('idle');
    setSelectedPlantId(addedPlant.id);
  }, [garden]);

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
          plants: currentGarden.plants.map((plant) =>
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
      setSelectedPlantId(plantId);
    },
    [],
  );

  const applyPlotSize = useCallback((widthFt: number, depthFt: number) => {
    setGarden((currentGarden) => {
      if (!currentGarden) {
        return currentGarden;
      }

      const plot: GardenPlot = {
        ...currentGarden.plot,
        depthFt: clampPlotDimension(depthFt),
        widthFt: clampPlotDimension(widthFt),
      };
      const plants = currentGarden.plants.map((plant) =>
        clampPlantToPlot(plant, plot),
      );
      const changed =
        plot.widthFt !== currentGarden.plot.widthFt ||
        plot.depthFt !== currentGarden.plot.depthFt ||
        plants.some(
          (plant, index) =>
            plant.xFt !== currentGarden.plants[index]?.xFt ||
            plant.yFt !== currentGarden.plants[index]?.yFt,
        );

      if (changed) {
        setDirty(true);
        setSaveStatus('idle');
      }

      return {
        ...currentGarden,
        plants,
        plot,
      };
    });
  }, []);

  const saveGarden = useCallback(async () => {
    if (!garden || !dirty) {
      return;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      await gardenRepository.saveGarden(garden);
      setDirty(false);
      setSaveStatus('saved');
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Unable to save your garden.'));
      setSaveStatus('error');
    }
  }, [dirty, garden, gardenRepository]);

  return {
    addPlant,
    applyPlotSize,
    dirty,
    error,
    garden,
    movePlant,
    saveGarden,
    saveStatus,
    selectedPlantId,
    setSelectedPlantId,
    status,
  };
}

function createPlant(garden: Garden): GardenPlant {
  const point = findNextPlantLocation(garden);

  return {
    id: createPlantId(),
    type: 'plant',
    xFt: point.xFt,
    yFt: point.yFt,
  };
}

function findNextPlantLocation(garden: Garden): PlotPoint {
  const { plot, plants } = garden;
  const occupied = new Set(
    plants.map((plant) => `${plant.xFt.toFixed(1)},${plant.yFt.toFixed(1)}`),
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

function createPlantId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `plant-${Date.now()}`;
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
