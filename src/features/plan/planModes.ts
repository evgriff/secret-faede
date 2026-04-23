export type PlanMode = 'optimize' | 'plant' | 'select' | 'structure' | 'sun';

export const planModes: Array<{
  description: string;
  label: string;
  mode: Exclude<PlanMode, 'select'>;
}> = [
  {
    description:
      'Place crop-backed plantings by hand when the layout needs it.',
    label: 'Plant',
    mode: 'plant',
  },
  {
    description: 'Place beds, containers, paths, and trellises.',
    label: 'Structure',
    mode: 'structure',
  },
  {
    description:
      'Resolve current problems and compare checked whole-plot variants.',
    label: 'Optimize',
    mode: 'optimize',
  },
  {
    description: 'Review sun layers, shade assumptions, and manual overrides.',
    label: 'Sun',
    mode: 'sun',
  },
];

export function getPlanModeLabel(mode: PlanMode) {
  return planModes.find((entry) => entry.mode === mode)?.label ?? 'Plan';
}
