import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  LocalDateString,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';

export interface RotationGuidance {
  family: string;
  level: 'avoid' | 'caution' | 'safe' | 'unknown';
  message: string;
  plantingId: string;
}

const dayMs = 24 * 60 * 60 * 1000;

export function buildRotationGuidance(
  garden: Garden,
  now = new Date(),
): RotationGuidance[] {
  const today = toLocalDate(now);

  return garden.plantings
    .filter(isActivePlanting)
    .flatMap((planting): RotationGuidance[] => {
      const crop = getCropById(planting.cropId);

      if (!crop?.family) {
        return [
          {
            family: 'Unknown',
            level: 'unknown',
            message: 'Rotation guidance needs a crop family.',
            plantingId: planting.id,
          },
        ];
      }

      const bedKey = getBedKey(garden, planting);
      const currentDate = planting.plannedFor ?? planting.plantedOn ?? today;
      const prior = garden.plantings
        .filter((candidate) => candidate.id !== planting.id)
        .filter((candidate) => candidate.status === 'harvested')
        .map((candidate) => toRotationRecord(garden, candidate))
        .flatMap((record) =>
          record &&
          record.bedKey === bedKey &&
          record.family === crop.family &&
          record.date <= currentDate
            ? [record]
            : [],
        )
        .sort((left, right) => right.date.localeCompare(left.date))[0];

      if (!prior) {
        return [
          {
            family: crop.family,
            level: 'safe',
            message:
              'No saved same-family harvest in this bed within the checked history.',
            plantingId: planting.id,
          },
        ];
      }

      const ageDays = differenceInDays(currentDate, prior.date);
      const level =
        ageDays <= 365 ? 'avoid' : ageDays <= 730 ? 'caution' : 'safe';

      return [
        {
          family: crop.family,
          level,
          message:
            level === 'safe'
              ? `${crop.family} appears outside the two-season caution window for this bed.`
              : `${crop.family} follows ${prior.label} in the same bed after ${Math.max(
                  Math.round(ageDays / 30),
                  1,
                )} months. This is saved-history guidance, not a disease guarantee.`,
          plantingId: planting.id,
        },
      ];
    });
}

function toRotationRecord(garden: Garden, planting: Planting) {
  const crop = getCropById(planting.cropId);
  const harvest = garden.harvestEvents
    .filter((event) => event.plantingId === planting.id)
    .sort((left, right) =>
      right.harvestedOn.localeCompare(left.harvestedOn),
    )[0];
  const date =
    harvest?.harvestedOn ?? planting.plantedOn ?? planting.plannedFor;

  if (!crop?.family || !date) {
    return null;
  }

  return {
    bedKey: getBedKey(garden, planting),
    date,
    family: crop.family,
    label: planting.label,
  };
}

function getBedKey(garden: Garden, planting: Planting) {
  return (
    findContainingStructure(garden.structures.filter(isBedLike), planting)
      ?.id ?? 'open-plot'
  );
}

function findContainingStructure(structures: Structure[], planting: Planting) {
  return structures.find((structure) => containsPoint(structure, planting));
}

function isActivePlanting(planting: Planting) {
  return planting.status !== 'removed' && planting.status !== 'harvested';
}

function isBedLike(structure: Structure) {
  return ['bed', 'container', 'inGroundBed', 'raisedBed'].includes(
    structure.type,
  );
}

function containsPoint(structure: Structure, planting: Planting) {
  return (
    planting.xFt >= structure.xFt &&
    planting.xFt <= structure.xFt + structure.widthFt &&
    planting.yFt >= structure.yFt &&
    planting.yFt <= structure.yFt + structure.depthFt
  );
}

function differenceInDays(later: LocalDateString, earlier: LocalDateString) {
  return Math.round(
    (parseLocalDate(later).getTime() - parseLocalDate(earlier).getTime()) /
      dayMs,
  );
}

function parseLocalDate(date: LocalDateString) {
  const [year = '1970', month = '1', day = '1'] = date.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function toLocalDate(date: Date): LocalDateString {
  return date.toISOString().slice(0, 10);
}
