import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

import type { GardenRepository } from '../../../domain/gardens/GardenRepository';
import type {
  GardenDocument,
  GardenMemberDocument,
} from '../../../domain/gardens/schema';
import type { GardenRole, GardenSummary } from '../../../domain/gardens/types';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirestoreClient } from '../app';

function toGardenSummary(
  id: string,
  garden: GardenDocument,
  memberRole: GardenRole,
): GardenSummary {
  return {
    dimensions: garden.dimensions,
    id,
    memberRole,
    name: garden.name,
    plotCount: 0,
    slug: garden.slug,
    timezone: garden.timezone,
    updatedLabel: 'Loaded from Firestore',
  };
}

export class FirebaseGardenRepository implements GardenRepository {
  private readonly firestore;

  constructor(environment: AppEnvironment) {
    this.firestore = getFirestoreClient(environment);
  }

  async getById(gardenId: string, uid: string): Promise<GardenSummary | null> {
    const memberSnapshot = await getDoc(
      doc(this.firestore, 'gardens', gardenId, 'members', uid),
    );

    if (!memberSnapshot.exists()) {
      return null;
    }

    const gardenSnapshot = await getDoc(
      doc(this.firestore, 'gardens', gardenId),
    );

    if (!gardenSnapshot.exists()) {
      return null;
    }

    return toGardenSummary(
      gardenSnapshot.id,
      gardenSnapshot.data() as GardenDocument,
      (memberSnapshot.data() as GardenMemberDocument).role,
    );
  }

  async listForUser(uid: string): Promise<GardenSummary[]> {
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

        return toGardenSummary(
          gardenSnapshot.id,
          gardenSnapshot.data() as GardenDocument,
          memberData.role,
        );
      }),
    );

    return gardens
      .filter((garden): garden is GardenSummary => Boolean(garden))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}
