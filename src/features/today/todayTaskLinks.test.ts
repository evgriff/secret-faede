import type { Task } from '../../domain/gardens/GardenRepository';
import { getTaskTargetLink } from './todayTaskLinks';

describe('todayTaskLinks', () => {
  it('routes planting and structure work into selected Plan state', () => {
    expect(
      getTaskTargetLink({
        ...createTask(),
        plantingId: 'tomato-1',
      }),
    ).toEqual({
      label: 'Plan',
      to: '/app/plan?p=tomato-1',
    });

    expect(
      getTaskTargetLink({
        ...createTask(),
        structureId: 'bed-1',
      }),
    ).toEqual({
      label: 'Plan',
      to: '/app/plan?p=bed-1',
    });
  });

  it('routes issue follow-up tasks back to the focused Feed entry', () => {
    expect(
      getTaskTargetLink({
        ...createTask(),
        source: 'manual',
        sourceId: 'issue-1',
      }),
    ).toEqual({
      label: 'Feed',
      to: '/app/feed?entry=journal-issue-1',
    });
  });
});

function createTask(): Task {
  return {
    bedLabel: null,
    completedAtIso: null,
    createdAtIso: '2026-06-21T12:00:00.000Z',
    deferredUntilDate: null,
    dueDate: '2026-06-21',
    gardenId: 'garden-1',
    id: 'task-1',
    notes: '',
    plantingId: null,
    priority: 'medium',
    snoozedUntilDate: null,
    source: 'generated',
    sourceId: null,
    status: 'open',
    structureId: null,
    title: 'Check target',
    type: 'inspect',
  };
}
