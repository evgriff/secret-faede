'use strict';

const { addDays, formatLocalDate } = require('./operationTime');
const { getCropGroupLabel } = require('./wateringV2Support');

const ACTIVE_LIFECYCLES = new Set(['planted', 'growing', 'harvestReady']);
const DENSE_ARRANGEMENTS = new Set(['block', 'cluster', 'row']);
const HEAVY_FEEDER_PATTERN =
  /tomato|pepper|eggplant|cucumber|squash|pumpkin|melon|corn|broccoli|cabbage|cauliflower|brassica/i;
const SUPPORT_PATTERN = /tomato|cucumber|bean|pea|melon|squash/i;
const TRAINING_PATTERN = /tomato|cucumber|melon|squash/i;
const SUCCESSION_PATTERN =
  /lettuce|radish|spinach|arugula|cilantro|beet|carrot|bean|pea/i;

function buildAutomatedTasks(plan, recommendations, snapshot, now) {
  const today = formatLocalDate(now, plan.plot.location.timezone);
  return [
    ...buildPlanTasks(plan, today, now),
    ...buildWateringTasks(recommendations, today, now),
    ...buildWeatherTasks(plan, snapshot, today, now),
  ].sort(compareTasks);
}

function buildPlanTasks(plan, today, now) {
  const structures = new Map(
    plan.structures.map((structure) => [structure.id, structure]),
  );
  return plan.plantings.flatMap((planting) => {
    const structure = planting.growingAreaStructureId
      ? structures.get(planting.growingAreaStructureId) || null
      : null;
    const context = {
      label: getCropGroupLabel(plan, planting),
      planId: plan.id,
      planting,
      structure,
      target: {
        id: planting.id,
        kind: 'plantingGroup',
        label: getCropGroupLabel(plan, planting),
      },
    };
    return tasksForPlanting(context, today, now);
  });
}

function tasksForPlanting(context, today, now) {
  const { planting } = context;
  if (planting.lifecycle === 'planned') {
    if (!isLocalDate(planting.plannedFor)) {
      return [confirmDateTask(context, 'plannedFor', today, now)];
    }
    return [
      planTask(
        context,
        'plant',
        planting.plannedFor,
        {
          dueOn: planting.plannedFor,
          kind: 'plant',
          notes: 'Use saved spacing, arrangement, and placement.',
          priority: planting.plannedFor <= today ? 'high' : 'medium',
          reason: `The saved plan schedules ${context.label} for ${planting.plannedFor}.`,
          title: `Plant ${context.label}`,
        },
        now,
      ),
    ];
  }
  if (!ACTIVE_LIFECYCLES.has(planting.lifecycle)) return [];

  const tasks = [];
  const plantedOn = isLocalDate(planting.plantedOn) ? planting.plantedOn : null;
  if (!plantedOn) {
    tasks.push(confirmDateTask(context, 'plantedOn', today, now));
  }
  if (planting.lifecycle === 'planted' && plantedOn) {
    tasks.push(
      scheduledTask(
        context,
        'establishment',
        plantedOn,
        7,
        {
          kind: 'inspect',
          notes: 'Check survival, new growth, spacing, and transplant stress.',
          priority: 'medium',
          reason: `${context.label} was recorded as planted on ${plantedOn}; inspect establishment after its first week.`,
          title: `Inspect establishment for ${context.label}`,
        },
        now,
      ),
    );
  }
  if (
    ['planted', 'growing'].includes(planting.lifecycle) &&
    plantedOn &&
    DENSE_ARRANGEMENTS.has(planting.arrangement)
  ) {
    tasks.push(
      scheduledTask(
        context,
        'thin',
        plantedOn,
        14,
        {
          kind: 'thin',
          notes: `Use the saved ${planting.spacingInches} in spacing as the field check.`,
          priority: 'medium',
          reason: `${context.label} uses a ${planting.arrangement} arrangement and was planted on ${plantedOn}.`,
          title: `Thin ${context.label}`,
        },
        now,
      ),
    );
  }
  if (planting.lifecycle === 'growing' && plantedOn) {
    const cropEvidence = `${planting.cropId} ${planting.cropName}`;
    const trellised = planting.arrangement === 'trellisLine';
    const rules = [
      {
        applies: trellised || SUPPORT_PATTERN.test(cropEvidence),
        category: 'support',
        days: 21,
        kind: 'support',
        notes: 'Check ties, stems, trellis clearance, and wind stability.',
        priority: 'medium',
        reason: `${context.label} is saved as a crop or arrangement that needs support checks.`,
        title: `Support ${context.label}`,
      },
      {
        applies: trellised || TRAINING_PATTERN.test(cropEvidence),
        category: 'train',
        days: 28,
        kind: 'prune',
        notes: 'Train healthy growth; remove only damaged growth.',
        priority: 'low',
        reason: `${context.label} is saved as a crop or arrangement that benefits from training.`,
        title: `Prune or train ${context.label}`,
      },
      {
        applies:
          context.structure?.type === 'container' ||
          HEAVY_FEEDER_PATTERN.test(cropEvidence),
        category: 'fertilize',
        days: 28,
        kind: 'fertilize',
        notes: 'Inspect growth and soil before applying a measured amendment.',
        priority: 'low',
        reason: `${context.label} is saved as a container or crop that merits an in-season feeding check.`,
        title: `Check feeding needs for ${context.label}`,
      },
    ];
    tasks.push(
      ...rules
        .filter((rule) => rule.applies)
        .map(({ applies, category, days, ...input }) =>
          scheduledTask(context, category, plantedOn, days, input, now),
        ),
    );
  }
  if (!(planting.mulched || context.structure?.mulched === true)) {
    tasks.push(
      planTask(
        context,
        'mulch',
        plantedOn || planting.lifecycle,
        {
          dueOn: today,
          kind: 'mulch',
          notes: 'Confirm moist soil, then mulch without touching stems.',
          priority: 'low',
          reason: `Neither ${context.label} nor its saved growing area is marked as mulched.`,
          title: `Mulch ${context.label}`,
        },
        now,
      ),
    );
  }
  if (planting.lifecycle === 'harvestReady') {
    tasks.push(
      planTask(
        context,
        'harvest',
        plantedOn || 'harvestReady',
        {
          dueOn: today,
          kind: 'harvest',
          notes: 'Harvest what is ready and record the amount in Feed.',
          priority: 'high',
          reason: `${context.label} is explicitly marked harvest ready in the saved plan.`,
          title: `Harvest ${context.label}`,
        },
        now,
      ),
    );
  }
  const cropEvidence = `${planting.cropId} ${planting.cropName}`;
  if (
    ['growing', 'harvestReady'].includes(planting.lifecycle) &&
    SUCCESSION_PATTERN.test(cropEvidence)
  ) {
    tasks.push(
      planTask(
        context,
        'succession',
        plantedOn || planting.lifecycle,
        {
          dueOn: today,
          kind: 'plant',
          notes: 'Review plot space and choose a deliberate next sowing date.',
          priority: 'low',
          reason: `${context.label} is an active succession-suitable crop in the saved plan.`,
          title: `Plan a succession sowing for ${context.label}`,
        },
        now,
      ),
    );
  }
  return tasks;
}

function buildWateringTasks(recommendations, today, now) {
  return recommendations.flatMap((recommendation) => {
    if (!recommendation.actionable) return [];
    const checkSoil = recommendation.status === 'checkSoil';
    const label =
      recommendation.target.cropGroupLabel || recommendation.target.cropName;
    return [
      createTask(
        {
          dueOn: today,
          id: `task:${recommendation.id}`,
          kind: checkSoil ? 'inspect' : 'water',
          notes: recommendation.reasonDetails
            .map((detail) => detail.message)
            .join(' '),
          priority:
            recommendation.confidence === 'low' || checkSoil
              ? 'medium'
              : recommendation.recommendedDepthInches >= 0.75
                ? 'high'
                : 'medium',
          reason: checkSoil
            ? 'Weather or crop context needs a physical soil check.'
            : 'Crop-specific root-zone depletion reached its threshold.',
          sourceId: recommendation.id,
          target: {
            id: recommendation.target.cropGroupId,
            kind: 'plantingGroup',
            label,
          },
          title: checkSoil ? `Check soil for ${label}` : `Water ${label}`,
        },
        now,
      ),
    ];
  });
}

function buildWeatherTasks(plan, snapshot, today, now) {
  const definitions = [
    {
      key: 'frost',
      notes: 'Check tender crop covers and containers before the low.',
      reason: 'The overnight forecast indicates frost risk.',
      risk: snapshot.frostRisk,
      title: 'Prepare for frost risk',
    },
    {
      key: 'heat',
      notes: 'Check containers and shallow-rooted crops early in the day.',
      reason: 'The daily forecast indicates heat stress risk.',
      risk: snapshot.heatRisk,
      title: 'Inspect for heat stress',
    },
  ];
  return definitions.flatMap((item) =>
    item.risk === 'none'
      ? []
      : [
          createTask(
            {
              dueOn: today,
              id: `weather:${item.key}:${today}`,
              kind: 'inspect',
              notes: item.notes,
              priority: item.risk === 'warning' ? 'high' : 'medium',
              reason: item.reason,
              sourceId: snapshot.id,
              target: { id: null, kind: 'garden', label: plan.name },
              title: item.title,
            },
            now,
          ),
        ],
  );
}

function mergeAutomatedTasks(existing, generated, now = new Date()) {
  const generatedById = new Map(generated.map((task) => [task.id, task]));
  const merged = existing.map((task) => {
    const next = generatedById.get(task.id);
    if (next) {
      generatedById.delete(task.id);
      if (task.status !== 'open') return task;
      return { ...next, createdAtIso: task.createdAtIso || next.createdAtIso };
    }
    if (task.status === 'open' && isAutomatedTask(task)) {
      return {
        ...task,
        completedAtIso: null,
        reason: 'Retired because saved plan evidence no longer calls for it.',
        status: 'done',
        updatedAtIso: now.toISOString(),
      };
    }
    return task;
  });
  return [...merged, ...generatedById.values()].sort(compareTasks);
}

function scheduledTask(context, category, anchor, offsetDays, input, now) {
  return planTask(
    context,
    category,
    anchor,
    { ...input, dueOn: addDays(anchor, offsetDays) },
    now,
  );
}

function confirmDateTask(context, field, today, now) {
  const planned = field === 'plannedFor';
  return planTask(
    context,
    `confirm-${field}`,
    context.planting.lifecycle,
    {
      dueOn: today,
      kind: 'inspect',
      notes: `Set a deliberate ${planned ? 'planned planting' : 'planted'} date in Plan before date-based operations are scheduled.`,
      priority: 'medium',
      reason: `${context.label} is ${context.planting.lifecycle}, but the saved plan has no valid ${field} date.`,
      title: `Confirm ${planned ? 'planting' : 'planted'} date for ${context.label}`,
    },
    now,
  );
}

function planTask(context, category, anchor, input, now) {
  return createTask(
    {
      ...input,
      id: `auto:${category}:${encodeURIComponent(context.planting.id)}:${anchor}`,
      sourceId: `plan:${context.planId}:${context.planting.id}:${category}:${anchor}`,
      target: context.target,
    },
    now,
  );
}

function createTask(input, now) {
  return {
    ...input,
    completedAtIso: null,
    createdAtIso: now.toISOString(),
    status: 'open',
    updatedAtIso: now.toISOString(),
  };
}

function isAutomatedTask(task) {
  return (
    task.id.startsWith('auto:') ||
    task.id.startsWith('task:watering:') ||
    task.id.startsWith('weather:') ||
    /^(plan|watering|weather):/.test(task.sourceId || '')
  );
}

function isLocalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function compareTasks(left, right) {
  return (
    left.dueOn.localeCompare(right.dueOn) ||
    left.title.localeCompare(right.title) ||
    left.id.localeCompare(right.id)
  );
}

module.exports = { buildAutomatedTasks, mergeAutomatedTasks };
