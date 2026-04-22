'use strict';

const {
  addDays,
  formatLocalDate,
  getGardenTimezone,
  sortTasks,
} = require('./operationTime');

function buildAutomatedTasks(garden, snapshot, now) {
  const today = formatLocalDate(now, getGardenTimezone(garden));
  const tasks = [
    ...buildWaterTasks(garden, now),
    ...buildWeatherTasks(garden, snapshot, today, now),
    ...buildPlantingTasks(garden, today, now),
  ];

  return sortTasks(tasks);
}

function mergeTasks(existing, generated) {
  const generatedById = new Map(generated.map((task) => [task.id, task]));
  const merged = existing.map((task) => {
    const generatedTask = generatedById.get(task.id);

    if (
      !generatedTask ||
      task.status !== 'open' ||
      task.snoozedUntilDate ||
      task.deferredUntilDate
    ) {
      return task;
    }

    return {
      ...generatedTask,
      completedAtIso: task.completedAtIso || null,
      createdAtIso: task.createdAtIso || generatedTask.createdAtIso,
      status: task.status,
    };
  });
  const existingIds = new Set(existing.map((task) => task.id));

  return sortTasks([
    ...merged,
    ...generated.filter((task) => !existingIds.has(task.id)),
  ]);
}

function buildWaterTasks(garden, now) {
  return (garden.waterRecommendations || []).flatMap((recommendation) => {
    if (
      !['active', 'new', 'accepted'].includes(recommendation.status) ||
      recommendation.recommendedWaterInches <= 0
    ) {
      return [];
    }

    return [
      createTask(
        {
          bedLabel: recommendation.targetLabel,
          dueDate: recommendation.recommendationDate,
          gardenId: garden.id,
          id: `water-${recommendation.id}`,
          notes: (recommendation.rationale || []).join(' '),
          plantingId: recommendation.plantingId || null,
          priority: recommendation.urgency === 'high' ? 'high' : 'medium',
          source: 'waterRecommendation',
          sourceId: recommendation.id,
          title: `Water ${recommendation.targetLabel}`,
          type: 'water',
        },
        now,
      ),
    ];
  });
}

function buildWeatherTasks(garden, snapshot, today, now) {
  const tasks = [];

  if (snapshot.frostRisk !== 'none') {
    tasks.push(
      createTask(
        {
          bedLabel: null,
          dueDate: today,
          gardenId: garden.id,
          id: `weather-frost-${today}`,
          notes:
            'Frost guidance is weather-based. Check sensitive crops and use row cover or containers as needed.',
          plantingId: null,
          priority: snapshot.frostRisk === 'warning' ? 'high' : 'medium',
          source: 'generated',
          sourceId: snapshot.id,
          title: 'Prep for frost risk',
          type: 'other',
        },
        now,
      ),
    );
  }

  if (snapshot.heatRisk !== 'none') {
    tasks.push(
      createTask(
        {
          bedLabel: null,
          dueDate: today,
          gardenId: garden.id,
          id: `weather-heat-${today}`,
          notes:
            'Heat guidance is forecast-based. Water early and check containers or shallow beds first.',
          plantingId: null,
          priority: snapshot.heatRisk === 'warning' ? 'high' : 'medium',
          source: 'generated',
          sourceId: snapshot.id,
          title: 'Prep for heat stress',
          type: 'inspect',
        },
        now,
      ),
    );
  }

  return tasks;
}

function buildPlantingTasks(garden, today, now) {
  return (garden.plantings || []).flatMap((planting) => {
    if (planting.status === 'removed') {
      return [];
    }

    const tasks = [];

    if (planting.plannedFor && planting.plannedFor <= addDays(today, 7)) {
      tasks.push(
        createTask(
          {
            bedLabel: getBedLabel(garden, planting),
            dueDate: planting.plannedFor,
            gardenId: garden.id,
            id: `planting-${planting.id}-plant`,
            notes: 'Backend scheduled from the saved planned date.',
            plantingId: planting.id,
            priority: 'medium',
            source: 'generated',
            sourceId: planting.id,
            title: `Plant ${planting.label}`,
            type: 'plant',
          },
          now,
        ),
      );
    }

    if (['harvest-ready', 'harvested'].includes(planting.status)) {
      tasks.push(
        createTask(
          {
            bedLabel: getBedLabel(garden, planting),
            dueDate: today,
            gardenId: garden.id,
            id: `succession-review-${planting.id}-${today}`,
            notes:
              'Review whether this bed can hold a follow-on crop. This is practical timing guidance, not a precision claim.',
            plantingId: planting.id,
            priority: 'medium',
            source: 'succession',
            sourceId: planting.id,
            title: `Review succession after ${planting.label}`,
            type: 'sow',
          },
          now,
        ),
      );
    }

    return tasks;
  });
}

function createTask(input, now) {
  return {
    bedLabel: input.bedLabel,
    completedAtIso: null,
    createdAtIso: now.toISOString(),
    deferredUntilDate: null,
    dueDate: input.dueDate,
    gardenId: input.gardenId,
    id: input.id,
    notes: input.notes,
    plantingId: input.plantingId,
    priority: input.priority,
    snoozedUntilDate: null,
    source: input.source,
    sourceId: input.sourceId,
    status: 'open',
    structureId: input.structureId || null,
    title: input.title,
    type: input.type,
  };
}

function getBedLabel(garden, planting) {
  return (
    (garden.structures || []).find((structure) =>
      isPointInsideStructure(planting.xFt, planting.yFt, structure),
    )?.label || 'Open plot'
  );
}

function isPointInsideStructure(xFt, yFt, structure) {
  return (
    xFt >= structure.xFt &&
    xFt <= structure.xFt + structure.widthFt &&
    yFt >= structure.yFt &&
    yFt <= structure.yFt + structure.depthFt
  );
}

module.exports = {
  buildAutomatedTasks,
  mergeTasks,
};
