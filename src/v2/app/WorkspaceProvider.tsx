import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type {
  CommitOutcome,
  GardenIssue,
  GardenPlan,
  GardenTask,
  GardenWorkspaceView,
  HarvestRecord,
  JournalEntry,
  UserProfile,
  WaterApplication,
} from '../domain';
import { loadOrCreateProfile } from './profileBootstrap';
import type { V2Services } from './services';
import { useV2Auth } from './AuthProvider';

export type WorkspaceLoadState = 'error' | 'loading' | 'ready';
export type SaveState =
  | 'conflict'
  | 'error'
  | 'idle'
  | 'queued'
  | 'saved'
  | 'saving';

export interface WorkspaceContextValue {
  activePlan: GardenPlan | null;
  discardDraft(): Promise<void>;
  error: Error | null;
  isDirty: boolean;
  loadState: WorkspaceLoadState;
  profile: UserProfile | null;
  publish(changeSummary: string): Promise<CommitOutcome | null>;
  publishSharedSettings(plan: GardenPlan): Promise<CommitOutcome | null>;
  recordHarvest(record: HarvestRecord): Promise<CommitOutcome | null>;
  recordJournal(
    entry: GardenIssue | JournalEntry,
  ): Promise<CommitOutcome | null>;
  recordWater(application: WaterApplication): Promise<CommitOutcome | null>;
  reload(): Promise<void>;
  revert(revisionId: string): Promise<CommitOutcome | null>;
  saveDraft(): Promise<CommitOutcome | null>;
  savePlan(plan: GardenPlan): Promise<CommitOutcome | null>;
  saveProfile(profile: UserProfile): Promise<CommitOutcome | null>;
  saveState: SaveState;
  updatePlan(update: (plan: GardenPlan) => GardenPlan): void;
  updateTask(task: GardenTask): Promise<CommitOutcome | null>;
  workspace: GardenWorkspaceView | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function V2WorkspaceProvider({
  children,
  services,
}: {
  children: ReactNode;
  services: V2Services;
}) {
  const auth = useV2Auth();
  const [workspace, setWorkspace] = useState<GardenWorkspaceView | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workingPlan, setWorkingPlan] = useState<GardenPlan | null>(null);
  const [isDirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [loadState, setLoadState] = useState<WorkspaceLoadState>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!auth.user) return;
    setLoadState('loading');
    setError(null);
    try {
      const [nextWorkspace, nextProfile] = await Promise.all([
        services.gardenRepository.getWorkspace(auth.user.uid),
        loadOrCreateProfile(services, auth.user),
      ]);
      setWorkspace(nextWorkspace);
      setProfile(nextProfile);
      setWorkingPlan(nextWorkspace.draft?.plan ?? nextWorkspace.published.plan);
      dirtyRef.current = false;
      setDirty(false);
      setLoadState('ready');
    } catch (caught) {
      setError(toError(caught));
      setLoadState('error');
    }
  }, [auth.user, services]);

  useEffect(() => {
    if (!auth.user) {
      setWorkspace(null);
      setProfile(null);
      setWorkingPlan(null);
      setLoadState('loading');
      return;
    }
    void load();
    const workspaceSubscription = services.gardenRepository.subscribe(
      auth.user.uid,
      (nextWorkspace) => {
        setWorkspace(nextWorkspace);
        if (!dirtyRef.current) {
          setWorkingPlan(
            nextWorkspace.draft?.plan ?? nextWorkspace.published.plan,
          );
        }
        setLoadState((current) => (current === 'error' ? current : 'ready'));
      },
      (nextError) => {
        setError(nextError);
        setLoadState('error');
      },
    );
    const profileSubscription = services.userProfileRepository.subscribe(
      auth.user.uid,
      (nextProfile) => {
        setProfile(nextProfile);
      },
      (nextError) => {
        setError(nextError);
        setLoadState('error');
      },
    );
    return () => {
      workspaceSubscription.unsubscribe();
      profileSubscription.unsubscribe();
    };
  }, [auth.user, load, services]);

  const runSave = useCallback(async (command: () => Promise<CommitOutcome>) => {
    setSaveState('saving');
    setError(null);
    try {
      const outcome = await command();
      setSaveState(outcome.status === 'committed' ? 'saved' : outcome.status);
      return outcome;
    } catch (caught) {
      setError(toError(caught));
      setSaveState('error');
      return null;
    }
  }, []);

  const updatePlan = useCallback((update: (plan: GardenPlan) => GardenPlan) => {
    setWorkingPlan((current) => {
      if (!current) return current;
      return update(structuredClone(current));
    });
    dirtyRef.current = true;
    setDirty(true);
    setSaveState('idle');
  }, []);

  const savePlan = useCallback(
    async (plan: GardenPlan) => {
      if (!auth.user || !workspace) return null;
      const outcome = await runSave(() =>
        services.gardenRepository.saveDraft({
          expectedRevisionId: workspace.published.revisionId,
          plan: { ...plan, updatedAtIso: new Date().toISOString() },
          userId: auth.user!.uid,
        }),
      );
      if (outcome && outcome.status !== 'conflict') {
        setWorkingPlan(plan);
        dirtyRef.current = false;
        setDirty(false);
      }
      return outcome;
    },
    [auth.user, runSave, services.gardenRepository, workspace],
  );

  const saveDraft = useCallback(async () => {
    if (!workingPlan) return null;
    return savePlan(workingPlan);
  }, [savePlan, workingPlan]);

  const refreshPublishedOperations = useCallback(
    (context: 'publish' | 'revert' | 'settings') => {
      if (!auth.user) return;
      void services.gardenOperationsService
        .refreshGardenOperations(auth.user.uid)
        .catch((caught) => {
          services.telemetryService.captureError(caught, {
            context: `v2_${context}_operations_refresh`,
          });
        });
    },
    [auth.user, services.gardenOperationsService, services.telemetryService],
  );

  const publish = useCallback(
    async (changeSummary: string) => {
      if (!auth.user || !workspace) return null;
      if (isDirty) {
        const saved = await saveDraft();
        if (!saved || saved.status === 'conflict') return saved;
      }
      const outcome = await runSave(() =>
        services.gardenRepository.publishDraft({
          changeSummary,
          expectedRevisionId: workspace.published.revisionId,
          userId: auth.user!.uid,
        }),
      );
      if (outcome && outcome.status !== 'conflict') {
        dirtyRef.current = false;
        setDirty(false);
      }
      if (outcome?.status === 'committed') {
        refreshPublishedOperations('publish');
      }
      return outcome;
    },
    [
      auth.user,
      isDirty,
      refreshPublishedOperations,
      runSave,
      saveDraft,
      services.gardenRepository,
      workspace,
    ],
  );

  const revert = useCallback(
    async (revisionId: string) => {
      if (!auth.user || !workspace) return null;
      const outcome = await runSave(() =>
        services.gardenRepository.revertPublished({
          expectedRevisionId: workspace.published.revisionId,
          revisionId,
          userId: auth.user!.uid,
        }),
      );
      if (outcome?.status === 'committed') {
        refreshPublishedOperations('revert');
      }
      return outcome;
    },
    [
      auth.user,
      refreshPublishedOperations,
      runSave,
      services.gardenRepository,
      workspace,
    ],
  );

  const publishSharedSettings = useCallback(
    async (plan: GardenPlan) => {
      if (!auth.user || !workspace) return null;
      if (isDirty) {
        const saved = await saveDraft();
        if (!saved || saved.status === 'conflict') return saved;
      }
      const outcome = await runSave(() =>
        services.gardenRepository.publishSharedSettings({
          expectedRevisionId: workspace.published.revisionId,
          plan,
          userId: auth.user!.uid,
        }),
      );
      if (outcome?.status === 'committed') {
        refreshPublishedOperations('settings');
      }
      return outcome;
    },
    [
      auth.user,
      isDirty,
      refreshPublishedOperations,
      runSave,
      saveDraft,
      services.gardenRepository,
      workspace,
    ],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      activePlan: workingPlan,
      discardDraft: async () => {
        if (!auth.user) return;
        await services.gardenRepository.discardDraft(auth.user.uid);
        setWorkingPlan(workspace?.published.plan ?? null);
        dirtyRef.current = false;
        setDirty(false);
      },
      error,
      isDirty,
      loadState,
      profile,
      publish,
      publishSharedSettings,
      recordHarvest: (record) =>
        runSave(() => services.gardenRepository.recordHarvest(record)),
      recordJournal: (entry) =>
        runSave(() => services.gardenRepository.recordJournalEntry(entry)),
      recordWater: (application) =>
        runSave(() =>
          services.gardenRepository.recordWaterApplication(application),
        ),
      reload: load,
      revert,
      saveDraft,
      savePlan,
      saveProfile: (nextProfile) =>
        runSave(() => services.userProfileRepository.saveProfile(nextProfile)),
      saveState,
      updatePlan,
      updateTask: (task) =>
        runSave(() => services.gardenRepository.updateTask(task)),
      workspace,
    }),
    [
      auth.user,
      error,
      isDirty,
      load,
      loadState,
      profile,
      publish,
      publishSharedSettings,
      revert,
      runSave,
      saveDraft,
      savePlan,
      saveState,
      services,
      updatePlan,
      workingPlan,
      workspace,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useV2Workspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error('useV2Workspace must be used inside V2WorkspaceProvider.');
  }
  return value;
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}
