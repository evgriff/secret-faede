import type { Task } from '../../domain/gardens/GardenRepository';
import { routePaths } from '../../shared/lib/routes';

export interface TodayTaskTargetLink {
  label: string;
  to: string;
}

export function getTaskTargetLink(task: Task): TodayTaskTargetLink | null {
  if (task.source === 'manual' && task.sourceId) {
    return {
      label: 'Feed',
      to: `${routePaths.feed}?entry=journal-${task.sourceId}`,
    };
  }

  if (task.plantingId) {
    return {
      label: 'Plan',
      to: `${routePaths.plan}?p=${task.plantingId}`,
    };
  }

  if (task.structureId) {
    return {
      label: 'Plan',
      to: `${routePaths.plan}?p=${task.structureId}`,
    };
  }

  return null;
}
