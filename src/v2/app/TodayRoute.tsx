import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useV2Auth } from './AuthProvider';
import { useV2Workspace } from './WorkspaceProvider';
import type { CommitOutcome, GardenTask, WaterApplication } from '../domain';
import {
  TodayPage,
  type TodayTaskActionInput,
  type TodayWateringLogInput,
} from '../routes/today';
import { RouteLink } from './RouterLinks';
import { useV2Runtime } from './RuntimeProvider';
import { useV2Services } from './V2ServicesContext';
import { recommendationsForToday } from './todayRecommendations';
import { useTodayWeather } from './useTodayWeather';
import { createWaterApplication } from './wateringApplicationRecords';

export function TodayRoute() {
  const auth = useV2Auth();
  const workspace = useV2Workspace();
  const runtime = useV2Runtime();
  const services = useV2Services();
  const [searchParams] = useSearchParams();
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const refreshRequested = useRef(false);
  const plan = workspace.workspace?.published.plan ?? null;
  const profile = workspace.profile;

  useEffect(() => {
    const timer = window.setInterval(
      () => setNowIso(new Date().toISOString()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const weather = useTodayWeather(plan, nowIso);
  const recommendations =
    plan && profile
      ? recommendationsForToday(
          plan,
          profile,
          workspace.workspace?.operations.wateringRecommendations ?? [],
          nowIso,
          workspace.workspace?.published.revisionId ?? '',
        )
      : [];

  useEffect(() => {
    if (
      refreshRequested.current ||
      services.environment.runtimeMode !== 'firebase' ||
      !auth.user ||
      !plan ||
      plan.plantings.length === 0 ||
      workspace.loadState !== 'ready'
    ) {
      return;
    }
    refreshRequested.current = true;
    void services.gardenOperationsService
      .refreshGardenOperations(auth.user.uid)
      .catch(() => undefined);
  }, [
    auth.user,
    plan,
    services.environment.runtimeMode,
    services.gardenOperationsService,
    workspace.loadState,
  ]);

  if (!plan || !profile || !auth.user) {
    return (
      <TodayPage
        LinkComponent={RouteLink}
        isOnline={runtime.isOnline}
        loadState="loading"
        nowIso={nowIso}
        onLogWatering={async () => undefined}
        onTaskAction={async () => undefined}
        recommendations={[]}
        tasks={[]}
        timezone="UTC"
        weather={null}
      />
    );
  }

  const focusValue = searchParams.get('focus');
  const focus =
    focusValue === 'task' ||
    focusValue === 'watering' ||
    focusValue === 'weather'
      ? focusValue
      : null;
  const focusId =
    focus === 'watering'
      ? (searchParams.get('recommendationId') ??
        searchParams.get('cropGroupId'))
      : focus === 'task'
        ? searchParams.get('taskId')
        : focus === 'weather'
          ? (searchParams.get('alertId') ?? searchParams.get('snapshotId'))
          : null;

  async function logWatering(input: TodayWateringLogInput) {
    const recommendation = recommendations.find(
      (item) => item.id === input.recommendationId,
    );
    const application: WaterApplication = createWaterApplication({
      input,
      nowIso,
      recommendation,
      timezone: plan!.plot.location.timezone,
      userId: auth.user!.uid,
    });
    const saved = await workspace.recordWater(application);
    if (
      saved?.status === 'committed' &&
      services.environment.runtimeMode === 'firebase'
    ) {
      void services.gardenOperationsService
        .refreshGardenOperations(auth.user!.uid)
        .catch(() => undefined);
    }
    return result(saved);
  }

  async function updateTask(input: TodayTaskActionInput) {
    const task = workspace.workspace?.operations.tasks.find(
      (candidate) => candidate.id === input.taskId,
    );
    if (!task) throw new Error('The selected task no longer exists.');
    return result(
      await workspace.updateTask(applyTaskAction(task, input, nowIso)),
    );
  }

  return (
    <TodayPage
      LinkComponent={RouteLink}
      focus={focus}
      focusId={focusId}
      isOnline={runtime.isOnline}
      loadState={workspace.loadState}
      nowIso={nowIso}
      onLogWatering={logWatering}
      onRefreshWeather={async () => {
        await Promise.all([
          weather.refresh(),
          services.gardenOperationsService.refreshGardenOperations(
            auth.user!.uid,
          ),
        ]);
      }}
      onRetry={workspace.reload}
      onTaskAction={updateTask}
      recommendations={recommendations}
      tasks={workspace.workspace?.operations.tasks ?? []}
      timezone={plan.plot.location.timezone}
      weather={weather.weather}
    />
  );
}

function applyTaskAction(
  task: GardenTask,
  input: TodayTaskActionInput,
  nowIso: string,
): GardenTask {
  if (input.action === 'complete') {
    return {
      ...task,
      completedAtIso: nowIso,
      status: 'done',
      updatedAtIso: nowIso,
    };
  }
  if (input.action === 'reopen') {
    return {
      ...task,
      completedAtIso: null,
      status: 'open',
      updatedAtIso: nowIso,
    };
  }
  return {
    ...task,
    completedAtIso: null,
    dueOn: input.nextDueOn ?? task.dueOn,
    status: input.action === 'snooze' ? 'snoozed' : 'deferred',
    updatedAtIso: nowIso,
  };
}

function result(outcome: CommitOutcome | null) {
  if (!outcome) throw new Error('The field update did not save.');
  if (outcome.status === 'conflict') throw new Error('The saved plan changed.');
  return outcome.status === 'queued' ? ('queued' as const) : ('saved' as const);
}
