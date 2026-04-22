export type PlanMode =
  | 'measure'
  | 'optimize'
  | 'plant'
  | 'select'
  | 'structure'
  | 'sun';

export const planModes: Array<{
  description: string;
  keyboard: string;
  label: string;
  mode: PlanMode;
}> = [
  {
    description: 'Pick up, inspect, and edit garden items.',
    keyboard: 'V',
    label: 'Select',
    mode: 'select',
  },
  {
    description: 'Add crop-backed plantings to the plot.',
    keyboard: 'P',
    label: 'Plant',
    mode: 'plant',
  },
  {
    description: 'Place beds, paths, containers, and crop supports.',
    keyboard: 'B',
    label: 'Structure',
    mode: 'structure',
  },
  {
    description: 'Accept, reject, or snooze layout and self-fix proposals.',
    keyboard: 'O',
    label: 'Optimize',
    mode: 'optimize',
  },
  {
    description: 'Read plot scale, coordinates, and orientation.',
    keyboard: 'M',
    label: 'Measure',
    mode: 'measure',
  },
  {
    description: 'Review sun layers, climate assumptions, and overrides.',
    keyboard: 'S',
    label: 'Sun/Climate',
    mode: 'sun',
  },
];

export function getPlanModeLabel(mode: PlanMode) {
  return planModes.find((entry) => entry.mode === mode)?.label ?? 'Select';
}
