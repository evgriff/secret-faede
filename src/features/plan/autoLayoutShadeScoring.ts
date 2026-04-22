import { getCropById } from '../../domain/crops/cropCatalog';
import type { Garden } from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  type FootRect,
} from '../garden/gardenPlanning';
import { doesPlantingReserveSpace } from '../garden/gardenImmutability';
import type { ScoredPlacement } from './autoLayoutScoring';

export function scorePlacementShadeDiscipline(
  garden: Garden,
  placement: ScoredPlacement,
  existingPlacements: ScoredPlacement[],
) {
  const candidate = toShadeSubject(placement);
  const existingSubjects = [
    ...existingPlacements.map(toShadeSubject),
    ...getSavedShadeSubjects(garden),
  ];
  const penalties = existingSubjects.filter((subject) =>
    createsShadeConflict(candidate, subject),
  ).length;

  return clamp01(1 - penalties * 0.28);
}

export function scoreShadeManagement(
  garden: Garden,
  placements: ScoredPlacement[],
) {
  const subjects = [
    ...placements.map(toShadeSubject),
    ...getSavedShadeSubjects(garden),
  ];

  if (subjects.length < 2) {
    return 1;
  }

  let penalties = 0;
  let checks = 0;

  for (const tall of subjects) {
    for (const short of subjects) {
      if (short === tall) {
        continue;
      }

      if (!isTallCaster(tall) || !isShadeSensitive(short)) {
        continue;
      }

      checks += 1;
      if (tallLikelyShadesShort(tall.rect, short.rect)) {
        penalties += 1;
      }
    }
  }

  return checks ? clamp01(1 - penalties / checks) : 1;
}

interface ShadeSubject {
  heightInches: number;
  rect: FootRect;
  shadeSensitive: boolean;
  tall: boolean;
}

function toShadeSubject(placement: ScoredPlacement): ShadeSubject {
  const heightInches = placement.crop.matureHeightInches ?? 18;

  return {
    heightInches,
    rect: getPlantingFootprint(placement.planting),
    shadeSensitive: placement.crop.sunRequirement === 'fullSun',
    tall: heightInches >= 48 || placement.crop.trellisRequired,
  };
}

function getSavedShadeSubjects(garden: Garden): ShadeSubject[] {
  const plantingSubjects = garden.plantings
    .filter(doesPlantingReserveSpace)
    .flatMap((planting): ShadeSubject[] => {
      const crop = getCropById(planting.cropId);

      if (!crop || isAutoLayoutItem(planting)) {
        return [];
      }

      return [
        toShadeSubject({
          crop,
          fitLevel: 'workable',
          planting,
          required: false,
        }),
      ];
    });
  const structureSubjects = garden.structures
    .filter((structure) => (structure.heightFt ?? 0) >= 3)
    .map((structure) => ({
      heightInches: (structure.heightFt ?? 0) * 12,
      rect: getStructureFootprint(structure),
      shadeSensitive: false,
      tall: true,
    }));

  return [...plantingSubjects, ...structureSubjects];
}

function createsShadeConflict(left: ShadeSubject, right: ShadeSubject) {
  return (
    (isTallCaster(left) &&
      isShadeSensitive(right) &&
      tallLikelyShadesShort(left.rect, right.rect)) ||
    (isTallCaster(right) &&
      isShadeSensitive(left) &&
      tallLikelyShadesShort(right.rect, left.rect))
  );
}

function isTallCaster(subject: ShadeSubject) {
  return subject.tall || subject.heightInches >= 48;
}

function isShadeSensitive(subject: ShadeSubject) {
  return subject.shadeSensitive;
}

function tallLikelyShadesShort(tall: FootRect, short: FootRect) {
  const tallCenterX = tall.xFt + tall.widthFt / 2;
  const tallCenterY = tall.yFt + tall.depthFt / 2;
  const shortCenterX = short.xFt + short.widthFt / 2;
  const shortCenterY = short.yFt + short.depthFt / 2;
  const xReach = Math.max(3, tall.widthFt / 2 + short.widthFt / 2 + 1);

  return (
    tallCenterY > shortCenterY && Math.abs(tallCenterX - shortCenterX) <= xReach
  );
}

function isAutoLayoutItem(item: { id: string; notes?: string }) {
  return (
    item.id.includes('[auto-layout]') || item.notes?.includes('[auto-layout]')
  );
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
