import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  readStorageValue,
  removeStorageValue,
  writeStorageValue,
} from '../../shared/lib/storage';
import { useAuth } from '../auth/auth-context';
import { buildSelectedGardenStorageKey } from './storage';

interface SelectedGardenContextValue {
  clearSelectedGarden(): void;
  selectGarden(gardenId: string): void;
  selectedGardenId: string | null;
}

const SelectedGardenContext = createContext<SelectedGardenContextValue | null>(
  null,
);

export function SelectedGardenProvider({ children }: { children: ReactNode }) {
  const {
    state: { user },
  } = useAuth();
  const [selectedGardenId, setSelectedGardenId] = useState<string | null>(null);
  const storageKey = user ? buildSelectedGardenStorageKey(user.uid) : null;

  useEffect(() => {
    if (!storageKey) {
      setSelectedGardenId(null);
      return;
    }

    setSelectedGardenId(readStorageValue(storageKey));
  }, [storageKey]);

  const value = useMemo<SelectedGardenContextValue>(
    () => ({
      clearSelectedGarden: () => {
        if (storageKey) {
          removeStorageValue(storageKey);
        }
        setSelectedGardenId(null);
      },
      selectGarden: (gardenId) => {
        if (storageKey) {
          writeStorageValue(storageKey, gardenId);
        }
        setSelectedGardenId(gardenId);
      },
      selectedGardenId,
    }),
    [selectedGardenId, storageKey],
  );

  return (
    <SelectedGardenContext.Provider value={value}>
      {children}
    </SelectedGardenContext.Provider>
  );
}

export function useSelectedGarden() {
  const context = useContext(SelectedGardenContext);

  if (!context) {
    throw new Error(
      'useSelectedGarden must be used inside SelectedGardenProvider.',
    );
  }

  return context;
}
