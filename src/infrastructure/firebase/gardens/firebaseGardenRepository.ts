import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';

import type { GardenRepository } from '../../../domain/gardens/GardenRepository';
import type {
  GardenDocument,
  GardenMemberDocument,
  PlotDocument,
  UserDocument,
} from '../../../domain/gardens/schema';
import type {
  GardenPlot,
  GardenRole,
  GardenSummary,
  SaveGardenPlotInput,
} from '../../../domain/gardens/types';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirestoreClient } from '../app';

function toGardenPlot(id: string, plot: PlotDocument): GardenPlot {
  return {
    height: plot.height,
    id,
    name: plot.name,
    rotation: plot.rotation,
    width: plot.width,
    x: plot.x,
    y: plot.y,
  };
}

function toGardenSummary(
  id: string,
  garden: GardenDocument,
  memberRole: GardenRole,
  plotCount: number,
): GardenSummary {
  return {
    dimensions: garden.dimensions,
    id,
    memberRole,
    name: garden.name,
    plotCount,
    slug: garden.slug,
    timezone: garden.timezone,
    updatedLabel: 'Loaded from Firestore',
  };
}

function isMissingCollectionGroupIndexError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';

  return code === 'failed-precondition' && /index/i.test(message);
}

export class FirebaseGardenRepository implements GardenRepository {
  private readonly firestore;

  constructor(environment: AppEnvironment) {
    this.firestore = getFirestoreClient(environment);
  }

  async deletePlot(
    gardenId: string,
    plotId: string,
    uid: string,
  ): Promise<void> {
    await this.assertCanEditPlots(gardenId, uid);

    await deleteDoc(doc(this.firestore, 'gardens', gardenId, 'plots', plotId));
  }

  async getById(gardenId: string, uid: string): Promise<GardenSummary | null> {
    const memberSnapshot = await this.getMemberSnapshot(gardenId, uid);

    if (!memberSnapshot.exists()) {
      return null;
    }

    const gardenSnapshot = await getDoc(
      doc(this.firestore, 'gardens', gardenId),
    );

    if (!gardenSnapshot.exists()) {
      return null;
    }

    const plotsSnapshot = await getDocs(
      collection(this.firestore, 'gardens', gardenId, 'plots'),
    );

    return toGardenSummary(
      gardenSnapshot.id,
      gardenSnapshot.data() as GardenDocument,
      (memberSnapshot.data() as GardenMemberDocument).role,
      plotsSnapshot.size,
    );
  }

  async listPlots(gardenId: string, uid: string): Promise<GardenPlot[]> {
    const memberSnapshot = await this.getMemberSnapshot(gardenId, uid);

    if (!memberSnapshot.exists()) {
      return [];
    }

    const plotsSnapshot = await getDocs(
      collection(this.firestore, 'gardens', gardenId, 'plots'),
    );

    return plotsSnapshot.docs
      .map((plotSnapshot) =>
        toGardenPlot(plotSnapshot.id, plotSnapshot.data() as PlotDocument),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async listForUser(uid: string): Promise<GardenSummary[]> {
    try {
      const gardens = await this.listFromMembershipQuery(uid);

      if (gardens.length > 0) {
        return gardens;
      }
    } catch (error) {
      if (!isMissingCollectionGroupIndexError(error)) {
        throw error;
      }
    }

    return this.listFromLastGarden(uid);
  }

  async savePlot(
    gardenId: string,
    plot: SaveGardenPlotInput,
    uid: string,
  ): Promise<GardenPlot> {
    await this.assertCanEditPlots(gardenId, uid);

    const existingPlotSnapshot = await getDoc(
      doc(this.firestore, 'gardens', gardenId, 'plots', plot.id),
    );
    const now = new Date().toISOString();
    const existingPlot = existingPlotSnapshot.exists()
      ? (existingPlotSnapshot.data() as PlotDocument)
      : null;
    const plotDocument: PlotDocument = {
      createdAt: existingPlot?.createdAt ?? now,
      height: plot.height,
      name: plot.name,
      rotation: plot.rotation,
      updatedAt: now,
      width: plot.width,
      x: plot.x,
      y: plot.y,
    };

    await setDoc(
      doc(this.firestore, 'gardens', gardenId, 'plots', plot.id),
      plotDocument,
    );

    return toGardenPlot(plot.id, plotDocument);
  }

  private async assertCanEditPlots(
    gardenId: string,
    uid: string,
  ): Promise<void> {
    const memberSnapshot = await this.getMemberSnapshot(gardenId, uid);

    if (!memberSnapshot.exists()) {
      throw new Error('Garden access is required to edit plots.');
    }

    const memberRole = (memberSnapshot.data() as GardenMemberDocument).role;

    if (memberRole === 'viewer') {
      throw new Error('Viewer members cannot edit plots.');
    }
  }

  private getMemberSnapshot(gardenId: string, uid: string) {
    return getDoc(doc(this.firestore, 'gardens', gardenId, 'members', uid));
  }

  private async listFromLastGarden(uid: string): Promise<GardenSummary[]> {
    const userSnapshot = await getDoc(doc(this.firestore, 'users', uid));

    if (!userSnapshot.exists()) {
      return [];
    }

    const lastGardenId = (userSnapshot.data() as UserDocument).lastGardenId;

    if (!lastGardenId) {
      return [];
    }

    const garden = await this.getById(lastGardenId, uid);

    return garden ? [garden] : [];
  }

  private async listFromMembershipQuery(uid: string): Promise<GardenSummary[]> {
    const membershipsQuery = query(
      collectionGroup(this.firestore, 'members'),
      where('uid', '==', uid),
    );
    const membershipSnapshots = await getDocs(membershipsQuery);
    const gardens = await Promise.all(
      membershipSnapshots.docs.map(async (memberSnapshot) => {
        const memberData = memberSnapshot.data() as GardenMemberDocument;
        const gardenRef = memberSnapshot.ref.parent.parent;

        if (!gardenRef) {
          return null;
        }

        const gardenSnapshot = await getDoc(gardenRef);

        if (!gardenSnapshot.exists()) {
          return null;
        }

        const plotsSnapshot = await getDocs(
          collection(this.firestore, 'gardens', gardenSnapshot.id, 'plots'),
        );

        return toGardenSummary(
          gardenSnapshot.id,
          gardenSnapshot.data() as GardenDocument,
          memberData.role,
          plotsSnapshot.size,
        );
      }),
    );

    return gardens
      .filter((garden): garden is GardenSummary => Boolean(garden))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
