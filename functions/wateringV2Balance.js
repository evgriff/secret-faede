'use strict';

const {
  EPSILON,
  GALLONS_PER_INCH_SQUARE_FOOT,
  assertFraction,
  assertIsoInstant,
  assertNonNegative,
  clamp,
  differenceInGardenDays,
  hasReliableArea,
  reason,
  round,
} = require('./wateringV2Support');

function resolveApplications(applications, baseline, nowMs, reasons) {
  const eventDeltas = new Map();
  const ledger = new Map(
    baseline.applicationLedger.map((entry) => [entry.applicationId, entry]),
  );
  let amountUncertain = false;

  for (const application of [...applications].sort(compareIds)) {
    if (
      typeof application.recordedByUserId !== 'string' ||
      !application.recordedByUserId.trim()
    ) {
      throw new Error(
        `Water application ${application.id} must identify its recorder.`,
      );
    }
    if (!['applied', 'partial', 'skipped'].includes(application.outcome)) {
      throw new Error(
        `Water application ${application.id} has an invalid outcome.`,
      );
    }
    assertIsoInstant(application.appliedAtIso);
    assertIsoInstant(application.recordedAtIso);
    const appliedAtMs = Date.parse(application.appliedAtIso);
    const recordedAtMs = Date.parse(application.recordedAtIso);

    if (appliedAtMs > nowMs || recordedAtMs > nowMs) {
      throw new Error(`Water application ${application.id} is in the future.`);
    }
    if (recordedAtMs < appliedAtMs) {
      throw new Error(
        `Water application ${application.id} was recorded before it occurred.`,
      );
    }
    if (!Number.isInteger(application.revision) || application.revision < 1) {
      throw new Error(
        `Water application ${application.id} revision must be positive.`,
      );
    }

    const previous = ledger.get(application.id);
    if (previous && application.revision < previous.revision) {
      throw new Error(
        `Water application ${application.id} revision is older than its ledger entry.`,
      );
    }
    const credit =
      application.outcome === 'skipped'
        ? 0
        : applicationCreditInches(application);

    if (application.outcome === 'skipped') {
      reasons.push(
        reason(
          'SKIPPED_APPLICATION_ZERO_CREDIT',
          'A skipped watering record contributes zero water to the balance.',
          0,
          [application.id],
        ),
      );
    } else if (credit === null) {
      amountUncertain = true;
      reasons.push(
        reason(
          'UNKNOWN_APPLICATION_AMOUNT',
          'An applied watering record cannot be converted to effective depth.',
          null,
          [application.id],
        ),
      );
    } else {
      reasons.push(
        reason(
          'WATER_APPLICATION_CREDITED',
          'A measured water application reduces the accrued crop-group deficit.',
          credit,
          [application.id],
        ),
      );
    }

    const nextCredit = credit || 0;
    const previousCredit = previous?.creditedDepthInches || 0;

    if (
      previous &&
      application.revision === previous.revision &&
      (Math.abs(previousCredit - nextCredit) > EPSILON ||
        previous.outcome !== application.outcome)
    ) {
      throw new Error(
        `Water application ${application.id} changed without a revision increment.`,
      );
    }

    const creditDelta = nextCredit - previousCredit;
    if (Math.abs(creditDelta) > EPSILON) {
      const isBackdated = appliedAtMs <= Date.parse(baseline.asOfIso);
      const eventAtMs = isBackdated
        ? Date.parse(baseline.asOfIso)
        : appliedAtMs;
      eventDeltas.set(
        eventAtMs,
        (eventDeltas.get(eventAtMs) || 0) - creditDelta,
      );
      if (isBackdated) {
        reasons.push(
          reason(
            'BACKDATED_APPLICATION_CREDITED',
            'A newly recorded earlier application is credited at the durable balance boundary so excess water cannot roll forward.',
            creditDelta,
            [application.id],
          ),
        );
      }
    }

    ledger.set(application.id, {
      applicationId: application.id,
      creditedDepthInches: round(nextCredit),
      outcome: application.outcome,
      revision: application.revision,
    });
  }

  return {
    amountUncertain,
    events: [...eventDeltas.entries()]
      .sort(([left], [right]) => left - right)
      .map(([atMs, deltaInches], order) => ({ atMs, deltaInches, order })),
    ledger: [...ledger.values()].sort((left, right) =>
      compareIds({ id: left.applicationId }, { id: right.applicationId }),
    ),
  };
}

function applicationCreditInches(application) {
  assertFraction(application.efficiency.fraction, 'application efficiency');
  if (application.amount.unit === 'unknown') return null;
  if (application.amount.unit === 'inches') {
    assertNonNegative(
      application.amount.depthInches,
      'application depthInches',
    );
    return application.amount.depthInches * application.efficiency.fraction;
  }

  assertNonNegative(application.amount.gallons, 'application gallons');
  if (!hasReliableArea(application.amount.area)) return null;
  return (
    (application.amount.gallons /
      (application.amount.area.squareFeet * GALLONS_PER_INCH_SQUARE_FOOT)) *
    application.efficiency.fraction
  );
}

function historicalEvents({
  baselineIso,
  factors,
  nowIso,
  observations,
  reasons,
  timezone,
}) {
  const baselineMs = Date.parse(baselineIso);
  const nowMs = Date.parse(nowIso);
  const events = [];
  let observedRain = 0;
  let observedEtDemand = 0;
  let estimatedEtDemand = 0;
  let coveredDays = 0;
  let missingRain = false;
  let missingEt = false;
  let order = 10000;

  for (const observation of observations) {
    const start = Math.max(Date.parse(observation.startIso), baselineMs);
    const end = Math.min(Date.parse(observation.endIso), nowMs);
    if (end <= start) continue;
    if (observation.observedRainInches !== null) {
      assertNonNegative(observation.observedRainInches, 'observedRainInches');
    }
    if (observation.referenceEtInches !== null) {
      assertNonNegative(observation.referenceEtInches, 'referenceEtInches');
    }
    const fraction =
      (end - start) /
      (Date.parse(observation.endIso) - Date.parse(observation.startIso));
    const days = Math.max(
      0,
      differenceInGardenDays(
        new Date(start).toISOString(),
        new Date(end).toISOString(),
        timezone,
      ),
    );
    coveredDays += days;
    const demand =
      observation.referenceEtInches === null
        ? days * factors.baseDailyDemandInches
        : observation.referenceEtInches *
          fraction *
          factors.cropDemandPerReferenceEtInch;
    const rain =
      observation.observedRainInches === null
        ? 0
        : observation.observedRainInches * fraction * factors.rainCaptureFactor;
    missingEt ||= observation.referenceEtInches === null;
    missingRain ||= observation.observedRainInches === null;
    estimatedEtDemand += observation.referenceEtInches === null ? demand : 0;
    observedEtDemand += observation.referenceEtInches === null ? 0 : demand;
    observedRain += observation.observedRainInches === null ? 0 : rain;
    events.push({ atMs: end, deltaInches: demand - rain, order: order++ });
  }

  const elapsedDays = Math.max(
    0,
    differenceInGardenDays(baselineIso, nowIso, timezone),
  );
  const gapDays = Math.max(0, elapsedDays - coveredDays);
  if (gapDays > 0.01) {
    const gapDemand = gapDays * factors.baseDailyDemandInches;
    estimatedEtDemand += gapDemand;
    events.push({
      atMs: nowMs,
      deltaInches: gapDemand,
      order: order++,
    });
    reasons.push(
      reason(
        'HISTORICAL_WEATHER_GAP',
        'The accrued interval is not fully covered by historical weather observations.',
        gapDemand,
      ),
    );
  }
  const ids = observations.map((observation) => observation.id);
  if (observedEtDemand > EPSILON) {
    reasons.push(
      reason(
        'HISTORICAL_ET_ACCRUED',
        'Historical reference evapotranspiration accrues crop-specific demand.',
        observedEtDemand,
        ids,
      ),
    );
  }
  if (estimatedEtDemand > EPSILON || missingEt) {
    reasons.push(
      reason(
        'HISTORICAL_ET_ESTIMATED',
        'Crop weekly need estimates demand where historical ET is unavailable.',
        estimatedEtDemand,
      ),
    );
  }
  if (observedRain > EPSILON) {
    reasons.push(
      reason(
        'OBSERVED_RAIN_CREDITED',
        'Only observed rain is credited to the accrued balance.',
        observedRain,
        ids,
      ),
    );
  }
  if (missingRain) {
    reasons.push(
      reason(
        'MISSING_RAIN_OBSERVATION',
        'At least one accrued weather interval has no observed-rain measurement.',
      ),
    );
  }
  return { events, hasGap: gapDays > 0.01, missingEt, missingRain };
}

function compareIds(left, right) {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function applyBalanceEvents(starting, capacity, events, reasons) {
  let depletion = clamp(starting, 0, capacity);
  let excessWater = 0;
  const ordered = [...events].sort((left, right) =>
    left.atMs === right.atMs
      ? left.order - right.order
      : left.atMs - right.atMs,
  );

  for (const event of ordered) {
    const next = depletion + event.deltaInches;
    if (next < 0) excessWater += -next;
    depletion = clamp(next, 0, capacity);
  }
  if (excessWater > EPSILON) {
    reasons.push(
      reason(
        'EXCESS_WATER_DRAINED',
        'Water beyond field capacity is not carried into later crop demand.',
        excessWater,
      ),
    );
  }
  return depletion;
}

module.exports = {
  applyBalanceEvents,
  historicalEvents,
  resolveApplications,
};
