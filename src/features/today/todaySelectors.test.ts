import {
  createDefaultPlanting,
  createDefaultStructure,
  createDefaultGarden,
  type Garden,
  type WeatherSnapshot,
  type Task,
} from '../../domain/gardens/GardenRepository';
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
      createDefaultGarden('user-a'),
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

  it('marks future watering days in the calendar strip when weather data supports an outlook', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'basil-1',
            label: 'Basil',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'basil',
          status: 'growing',
          weeklyWaterNeedInches: 0.9,
        },
      ],
      structures: [
        {
          ...createDefaultStructure({
            id: 'bed-1',
            type: 'raisedBed',
            xFt: 1,
            yFt: 1,
          }),
          label: 'Main bed',
          mulched: true,
        },
      ],
      weatherSnapshots: [createSnapshot()],
    };

    const days = buildCalendarDays(garden, [], '2026-06-21');

    expect(days[1]).toMatchObject({
      count: 1,
      date: '2026-06-22',
      markers: expect.arrayContaining(['watering']),
    });
  });

  it('ignores legacy generated harvest tasks in Today scheduling counts', () => {
    const tasks = [
      createTask({ dueDate: '2026-06-21', id: 'inspect', type: 'inspect' }),
      createTask({ dueDate: '2026-06-21', id: 'harvest', type: 'harvest' }),
    ];

    expect(
      getTasksForSelectedDate(tasks, '2026-06-21', '2026-06-21').map(
        (task) => task.id,
      ),
    ).toEqual(['inspect']);
    expect(
      buildCalendarDays(createDefaultGarden('user-a'), tasks, '2026-06-21')[0],
    ).toMatchObject({ count: 1, date: '2026-06-21' });
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

function createSnapshot(): WeatherSnapshot {
  return {
    alertSummaries: [],
    capturedAtIso: '2026-06-21T11:00:00.000Z',
    conditionSummary: 'Sunny and dry',
    evapotranspirationIn: 0.08,
    forecastDays: Array.from({ length: 14 }, (_, index) => ({
      conditionSummary: 'Sunny and dry',
      date: new Date(Date.UTC(2026, 5, 21 + index)).toISOString().slice(0, 10),
      expectedRainIn: index === 3 ? 0.35 : 0,
      highF: index < 2 ? 88 : 84,
    })),
    forecastRainNext24In: 0,
    forecastRainNext48In: 0,
    frostRisk: 'none',
    gardenId: 'user-a',
    heatRisk: 'watch',
    humidityPercent: 42,
    id: 'weather-1',
    nextRainIso: null,
    observedForDate: '2026-06-21',
    overnightLowF: 60,
    precipitationIn: 0,
    providerDecision: null,
    providerLabel: 'National Weather Service',
    recentPrecipitation72hIn: 0.1,
    source: 'nationalWeatherService',
    temperatureF: 82,
    windMph: 5,
  };
}
