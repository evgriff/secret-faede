import type { AutoLayoutRunStatus } from './autoLayoutTypes';

export type AutoLayoutBusyStatus =
  | 'collectingConstraints'
  | 'generatingSuggestion'
  | 'preparingPreview'
  | 'savingDraft'
  | 'validatingSuggestion';

export interface AutoLayoutStageDefinition {
  description: string;
  label: string;
  status: AutoLayoutBusyStatus;
}

const allBusyStages: AutoLayoutStageDefinition[] = [
  {
    description: 'Store the current draft before checking another arrangement.',
    label: 'Saving draft',
    status: 'savingDraft',
  },
  {
    description: 'Gather the current spacing, access, and support constraints.',
    label: 'Collecting constraints',
    status: 'collectingConstraints',
  },
  {
    description: 'Search for one clearer full-plot arrangement.',
    label: 'Generating suggestion',
    status: 'generatingSuggestion',
  },
  {
    description: 'Check that the suggestion still clears must-fix issues.',
    label: 'Validating suggestion',
    status: 'validatingSuggestion',
  },
  {
    description: 'Build the before-and-after preview for review.',
    label: 'Preparing preview',
    status: 'preparingPreview',
  },
];

const busyStatuses = new Set<AutoLayoutRunStatus>(
  allBusyStages.map((stage) => stage.status),
);

export function isAutoLayoutBusy(status: AutoLayoutRunStatus) {
  return busyStatuses.has(status);
}

export function getAutoLayoutButtonLabel(
  status: AutoLayoutRunStatus,
  hasSuggestion: boolean,
) {
  switch (status) {
    case 'savingDraft':
      return 'Saving draft...';
    case 'collectingConstraints':
      return 'Checking constraints...';
    case 'generatingSuggestion':
      return 'Generating layout...';
    case 'validatingSuggestion':
      return 'Validating layout...';
    case 'preparingPreview':
      return 'Preparing preview...';
    default:
      return hasSuggestion ? 'Check again' : 'Generate layout';
  }
}

export function getVisibleAutoLayoutStages(includeDraftSave: boolean) {
  return includeDraftSave
    ? allBusyStages
    : allBusyStages.filter((stage) => stage.status !== 'savingDraft');
}

export function getAutoLayoutStageState(
  status: AutoLayoutRunStatus,
  stage: AutoLayoutBusyStatus,
) {
  const currentIndex = allBusyStages.findIndex(
    (candidateStage) => candidateStage.status === status,
  );
  const stageIndex = allBusyStages.findIndex(
    (candidateStage) => candidateStage.status === stage,
  );

  if (currentIndex === -1 || stageIndex === -1) {
    return 'pending';
  }

  if (currentIndex === stageIndex) {
    return 'active';
  }

  return currentIndex > stageIndex ? 'complete' : 'pending';
}

export async function allowAutoLayoutStagePaint() {
  await new Promise<void>((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }

    window.requestAnimationFrame(() => resolve());
  });

  const delayMs = readAutoLayoutStageDelayMs();

  if (delayMs > 0) {
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }
}

function readAutoLayoutStageDelayMs(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  const windowDelay = readWindowAutoLayoutStageDelayMs(window);

  if (windowDelay > 0) {
    return windowDelay;
  }

  const rawDelay = window.localStorage.getItem(
    'secret-faeries:auto-layout-stage-delay-ms',
  );
  const delayMs = Number.parseInt(rawDelay ?? '0', 10);

  return Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
}

function readWindowAutoLayoutStageDelayMs(
  currentWindow: Window & {
    __secretFaeriesAutoLayoutStageDelayMs?: number;
  },
): number {
  const delayMs = currentWindow.__secretFaeriesAutoLayoutStageDelayMs ?? 0;

  return Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
}
