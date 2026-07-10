'use strict';

const {
  isValidLocalTime,
  isValidTimezone,
  normalizeLocalTime,
} = require('./operationTime');
const { validateV2Plan } = require('./v2PlanValidator');

function validateCanonicalWorkspace({ metadata, published }) {
  const errors = [];
  const warnings = [];

  if (!isRecord(metadata) || metadata.schemaVersion !== 2) {
    errors.push('Workspace metadata schemaVersion must be 2.');
  }
  if (
    !isRecord(published) ||
    !isRecord(published.plan) ||
    published.plan.schemaVersion !== 9
  ) {
    errors.push('Published Plan schemaVersion must be 9.');
  }
  if (
    metadata?.publishedRevisionId !== published?.revisionId ||
    typeof published?.revisionId !== 'string'
  ) {
    errors.push('Published Plan revision does not match workspace metadata.');
  }

  const plan = published?.plan;
  if (plan?.schemaVersion === 9) {
    const planIssues = validateV2Plan(plan);
    if (planIssues.length > 0) {
      errors.push(
        ...planIssues
          .slice(0, 20)
          .map((issue) => `${issue.path}: ${issue.message}`),
      );
    }
  }
  const plot = isRecord(plan?.plot) ? plan.plot : {};
  const location = isRecord(plot.location) ? plot.location : {};
  const coordinates = isRecord(location.coordinates)
    ? location.coordinates
    : null;
  const widthFt = finiteNumber(plot.widthFt);
  const depthFt = finiteNumber(plot.depthFt);
  const latitude = finiteNumber(coordinates?.latitude);
  const longitude = finiteNumber(coordinates?.longitude);

  if (!(widthFt > 0 && widthFt <= 1000)) {
    errors.push('Plot width must be between 0 and 1000 feet.');
  }
  if (!(depthFt > 0 && depthFt <= 1000)) {
    errors.push('Plot depth must be between 0 and 1000 feet.');
  }
  if (location.coordinates !== null && !coordinates) {
    errors.push(
      'Garden coordinates must be null or a latitude/longitude pair.',
    );
  }
  if (coordinates && (latitude === null || latitude < -90 || latitude > 90)) {
    errors.push('Garden latitude must be between -90 and 90.');
  }
  if (
    coordinates &&
    (longitude === null || longitude < -180 || longitude > 180)
  ) {
    errors.push('Garden longitude must be between -180 and 180.');
  }
  if (!isValidTimezone(location.timezone)) {
    errors.push('Garden timezone must be a valid IANA timezone.');
  }
  if (errors.length > 0) return { errors, valid: false };
  if (!coordinates) {
    warnings.push(
      'Garden coordinates are missing; weather alerts and automatic watering amounts are disabled.',
    );
  }

  const structures = asArray(plan.structures).filter((structure) => {
    const valid = validStructure(structure, widthFt, depthFt);
    if (!valid) {
      warnings.push(
        `Structure ${label(structure)} was excluded because its feet-based geometry is invalid.`,
      );
    }
    return valid;
  });
  const structureIds = new Set(
    structures
      .filter((structure) =>
        ['bed', 'raisedBed', 'container'].includes(structure.type),
      )
      .map((structure) => structure.id),
  );
  const plantings = asArray(plan.plantings).filter((planting) => {
    if (!['planted', 'growing', 'harvestReady'].includes(planting.lifecycle)) {
      return true;
    }
    const valid =
      validPoint(planting.xFt, planting.yFt, widthFt, depthFt) &&
      validExtent(planting.widthFt, planting.depthFt) &&
      asArray(planting.instances).every((instance) =>
        validPoint(instance.xFt, instance.yFt, widthFt, depthFt),
      ) &&
      typeof planting.cropId === 'string' &&
      Boolean(planting.cropId.trim()) &&
      typeof planting.cropName === 'string' &&
      Boolean(planting.cropName.trim()) &&
      validWaterProfile(planting.waterProfile) &&
      validWateringStage(planting) &&
      (!planting.growingAreaStructureId ||
        structureIds.has(planting.growingAreaStructureId));
    if (!valid) {
      warnings.push(
        `Crop group ${planting.cropName || planting.id} was excluded because its geometry, structure link, or water profile is invalid.`,
      );
    }
    return valid;
  });
  const requestedCheckTime = metadata.operationsAutomation?.checkTimeLocal;

  if (requestedCheckTime && !isValidLocalTime(requestedCheckTime)) {
    warnings.push('Invalid workspace watering check time; 07:00 was used.');
  }

  return {
    errors: [],
    operationsSettings: {
      defaultWateringCheckTime: normalizeLocalTime(requestedCheckTime, '07:00'),
      timezone: location.timezone,
    },
    plan: {
      ...plan,
      plantings,
      plot: {
        ...plot,
        depthFt,
        location: {
          ...location,
          coordinates: coordinates ? { latitude, longitude } : null,
        },
        widthFt,
      },
      structures,
    },
    revisionId: published.revisionId,
    valid: true,
    warnings,
  };
}

function validateNotificationProfile(profile) {
  const preferences = isRecord(profile?.notificationPreferences)
    ? profile.notificationPreferences
    : null;
  const errors = [];

  if (profile?.schemaVersion !== 2) errors.push('invalid profile schema');
  if (!isValidTimezone(profile?.timezone)) {
    errors.push('invalid notification timezone');
  }
  if (!preferences) {
    errors.push('notification preferences missing');
  } else {
    if (!isValidLocalTime(preferences.dailyCheckTime)) {
      errors.push('invalid daily check time');
    }
    if (
      !isValidLocalTime(preferences.quietHours?.start) ||
      !isValidLocalTime(preferences.quietHours?.end)
    ) {
      errors.push('invalid quiet hours');
    }
    if (!isValidThreshold(preferences.minimumWateringDeficitInches)) {
      errors.push('invalid watering threshold');
    }
  }

  return {
    errors,
    preference: preferences
      ? {
          alertTypes: {
            frost: preferences.alertKinds?.frost !== false,
            heatStress: preferences.alertKinds?.heat !== false,
            severeWeather: preferences.alertKinds?.severeWeather !== false,
            taskDue: preferences.alertKinds?.taskDue !== false,
            watering: preferences.alertKinds?.watering !== false,
          },
          channelConsent: {
            push: {
              status: preferences.pushEnabled ? 'granted' : 'revoked',
            },
          },
          channels: { inApp: true, push: preferences.pushEnabled === true },
          defaultWateringCheckTime: preferences.dailyCheckTime,
          quietHours: {
            endLocalTime: preferences.quietHours?.end,
            startLocalTime: preferences.quietHours?.start,
          },
          timezone: profile.timezone,
          wateringAlertThresholdIn: preferences.minimumWateringDeficitInches,
        }
      : {},
    valid: errors.length === 0,
  };
}

function validWaterProfile(profile) {
  const baseWeeklyInches = finiteNumber(profile?.baseWeeklyInches);
  const rootDepthInches = finiteNumber(profile?.rootDepthInches);
  const depletionFraction = finiteNumber(profile?.depletionFraction);
  const stageCoefficients = [
    'establishing',
    'flowering',
    'fruiting',
    'mature',
  ].map((stage) => finiteNumber(profile?.stageCoefficients?.[stage]));

  return (
    isRecord(profile) &&
    baseWeeklyInches !== null &&
    baseWeeklyInches >= 0 &&
    baseWeeklyInches <= 10 &&
    rootDepthInches !== null &&
    rootDepthInches > 0 &&
    rootDepthInches <= 120 &&
    depletionFraction !== null &&
    depletionFraction > 0 &&
    depletionFraction <= 1 &&
    ['high', 'medium', 'low'].includes(profile.confidence) &&
    ['catalog', 'curated', 'estimated', 'manual'].includes(profile.source) &&
    typeof profile.sourceVersion === 'string' &&
    Boolean(profile.sourceVersion.trim()) &&
    stageCoefficients.every(
      (coefficient) =>
        coefficient !== null && coefficient >= 0 && coefficient <= 3,
    )
  );
}

function validWateringStage(planting) {
  const allowedStages = ['establishing', 'flowering', 'fruiting', 'mature'];
  const allowedSources = ['manual', 'plantingEvent', 'lifecycleFallback'];
  if (
    !allowedStages.includes(planting?.wateringStage) ||
    !allowedSources.includes(planting?.wateringStageSource)
  ) {
    return false;
  }
  if (planting.wateringStageSource !== 'lifecycleFallback') return true;
  const fallback =
    planting.lifecycle === 'planted'
      ? 'establishing'
      : planting.lifecycle === 'harvestReady'
        ? 'fruiting'
        : 'mature';
  return planting.wateringStage === fallback;
}

function validStructure(structure, width, depth) {
  const soilDepth = finiteNumber(structure?.soilDepthInches);

  return (
    isRecord(structure) &&
    validPoint(structure.xFt, structure.yFt, width, depth) &&
    validExtent(structure.widthFt, structure.depthFt) &&
    structure.xFt + structure.widthFt <= width &&
    structure.yFt + structure.depthFt <= depth &&
    (structure.soilDepthInches === null ||
      (soilDepth !== null && soilDepth >= 1 && soilDepth <= 120))
  );
}

function validPoint(xFt, yFt, width, depth) {
  return (
    finiteNumber(xFt) !== null &&
    finiteNumber(yFt) !== null &&
    xFt >= 0 &&
    yFt >= 0 &&
    xFt <= width &&
    yFt <= depth
  );
}

function validExtent(widthFt, depthFt) {
  return finiteNumber(widthFt) > 0 && finiteNumber(depthFt) > 0;
}

function isValidThreshold(value) {
  return finiteNumber(value) >= 0.05 && finiteNumber(value) <= 2;
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function label(value) {
  return value?.label || value?.id || 'unknown';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  isValidThreshold,
  validateCanonicalWorkspace,
  validateNotificationProfile,
};
