import { useEffect, useState } from 'react';

import {
  readPendingGardenSaveMetadata,
  subscribeToPendingGardenSaves,
  type PendingGardenSaveMetadata,
} from '../../infrastructure/firebase/gardens/pendingGardenSaves';

export type GardenSyncState =
  | {
      metadata: null;
      status: 'synced';
    }
  | {
      metadata: PendingGardenSaveMetadata;
      status: 'conflict';
    }
  | {
      metadata: PendingGardenSaveMetadata;
      status: 'queued';
    };

export function usePendingGardenSyncState(
  userId: string | null,
): GardenSyncState {
  const [state, setState] = useState<GardenSyncState>(() => readState(userId));

  useEffect(() => {
    const update = () => setState(readState(userId));

    update();

    return subscribeToPendingGardenSaves(update);
  }, [userId]);

  return state;
}

function readState(userId: string | null): GardenSyncState {
  if (!userId) {
    return { metadata: null, status: 'synced' };
  }

  const metadata = readPendingGardenSaveMetadata(userId);

  return metadata
    ? {
        metadata,
        status: metadata.conflictDetectedAtIso ? 'conflict' : 'queued',
      }
    : { metadata: null, status: 'synced' };
}
