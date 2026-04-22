import type {
  Garden,
  HarvestEvent,
  JournalEntry,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';
import {
  buildCropRollups,
  formatHarvestUnit,
  formatQuantity,
  formatRollupTotals,
  type CropRollup,
} from './journalAnalyticsRollups';

export interface JournalAnalytics {
  activeBeds: Array<{ count: number; label: string }>;
  harvestTotals: Array<{ label: string; value: string }>;
  impact: {
    estimatedValueLabel: string;
    estimatedValueNote: string;
    harvestedPlantings: number;
    harvestEvents: number;
    seedOrSeedlingCount: number;
  };
  issues: {
    highSeverity: number;
    inProgress: number;
    open: number;
    resolved: number;
    unresolved: number;
  };
  media: {
    attachedPhotos: number;
    entriesWithPhotos: number;
  };
  performance: {
    bestPerformers: Array<{ detail: string; label: string }>;
    underperformers: Array<{ detail: string; label: string }>;
  };
  seasonYear: number;
  waterAlerts: {
    acknowledged: number;
    acknowledgementRate: number | null;
    sent: number;
  };
  yieldByBed: Array<{ bedName: string; total: string }>;
  yieldByCrop: Array<{ cropName: string; total: string }>;
}

export function buildJournalAnalytics(
  garden: Garden,
  seasonYear = new Date().getFullYear(),
): JournalAnalytics {
  const seasonHarvests = garden.harvestEvents.filter((harvest) =>
    harvest.harvestedOn.startsWith(String(seasonYear)),
  );
  const seasonEntries = garden.journalEntries.filter((entry) =>
    entry.occurredOn.startsWith(String(seasonYear)),
  );
  const unresolvedIssues = garden.journalEntries.filter(
    (entry) => entry.type === 'issue' && entry.issueStatus !== 'resolved',
  );
  const waterAlertsSent = garden.notificationLogs.filter(
    (log) => log.type === 'watering' && log.status === 'sent',
  ).length;
  const waterAlertsAcknowledged = countAcknowledgedWaterAlerts(garden);
  const cropRollups = buildCropRollups(seasonHarvests);

  return {
    activeBeds: buildActiveBeds(garden),
    harvestTotals: buildHarvestTotals(seasonHarvests),
    impact: buildImpact(garden, seasonHarvests, cropRollups),
    issues: {
      highSeverity: unresolvedIssues.filter(
        (entry) => entry.issueSeverity === 'high',
      ).length,
      inProgress: unresolvedIssues.filter(
        (entry) => entry.issueStatus === 'inProgress',
      ).length,
      open: unresolvedIssues.filter((entry) => entry.issueStatus === 'open')
        .length,
      resolved: garden.journalEntries.filter(
        (entry) => entry.type === 'issue' && entry.issueStatus === 'resolved',
      ).length,
      unresolved: unresolvedIssues.length,
    },
    media: {
      attachedPhotos: seasonEntries.reduce(
        (total, entry) => total + entry.photos.length,
        0,
      ),
      entriesWithPhotos: seasonEntries.filter((entry) => entry.photos.length)
        .length,
    },
    performance: buildPerformance(garden, seasonHarvests, cropRollups),
    seasonYear,
    waterAlerts: {
      acknowledged: waterAlertsAcknowledged,
      acknowledgementRate:
        waterAlertsSent > 0
          ? Math.min(
              100,
              Math.round((waterAlertsAcknowledged / waterAlertsSent) * 100),
            )
          : null,
      sent: waterAlertsSent,
    },
    yieldByBed: buildYieldByBed(garden, seasonHarvests),
    yieldByCrop: [...cropRollups.values()]
      .map((rollup) => ({
        cropName: rollup.cropName,
        total: formatRollupTotals(rollup),
      }))
      .filter((entry) => entry.total)
      .sort((left, right) => left.cropName.localeCompare(right.cropName)),
  };
}

function countAcknowledgedWaterAlerts(garden: Garden) {
  const acknowledged = new Set<string>();

  garden.tasks
    .filter((task) => task.type === 'water' && task.status === 'done')
    .forEach((task) => acknowledged.add(task.sourceId ?? task.id));
  garden.waterRecommendations
    .filter((recommendation) => recommendation.status === 'completed')
    .forEach((recommendation) => acknowledged.add(recommendation.id));

  return acknowledged.size;
}

function buildImpact(
  garden: Garden,
  seasonHarvests: HarvestEvent[],
  cropRollups: Map<string, CropRollup>,
) {
  const seedOrSeedlingCount = garden.plantings
    .filter((planting) => planting.status !== 'removed')
    .reduce((total, planting) => total + (planting.plantCount ?? 1), 0);
  const harvestedPlantings = new Set(
    seasonHarvests
      .map((harvest) => harvest.plantingId)
      .filter((plantingId): plantingId is string => Boolean(plantingId)),
  ).size;
  const estimatedValueUsd = [...cropRollups.values()].reduce(
    (total, rollup) => total + rollup.estimatedValueUsd,
    0,
  );

  return {
    estimatedValueLabel:
      estimatedValueUsd > 0 ? `$${Math.round(estimatedValueUsd)}` : '$0',
    estimatedValueNote:
      'Rough value proxy using conservative default unit values; freeform harvests are excluded.',
    harvestedPlantings,
    harvestEvents: seasonHarvests.length,
    seedOrSeedlingCount,
  };
}

function buildPerformance(
  garden: Garden,
  seasonHarvests: HarvestEvent[],
  cropRollups: Map<string, CropRollup>,
) {
  const harvestedPlantingIds = new Set(
    seasonHarvests
      .map((harvest) => harvest.plantingId)
      .filter((plantingId): plantingId is string => Boolean(plantingId)),
  );
  const bestPerformers = [...cropRollups.values()]
    .sort(
      (left, right) =>
        right.estimatedValueUsd - left.estimatedValueUsd ||
        right.eventCount - left.eventCount ||
        left.cropName.localeCompare(right.cropName),
    )
    .slice(0, 3)
    .map((rollup) => ({
      detail:
        rollup.estimatedValueUsd > 0
          ? `${formatRollupTotals(rollup)}; rough value $${Math.round(
              rollup.estimatedValueUsd,
            )}`
          : formatRollupTotals(rollup),
      label: rollup.cropName,
    }));
  const underperformers = garden.plantings
    .filter(
      (planting) =>
        !harvestedPlantingIds.has(planting.id) &&
        ['harvest-ready', 'harvested'].includes(planting.status),
    )
    .slice(0, 3)
    .map((planting) => ({
      detail:
        planting.status === 'harvest-ready'
          ? 'Harvest-ready with no logged harvest yet'
          : 'Marked harvested with no harvest amount logged',
      label: planting.label,
    }));

  return { bestPerformers, underperformers };
}

function buildHarvestTotals(harvests: HarvestEvent[]) {
  const totals = new Map<string, number>();
  const freeform: string[] = [];

  harvests.forEach((harvest) => {
    if (harvest.unit === 'freeform') {
      if (harvest.amountText) {
        freeform.push(harvest.amountText);
      }
      return;
    }

    totals.set(
      harvest.unit,
      (totals.get(harvest.unit) ?? 0) + (harvest.quantity ?? 0),
    );
  });

  return [
    ...[...totals.entries()].map(([unit, quantity]) => ({
      label: formatHarvestUnit(unit),
      value: formatQuantity(quantity),
    })),
    ...freeform.slice(0, 3).map((value, index) => ({
      label: index === 0 ? 'Other' : 'Other note',
      value,
    })),
  ];
}

function buildYieldByBed(garden: Garden, harvests: HarvestEvent[]) {
  const bedTotals = new Map<string, Map<string, number>>();
  const freeform = new Map<string, string[]>();

  harvests.forEach((harvest) => {
    const bedName = getHarvestBedLabel(garden, harvest);

    if (harvest.unit === 'freeform') {
      const values = freeform.get(bedName) ?? [];

      if (harvest.amountText) {
        values.push(harvest.amountText);
      }

      freeform.set(bedName, values);
      return;
    }

    const totals = bedTotals.get(bedName) ?? new Map<string, number>();
    totals.set(
      harvest.unit,
      (totals.get(harvest.unit) ?? 0) + (harvest.quantity ?? 0),
    );
    bedTotals.set(bedName, totals);
  });

  return [...new Set([...bedTotals.keys(), ...freeform.keys()])]
    .map((bedName) => ({
      bedName,
      total: [
        ...[...(bedTotals.get(bedName)?.entries() ?? [])].map(
          ([unit, quantity]) =>
            `${formatQuantity(quantity)} ${formatHarvestUnit(unit)}`,
        ),
        ...(freeform.get(bedName) ?? []),
      ].join(', '),
    }))
    .filter((entry) => entry.total)
    .sort((left, right) => left.bedName.localeCompare(right.bedName));
}

function buildActiveBeds(garden: Garden) {
  const counts = new Map<string, number>();

  garden.journalEntries.forEach((entry) => {
    addCount(counts, getJournalBedLabel(garden, entry));
  });
  garden.harvestEvents.forEach((harvest) => {
    addCount(counts, getHarvestBedLabel(garden, harvest));
  });

  return [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    )
    .slice(0, 5);
}

function getJournalBedLabel(garden: Garden, entry: JournalEntry) {
  if (entry.targetType === 'structure' && entry.structureId) {
    return (
      garden.structures.find((structure) => structure.id === entry.structureId)
        ?.label ?? entry.targetLabel
    );
  }

  if (entry.targetType === 'planting' && entry.plantingId) {
    const planting = garden.plantings.find(
      (candidate) => candidate.id === entry.plantingId,
    );
    return planting
      ? getBedLabelForPlanting(garden, planting)
      : entry.targetLabel;
  }

  return 'Whole garden';
}

function getHarvestBedLabel(garden: Garden, harvest: HarvestEvent) {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === harvest.plantingId,
  );

  return planting ? getBedLabelForPlanting(garden, planting) : 'Whole garden';
}

function getBedLabelForPlanting(garden: Garden, planting: Planting) {
  const bed = garden.structures.find(
    (structure) =>
      isBedLike(structure) && containsPlanting(structure, planting),
  );

  return bed?.label ?? 'Open plot';
}

function isBedLike(structure: Structure) {
  return (
    structure.type === 'bed' ||
    structure.type === 'container' ||
    structure.type === 'inGroundBed' ||
    structure.type === 'raisedBed'
  );
}

function containsPlanting(structure: Structure, planting: Planting) {
  return (
    planting.xFt >= structure.xFt &&
    planting.xFt <= structure.xFt + structure.widthFt &&
    planting.yFt >= structure.yFt &&
    planting.yFt <= structure.yFt + structure.depthFt
  );
}

function addCount(counts: Map<string, number>, label: string) {
  counts.set(label, (counts.get(label) ?? 0) + 1);
}
