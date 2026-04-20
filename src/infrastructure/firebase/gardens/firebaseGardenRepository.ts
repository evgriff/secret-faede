import {
  defaultGardenPlot,
  type Garden,
  type GardenPlant,
  type GardenPlot,
  type GardenRepository,
} from '../../../domain/gardens/GardenRepository';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirestoreClient } from '../app';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

export class FirebaseGardenRepository implements GardenRepository {
  private readonly firestore: Firestore;

  constructor(environment: AppEnvironment) {
    this.firestore = getFirestoreClient(environment);
  }

  async getGarden(userId: string): Promise<Garden | null> {
    const snapshot = await getDoc(this.getGardenDocument(userId));

    if (!snapshot.exists()) {
      return null;
    }

    return parseGardenDocument(userId, snapshot.data());
  }

  async saveGarden(garden: Garden): Promise<void> {
    await setDoc(this.getGardenDocument(garden.userId), {
      plants: garden.plants.map((plant) => ({
        id: plant.id,
        type: plant.type,
        xFt: plant.xFt,
        yFt: plant.yFt,
      })),
      plot: garden.plot,
      updatedAt: serverTimestamp(),
      userId: garden.userId,
    });
  }

  private getGardenDocument(userId: string) {
    return doc(this.firestore, 'gardens', userId);
  }
}

function parseGardenDocument(
  userId: string,
  data: Record<string, unknown>,
): Garden {
  const plot = parsePlot(data.plot);

  return {
    plants: parsePlants(data.plants, plot),
    plot,
    userId,
  };
}

function parsePlot(value: unknown): GardenPlot {
  if (!isRecord(value)) {
    return defaultGardenPlot;
  }

  return {
    depthFt: readNumber(value.depthFt, defaultGardenPlot.depthFt),
    gridUnitFt: 1,
    snapUnitFt: 0.5,
    widthFt: readNumber(value.widthFt, defaultGardenPlot.widthFt),
  };
}

function parsePlants(value: unknown, plot: GardenPlot): GardenPlant[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((plant): GardenPlant[] => {
    if (!isRecord(plant) || typeof plant.id !== 'string') {
      return [];
    }

    return [
      {
        id: plant.id,
        type: 'plant',
        xFt: clamp(readNumber(plant.xFt, 0), 0, plot.widthFt),
        yFt: clamp(readNumber(plant.yFt, 0), 0, plot.depthFt),
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
