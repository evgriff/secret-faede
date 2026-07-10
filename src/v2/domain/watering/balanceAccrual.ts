import { assertIsoInstant, differenceInGardenDays } from '../time/gardenTime';
import {
  EPSILON,
  GALLONS_PER_INCH_SQUARE_FOOT,
  addReason,
  assertFiniteNonNegative,
  assertFraction,
  clamp,
  round,
  type BalanceEvent,
  type TargetFactors,
} from './modelSupport';
import type {
  CreditedWaterApplication,
  HistoricalWeatherObservation,
  WaterApplication,
  WaterBalanceBaseline,
  WateringReasonDetail,
} from './types';

function applicationCreditInches(application: CreditedWaterApplication) {
  assertFraction(application.efficiency.fraction, 'application efficiency');

  if (application.amount.unit === 'unknown') {
    return null;
  }

  if (application.amount.unit === 'inches') {
    assertFiniteNonNegative(
      application.amount.depthInches,
      'application depthInches',
    );
    return application.amount.depthInches * application.efficiency.fraction;
  }

  assertFiniteNonNegative(application.amount.gallons, 'application gallons');
  const area = application.amount.area;

  if (
    area.squareFeet === null ||
    area.squareFeet <= 0 ||
    (area.reliability !== 'measured' && area.reliability !== 'geometry')
  ) {
    return null;
  }

  return (
    (application.amount.gallons /
      (area.squareFeet * GALLONS_PER_INCH_SQUARE_FOOT)) *
    application.efficiency.fraction
  );
}

export function resolveApplications(
  applications: readonly WaterApplication[],
  baseline: WaterBalanceBaseline,
  nowMs: number,
  reasons: WateringReasonDetail[],
) {
  const eventDeltas = new Map<number, number>();
  const ledger = new Map(
    baseline.applicationLedger.map((entry) => [entry.applicationId, entry]),
  );
  let amountUncertain = false;

  for (const application of [...applications].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  )) {
    if (
      typeof application.recordedByUserId !== 'string' ||
      !application.recordedByUserId.trim()
    ) {
      throw new Error(
        `Water application ${application.id} must identify its recorder.`,
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
        `Water application ${application.id} revision must be a positive integer.`,
      );
    }

    const previous = ledger.get(application.id);

    if (previous && application.revision < previous.revision) {
      throw new Error(
        `Water application ${application.id} revision is older than its balance ledger entry.`,
      );
    }

    const credit =
      application.outcome === 'skipped'
        ? 0
        : applicationCreditInches(application);

    if (application.outcome === 'skipped') {
      addReason(
        reasons,
        'SKIPPED_APPLICATION_ZERO_CREDIT',
        'A skipped watering record contributes zero water to the balance.',
        0,
        [application.id],
      );
    } else if (credit === null) {
      amountUncertain = true;
      addReason(
        reasons,
        'UNKNOWN_APPLICATION_AMOUNT',
        'An applied watering record cannot be converted to effective depth.',
        null,
        [application.id],
      );
    } else {
      addReason(
        reasons,
        'WATER_APPLICATION_CREDITED',
        'A measured water application reduces the accrued crop-group deficit.',
        credit,
        [application.id],
      );
    }

    const nextCredit = credit ?? 0;
    const previousCredit = previous?.creditedDepthInches ?? 0;

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
        (eventDeltas.get(eventAtMs) ?? 0) - creditDelta,
      );

      if (isBackdated) {
        addReason(
          reasons,
          'BACKDATED_APPLICATION_CREDITED',
          'A newly recorded earlier application is credited at the durable balance boundary so excess water cannot roll forward.',
          creditDelta,
          [application.id],
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
      .map(([atMs, deltaInches], order) => ({
        atMs,
        deltaInches,
        order,
      })),
    ledger: [...ledger.values()].sort((left, right) =>
      left.applicationId < right.applicationId
        ? -1
        : left.applicationId > right.applicationId
          ? 1
          : 0,
    ),
  };
}

export function historicalEvents(
  observations: readonly HistoricalWeatherObservation[],
  baselineIso: string,
  nowIso: string,
  timezone: string,
  factors: TargetFactors,
  reasons: WateringReasonDetail[],
) {
  const baselineMs = Date.parse(baselineIso);
  const nowMs = Date.parse(nowIso);
  const events: BalanceEvent[] = [];
  let observedRain = 0;
  let observedEtDemand = 0;
  let estimatedEtDemand = 0;
  let coveredGardenDays = 0;
  let missingRain = false;
  let missingEt = false;
  let order = 10_000;

  for (const observation of observations) {
    const observationStart = Date.parse(observation.startIso);
    const observationEnd = Date.parse(observation.endIso);
    const clippedStart = Math.max(observationStart, baselineMs);
    const clippedEnd = Math.min(observationEnd, nowMs);

    if (clippedEnd <= clippedStart) continue;
    if (observation.observedRainInches !== null) {
      assertFiniteNonNegative(
        observation.observedRainInches,
        'observedRainInches',
      );
    }
    if (observation.referenceEtInches !== null) {
      assertFiniteNonNegative(
        observation.referenceEtInches,
        'referenceEtInches',
      );
    }

    const fraction =
      (clippedEnd - clippedStart) / (observationEnd - observationStart);
    const startIso = new Date(clippedStart).toISOString();
    const endIso = new Date(clippedEnd).toISOString();
    const gardenDays = Math.max(
      0,
      differenceInGardenDays(startIso, endIso, timezone),
    );
    coveredGardenDays += gardenDays;
    const demand =
      observation.referenceEtInches === null
        ? gardenDays * factors.baseDailyDemandInches
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
    events.push({
      atMs: clippedEnd,
      deltaInches: demand - rain,
      order: order++,
    });
  }

  const elapsedDays = Math.max(
    0,
    differenceInGardenDays(baselineIso, nowIso, timezone),
  );
  const gapDays = Math.max(0, elapsedDays - coveredGardenDays);

  if (gapDays > 0.01) {
    const gapDemand = gapDays * factors.baseDailyDemandInches;
    estimatedEtDemand += gapDemand;
    events.push({ atMs: nowMs, deltaInches: gapDemand, order: order++ });
    addReason(
      reasons,
      'HISTORICAL_WEATHER_GAP',
      'The accrued interval is not fully covered by historical weather observations.',
      gapDemand,
    );
  }

  const ids = observations.map((observation) => observation.id);
  if (observedEtDemand > EPSILON) {
    addReason(
      reasons,
      'HISTORICAL_ET_ACCRUED',
      'Historical reference evapotranspiration accrues crop-specific demand.',
      observedEtDemand,
      ids,
    );
  }
  if (estimatedEtDemand > EPSILON || missingEt) {
    addReason(
      reasons,
      'HISTORICAL_ET_ESTIMATED',
      'Crop weekly need estimates demand where historical ET is unavailable.',
      estimatedEtDemand,
    );
  }
  if (observedRain > EPSILON) {
    addReason(
      reasons,
      'OBSERVED_RAIN_CREDITED',
      'Only observed rain is credited to the accrued balance.',
      observedRain,
      ids,
    );
  }
  if (missingRain) {
    addReason(
      reasons,
      'MISSING_RAIN_OBSERVATION',
      'At least one accrued weather interval has no observed-rain measurement.',
    );
  }

  return { events, hasGap: gapDays > 0.01, missingEt, missingRain };
}

export function applyBalanceEvents(
  startingDepletionInches: number,
  capacityInches: number,
  events: readonly BalanceEvent[],
  reasons: WateringReasonDetail[],
) {
  let depletion = clamp(startingDepletionInches, 0, capacityInches);
  let excessWater = 0;

  for (const event of [...events].sort((left, right) =>
    left.atMs === right.atMs
      ? left.order - right.order
      : left.atMs - right.atMs,
  )) {
    const next = depletion + event.deltaInches;
    if (next < 0) excessWater += -next;
    depletion = clamp(next, 0, capacityInches);
  }

  if (excessWater > EPSILON) {
    addReason(
      reasons,
      'EXCESS_WATER_DRAINED',
      'Water beyond field capacity is not carried into later crop demand.',
      excessWater,
    );
  }

  return depletion;
}
