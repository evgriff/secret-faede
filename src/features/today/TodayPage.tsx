import { useMemo, useState } from 'react';

import { useServices } from '../../app/providers';
import { useNetworkStatus } from '../../shared/network/networkStatus';
import { LoadingState } from '../../shared/ui/LoadingState';
import {
  addManualTask,
  addSuccessionTask,
  buildSuccessionRecommendations,
  completeTask,
  deferTask,
  snoozeTask,
  sortTasks,
  synchronizeGardenTasks,
  type SuccessionRecommendation,
} from '../tasks/taskEngine';
import { TodayCalendarStrip } from './components/TodayCalendarStrip';
import { TodayFieldPanels } from './components/TodayFieldPanels';
import { type TodayManualTaskInput } from './components/TodayManualTaskForm';
import { TodayDayOverview } from './components/TodayDayOverview';
import { type TodayQuickActionState } from './components/TodayQuickActionRail';
import { TodayQuickActionsPanel } from './components/TodayQuickActionsPanel';
import {
  TodayQuickActionSheet,
  type QuickHarvestSubmit,
  type QuickIssueSubmit,
  type QuickJournalSubmit,
} from './components/TodayQuickActionSheet';
import { TodayPageHeader } from './components/TodayPageHeader';
import { TodaySidebar } from './components/TodaySidebar';
import { TodayTaskGroup } from './components/TodayTaskGroup';
import {
  addFieldNote,
  createTodayId,
  logFieldHarvest,
  markWaterDone,
  reportFieldIssue,
  updateIssueStatus,
} from './todayActions';
import { toLocalDate } from './todayFormatters';
import { buildTodayFieldModel } from './todayFieldModel';
import { markPlantingLifecycle } from './todayLifecycleActions';
import { delayHarvestReminderWithLocalNotification } from './todayLocalNotifications';
import {
  buildCalendarDays,
  buildTodayTargetOptions,
  countTasksByBed,
  getTasksForSelectedDate,
  getTodayTarget,
} from './todaySelectors';
import { useTodayGarden } from './useTodayGarden';
import styles from './TodayPage.module.css';

export function TodayPage() {
  const { mobileDeviceService, telemetryService } = useServices();
  const networkStatus = useNetworkStatus();
  const [activeQuickAction, setActiveQuickAction] =
    useState<TodayQuickActionState | null>(null);
  const [today] = useState(() => new Date());
  const todayDate = toLocalDate(today);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const isOffline = networkStatus === 'offline';
  const canUseNativeCamera = mobileDeviceService.getCapabilities().camera;
  const {
    applyGardenUpdate,
    error,
    garden,
    loadStatus,
    saveStatus,
    uploadQuickPhotos,
  } = useTodayGarden(today, isOffline);

  const openTasks = useMemo(
    () =>
      sortTasks(garden?.tasks.filter((task) => task.status === 'open') ?? []),
    [garden?.tasks],
  );
  const selectedDayTasks = useMemo(
    () => getTasksForSelectedDate(openTasks, selectedDate, todayDate),
    [openTasks, selectedDate, todayDate],
  );
  const bedCounts = useMemo(
    () => countTasksByBed(selectedDayTasks),
    [selectedDayTasks],
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(openTasks, todayDate),
    [openTasks, todayDate],
  );
  const successionRecommendations = useMemo(
    () => (garden ? buildSuccessionRecommendations(garden, today) : []),
    [garden, today],
  );
  const targetOptions = useMemo(
    () => (garden ? buildTodayTargetOptions(garden) : []),
    [garden],
  );
  const fieldModel = useMemo(
    () =>
      garden ? buildTodayFieldModel(garden, openTasks, selectedDate) : null,
    [garden, openTasks, selectedDate],
  );

  async function handleAddManualTask(input: TodayManualTaskInput) {
    return applyGardenUpdate((current) => addManualTask(current, input));
  }

  async function handleQuickNoteSubmit(input: QuickJournalSubmit) {
    if (!input.body.trim()) {
      return false;
    }

    const entryId = createTodayId('journal');
    const photos = await uploadQuickPhotos(entryId, input.photoFiles);
    const target = getTodayTarget(targetOptions, input.targetId);

    if (!photos || !target) {
      return false;
    }

    const saved = await applyGardenUpdate(
      (current) =>
        addFieldNote(current, {
          body: input.body.trim(),
          id: entryId,
          occurredOn: input.occurredOn,
          photos,
          target,
          title: input.title.trim() || 'Field note',
        }),
      'Unable to save field note.',
    );

    if (saved) {
      telemetryService.trackEvent('note_added', { source: 'today' });
    }

    return saved;
  }

  async function handleQuickIssueSubmit(input: QuickIssueSubmit) {
    if (!input.body.trim()) {
      return false;
    }

    const entryId = createTodayId('issue');
    const photos = await uploadQuickPhotos(entryId, input.photoFiles);
    const target = getTodayTarget(targetOptions, input.targetId);

    if (!photos || !target) {
      return false;
    }

    const saved = await applyGardenUpdate(
      (current) =>
        reportFieldIssue(current, {
          body: input.body.trim(),
          category: input.category,
          id: entryId,
          occurredOn: input.occurredOn,
          photos,
          severity: input.severity,
          status: 'open',
          target,
          title: input.title.trim() || 'Field issue',
        }),
      'Unable to save issue.',
    );

    if (saved) {
      telemetryService.trackEvent('issue_reported', {
        severity: input.severity,
        source: 'today',
      });
    }

    return saved;
  }

  async function handleQuickHarvestSubmit(input: QuickHarvestSubmit) {
    const saved = await applyGardenUpdate(
      (current) => logFieldHarvest(current, input),
      'Unable to log harvest.',
    );

    if (saved) {
      telemetryService.trackEvent('harvest_logged', {
        source: 'today',
        unit: input.unit,
      });
    }

    return saved;
  }

  async function handleCapturePhoto() {
    try {
      return await mobileDeviceService.capturePhoto();
    } catch {
      return null;
    }
  }

  function addSuccession(recommendation: SuccessionRecommendation) {
    void applyGardenUpdate((current) =>
      addSuccessionTask(current, recommendation),
    );
  }

  function handleCompleteTask(taskId: string) {
    void applyGardenUpdate((current) => {
      const task = current.tasks.find((candidate) => candidate.id === taskId);
      const updated = completeTask(current, taskId);

      if (task) {
        telemetryService.trackEvent('task_completed', {
          source: task.source,
          task_type: task.type,
        });
      }

      return updated;
    });
  }

  function handleSnoozeTask(taskId: string) {
    void applyGardenUpdate((current) => snoozeTask(current, taskId, 1));
  }

  function handleDeferTask(taskId: string) {
    void applyGardenUpdate((current) => deferTask(current, taskId, 7));
  }

  function handleUpdateIssue(
    entryId: string,
    status: Parameters<typeof updateIssueStatus>[2],
  ) {
    void applyGardenUpdate(
      (current) => updateIssueStatus(current, entryId, status),
      'Unable to update issue.',
    );
  }

  function handleUpdatePlantingStatus(
    plantingId: string,
    status: Parameters<typeof markPlantingLifecycle>[2],
  ) {
    void applyGardenUpdate(
      (current) => markPlantingLifecycle(current, plantingId, status),
      'Unable to update crop status.',
    );
  }

  function handleWaterDone(recommendationId: string) {
    void applyGardenUpdate(
      (current) => markWaterDone(current, recommendationId),
      'Unable to save watering.',
    ).then((saved) => {
      if (saved) {
        telemetryService.trackEvent('task_completed', {
          source: 'watering_recommendation',
          task_type: 'water',
        });
      }
    });
  }

  function handleDelayHarvest(
    plantingId: string,
    delayUntilDate: string,
    reason: string,
  ) {
    void delayHarvestReminderWithLocalNotification({
      applyGardenUpdate,
      delayUntilDate,
      garden,
      mobileDeviceService,
      plantingId,
      reason,
    });
  }

  const handleSyncSchedule = () =>
    void applyGardenUpdate((current) =>
      synchronizeGardenTasks(current, {
        now: new Date(),
        refreshOpenGenerated: true,
      }),
    );

  if (loadStatus === 'loading') {
    return <LoadingState message="Building field list." title="Today" />;
  }

  if (loadStatus === 'error' || !garden || !fieldModel) {
    return (
      <section className={styles.page}>
        <h1>Today</h1>
        <p role="alert">{error ?? 'Unable to load today.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <TodayPageHeader
        error={error}
        isOffline={isOffline}
        onSyncSchedule={handleSyncSchedule}
        openIssueCount={fieldModel.unresolvedIssues.length}
        saveStatus={saveStatus}
        selectedTaskCount={selectedDayTasks.length}
        wateringCount={fieldModel.activeWatering.length}
      />

      <TodayQuickActionSheet
        action={activeQuickAction}
        canUseNativeCamera={canUseNativeCamera}
        garden={garden}
        isOffline={isOffline}
        onClose={() => setActiveQuickAction(null)}
        onCapturePhoto={handleCapturePhoto}
        onSubmitHarvest={handleQuickHarvestSubmit}
        onSubmitIssue={handleQuickIssueSubmit}
        onSubmitNote={handleQuickNoteSubmit}
        targets={targetOptions}
        todayDate={selectedDate}
      />

      <TodayCalendarStrip
        days={calendarDays}
        onSelectDate={setSelectedDate}
        selectedDate={selectedDate}
        todayDate={todayDate}
      />

      <TodayDayOverview
        model={fieldModel}
        onCompleteTask={handleCompleteTask}
        onOpenAction={setActiveQuickAction}
        onUpdateIssue={handleUpdateIssue}
        onUpdatePlantingStatus={handleUpdatePlantingStatus}
        onWaterDone={handleWaterDone}
        selectedDate={selectedDate}
        selectedTasks={selectedDayTasks}
      />

      <TodayFieldPanels
        model={fieldModel}
        onCompleteTask={handleCompleteTask}
        onDeferTask={handleDeferTask}
        onDelayHarvest={handleDelayHarvest}
        onOpenAction={setActiveQuickAction}
        onSnoozeTask={handleSnoozeTask}
        onUpdatePlantingStatus={handleUpdatePlantingStatus}
        onUpdateIssue={handleUpdateIssue}
        onWaterDone={handleWaterDone}
        selectedTasks={selectedDayTasks}
        todayDate={selectedDate}
      />

      <div className={styles.layout}>
        <main className={styles.timeline}>
          {selectedDayTasks.length > 0 ? (
            <TodayTaskGroup
              onComplete={handleCompleteTask}
              onDefer={handleDeferTask}
              onSnooze={handleSnoozeTask}
              tasks={selectedDayTasks}
              title="Task list"
            />
          ) : (
            <section className={styles.clearDay}>
              <p className={styles.kicker}>Task list</p>
              <h2>No dated tasks for this day</h2>
              <p>
                Watering, harvests, and issue checks still appear above when
                they matter.
              </p>
            </section>
          )}

          <TodayQuickActionsPanel
            onAddManualTask={handleAddManualTask}
            onOpenAction={setActiveQuickAction}
            selectedDate={selectedDate}
          />
        </main>

        <TodaySidebar
          bedCounts={bedCounts}
          onAddSuccession={addSuccession}
          successionRecommendations={successionRecommendations}
        />
      </div>
    </section>
  );
}
