import {
  parseGarden,
  parseHarvestEvents,
  parseJournalEntries,
  parseNotificationLogs,
  parsePlantings,
  parsePlot,
  parseStructures,
  parseTasks,
  type Garden,
  type GardenRepository,
} from '../../../domain/gardens/GardenRepository';
import type { AppEnvironment } from '../../../shared/config/env';
import { isBrowserOffline } from '../../../shared/network/networkStatus';
import { getFirestoreClient } from '../app';
import {
  clearPendingGardenSave,
  getPendingGardenSaveUserIds,
  queuePendingGardenSave,
  readPendingGardenSave,
} from './pendingGardenSaves';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

export class FirebaseGardenRepository implements GardenRepository {
  private readonly firestore: Firestore;

  constructor(environment: AppEnvironment) {
    this.firestore = getFirestoreClient(environment);

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.flushPendingSaves().catch(() => undefined);
      });
      void this.flushPendingSaves().catch(() => undefined);
    }
  }

  async getGarden(userId: string): Promise<Garden | null> {
    if (!isBrowserOffline()) {
      await this.flushPendingSave(userId).catch(() => undefined);
    }

    try {
      const snapshot = await getDoc(this.getGardenDocument(userId));

      if (!snapshot.exists()) {
        return readPendingGardenSave(userId);
      }

      const gardenData = snapshot.data();
      const plot = parsePlot(gardenData.plot);
      const [
        structures,
        plantings,
        tasks,
        journalEntries,
        harvestEvents,
        logs,
      ] = await Promise.all([
        this.getCollectionData(userId, 'structures'),
        this.getCollectionData(userId, 'plantings'),
        this.getCollectionData(userId, 'tasks'),
        this.getCollectionData(userId, 'journal'),
        this.getCollectionData(userId, 'harvests'),
        this.getCollectionData(userId, 'notifications'),
      ]);

      return parseGarden(userId, gardenData, {
        harvestEvents: parseHarvestEvents(harvestEvents),
        journalEntries: parseJournalEntries(journalEntries),
        notificationLogs: parseNotificationLogs(logs),
        plantings: parsePlantings(plantings, plot),
        structures: parseStructures(structures, plot),
        tasks: parseTasks(tasks),
      });
    } catch (loadError) {
      const pendingGarden = readPendingGardenSave(userId);

      if (pendingGarden) {
        return pendingGarden;
      }

      throw loadError;
    }
  }

  async saveGarden(garden: Garden): Promise<void> {
    if (isBrowserOffline()) {
      queuePendingGardenSave(garden);
      return;
    }

    try {
      await this.commitGarden(garden);
      clearPendingGardenSave(garden.userId);
    } catch (saveError) {
      if (shouldQueueSaveFailure(saveError)) {
        queuePendingGardenSave(garden);
        return;
      }

      throw saveError;
    }
  }

  private async commitGarden(garden: Garden): Promise<void> {
    const batch = writeBatch(this.firestore);
    const gardenRef = this.getGardenDocument(garden.userId);

    batch.set(gardenRef, {
      climateProfile: garden.climateProfile,
      id: garden.id,
      name: garden.name,
      plot: garden.plot,
      sunShadeLayers: garden.sunShadeLayers,
      updatedAt: serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
      userId: garden.userId,
      waterRecommendations: garden.waterRecommendations,
      weatherSnapshots: garden.weatherSnapshots,
    });

    for (const structure of garden.structures) {
      batch.set(
        this.getNestedDocument(garden.userId, 'structures', structure.id),
        structure,
      );
    }

    for (const planting of garden.plantings) {
      batch.set(
        this.getNestedDocument(garden.userId, 'plantings', planting.id),
        planting,
      );
    }

    for (const task of garden.tasks) {
      batch.set(this.getNestedDocument(garden.userId, 'tasks', task.id), task);
    }

    for (const entry of garden.journalEntries) {
      batch.set(
        this.getNestedDocument(garden.userId, 'journal', entry.id),
        entry,
      );
    }

    for (const harvest of garden.harvestEvents) {
      batch.set(
        this.getNestedDocument(garden.userId, 'harvests', harvest.id),
        harvest,
      );
    }

    for (const log of garden.notificationLogs) {
      batch.set(
        this.getNestedDocument(garden.userId, 'notifications', log.id),
        log,
      );
    }

    await batch.commit();
  }

  private async flushPendingSaves() {
    if (isBrowserOffline()) {
      return;
    }

    await Promise.all(
      getPendingGardenSaveUserIds().map((userId) =>
        this.flushPendingSave(userId),
      ),
    );
  }

  private async flushPendingSave(userId: string) {
    if (isBrowserOffline()) {
      return;
    }

    const pendingGarden = readPendingGardenSave(userId);

    if (!pendingGarden) {
      return;
    }

    await this.commitGarden(pendingGarden);
    clearPendingGardenSave(userId);
  }

  private async getCollectionData(userId: string, collectionName: string) {
    const snapshot = await getDocs(
      collection(this.firestore, 'gardens', userId, collectionName),
    );

    return snapshot.docs.map((documentSnapshot) => ({
      id: documentSnapshot.id,
      ...documentSnapshot.data(),
    }));
  }

  private getGardenDocument(userId: string) {
    return doc(this.firestore, 'gardens', userId);
  }

  private getNestedDocument(
    userId: string,
    collectionName: string,
    documentId: string,
  ) {
    return doc(this.firestore, 'gardens', userId, collectionName, documentId);
  }
}

function shouldQueueSaveFailure(error: unknown) {
  if (isBrowserOffline()) {
    return true;
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'unavailable'
  );
}
