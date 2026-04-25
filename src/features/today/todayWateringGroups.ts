import type {
  Garden,
  Structure,
  WateringScheduleEntry,
  WateringScheduleUrgency,
} from '../../domain/gardens/GardenRepository';
import { toLocalDate } from './todayFormatters';

export interface TodayWateringGroup {
  dueDate: string;
  entries: WateringScheduleEntry[];
  entryIds: string[];
  hiddenMemberCount: number;
  id: string;
  label: string;
  memberCount: number;
  memberLabels: string[];
  reasonSummary: string;
  statusSummary: string | null;
  targetCount: number;
  totalTargetAmountInches: number;
  urgency: WateringScheduleUrgency;
  visibleMemberLabels: string[];
  wateringZoneId: string | null;
}

export function buildTodayWateringGroups(
  garden: Garden,
  selectedDate: string,
  todayDate: string,
  now: Date,
): TodayWateringGroup[] {
  const activeEntries = getActiveWateringEntries(
    garden,
    selectedDate,
    todayDate,
    now,
  );
  const groups = new Map<string, WateringScheduleEntry[]>();

  activeEntries.forEach((entry) => {
    const key = getWateringGroupKey(entry);
    const current = groups.get(key);

    if (current) {
      current.push(entry);
      return;
    }

    groups.set(key, [entry]);
  });

  return [...groups.entries()]
    .map(([key, entries]) => buildTodayWateringGroup(garden, key, entries))
    .sort(
      (left, right) =>
        urgencyRank(right.urgency) - urgencyRank(left.urgency) ||
        right.totalTargetAmountInches - left.totalTargetAmountInches ||
        left.label.localeCompare(right.label),
    )
    .slice(0, 6);
}

export function getActiveWateringEntries(
  garden: Garden,
  selectedDate: string,
  todayDate: string,
  now: Date,
) {
  const currentDate = toLocalDate(now);
  const showDueBySelectedDate = selectedDate === todayDate;

  return garden.wateringSchedule
    .filter(
      (entry) =>
        ['due', 'partial', 'scheduled', 'snoozed'].includes(entry.status) &&
        entry.targetAmountInches > 0 &&
        (showDueBySelectedDate
          ? entry.dueDate <= selectedDate
          : entry.dueDate === selectedDate) &&
        !isDeferredUntilLaterToday(entry, selectedDate, currentDate, now),
    )
    .sort(
      (left, right) =>
        urgencyRank(right.urgency) - urgencyRank(left.urgency) ||
        right.targetAmountInches - left.targetAmountInches,
    );
}

export function isDeferredUntilLaterToday(
  entry: Garden['wateringSchedule'][number],
  selectedDate: string,
  currentDate: string,
  now: Date,
) {
  if (
    selectedDate !== currentDate ||
    (entry.status !== 'scheduled' && entry.status !== 'snoozed')
  ) {
    return false;
  }

  const dueWindowStartMs = Date.parse(entry.dueWindowStartIso ?? '');
  return Number.isFinite(dueWindowStartMs) && dueWindowStartMs > now.getTime();
}

function buildTodayWateringGroup(
  garden: Garden,
  key: string,
  entries: WateringScheduleEntry[],
): TodayWateringGroup {
  const memberLabels = getGroupMemberLabels(garden, entries);
  const firstEntry = entries[0];
  const totalTargetAmountInches = roundTo(
    entries.reduce((total, entry) => total + entry.targetAmountInches, 0),
    2,
  );

  return {
    dueDate:
      [...entries]
        .map((entry) => entry.dueDate)
        .sort((left, right) => left.localeCompare(right))[0] ??
      firstEntry?.dueDate ??
      '',
    entries,
    entryIds: entries.map((entry) => entry.id),
    hiddenMemberCount: Math.max(memberLabels.length - 3, 0),
    id: key,
    label: getGroupLabel(entries),
    memberCount: memberLabels.length,
    memberLabels,
    reasonSummary: getGroupReasonSummary(entries),
    statusSummary: getGroupStatusSummary(entries),
    targetCount: entries.length,
    totalTargetAmountInches,
    urgency: getHighestUrgency(entries),
    visibleMemberLabels: memberLabels.slice(0, 3),
    wateringZoneId: firstEntry?.wateringZoneId ?? null,
  };
}

function getGroupLabel(entries: WateringScheduleEntry[]) {
  const bedEntry = entries.find((entry) => entry.targetKind === 'bed');

  if (bedEntry) {
    return bedEntry.targetLabel;
  }

  return entries[0]?.targetLabel ?? 'Watering run';
}

function getGroupMemberLabels(
  garden: Garden,
  entries: WateringScheduleEntry[],
) {
  const memberLabels = new Set<string>();

  entries.forEach((entry) => {
    if (entry.targetKind === 'planting') {
      const planting = garden.plantings.find(
        (candidate) => candidate.id === entry.targetId,
      );

      if (planting?.label) {
        memberLabels.add(planting.label);
        return;
      }

      memberLabels.add(entry.targetLabel);
      return;
    }

    const structure = garden.structures.find(
      (candidate) => candidate.id === entry.targetId,
    );

    if (!structure) {
      memberLabels.add(entry.targetLabel);
      return;
    }

    const plantings = getPlantingsInsideStructure(garden.plantings, structure);

    if (plantings.length === 0) {
      memberLabels.add(entry.targetLabel);
      return;
    }

    plantings.forEach((planting) => memberLabels.add(planting.label));
  });

  return [...memberLabels];
}

function getPlantingsInsideStructure(
  plantings: Garden['plantings'],
  structure: Structure,
) {
  return plantings
    .filter(
      (planting) =>
        planting.status !== 'harvested' &&
        planting.status !== 'removed' &&
        isPointInsideStructure(planting.xFt, planting.yFt, structure),
    )
    .sort((left, right) => left.label.localeCompare(right.label));
}

function isPointInsideStructure(
  xFt: number,
  yFt: number,
  structure: Structure,
) {
  return (
    xFt >= structure.xFt &&
    xFt <= structure.xFt + structure.widthFt &&
    yFt >= structure.yFt &&
    yFt <= structure.yFt + structure.depthFt
  );
}

function getGroupReasonSummary(entries: WateringScheduleEntry[]) {
  const uniqueReasons = [
    ...new Set(entries.map((entry) => entry.reasonSummary)),
  ];

  if (uniqueReasons.length === 1) {
    return uniqueReasons[0] ?? 'Watering is due.';
  }

  return `Use one watering pass for these ${entries.length} nearby targets.`;
}

function getGroupStatusSummary(entries: WateringScheduleEntry[]) {
  const partialCount = entries.filter(
    (entry) => entry.status === 'partial',
  ).length;
  const snoozedCount = entries.filter(
    (entry) => entry.status === 'snoozed',
  ).length;
  const scheduledCount = entries.filter(
    (entry) => entry.status === 'scheduled',
  ).length;

  if (partialCount > 0) {
    return `${partialCount} target${partialCount === 1 ? '' : 's'} still have remaining water due.`;
  }

  if (snoozedCount > 0) {
    return `${snoozedCount} target${snoozedCount === 1 ? '' : 's'} were snoozed and are back in this watering run.`;
  }

  if (scheduledCount > 0) {
    return `${scheduledCount} target${scheduledCount === 1 ? '' : 's'} opened at the saved watering check time.`;
  }

  return null;
}

function getHighestUrgency(entries: WateringScheduleEntry[]) {
  return (
    [...entries].sort(
      (left, right) => urgencyRank(right.urgency) - urgencyRank(left.urgency),
    )[0]?.urgency ?? 'low'
  );
}

function getWateringGroupKey(entry: WateringScheduleEntry) {
  if (entry.wateringZoneId) {
    return `zone:${entry.wateringZoneId}`;
  }

  if (entry.targetKind === 'bed') {
    return `bed:${entry.targetId}`;
  }

  return `planting:${entry.targetId}`;
}

function urgencyRank(urgency: WateringScheduleUrgency) {
  switch (urgency) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function roundTo(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
