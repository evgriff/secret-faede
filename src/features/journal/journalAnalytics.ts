import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  HarvestEvent,
  JournalEntry,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';

export interface JournalAnalytics {
  activeBeds: Array<{ count: number; label: string }>;
  harvestTotals: Array<{ label: string; value: string }>;
  issues: {
    highSeverity: number;
    unresolved: number;
  };
  waterAlerts: {
    acknowledged: number;
    sent: number;
  };
  yieldByCrop: Array<{ cropName: string; total: string }>;
}

export function buildJournalAnalytics(
  garden: Garden,
  seasonYear = new Date().getFullYear(),
): JournalAnalytics {
  const seasonHarvests = garden.harvestEvents.filter((harvest) =>
    harvest.harvestedOn.startsWith(String(seasonYear)),
  );
  const unresolvedIssues = garden.journalEntries.filter(
    (entry) => entry.type === 'issue' && entry.issueStatus !== 'resolved',
  );

  return {
    activeBeds: buildActiveBeds(garden),
    harvestTotals: buildHarvestTotals(seasonHarvests),
    issues: {
      highSeverity: unresolvedIssues.filter(
        (entry) => entry.issueSeverity === 'high',
      ).length,
      unresolved: unresolvedIssues.length,
    },
    waterAlerts: {
      acknowledged: countAcknowledgedWaterAlerts(garden),
      sent: garden.notificationLogs.filter(
        (log) => log.type === 'watering' && log.status === 'sent',
      ).length,
    },
    yieldByCrop: buildYieldByCrop(seasonHarvests),
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

function buildYieldByCrop(harvests: HarvestEvent[]) {
  const totals = new Map<string, Map<string, number>>();
  const freeform = new Map<string, string[]>();

  harvests.forEach((harvest) => {
    const cropName =
      getCropById(harvest.cropId)?.commonName ?? 'Unassigned crop';

    if (harvest.unit === 'freeform') {
      const values = freeform.get(cropName) ?? [];
      if (harvest.amountText) {
        values.push(harvest.amountText);
      }
      freeform.set(cropName, values);
      return;
    }

    const cropTotals = totals.get(cropName) ?? new Map<string, number>();
    cropTotals.set(
      harvest.unit,
      (cropTotals.get(harvest.unit) ?? 0) + (harvest.quantity ?? 0),
    );
    totals.set(cropName, cropTotals);
  });

  return [...new Set([...totals.keys(), ...freeform.keys()])]
    .map((cropName) => ({
      cropName,
      total: [
        ...[...(totals.get(cropName)?.entries() ?? [])].map(
          ([unit, quantity]) =>
            `${formatQuantity(quantity)} ${formatHarvestUnit(unit)}`,
        ),
        ...(freeform.get(cropName) ?? []),
      ].join(', '),
    }))
    .filter((entry) => entry.total)
    .sort((left, right) => left.cropName.localeCompare(right.cropName));
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

function formatHarvestUnit(unit: string) {
  const labels: Record<string, string> = {
    bunch: 'bunches',
    count: 'count',
    lb: 'lb',
    oz: 'oz',
  };

  return labels[unit] ?? unit;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
