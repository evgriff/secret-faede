import { getCropById } from '../../domain/crops/cropCatalog';
import type { HarvestEvent } from '../../domain/gardens/GardenRepository';

export interface CropRollup {
  cropName: string;
  estimatedValueUsd: number;
  eventCount: number;
  freeform: string[];
  totals: Map<string, number>;
}

export function buildCropRollups(harvests: HarvestEvent[]) {
  const rollups = new Map<string, CropRollup>();

  harvests.forEach((harvest) => {
    const cropName =
      getCropById(harvest.cropId)?.commonName ?? 'Unassigned crop';
    const rollup = rollups.get(cropName) ?? {
      cropName,
      estimatedValueUsd: 0,
      eventCount: 0,
      freeform: [],
      totals: new Map<string, number>(),
    };

    rollup.eventCount += 1;

    if (harvest.unit === 'freeform') {
      if (harvest.amountText) {
        rollup.freeform.push(harvest.amountText);
      }
    } else {
      rollup.totals.set(
        harvest.unit,
        (rollup.totals.get(harvest.unit) ?? 0) + (harvest.quantity ?? 0),
      );
      rollup.estimatedValueUsd += estimateHarvestValue(harvest);
    }

    rollups.set(cropName, rollup);
  });

  return rollups;
}

export function formatRollupTotals(rollup: CropRollup) {
  return [
    ...[...rollup.totals.entries()].map(
      ([unit, quantity]) =>
        `${formatQuantity(quantity)} ${formatHarvestUnit(unit)}`,
    ),
    ...rollup.freeform,
  ].join(', ');
}

export function formatHarvestUnit(unit: string) {
  const labels: Record<string, string> = {
    bunch: 'bunches',
    count: 'count',
    lb: 'lb',
    oz: 'oz',
  };

  return labels[unit] ?? unit;
}

export function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function estimateHarvestValue(harvest: HarvestEvent) {
  const quantity = harvest.quantity ?? 0;

  switch (harvest.unit) {
    case 'lb':
      return quantity * 4;
    case 'oz':
      return (quantity / 16) * 4;
    case 'count':
      return quantity * 0.75;
    case 'bunch':
      return quantity * 3;
    case 'freeform':
      return 0;
  }
}
