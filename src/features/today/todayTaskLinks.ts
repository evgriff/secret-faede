import type { Task } from '../../domain/gardens/GardenRepository';
import { routePaths } from '../../shared/lib/routes';

export interface TodayTaskTargetLink {
  label: string;
  to: string;
}

export function getTaskTargetLink(task: Task): TodayTaskTargetLink | null {
  if (task.source === 'manual' && task.sourceId) {
    return {
      label: 'Open feed',
      to: `${routePaths.feed}?entry=${encodeURIComponent(`journal-${task.sourceId}`)}`,
    };
  }

  if (task.plantingId) {
    return {
      label: 'Open plot',
      to: routePaths.plan,
    };
  }

  if (task.structureId) {
    return {
      label: 'Open plot',
      to: routePaths.plan,
    };
  }

  return null;
}
