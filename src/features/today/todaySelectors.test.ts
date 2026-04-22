import type { Task } from '../../domain/gardens/GardenRepository';
import {
  buildCalendarDays,
  getCriticalCheckTasks,
  getTasksForSelectedDate,
} from './todaySelectors';

describe('todaySelectors', () => {
  it('keeps overdue work on today while future selections show only that day', () => {
    const tasks = [
      createTask({ dueDate: '2026-06-20', id: 'overdue' }),
      createTask({ dueDate: '2026-06-21', id: 'today' }),
      createTask({ dueDate: '2026-06-23', id: 'future' }),
      createTask({ dueDate: null, id: 'undated' }),
    ];

    expect(
      getTasksForSelectedDate(tasks, '2026-06-21', '2026-06-21').map(
        (task) => task.id,
      ),
    ).toEqual(['overdue', 'today']);
    expect(
      getTasksForSelectedDate(tasks, '2026-06-23', '2026-06-21').map(
        (task) => task.id,
      ),
    ).toEqual(['future']);
  });

  it('counts overdue work in the today calendar cell', () => {
    const days = buildCalendarDays(
      [
        createTask({ dueDate: '2026-06-20', id: 'overdue' }),
        createTask({ dueDate: '2026-06-21', id: 'today' }),
        createTask({ dueDate: '2026-06-22', id: 'tomorrow' }),
      ],
      '2026-06-21',
    );

    expect(days[0]).toMatchObject({ count: 2, date: '2026-06-21' });
    expect(days[1]).toMatchObject({ count: 1, date: '2026-06-22' });
  });

  it('pulls high-priority and field-check task types into critical checks', () => {
    const critical = getCriticalCheckTasks([
      createTask({ id: 'inspect', priority: 'medium', type: 'inspect' }),
      createTask({ id: 'trellis', priority: 'low', type: 'trellis' }),
      createTask({ id: 'urgent-water', priority: 'high', type: 'water' }),
      createTask({ id: 'normal-water', priority: 'medium', type: 'water' }),
    ]);

    expect(critical.map((task) => task.id)).toEqual([
      'inspect',
      'trellis',
      'urgent-water',
    ]);
  });
});

function createTask(overrides: Partial<Task>): Task {
  return {
    bedLabel: 'Main bed',
    completedAtIso: null,
    createdAtIso: '2026-06-21T12:00:00.000Z',
    deferredUntilDate: null,
    dueDate: '2026-06-21',
    gardenId: 'garden-a',
    id: 'task-a',
    notes: 'Task reason.',
    plantingId: null,
    priority: 'medium',
    snoozedUntilDate: null,
    source: 'generated',
    sourceId: null,
    status: 'open',
    structureId: null,
    title: 'Field task',
    type: 'other',
    ...overrides,
  };
}
