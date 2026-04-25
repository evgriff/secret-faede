import { getCropById } from '../../domain/crops/cropCatalog';
import {
  getInGroundDate,
  getLatestPlantingEventDate,
  type Garden,
  type LocalDateString,
  type Planting,
} from '../../domain/gardens/GardenRepository';

const dayMs = 24 * 60 * 60 * 1000;
const openingWindowDays = 7;

export type PlantingHarvestScheduleStatus =
  | 'late'
  | 'opening'
  | 'ready'
  | 'upcoming';

export interface PlantingHarvestSchedule {
  cropName: string;
  expectedHarvestDate: LocalDateString;
  isIndoorEstimate: boolean;
  planting: Planting;
  status: PlantingHarvestScheduleStatus;
}

export function getPlantingHarvestSchedule(
  _garden: Garden,
  planting: Planting,
  todayDate: LocalDateString,
): PlantingHarvestSchedule | null {
  if (planting.status === 'removed' || planting.status === 'harvested') {
    return null;
  }

  const crop = planting.cropId ? getCropById(planting.cropId) : null;

  if (!crop?.daysToMaturity) {
    return null;
  }

  const inGroundDate = getInGroundDate(planting);
  const startedInsideDate = getLatestPlantingEventDate(
    planting,
    'startedInside',
  );
  const anchorDate = inGroundDate ?? startedInsideDate ?? null;

  if (!anchorDate) {
    return null;
  }

  const expectedHarvestDate = addDays(anchorDate, crop.daysToMaturity);

  return {
    cropName: crop.commonName,
    expectedHarvestDate,
    isIndoorEstimate: !inGroundDate && Boolean(startedInsideDate),
    planting,
    status: getHarvestScheduleStatus(planting, expectedHarvestDate, todayDate),
  };
}

function getHarvestScheduleStatus(
  planting: Planting,
  expectedHarvestDate: LocalDateString,
  todayDate: LocalDateString,
): PlantingHarvestScheduleStatus {
  if (planting.status === 'harvest-ready') {
    return 'ready';
  }

  if (expectedHarvestDate < todayDate) {
    return 'late';
  }

  if (expectedHarvestDate <= addDays(todayDate, openingWindowDays)) {
    return 'opening';
  }

  return 'upcoming';
}

function addDays(date: LocalDateString, days: number): LocalDateString {
  return toLocalDate(new Date(parseLocalDate(date).getTime() + days * dayMs));
}

function parseLocalDate(date: LocalDateString) {
  const [year = '1970', month = '1', day = '1'] = date.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function toLocalDate(date: Date): LocalDateString {
  return date.toISOString().slice(0, 10);
}
