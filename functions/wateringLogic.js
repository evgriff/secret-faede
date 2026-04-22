'use strict';

const {
  defaultLocation,
  formatLocalDate,
  getGardenTimezone,
  roundTo,
} = require('./operationTime');

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

function buildWaterRecommendations(garden, context, snapshot, now) {
  const recommendationDate = formatLocalDate(now, getGardenTimezone(garden));
  const forecastCredit = Math.min(context.forecast.next24hPrecipIn * 0.6, 0.75);
  const effectiveRainIn =
    context.recentPrecipitation.last72hIn + forecastCredit;
  const heatMultiplier = getHeatMultiplier(context.forecast.dailyHighF);
  const etAdjustment = Math.min(
    context.agricultureMetrics.evapotranspirationNext24hIn || 0,
    0.35,
  );

  return getWaterTargets(garden).flatMap((target) => {
    const manualWaterIn = estimateManualWateringIn(garden, target, now);
    const adjustedNeedInches =
      target.weeklyWaterNeedInches *
        heatMultiplier *
        (target.mulched ? 0.85 : 1) *
        getSoilMultiplier(target.soilType) *
        getDrainageMultiplier(target.drainageProfile) +
      etAdjustment;
    const deficitInches = Math.max(
      adjustedNeedInches - effectiveRainIn - manualWaterIn,
      0,
    );

    if (deficitInches < 0.15) {
      return [];
    }

    const suppressUntilIso = getSuppressUntilIso(
      context.forecast,
      deficitInches,
    );
    const status = suppressUntilIso ? 'suppressed' : 'active';
    const recommendedWaterInches =
      status === 'suppressed' ? 0 : roundTo(deficitInches, 2);
    const rationale = buildRationale({
      adjustedNeedInches,
      effectiveRainIn,
      forecastCredit,
      heatMultiplier,
      manualWaterIn,
      recommendedWaterInches,
      status,
      target,
    });

    return [
      {
        dataQuality:
          target.waterNeedSource === 'fallback'
            ? 'limited'
            : context.dataQuality,
        deficitInches: roundTo(deficitInches, 2),
        generatedAtIso: now.toISOString(),
        generatedBy: 'backend',
        gardenId: garden.id,
        id: `water-${target.targetType}-${target.id}-${recommendationDate}`,
        inchesNeeded: recommendedWaterInches,
        plantingId: target.targetType === 'planting' ? target.id : null,
        rationale,
        reason: rationale[0] || 'Water deficit detected.',
        recommendationDate,
        recommendedWaterInches,
        refreshedAtIso: now.toISOString(),
        status,
        suppressUntilIso,
        targetId: target.id,
        targetLabel: target.label,
        targetType: target.targetType,
        urgency: getUrgency(deficitInches, context.forecast.dailyHighF),
        weatherSnapshotId: snapshot.id,
      },
    ];
  });
}

function mergeWaterRecommendations(existing, generated, now) {
  const generatedById = new Map(generated.map((item) => [item.id, item]));
  const today = formatLocalDate(now, defaultLocation.timezone);
  const merged = existing.map((item) => {
    const generatedItem = generatedById.get(item.id);

    if (!generatedItem) {
      return item.recommendationDate < today &&
        ['active', 'new'].includes(item.status)
        ? { ...item, status: 'suppressed', suppressUntilIso: now.toISOString() }
        : item;
    }

    return ['completed', 'dismissed'].includes(item.status)
      ? { ...generatedItem, status: item.status }
      : generatedItem;
  });
  const existingIds = new Set(existing.map((item) => item.id));

  return [...merged, ...generated.filter((item) => !existingIds.has(item.id))]
    .sort((left, right) =>
      String(right.generatedAtIso || '').localeCompare(
        String(left.generatedAtIso || ''),
      ),
    )
    .slice(0, 120);
}

function getWaterTargets(garden) {
  const plantings = (garden.plantings || [])
    .filter((planting) => !['planned', 'removed'].includes(planting.status))
    .map((planting) => createPlantingTarget(garden, planting));
  const beds = (garden.structures || []).flatMap((structure) =>
    isWaterableBed(structure) ? [createBedTarget(garden, structure)] : [],
  );

  return [...plantings, ...beds];
}

function createPlantingTarget(garden, planting) {
  const structure = getPlantingStructure(garden, planting);
  const weeklyWaterNeedInches = planting.weeklyWaterNeedInches || 1;

  return {
    drainageProfile: structure?.drainageProfile || 'unknown',
    id: planting.id,
    irrigationZone:
      planting.irrigationZone || structure?.irrigationZone || null,
    label: planting.label || 'Planting',
    mulched: planting.mulched === true,
    soilType: structure?.soilType || 'unknown',
    targetType: 'planting',
    waterNeedSource: planting.weeklyWaterNeedInches
      ? 'cropProfile'
      : 'fallback',
    weeklyWaterNeedInches:
      weeklyWaterNeedInches * getStructureWaterMultiplier(structure),
  };
}

function createBedTarget(garden, structure) {
  const bedPlantings = (garden.plantings || []).filter((planting) =>
    isPointInsideStructure(planting.xFt, planting.yFt, structure),
  );
  const averageCropNeed =
    bedPlantings.length > 0
      ? bedPlantings.reduce(
          (total, planting) => total + (planting.weeklyWaterNeedInches || 1),
          0,
        ) / bedPlantings.length
      : 1;

  return {
    drainageProfile: structure.drainageProfile || 'unknown',
    id: structure.id,
    irrigationZone: structure.irrigationZone || null,
    label: structure.label || 'Bed',
    mulched: structure.mulched === true,
    soilType: structure.soilType || 'unknown',
    targetType: 'bed',
    waterNeedSource: bedPlantings.length > 0 ? 'cropProfile' : 'fallback',
    weeklyWaterNeedInches:
      averageCropNeed * getStructureWaterMultiplier(structure),
  };
}

function estimateManualWateringIn(garden, target, now) {
  const start = new Date(now.getTime() - 72 * 60 * 60 * 1000);
  const targetText = String(target.label || '').toLowerCase();

  return (garden.journalEntries || []).reduce((total, entry) => {
    const entryDate = new Date(entry.createdAtIso || entry.occurredOn || '');
    const text = `${entry.title || ''} ${entry.body || ''}`.toLowerCase();
    const matchesTarget =
      entry.plantingId === target.id ||
      entry.structureId === target.id ||
      text.includes(targetText) ||
      text.includes('garden');

    if (
      Number.isNaN(entryDate.getTime()) ||
      entryDate < start ||
      !text.includes('water') ||
      !matchesTarget
    ) {
      return total;
    }

    return total + readWaterAmountInches(text);
  }, 0);
}

function buildRationale({
  adjustedNeedInches,
  effectiveRainIn,
  forecastCredit,
  heatMultiplier,
  manualWaterIn,
  recommendedWaterInches,
  status,
  target,
}) {
  const rationale = [
    `${target.label} needs about ${roundTo(adjustedNeedInches, 2)} in/week after crop, bed, soil, mulch, and weather adjustments.`,
    `Recent rain plus forecast credit covers ${roundTo(effectiveRainIn, 2)} in.`,
  ];

  if (manualWaterIn > 0) {
    rationale.push(`Manual watering logs add ${roundTo(manualWaterIn, 2)} in.`);
  }
  if (heatMultiplier > 1) {
    rationale.push('Heat stress increased the water target.');
  }
  if (target.irrigationZone) {
    rationale.push(`Assigned irrigation zone: ${target.irrigationZone}.`);
  }
  if (target.waterNeedSource === 'fallback') {
    rationale.push(
      'Crop-specific water data is incomplete, so a conservative default was used.',
    );
  }
  if (status === 'suppressed') {
    rationale.push(
      'Forecast rain should cover the deficit, so watering is suppressed for now.',
    );
  } else {
    rationale.push(
      `Apply ${roundTo(recommendedWaterInches, 2)} in to close the current deficit.`,
    );
  }
  if (forecastCredit > 0) {
    rationale.push(
      `${roundTo(forecastCredit, 2)} in of forecast rain is counted at partial credit.`,
    );
  }

  return rationale;
}

function getPlantingStructure(garden, planting) {
  return (garden.structures || []).find((structure) =>
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
  return forecast.nextRainIso && forecast.next24hPrecipIn >= deficitInches
    ? forecast.nextRainIso
    : null;
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
