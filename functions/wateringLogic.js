'use strict';

const {
  formatLocalDate,
  getGardenTimezone,
  isBeforeWateringCheck,
  roundTo,
  resolveWateringCheckWindowStartIso,
} = require('./operationTime');

const WATER_BALANCE_MODEL_VERSION = 'water-balance-v1';
const DIRECT_SOW_WATER_CREDIT_INCHES = 0.25;
const PLANTED_OUT_WATER_CREDIT_INCHES = 0.4;

function createWeatherSnapshot(garden, context, now) {
  const providerId = context.currentConditions.providerId;

  return {
    alertSummaries: context.alerts
      .slice(0, 4)
      .map((alert) => alert.headline || alert.event),
    capturedAtIso: now.toISOString(),
    conditionSummary: context.currentConditions.conditionSummary,
    dataQuality: context.dataQuality,
    evapotranspirationIn:
      context.agricultureMetrics.evapotranspirationNext24hIn,
    forecastDays: (context.forecast.days || []).slice(0, 14).map((day) => ({
      conditionSummary: day.conditionSummary,
      date: day.date,
      expectedRainIn: roundTo(day.expectedRainIn || 0, 2),
      highF: day.highF ?? null,
      precipitationChancePercent: day.precipitationChancePercent ?? null,
      rainAmountSource: day.rainAmountSource,
      rainLikely: day.rainLikely,
      rainSignalSource: day.rainSignalSource,
      rainSummary: day.rainSummary,
      rainWindowEndIso: day.rainWindowEndIso,
      rainWindowStartIso: day.rainWindowStartIso,
    })),
    forecastRainNext24In: context.forecast.next24hPrecipIn,
    forecastRainNext48In: context.forecast.next48hPrecipIn,
    frostRisk: getFrostRisk(context.forecast.overnightLowF),
    gardenId: garden.id,
    heatRisk: getHeatRisk(context.forecast.dailyHighF),
    humidityPercent: context.currentConditions.humidityPercent,
    id: `weather-${now.toISOString()}`,
    nextRainIso: context.forecast.nextRainIso,
    observedForDate: formatLocalDate(now, getGardenTimezone(garden)),
    overnightLowF: context.forecast.overnightLowF,
    precipitationIn: context.recentPrecipitation.totalIn,
    providerDecision:
      providerId === 'tomorrowIo'
        ? 'Tomorrow.io enhanced weather was used; NWS remains the fallback for alerts and gaps.'
        : 'National Weather Service was used as the default U.S. provider.',
    providerLabel: context.currentConditions.sourceLabel,
    recentPrecipitation72hIn: context.recentPrecipitation.last72hIn,
    source: providerId,
    temperatureF: context.currentConditions.temperatureF,
    windMph: context.currentConditions.windMph,
  };
}

function buildWaterRecommendations(
  garden,
  context,
  snapshot,
  now,
  defaults = {},
) {
  const scheduleTimezone = defaults.timezone || getGardenTimezone(garden);
  const wateringCheckTime = defaults.defaultWateringCheckTime || '07:00';
  const dueDate = formatLocalDate(now, scheduleTimezone);

  return getWaterTargets(garden, now).flatMap((target) => {
    const createdAtIso = now.toISOString();
    const dueWindowStartIso = resolveWateringCheckWindowStartIso(
      dueDate,
      scheduleTimezone,
      wateringCheckTime,
    );
    const nextRecalculationAtIso = getNextRecalculationAtIso(
      context.forecast,
      now,
    );
    const manualWateringHistory = estimateManualWatering(garden, target, now);
    const balance = calculateWaterBalance({
      context,
      manualWateringHistory,
      now,
      scheduleTimezone,
      target,
    });

    if (balance.deficitBeforeForecastInches < balance.thresholdInches) {
      return [];
    }

    const suppressUntilIso = getSuppressUntilIso(
      context.forecast,
      balance.deficitBeforeForecastInches,
      balance.forecastCreditInches,
      balance.thresholdInches,
      now,
    );
    let status;
    let targetAmountInches = balance.targetAmountInches;
    let deficitInches = balance.targetAmountInches;

    if (suppressUntilIso) {
      status = 'suppressed';
      targetAmountInches = 0;
      deficitInches = roundTo(balance.deficitBeforeForecastInches, 2);
    } else {
      status = isBeforeWateringCheck(now, scheduleTimezone, wateringCheckTime)
        ? 'scheduled'
        : balance.manualWaterCreditInches > 0
          ? 'partial'
          : 'due';
    }

    const rationale = buildRationale({
      balance,
      deficitInches,
      targetAmountInches,
      wateringCheckTime,
      status,
      target,
    });

    return [
      {
        appliedAmountInches:
          balance.manualWaterCreditInches > 0
            ? balance.manualWaterCreditInches
            : null,
        createdAtIso,
        dataQuality:
          target.waterNeedSource === 'fallback'
            ? 'limited'
            : context.dataQuality,
        deficitInches,
        dueDate,
        dueWindowEndIso: nextRecalculationAtIso,
        dueWindowStartIso,
        gardenId: garden.id,
        id: `water-${target.targetKind}-${target.id}-${dueDate}`,
        lastWateredAtIso: manualWateringHistory.lastWateredAtIso,
        nextRecalculationAtIso,
        reasonDetails: rationale,
        reasonSummary: rationale[0] || 'Watering check scheduled.',
        source: 'backend',
        status,
        targetId: target.id,
        targetAmountInches,
        targetKind: target.targetKind,
        targetLabel: target.label,
        updatedAtIso: createdAtIso,
        urgency: getUrgency(
          status === 'suppressed' ? deficitInches : targetAmountInches,
          context.forecast.dailyHighF,
          target,
        ),
        waterBalance: balance.waterBalance,
        wateringZoneId: target.irrigationZone || null,
        weatherSnapshotId: snapshot.id,
      },
    ];
  });
}

function mergeWaterRecommendations(existing, generated) {
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const generatedIds = new Set(generated.map((item) => item.id));
  const preserved = existing.filter(
    (item) =>
      !generatedIds.has(item.id) &&
      item.status !== 'due' &&
      item.status !== 'partial' &&
      item.status !== 'scheduled' &&
      item.status !== 'suppressed',
  );
  const mergedGenerated = generated.map((item) => {
    const existingItem = existingById.get(item.id);

    if (!existingItem) {
      return item;
    }

    const mergedItem = {
      ...item,
      createdAtIso: existingItem.createdAtIso || item.createdAtIso,
      dueWindowStartIso:
        existingItem.dueWindowStartIso || item.dueWindowStartIso,
    };

    if (
      !['completed', 'partial', 'skipped', 'snoozed'].includes(
        existingItem.status,
      )
    ) {
      return mergedItem;
    }

    return {
      ...mergedItem,
      appliedAmountInches:
        existingItem.appliedAmountInches ?? item.appliedAmountInches,
      lastWateredAtIso: existingItem.lastWateredAtIso || item.lastWateredAtIso,
      nextRecalculationAtIso:
        existingItem.nextRecalculationAtIso || item.nextRecalculationAtIso,
      status: existingItem.status,
      updatedAtIso: existingItem.updatedAtIso || item.updatedAtIso,
    };
  });

  return [...preserved, ...mergedGenerated]
    .sort((left, right) =>
      String(right.updatedAtIso || '').localeCompare(
        String(left.updatedAtIso || ''),
      ),
    )
    .slice(0, 120);
}

function getWaterTargets(garden, now) {
  const groupedPlantings = new Map();
  const standalonePlantings = [];

  (garden.plantings || [])
    .filter((planting) =>
      ['growing', 'harvest-ready', 'planted'].includes(planting.status),
    )
    .forEach((planting) => {
      const structure = getPlantingStructure(garden, planting);

      if (structure && isWaterableBed(structure)) {
        const plantings = groupedPlantings.get(structure.id) || [];
        plantings.push(planting);
        groupedPlantings.set(structure.id, plantings);
        return;
      }

      standalonePlantings.push({ planting, structure });
    });

  return [
    ...(garden.structures || []).flatMap((structure) => {
      if (!isWaterableBed(structure)) {
        return [];
      }

      const structurePlantings = groupedPlantings.get(structure.id) || [];
      return structurePlantings.length > 0
        ? [createBedTarget(structure, structurePlantings, now)]
        : [];
    }),
    ...standalonePlantings.map(({ planting, structure }) =>
      createPlantingTarget(planting, structure, now),
    ),
  ];
}

function createPlantingTarget(planting, structure, now) {
  const waterProfile = getPlantingWaterProfile(planting, now);

  return {
    drainageProfile: structure?.drainageProfile || 'unknown',
    id: planting.id,
    irrigationZone:
      planting.irrigationZone || structure?.irrigationZone || null,
    isContainer: structure?.type === 'container',
    label: planting.label || 'Planting',
    lifecycleStage: waterProfile.lifecycleStage,
    memberCount: 1,
    mulched: planting.mulched === true,
    plantings: [planting],
    soilType: structure?.soilType || 'unknown',
    targetKind: 'planting',
    waterNeedSource: waterProfile.waterNeedSource,
    weeklyWaterNeedInches:
      waterProfile.weeklyWaterNeedInches *
      getStructureWaterMultiplier(structure),
  };
}

function createBedTarget(structure, bedPlantings, now) {
  const waterProfiles = bedPlantings.map((planting) =>
    getPlantingWaterProfile(planting, now),
  );
  const highestCropNeed = Math.max(
    ...waterProfiles.map((profile) => profile.weeklyWaterNeedInches),
  );

  return {
    drainageProfile: structure.drainageProfile || 'unknown',
    id: structure.id,
    irrigationZone: structure.irrigationZone || null,
    isContainer: structure.type === 'container',
    label: structure.label || 'Bed',
    lifecycleStage: getTargetLifecycleStage(bedPlantings, now),
    memberCount: bedPlantings.length,
    mulched: structure.mulched === true,
    plantings: bedPlantings,
    soilType: structure.soilType || 'unknown',
    targetKind: 'bed',
    waterNeedSource: combineWaterNeedSources(
      waterProfiles.map((profile) => profile.waterNeedSource),
    ),
    weeklyWaterNeedInches:
      highestCropNeed * getStructureWaterMultiplier(structure),
  };
}

function estimateManualWatering(garden, target, now) {
  const start = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const targetText = String(target.label || '').toLowerCase();
  const fallbackOccurredOn = formatLocalDate(now, getGardenTimezone(garden));

  return (garden.journalEntries || []).reduce(
    (history, entry) => {
      const entryIso =
        entry.createdAtIso ||
        `${entry.occurredOn || fallbackOccurredOn}T12:00:00.000Z`;
      const entryDate = new Date(entryIso);
      const text = `${entry.title || ''} ${entry.body || ''}`.toLowerCase();
      const matchesTarget =
        (target.targetKind === 'planting'
          ? entry.plantingId === target.id
          : entry.structureId === target.id ||
            (target.plantings || []).some(
              (planting) => entry.plantingId === planting.id,
            )) ||
        String(entry.targetLabel || '').toLowerCase() === targetText ||
        (target.plantings || []).some(
          (planting) =>
            String(entry.targetLabel || '').toLowerCase() ===
            String(planting.label || '').toLowerCase(),
        ) ||
        text.includes(targetText);

      if (
        Number.isNaN(entryDate.getTime()) ||
        entryDate < start ||
        !text.includes('water') ||
        !matchesTarget
      ) {
        return history;
      }

      return {
        appliedAmountInches:
          history.appliedAmountInches + readWaterAmountInches(text),
        lastWateredAtIso:
          !history.lastWateredAtIso ||
          entryDate.getTime() > Date.parse(history.lastWateredAtIso)
            ? entryIso
            : history.lastWateredAtIso,
      };
    },
    {
      appliedAmountInches: 0,
      lastWateredAtIso: null,
    },
  );
}

function calculateWaterBalance({
  context,
  manualWateringHistory,
  now,
  scheduleTimezone,
  target,
}) {
  const today = formatLocalDate(now, scheduleTimezone);
  const plantingBaseline = getPlantingWaterBaseline(
    target.plantings || [],
    now,
    scheduleTimezone,
  );
  const fallbackBaselineDate = addDays(today, -3);
  const baselineDate = plantingBaseline.baselineDate || fallbackBaselineDate;
  const baselineSource = plantingBaseline.baselineDate
    ? plantingBaseline.baselineSource
    : 'fallbackWeatherWindow';
  const elapsedDays = Math.max(daysBetweenLocalDates(baselineDate, today), 0);
  const dailyNeedInches = getLifecycleDailyNeedInches(target, {
    dailyHighF: context.forecast.dailyHighF,
    evapotranspirationIn:
      context.agricultureMetrics.evapotranspirationNext24hIn,
  });
  const rawNeedInches = dailyNeedInches * elapsedDays;
  const rootZoneCapacityInches = getRootZoneCapacityInches(target);
  const recentRainCreditInches = getRecentRainCredit(
    context,
    target,
    baselineDate,
  );
  const manualWaterCreditInches = roundTo(
    Math.min(manualWateringHistory.appliedAmountInches, rawNeedInches),
    2,
  );
  const plantingWaterCreditInches =
    elapsedDays === 0 ? plantingBaseline.plantingWaterCreditInches : 0;
  const currentDepletionInches = roundTo(
    Math.min(
      Math.max(
        rawNeedInches - recentRainCreditInches - manualWaterCreditInches,
        0,
      ),
      rootZoneCapacityInches,
    ),
    2,
  );
  const deficitBeforeForecastInches = currentDepletionInches;
  const forecastCreditInches = getForecastRainCredit(context, target);
  const allowedDepletionInches = getDueThresholdInches(
    target,
    context.forecast.dailyHighF,
  );
  const thresholdInches = allowedDepletionInches;
  const actionableDeficitInches = roundTo(
    Math.max(deficitBeforeForecastInches - forecastCreditInches, 0),
    2,
  );
  const targetAmountInches = actionableDeficitInches;
  const nextCheckReason = getNextCheckReason({
    deficitBeforeForecastInches,
    forecastCreditInches,
    hasQualitativeRainSignal: hasQualitativeRainSignal(context.forecast),
    manualWaterCreditInches,
    plantingWaterCreditInches,
    recentRainCreditInches,
    targetAmountInches,
    thresholdInches,
  });

  return {
    actionableDeficitInches,
    allowedDepletionInches,
    baselineDate,
    baselineSource,
    currentDepletionInches,
    dailyNeedInches,
    deficitBeforeForecastInches,
    elapsedDays,
    forecastCreditInches,
    manualWaterCreditInches,
    nextCheckReason,
    plantingWaterCreditInches,
    rawNeedInches: roundTo(rawNeedInches, 2),
    recentRainCreditInches,
    rootZoneCapacityInches,
    targetAmountInches,
    thresholdInches,
    waterBalance: {
      actionableDeficitInches,
      allowedDepletionInches,
      baselineDate,
      baselineSource,
      currentDepletionInches,
      dailyNeedInches,
      effectiveDeficitInches: deficitBeforeForecastInches,
      forecastCreditInches,
      manualWaterCreditInches,
      modelVersion: WATER_BALANCE_MODEL_VERSION,
      nextCheckReason,
      observedRainCreditInches: recentRainCreditInches,
      plantingWaterCreditInches,
      recentRainCreditInches,
      rootZoneCapacityInches,
      rootZoneCapacitySource: 'estimated',
      thresholdInches,
    },
  };
}

function getPlantingWaterBaseline(plantings, now, timezone) {
  const today = formatLocalDate(now, timezone);
  const events = plantings.flatMap((planting) => {
    const plantingEvents = Array.isArray(planting.plantingEvents)
      ? planting.plantingEvents
      : [];
    const directSowed = plantingEvents
      .filter((event) => event.type === 'directSowed')
      .map((event) => ({
        occurredOn: event.occurredOn,
        source: 'plantingEvent',
        type: event.type,
      }));
    const plantedOut = plantingEvents
      .filter((event) => event.type === 'plantedOut')
      .map((event) => ({
        occurredOn: event.occurredOn,
        source: 'plantingEvent',
        type: event.type,
      }));
    const plantedOn = planting.plantedOn
      ? [
          {
            occurredOn: planting.plantedOn,
            source: 'plantingRecord',
            type: 'plantedOut',
          },
        ]
      : [];

    return [...directSowed, ...plantedOut, ...plantedOn];
  });
  const latest = events.sort((left, right) =>
    String(right.occurredOn || '').localeCompare(String(left.occurredOn || '')),
  )[0];

  if (!latest) {
    return {
      baselineDate: null,
      baselineSource: 'fallbackWeatherWindow',
      plantingWaterCreditInches: 0,
    };
  }

  return {
    baselineDate: latest.occurredOn,
    baselineSource: latest.source,
    plantingWaterCreditInches:
      latest.occurredOn === today
        ? latest.type === 'directSowed'
          ? DIRECT_SOW_WATER_CREDIT_INCHES
          : PLANTED_OUT_WATER_CREDIT_INCHES
        : 0,
  };
}

function getLifecycleDailyNeedInches(target, input) {
  return roundTo(
    (target.weeklyWaterNeedInches / 7) *
      getLifecycleDemandMultiplier(input) *
      getTargetContextMultiplier(target),
    3,
  );
}

function getLifecycleDemandMultiplier(input) {
  const heatMultiplier = getHeatMultiplier(input.dailyHighF);
  const et = input.evapotranspirationIn;
  const etMultiplier =
    et === null || et === undefined ? 1 : Math.min(1 + et / 0.7, 1.35);

  return Math.min(Math.max(heatMultiplier, etMultiplier), 1.35);
}

function getTargetContextMultiplier(target) {
  return (
    (target.mulched ? 0.85 : 1) *
    getSoilMultiplier(target.soilType) *
    getDrainageMultiplier(target.drainageProfile)
  );
}

function getRecentRainCredit(context, target, baselineDate) {
  return getEffectiveRainCreditInches(
    getRecentRainSinceBaseline(context, baselineDate),
    target,
  );
}

function getRecentRainSinceBaseline(context, baselineDate) {
  const baselineMs = Date.parse(`${baselineDate}T00:00:00.000Z`);
  const observations = (context.recentPrecipitation.observations || []).filter(
    (observation) => Date.parse(observation.observedAtIso) >= baselineMs,
  );

  if (observations.length > 0) {
    return observations.reduce(
      (total, observation) => total + observation.precipitationIn,
      0,
    );
  }

  const today = context.forecast.days?.[0]?.date;
  const elapsedDays = today ? daysBetweenLocalDates(baselineDate, today) : 3;

  return elapsedDays <= 1
    ? context.recentPrecipitation.last24hIn
    : context.recentPrecipitation.last72hIn;
}

function getForecastRainCredit(context, target) {
  const expectedRainIn =
    context.forecast.days?.[0]?.expectedRainIn ??
    context.forecast.next24hPrecipIn ??
    0;

  return getEffectiveRainCreditInches(expectedRainIn, target, 0.75);
}

function getDueThresholdInches(target, dailyHighF) {
  const baseThreshold =
    target.lifecycleStage === 'establishing'
      ? 0.18
      : target.isContainer
        ? 0.22
        : target.lifecycleStage === 'mixed'
          ? 0.28
          : 0.35;
  const harvestAdjusted = (target.plantings || []).some(
    (planting) => planting.status === 'harvest-ready',
  )
    ? Math.min(baseThreshold, 0.3)
    : baseThreshold;

  return (dailyHighF || 0) >= 95
    ? roundTo(Math.max(harvestAdjusted - 0.08, 0.15), 2)
    : harvestAdjusted;
}

function getRootZoneCapacityInches(target) {
  const baseCapacity = target.isContainer
    ? 0.5
    : target.lifecycleStage === 'establishing'
      ? 0.6
      : target.lifecycleStage === 'mixed'
        ? 0.85
        : 1.15;
  const soilCapacityMultiplier =
    target.soilType === 'sandy' ? 0.75 : target.soilType === 'clay' ? 1.1 : 1;
  const drainageCapacityMultiplier =
    target.drainageProfile === 'fast'
      ? 0.85
      : target.drainageProfile === 'slow'
        ? 1.05
        : 1;
  const minCapacity = target.isContainer ? 0.3 : 0.4;
  const maxCapacity = target.isContainer ? 0.8 : 1.6;

  return roundTo(
    Math.min(
      Math.max(
        baseCapacity * soilCapacityMultiplier * drainageCapacityMultiplier,
        minCapacity,
      ),
      maxCapacity,
    ),
    2,
  );
}

function getEffectiveRainCreditInches(
  rawRainInches,
  target,
  capInches = Infinity,
) {
  const effectiveness = target.isContainer ? 0.65 : 0.8;
  return roundTo(
    Math.min(Math.max(rawRainInches || 0, 0) * effectiveness, capInches),
    2,
  );
}

function getNextCheckReason(input) {
  if (input.plantingWaterCreditInches > 0) {
    return 'Planting-day watering is the current baseline.';
  }

  if (input.deficitBeforeForecastInches < input.thresholdInches) {
    return 'Recent rain or watering still covers the current plant need.';
  }

  if (input.forecastCreditInches >= input.deficitBeforeForecastInches) {
    return 'Forecast rain should cover the current deficit before watering.';
  }

  if (input.hasQualitativeRainSignal) {
    return 'NWS shows likely rain but has not published an inch amount yet; recheck after the rain window.';
  }

  if (input.manualWaterCreditInches > 0) {
    return 'Manual watering covered part of the current deficit.';
  }

  if (input.recentRainCreditInches > 0) {
    return 'Recent rain reduced the current deficit.';
  }

  return input.targetAmountInches > 0
    ? 'Dry weather has built a water deficit.'
    : 'No watering is due right now.';
}

function buildRationale({
  balance,
  deficitInches,
  targetAmountInches,
  wateringCheckTime,
  status,
  target,
}) {
  const rationale = [
    status === 'suppressed'
      ? balance.forecastCreditInches > 0
        ? `${target.label} can wait; forecast rain should cover about ${roundTo(deficitInches, 2)} in.`
        : `${target.label} can wait for the NWS rain window, then the water balance will be recalculated.`
      : status === 'scheduled'
        ? `${target.label} is lined up for the ${wateringCheckTime} watering check with about ${roundTo(targetAmountInches, 2)} in likely due.`
        : status === 'partial'
          ? `${target.label} still needs about ${roundTo(targetAmountInches, 2)} in after ${roundTo(balance.manualWaterCreditInches, 2)} in already logged.`
          : `${target.label} needs about ${roundTo(targetAmountInches, 2)} in soon.`,
    `Water balance started from ${balance.baselineDate}; demand since then is about ${roundTo(balance.rawNeedInches, 2)} in and root-zone depletion is about ${roundTo(balance.currentDepletionInches, 2)} in.`,
    `This target can use about ${roundTo(balance.rootZoneCapacityInches, 2)} in in the active root zone before excess water is ignored, with watering due at ${roundTo(balance.allowedDepletionInches, 2)} in depleted.`,
    `Credit counted: ${roundTo(balance.recentRainCreditInches, 2)} in effective rain, ${roundTo(balance.manualWaterCreditInches, 2)} in logged watering, and ${roundTo(balance.forecastCreditInches, 2)} in forecast rain.`,
    balance.nextCheckReason,
  ];

  if (balance.plantingWaterCreditInches > 0) {
    rationale.push(
      `This planting-day baseline counts ${roundTo(balance.plantingWaterCreditInches, 2)} in as already watered.`,
    );
  }
  if (balance.manualWaterCreditInches > 0) {
    rationale.push(
      `Logged watering already covered ${roundTo(balance.manualWaterCreditInches, 2)} in.`,
    );
  }
  if (balance.dailyNeedInches > target.weeklyWaterNeedInches / 7) {
    rationale.push('Heat is pushing the water need up.');
  }
  if (target.mulched) {
    rationale.push('Mulch is easing the demand a bit.');
  }
  if (target.soilType === 'sandy' || target.drainageProfile === 'fast') {
    rationale.push('Fast-draining soil means this area dries out faster.');
  }
  if (target.soilType === 'clay' || target.drainageProfile === 'slow') {
    rationale.push('Slower drainage trims the near-term water need.');
  }
  if (target.lifecycleStage === 'establishing') {
    rationale.push('New plantings need steadier moisture right now.');
  }
  if (target.lifecycleStage === 'mixed') {
    rationale.push(
      'This bed includes some newer plantings that dry out faster.',
    );
  }
  if (target.targetKind === 'bed' && target.memberCount > 1) {
    rationale.push(
      `This is rolled up for ${target.memberCount} active plantings in the same bed.`,
    );
  }
  if (target.irrigationZone) {
    rationale.push(`Water with ${target.irrigationZone}.`);
  }
  if (target.waterNeedSource === 'fallback') {
    rationale.push(
      'Crop-specific water data is thin here, so a conservative default was used.',
    );
  }
  if (status === 'suppressed') {
    rationale.push(
      'Keep this off the Today list until that rain window passes.',
    );
  } else if (status === 'scheduled') {
    rationale.push(`Bring this forward at ${wateringCheckTime}.`);
  } else {
    rationale.push(
      `Apply ${roundTo(targetAmountInches, 2)} in to close the current deficit.`,
    );
  }

  return rationale;
}

function getPlantingWaterProfile(planting, now) {
  const waterNeedSource = planting.weeklyWaterNeedInches
    ? 'manual'
    : 'fallback';
  const weeklyWaterNeedInches =
    (planting.weeklyWaterNeedInches || 1) *
    getLifecycleWaterMultiplier(planting, now);

  return {
    lifecycleStage: isEstablishingPlanting(planting, now)
      ? 'establishing'
      : 'steady',
    waterNeedSource,
    weeklyWaterNeedInches,
  };
}

function getLifecycleWaterMultiplier(planting, now) {
  if (isEstablishingPlanting(planting, now)) {
    return 1.1;
  }

  if (planting.status === 'harvest-ready') {
    return 1.05;
  }

  return 1;
}

function getTargetLifecycleStage(plantings, now) {
  const establishingCount = plantings.filter((planting) =>
    isEstablishingPlanting(planting, now),
  ).length;

  if (establishingCount === 0) {
    return 'steady';
  }

  if (establishingCount === plantings.length) {
    return 'establishing';
  }

  return 'mixed';
}

function isEstablishingPlanting(planting, now) {
  if (planting.status === 'planted') {
    return true;
  }

  if (!['growing', 'harvest-ready', 'planted'].includes(planting.status)) {
    return false;
  }

  const inGroundDate = getInGroundDate(planting);

  return inGroundDate
    ? daysBetweenLocalDates(inGroundDate, formatLocalDate(now, 'UTC')) <= 14
    : false;
}

function getInGroundDate(planting) {
  const events = Array.isArray(planting.plantingEvents)
    ? planting.plantingEvents
    : [];
  const latestEventDate = events
    .filter(
      (event) => event.type === 'plantedOut' || event.type === 'directSowed',
    )
    .map((event) => event.occurredOn)
    .sort((left, right) => String(right).localeCompare(String(left)))[0];

  return latestEventDate || planting.plantedOn || null;
}

function combineWaterNeedSources(sources) {
  if (sources.includes('fallback')) {
    return 'fallback';
  }

  if (sources.includes('manual')) {
    return 'manual';
  }

  return 'cropProfile';
}

function getPlantingStructure(garden, planting) {
  return (garden.structures || []).find(
    (structure) =>
      isWaterableBed(structure) &&
      isPointInsideStructure(planting.xFt, planting.yFt, structure),
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

function isWaterableBed(structure) {
  return ['bed', 'container', 'inGroundBed', 'raisedBed'].includes(
    structure.type,
  );
}

function getStructureWaterMultiplier(structure) {
  if (structure?.type === 'container') {
    return 1.25;
  }

  return structure?.type === 'raisedBed' || structure?.type === 'bed'
    ? 1.05
    : 1;
}

function getSoilMultiplier(soilType) {
  return soilType === 'sandy' ? 1.12 : soilType === 'clay' ? 0.92 : 1;
}

function getDrainageMultiplier(drainageProfile) {
  return drainageProfile === 'fast'
    ? 1.12
    : drainageProfile === 'slow'
      ? 0.92
      : 1;
}

function getHeatMultiplier(dailyHighF) {
  if (dailyHighF >= 95) {
    return 1.3;
  }

  if (dailyHighF >= 88) {
    return 1.15;
  }

  return dailyHighF >= 82 ? 1.05 : 1;
}

function getFrostRisk(overnightLowF) {
  if (overnightLowF === null || overnightLowF === undefined) {
    return 'none';
  }

  return overnightLowF <= 32
    ? 'warning'
    : overnightLowF <= 36
      ? 'watch'
      : 'none';
}

function getHeatRisk(dailyHighF) {
  if (dailyHighF === null || dailyHighF === undefined) {
    return 'none';
  }

  return dailyHighF >= 95 ? 'warning' : dailyHighF >= 88 ? 'watch' : 'none';
}

function getUrgency(deficitInches, dailyHighF, target) {
  if (
    deficitInches >= 0.75 ||
    ((dailyHighF || 0) >= 95 &&
      deficitInches >= (target.isContainer ? 0.2 : 0.3))
  ) {
    return 'high';
  }

  if (deficitInches >= 0.4) {
    return 'medium';
  }

  return deficitInches >= 0.15 ? 'low' : 'none';
}

function getSuppressUntilIso(
  forecast,
  deficitInches,
  forecastCreditInches,
  thresholdInches,
  now,
) {
  const nextRainIso = getFutureIso(forecast.nextRainIso, now);

  if (!nextRainIso) {
    return null;
  }

  if (forecastCreditInches + 0.05 >= deficitInches) {
    return nextRainIso;
  }

  const qualitativeCanWait =
    hasQualitativeRainSignal(forecast) &&
    deficitInches <= Math.max(thresholdInches + 0.25, 0.6);

  return qualitativeCanWait ? nextRainIso : null;
}

function getNextRecalculationAtIso(forecast, now) {
  return (
    getFutureIso(forecast.nextRainIso, now) ||
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  );
}

function hasQualitativeRainSignal(forecast) {
  return (forecast.days || []).some(
    (day) =>
      day.rainLikely === true &&
      (day.expectedRainIn || 0) < 0.01 &&
      day.rainSignalSource !== 'quantitativePrecipitation',
  );
}

function getFutureIso(value, now) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date < now ? null : value;
}

function readWaterAmountInches(text) {
  const match = /\b(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i.exec(text);
  return match?.[1] ? Number(match[1]) : 0.25;
}

function addDays(localDate, days) {
  const parsedDate = new Date(`${localDate}T12:00:00.000Z`);
  parsedDate.setUTCDate(parsedDate.getUTCDate() + days);
  return parsedDate.toISOString().slice(0, 10);
}

function daysBetweenLocalDates(startDate, endDate) {
  const startMs = Date.parse(`${startDate}T12:00:00.000Z`);
  const endMs = Date.parse(`${endDate}T12:00:00.000Z`);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return 0;
  }

  return Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000));
}

module.exports = {
  buildWaterRecommendations,
  createWeatherSnapshot,
  mergeWaterRecommendations,
};
