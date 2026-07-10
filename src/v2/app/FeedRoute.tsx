import { useMemo } from 'react';

import { useV2Auth } from './AuthProvider';
import { useV2Workspace } from './WorkspaceProvider';
import { getGardenDate } from '../domain/time';
import {
  getPlantingGroupLabel,
  type CommitOutcome,
  type GardenIssue,
  type GardenOperationsSnapshot,
  type GardenPlan,
  type JournalEntry,
  type PhotoAttachment,
} from '../domain';
import {
  FeedPage,
  type FeedCreateEntryInput,
  type FeedCorrectWateringInput,
  type FeedTargetOption,
  type FeedWateringActivity,
} from '../routes/feed';
import { RouteLink } from './RouterLinks';
import { usePhotoUrls } from './usePhotoUrls';
import { useV2Runtime } from './RuntimeProvider';
import { useV2Services } from './V2ServicesContext';
import { correctWaterApplication } from './wateringApplicationRecords';

export function FeedRoute() {
  const auth = useV2Auth();
  const workspace = useV2Workspace();
  const services = useV2Services();
  const runtime = useV2Runtime();
  const plan = workspace.workspace?.published.plan ?? null;
  const operations = workspace.workspace?.operations;
  const targets = useMemo(() => (plan ? feedTargets(plan) : []), [plan]);
  const photos = operations?.journal.flatMap((entry) => entry.photos) ?? [];
  const photoUrls = usePhotoUrls(photos);
  const wateringActivity = useMemo(
    () => buildWateringActivity(targets, operations),
    [operations, targets],
  );

  if (!auth.user || !plan || !workspace.profile || !operations) {
    return (
      <FeedPage
        LinkComponent={RouteLink}
        currentUserId="loading"
        harvests={[]}
        isOnline={runtime.isOnline}
        journalEntries={[]}
        loadState="loading"
        onCreateEntry={async () => 'saved'}
        targets={[]}
        timezone="UTC"
        today="1970-01-01"
      />
    );
  }

  async function createEntry(input: FeedCreateEntryInput) {
    const id = `${input.kind}-${crypto.randomUUID()}`;
    if (input.kind === 'harvest') {
      const notes = [input.freeformAmount, input.notes]
        .filter(Boolean)
        .join(' · ');
      return outcomeResult(
        await workspace.recordHarvest({
          amount: input.amount,
          createdAtIso: new Date().toISOString(),
          createdByUserId: auth.user!.uid,
          cropId: input.cropId,
          id,
          notes,
          occurredOn: input.occurredOn,
          plantingGroupId: input.plantingGroupId,
          unit: input.unit,
        }),
      );
    }
    if (input.files.length > 12) {
      throw new Error('Add no more than 12 photos to one garden entry.');
    }
    for (const file of input.files) {
      if (file.size <= 0 || file.size >= 10 * 1024 * 1024) {
        throw new Error(
          `${file.name || 'A photo'} must be smaller than 10 MB.`,
        );
      }
      if (!/^image\/(?:jpeg|png|webp|heic|heif)$/i.test(file.type)) {
        throw new Error(
          `${file.name || 'A photo'} must be JPEG, PNG, WebP, HEIC, or HEIF.`,
        );
      }
    }
    const uploaded = await Promise.all(
      input.files.map(async (file) => {
        const photo = await services.mediaStorageService.uploadJournalPhoto({
          entryId: id,
          file,
          gardenId: plan!.id,
          userId: auth.user!.uid,
        });
        photoUrls.rememberPhotoUrl(photo.storagePath, photo.downloadUrl);
        return {
          contentType: photo.contentType,
          fileName: photo.fileName,
          height: null,
          id: photo.id,
          sizeBytes: photo.sizeBytes,
          storagePath: photo.storagePath,
          uploadedAtIso: photo.uploadedAtIso,
          width: null,
        } satisfies PhotoAttachment;
      }),
    );
    const base: JournalEntry = {
      body: input.body,
      createdAtIso: new Date().toISOString(),
      createdByUserId: auth.user!.uid,
      id,
      occurredOn: input.occurredOn,
      photos: uploaded,
      target: input.target,
      title: input.title,
      type: input.kind === 'photo' ? 'photo' : 'note',
    };
    const entry: JournalEntry | GardenIssue =
      input.kind === 'issue'
        ? {
            ...base,
            ...input.issue,
            resolvedAtIso:
              input.issue.status === 'resolved'
                ? new Date().toISOString()
                : null,
            type: 'issue',
          }
        : base;
    return outcomeResult(await workspace.recordJournal(entry));
  }

  async function correctWatering(input: FeedCorrectWateringInput) {
    const original = operations!.waterApplications.find(
      (application) => application.id === input.applicationId,
    );
    if (!original) {
      throw new Error('The watering record no longer exists.');
    }
    const recommendation = operations!.wateringRecommendations.find(
      (item) => item.target.cropGroupId === original.cropGroupId,
    );
    const corrected = correctWaterApplication({
      area: recommendation?.basis.area,
      input,
      nowIso: new Date().toISOString(),
      original,
      timezone: plan!.plot.location.timezone,
    });
    const saved = await workspace.recordWater(corrected);
    if (
      saved?.status === 'committed' &&
      services.environment.runtimeMode === 'firebase'
    ) {
      void services.gardenOperationsService
        .refreshGardenOperations(auth.user!.uid)
        .catch(() => undefined);
    }
    return outcomeResult(saved);
  }

  return (
    <FeedPage
      LinkComponent={RouteLink}
      currentUserId={auth.user.uid}
      {...(workspace.error ? { errorMessage: workspace.error.message } : {})}
      getPhotoUrl={photoUrls.getPhotoUrl}
      harvests={operations.harvests}
      isOnline={runtime.isOnline}
      journalEntries={operations.journal}
      loadState={workspace.loadState}
      onCreateEntry={createEntry}
      onCorrectWatering={correctWatering}
      onRetry={workspace.reload}
      onUpdateIssue={async (issue) =>
        outcomeResult(await workspace.recordJournal(issue))
      }
      targets={targets}
      timezone={plan.plot.location.timezone}
      today={getGardenDate(
        new Date().toISOString(),
        plan.plot.location.timezone,
      )}
      wateringActivity={wateringActivity}
    />
  );
}

function feedTargets(plan: GardenPlan) {
  const garden: FeedTargetOption = {
    cropId: null,
    deepLink: '/app/plan',
    target: { id: null, kind: 'garden', label: plan.name },
    value: 'garden',
  };
  return [
    garden,
    ...plan.structures.map((structure) => ({
      cropId: null,
      deepLink: `/app/plan?structureId=${encodeURIComponent(structure.id)}`,
      target: {
        id: structure.id,
        kind: 'structure' as const,
        label: structure.label,
      },
      value: `structure:${structure.id}`,
    })),
    ...plan.plantings.map((group) => ({
      cropId: group.cropId,
      deepLink: `/app/plan?plantingId=${encodeURIComponent(group.id)}`,
      target: {
        id: group.id,
        kind: 'plantingGroup' as const,
        label: getPlantingGroupLabel(plan, group),
      },
      value: `planting:${group.id}`,
    })),
  ];
}

function buildWateringActivity(
  targets: readonly FeedTargetOption[],
  operations: GardenOperationsSnapshot | undefined,
): FeedWateringActivity[] {
  if (!operations) return [];
  const options = new Map(targets.map((target) => [target.target.id, target]));
  return [
    ...operations.waterApplications.flatMap((application) => {
      const target = options.get(application.cropGroupId);
      return target
        ? [
            {
              application,
              cropName: target.target.label,
              kind: 'application' as const,
              target,
            },
          ]
        : [];
    }),
    ...operations.wateringRecommendations.map((recommendation) => ({
      kind: 'recommendation' as const,
      recommendation,
    })),
  ];
}

function outcomeResult(outcome: CommitOutcome | null) {
  if (!outcome) throw new Error('The garden entry did not save.');
  if (outcome.status === 'conflict') throw new Error('The saved plan changed.');
  return outcome.status === 'queued' ? ('queued' as const) : ('saved' as const);
}
