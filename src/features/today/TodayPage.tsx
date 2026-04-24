import { useMemo, useState } from 'react';

import { useServices } from '../../app/providers';
import { useNetworkStatus } from '../../shared/network/networkStatus';
import { LoadingState } from '../../shared/ui/LoadingState';
import {
  addManualTask,
  completeTask,
  deferTask,
  snoozeTask,
  sortTasks,
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
import { TodayTaskGroup } from './components/TodayTaskGroup';
import {
  TodayWateringSheet,
  type TodayWateringSheetState,
} from './components/TodayWateringSheet';
import {
  addFieldNote,
  adjustWateringAmount,
  createTodayId,
  logFieldHarvest,
  logPartialWatering,
  markWaterDone,
  reportFieldIssue,
  skipWateringBecauseRainArrived,
  snoozeWatering,
  updateIssueStatus,
} from './todayActions';
import { toLocalDate } from './todayFormatters';
import { buildTodayFieldModel } from './todayFieldModel';
import { markPlantingLifecycle } from './todayLifecycleActions';
import { delayHarvestReminderWithLocalNotification } from './todayLocalNotifications';
import {
  buildCalendarDays,
  buildTodayTargetOptions,
  getTasksForSelectedDate,
  getTodayTarget,
  isScheduledWateringTask,
} from './todaySelectors';
import { useTodayGarden } from './useTodayGarden';
import styles from './TodayPage.module.css';

export function TodayPage() {
  const { mobileDeviceService, telemetryService } = useServices();
  const networkStatus = useNetworkStatus();
  const [activeQuickAction, setActiveQuickAction] =
    useState<TodayQuickActionState | null>(null);
  const [activeWateringAction, setActiveWateringAction] =
    useState<TodayWateringSheetState | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    id: number;
    message: string;
    tone: 'success' | 'warning';
  } | null>(null);
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
    refreshWeatherAndWatering,
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
  const selectedDayFieldTasks = useMemo(
    () => selectedDayTasks.filter((task) => !isScheduledWateringTask(task)),
    [selectedDayTasks],
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(openTasks, todayDate),
    [openTasks, todayDate],
  );
  const targetOptions = useMemo(
    () => (garden ? buildTodayTargetOptions(garden) : []),
    [garden],
  );
  const fieldModel = useMemo(
    () =>
      garden
        ? buildTodayFieldModel(garden, openTasks, selectedDate, today)
        : null,
    [garden, openTasks, selectedDate, today],
  );

  function openQuickAction(action: TodayQuickActionState) {
    setActiveWateringAction(null);
    setActiveQuickAction(action);
  }

  function openWateringAction(action: TodayWateringSheetState) {
    setActiveQuickAction(null);
    setActiveWateringAction(action);
  }

  function showActionNotice(
    message: string,
    tone: 'success' | 'warning' = 'success',
  ) {
    setActionNotice({ id: Date.now(), message, tone });
  }

  async function handleAddManualTask(input: TodayManualTaskInput) {
    const saved = await applyGardenUpdate((current) =>
      addManualTask(current, input),
    );

    if (saved) {
      showActionNotice('Manual task added.');
    }

    return saved;
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
      { refreshWateringFromSnapshot: true },
    );

    if (saved) {
      telemetryService.trackEvent('note_added', { source: 'today' });
      showActionNotice('Field note saved to Feed.');
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
      showActionNotice(
        'Issue saved in Feed and follow-up task created.',
        'warning',
      );
    }

    return saved;
  }
  async function handleQuickHarvestSubmit(input: QuickHarvestSubmit) {
    const saved = await applyGardenUpdate(
      (current) => logFieldHarvest(current, input),
      'Unable to log.',
      { refreshWateringFromSnapshot: true },
    );

    if (saved) {
      showActionNotice(
        'Harvest saved to Feed. Add a photo if it helps the memory.',
      );
      setActiveQuickAction({
        kind: 'photo',
        targetId: input.plantingId ? `planting:${input.plantingId}` : 'garden',
      });
    }

    return saved;
  }

  function handleLogHarvestDone(item: { planting: { id: string } }) {
    void handleQuickHarvestSubmit({
      amountText: 'Picked',
      cropFinished: false,
      harvestedOn: selectedDate,
      notes: '',
      plantingId: item.planting.id,
      quantity: null,
      unit: 'freeform',
    });
  }
  async function handleCapturePhoto() {
    try {
      return await mobileDeviceService.capturePhoto();
    } catch {
      return null;
    }
  }

  function handleCompleteTask(taskId: string) {
    const wateringTask = garden?.tasks.find(
      (task) =>
        task.id === taskId &&
        task.type === 'water' &&
        task.source === 'wateringSchedule' &&
        Boolean(task.sourceId),
    );

    void applyGardenUpdate((current) => {
      const task = current.tasks.find((candidate) => candidate.id === taskId);

      if (
        task?.type === 'water' &&
        task.source === 'wateringSchedule' &&
        task.sourceId
      ) {
        return markWaterDone(current, task.sourceId);
      }

      const updated = completeTask(current, taskId);

      if (task) {
        telemetryService.trackEvent('task_completed', {
          source: task.source,
          task_type: task.type,
        });
      }

      return updated;
    }).then((saved) => {
      if (saved) {
        showActionNotice(
          wateringTask ? 'Watering logged in Feed.' : 'Task completed.',
        );
      }
    });
  }

  function handleSnoozeTask(taskId: string) {
    void applyGardenUpdate((current) => snoozeTask(current, taskId, 1)).then(
      (saved) => {
        if (saved) {
          showActionNotice('Task snoozed until tomorrow.');
        }
      },
    );
  }

  function handleDeferTask(taskId: string) {
    void applyGardenUpdate((current) => deferTask(current, taskId, 7)).then(
      (saved) => {
        if (saved) {
          showActionNotice('Task deferred one week.');
        }
      },
    );
  }

  function handleUpdateIssue(
    entryId: string,
    status: Parameters<typeof updateIssueStatus>[2],
  ) {
    void applyGardenUpdate(
      (current) => updateIssueStatus(current, entryId, status),
      'Unable to update issue.',
    ).then((saved) => {
      if (saved) {
        showActionNotice(`Issue marked ${status}.`);
      }
    });
  }

  function handleUpdatePlantingStatus(
    plantingId: string,
    status: Parameters<typeof markPlantingLifecycle>[2],
  ) {
    void applyGardenUpdate(
      (current) => markPlantingLifecycle(current, plantingId, status),
      'Unable to update crop status.',
      { refreshWateringFromSnapshot: true },
    ).then((saved) => {
      if (saved) {
        showActionNotice('Crop status updated.');
      }
    });
  }

  function handleWaterDone(recommendationId: string) {
    void applyGardenUpdate(
      (current) => markWaterDone(current, recommendationId),
      'Unable to save watering.',
    ).then((saved) => {
      if (saved) {
        setActiveWateringAction(null);
        telemetryService.trackEvent('task_completed', {
          source: 'watering_recommendation',
          task_type: 'water',
        });
        showActionNotice('Watering logged in Feed.');
      }
    });
  }

  async function handlePartialWatering(
    recommendationId: string,
    amountInches: number,
  ) {
    const saved = await applyGardenUpdate(
      (current) =>
        logPartialWatering(current, recommendationId, { amountInches }),
      'Unable to save partial watering.',
    );

    if (saved) {
      setActiveWateringAction(null);
      showActionNotice('Partial watering logged in Feed.');
    }

    return saved;
  }

  function handleSkipWateringForRain(recommendationId: string) {
    void applyGardenUpdate(
      (current) => skipWateringBecauseRainArrived(current, recommendationId),
      'Unable to skip watering.',
    ).then((saved) => {
      if (saved) {
        setActiveWateringAction(null);
        showActionNotice('Skipped watering saved in Feed.');
      }
    });
  }

  function handleSnoozeWatering(
    recommendationId: string,
    option: 'tonight' | 'tomorrow',
  ) {
    void applyGardenUpdate(
      (current) => snoozeWatering(current, recommendationId, option),
      'Unable to move watering.',
    ).then((saved) => {
      if (saved) {
        setActiveWateringAction(null);
        showActionNotice(
          option === 'tomorrow'
            ? 'Watering moved to tomorrow.'
            : 'Watering moved to tonight.',
        );
      }
    });
  }

  async function handleAdjustWateringAmount(
    recommendationId: string,
    amountInches: number,
  ) {
    const saved = await applyGardenUpdate(
      (current) =>
        adjustWateringAmount(current, recommendationId, amountInches),
      'Unable to update the watering amount.',
    );

    if (saved) {
      setActiveWateringAction(null);
      showActionNotice('Remaining watering amount updated.');
    }

    return saved;
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
    }).then((saved) => {
      if (saved) {
        showActionNotice('Harvest reminder rescheduled.');
      }
    });
  }

  const handleRefreshWeatherAndWatering = () =>
    void refreshWeatherAndWatering().then((saved) => {
      if (saved) {
        showActionNotice('Weather and watering schedule refreshed.');
      }
    });

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
        onRefreshWeatherAndWatering={handleRefreshWeatherAndWatering}
        saveStatus={saveStatus}
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
      <TodayWateringSheet
        action={activeWateringAction}
        onAdjustAmount={handleAdjustWateringAmount}
        onClose={() => setActiveWateringAction(null)}
        onSubmitPartial={handlePartialWatering}
        recommendation={
          activeWateringAction
            ? (garden.wateringSchedule.find(
                (candidate) =>
                  candidate.id === activeWateringAction.recommendationId,
              ) ?? null)
            : null
        }
      />

      {actionNotice ? (
        <p
          aria-live="polite"
          className={`${styles.actionNotice} ${
            actionNotice.tone === 'warning' ? styles.actionNoticeWarning : ''
          }`}
          key={actionNotice.id}
          role="status"
        >
          {actionNotice.message}
        </p>
      ) : null}

      <TodayCalendarStrip
        days={calendarDays}
        onSelectDate={setSelectedDate}
        selectedDate={selectedDate}
        todayDate={todayDate}
      />

      <TodayDayOverview
        model={fieldModel}
        onCompleteTask={handleCompleteTask}
        onLogHarvest={handleLogHarvestDone}
        onUpdateIssue={handleUpdateIssue}
        onUpdatePlantingStatus={handleUpdatePlantingStatus}
        onWaterDone={handleWaterDone}
        selectedDate={selectedDate}
        selectedTasks={selectedDayFieldTasks}
      />

      <TodayFieldPanels
        model={fieldModel}
        onCompleteTask={handleCompleteTask}
        onDeferTask={handleDeferTask}
        onDelayHarvest={handleDelayHarvest}
        onLogHarvest={handleLogHarvestDone}
        onAdjustWateringAmount={(recommendationId) =>
          openWateringAction({ mode: 'adjust', recommendationId })
        }
        onOpenAction={openQuickAction}
        onPartialWatering={(recommendationId) =>
          openWateringAction({ mode: 'partial', recommendationId })
        }
        onSkipWateringForRain={handleSkipWateringForRain}
        onSnoozeWatering={handleSnoozeWatering}
        onSnoozeTask={handleSnoozeTask}
        onUpdatePlantingStatus={handleUpdatePlantingStatus}
        onUpdateIssue={handleUpdateIssue}
        onWaterDone={handleWaterDone}
        selectedTasks={selectedDayFieldTasks}
        todayDate={selectedDate}
      />

      <div className={styles.layout}>
        <main className={styles.timeline}>
          {selectedDayFieldTasks.length > 0 ? (
            <TodayTaskGroup
              onComplete={handleCompleteTask}
              onDefer={handleDeferTask}
              onSnooze={handleSnoozeTask}
              tasks={selectedDayFieldTasks}
              title="Checks and other work"
            />
          ) : (
            <section className={styles.clearDay}>
              <p className={styles.kicker}>Checks and other work</p>
              <h2>No dated tasks for this day</h2>
              <p>
                Watering, harvests, and issue checks still appear above when
                they matter.
              </p>
            </section>
          )}

          <TodayQuickActionsPanel
            onAddManualTask={handleAddManualTask}
            onOpenAction={openQuickAction}
            selectedDate={selectedDate}
          />
        </main>
      </div>
    </section>
  );
}
