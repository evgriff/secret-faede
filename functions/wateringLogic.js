'use strict';

const {
  formatLocalDate,
  getGardenTimezone,
  isBeforeWateringCheck,
  roundTo,
  resolveWateringCheckWindowStartIso,
} = require('./operationTime');

const MIN_ACTIONABLE_DEFICIT_INCHES = 0.15;

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
  const forecastCredit = Math.min(context.forecast.next24hPrecipIn * 0.6, 0.75);
  const recentRainIn = context.recentPrecipitation.last72hIn;
  const heatMultiplier = getHeatMultiplier(context.forecast.dailyHighF);
  const etAdjustment = Math.min(
    context.agricultureMetrics.evapotranspirationNext24hIn || 0,
    0.35,
  );

  return getWaterTargets(garden).flatMap((target) => {
    const manualWateringHistory = estimateManualWatering(garden, target, now);
    const manualWaterIn = manualWateringHistory.appliedAmountInches;
    const adjustedNeedInches =
      target.weeklyWaterNeedInches *
        heatMultiplier *
        (target.mulched ? 0.85 : 1) *
        getSoilMultiplier(target.soilType) *
        getDrainageMultiplier(target.drainageProfile) +
      etAdjustment;
    const remainingBeforeForecastInches = Math.max(
      adjustedNeedInches - recentRainIn - manualWaterIn,
      0,
    );
    const remainingAfterForecastInches = Math.max(
      remainingBeforeForecastInches - forecastCredit,
      0,
    );
    const manualCreditInches = roundTo(
      Math.min(manualWaterIn, adjustedNeedInches),
      2,
    );
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

    if (
      remainingBeforeForecastInches < MIN_ACTIONABLE_DEFICIT_INCHES &&
      manualCreditInches <= 0
    ) {
      return [];
    }

    const suppressUntilIso = getSuppressUntilIso(
      context.forecast,
      remainingBeforeForecastInches,
    );
    let status;
    let targetAmountInches = 0;
    let deficitInches = 0;

    if (remainingBeforeForecastInches < MIN_ACTIONABLE_DEFICIT_INCHES) {
      status = 'completed';
    } else if (suppressUntilIso) {
      status = 'suppressed';
      deficitInches = roundTo(remainingBeforeForecastInches, 2);
    } else if (remainingAfterForecastInches < MIN_ACTIONABLE_DEFICIT_INCHES) {
      if (manualCreditInches <= 0) {
        return [];
      }

      status = 'completed';
    } else {
      status = isBeforeWateringCheck(now, scheduleTimezone, wateringCheckTime)
        ? 'scheduled'
        : manualCreditInches > 0
          ? 'partial'
          : 'due';
      targetAmountInches = roundTo(remainingAfterForecastInches, 2);
      deficitInches = targetAmountInches;
    }

    const rationale = buildRationale({
      adjustedNeedInches,
      deficitInches,
      forecastCredit,
      heatMultiplier,
      manualWaterIn,
      recentRainIn,
      targetAmountInches,
      wateringCheckTime,
      status,
      target,
    });

    return [
      {
        appliedAmountInches: manualCreditInches > 0 ? manualCreditInches : null,
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
        ),
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

    if (!['completed', 'skipped', 'snoozed'].includes(existingItem.status)) {
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

function getWaterTargets(garden) {
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
        ? [createBedTarget(structure, structurePlantings)]
        : [];
    }),
    ...standalonePlantings.map(({ planting, structure }) =>
      createPlantingTarget(planting, structure),
    ),
  ];
}

function createPlantingTarget(planting, structure) {
  const waterProfile = getPlantingWaterProfile(planting);

  return {
    drainageProfile: structure?.drainageProfile || 'unknown',
    id: planting.id,
    irrigationZone:
      planting.irrigationZone || structure?.irrigationZone || null,
    label: planting.label || 'Planting',
    lifecycleStage: waterProfile.lifecycleStage,
    memberCount: 1,
    mulched: planting.mulched === true,
    soilType: structure?.soilType || 'unknown',
    targetKind: 'planting',
    waterNeedSource: waterProfile.waterNeedSource,
    weeklyWaterNeedInches:
      waterProfile.weeklyWaterNeedInches *
      getStructureWaterMultiplier(structure),
  };
}

function createBedTarget(structure, bedPlantings) {
  const waterProfiles = bedPlantings.map(getPlantingWaterProfile);
  const averageCropNeed =
    waterProfiles.reduce(
      (total, profile) => total + profile.weeklyWaterNeedInches,
      0,
    ) / waterProfiles.length;

  return {
    drainageProfile: structure.drainageProfile || 'unknown',
    id: structure.id,
    irrigationZone: structure.irrigationZone || null,
    label: structure.label || 'Bed',
    lifecycleStage: getTargetLifecycleStage(bedPlantings),
    memberCount: bedPlantings.length,
    mulched: structure.mulched === true,
    soilType: structure.soilType || 'unknown',
    targetKind: 'bed',
    waterNeedSource: combineWaterNeedSources(
      waterProfiles.map((profile) => profile.waterNeedSource),
    ),
    weeklyWaterNeedInches:
      averageCropNeed * getStructureWaterMultiplier(structure),
  };
}

function estimateManualWatering(garden, target, now) {
  const start = new Date(now.getTime() - 72 * 60 * 60 * 1000);
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
          : entry.structureId === target.id) ||
        String(entry.targetLabel || '').toLowerCase() === targetText ||
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

function buildRationale({
  adjustedNeedInches,
  deficitInches,
  forecastCredit,
  heatMultiplier,
  manualWaterIn,
  recentRainIn,
  targetAmountInches,
  wateringCheckTime,
  status,
  target,
}) {
  const rationale = [
    status === 'completed'
      ? `${target.label} is covered for now after ${roundTo(manualWaterIn, 2)} in already logged.`
      : status === 'suppressed'
        ? `${target.label} can wait; rain due soon should cover about ${roundTo(deficitInches, 2)} in.`
        : status === 'scheduled'
          ? `${target.label} is lined up for the ${wateringCheckTime} watering check with about ${roundTo(targetAmountInches, 2)} in likely due.`
          : status === 'partial'
            ? `${target.label} still needs about ${roundTo(targetAmountInches, 2)} in after ${roundTo(manualWaterIn, 2)} in already logged.`
            : `${target.label} needs about ${roundTo(targetAmountInches, 2)} in soon.`,
    `Adjusted need is about ${roundTo(adjustedNeedInches, 2)} in this week.`,
    `Rain credit: ${roundTo(recentRainIn, 2)} in recent and ${roundTo(forecastCredit, 2)} in forecast.`,
  ];

  if (manualWaterIn > 0) {
    rationale.push(
      `Logged watering already covered ${roundTo(manualWaterIn, 2)} in.`,
    );
  }
  if (heatMultiplier > 1) {
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
  } else if (status === 'completed') {
    rationale.push('No more watering is due right now.');
  } else if (status === 'scheduled') {
    rationale.push(`Bring this forward at ${wateringCheckTime}.`);
  } else {
    rationale.push(
      `Apply ${roundTo(targetAmountInches, 2)} in to close the current deficit.`,
    );
  }

  return rationale;
}

function getPlantingWaterProfile(planting) {
  const waterNeedSource = planting.weeklyWaterNeedInches
    ? 'manual'
    : 'fallback';
  const weeklyWaterNeedInches =
    (planting.weeklyWaterNeedInches || 1) *
    getLifecycleWaterMultiplier(planting);

  return {
    lifecycleStage: planting.status === 'planted' ? 'establishing' : 'steady',
    waterNeedSource,
    weeklyWaterNeedInches,
  };
}

function getLifecycleWaterMultiplier(planting) {
  if (planting.status === 'planted') {
    return 1.15;
  }

  if (planting.status === 'harvest-ready') {
    return 1.05;
  }

  return 1;
}

function getTargetLifecycleStage(plantings) {
  const establishingCount = plantings.filter(
    (planting) => planting.status === 'planted',
  ).length;

  if (establishingCount === 0) {
    return 'steady';
  }

  if (establishingCount === plantings.length) {
    return 'establishing';
  }

  return 'mixed';
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
  return soilType === 'sandy' ? 1.12 : soilType === 'clay' ? 0.94 : 1;
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

function getUrgency(deficitInches, dailyHighF) {
  if (deficitInches >= 0.75 || (dailyHighF || 0) >= 95) {
    return 'high';
  }

  if (deficitInches >= 0.4) {
    return 'medium';
  }

  return deficitInches >= 0.15 ? 'low' : 'none';
}

function getSuppressUntilIso(forecast, deficitInches) {
  return forecast.nextRainIso && forecast.next24hPrecipIn + 0.1 >= deficitInches
    ? forecast.nextRainIso
    : null;
}

function getNextRecalculationAtIso(forecast, now) {
  return (
    forecast.nextRainIso ||
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  );
}

function readWaterAmountInches(text) {
  const match = /\b(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i.exec(text);
  return match?.[1] ? Number(match[1]) : 0.25;
}

module.exports = {
  buildWaterRecommendations,
  createWeatherSnapshot,
  mergeWaterRecommendations,
};
