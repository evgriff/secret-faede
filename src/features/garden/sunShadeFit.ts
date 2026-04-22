import type {
  SunExposure,
  SunShadeArea,
  SunShadeSource,
} from '../../domain/gardens/GardenRepository';
import { getSunExposureScore } from './sunShadeEngine';

export type CropSunFitLevel = 'good' | 'underperform' | 'workable' | 'unknown';

export function describeCropSunFit(
  required: SunExposure | null,
  area: Pick<
    SunShadeArea,
    'exposure' | 'shadeSources' | 'source' | 'sunHours'
  > | null,
): { action: string; label: string; level: CropSunFitLevel; message: string } {
  if (!required || !area) {
    return {
      action:
        'Select a modeled or observed sun cell before trusting this placement guidance.',
      label: 'sun unknown',
      level: 'unknown',
      message: 'Sun guidance needs a modeled or observed cell.',
    };
  }

  const requiredScore = getSunExposureScore(required);
  const actualScore = getSunExposureScore(area.exposure);
  const sourceText =
    area.source === 'manual' ? 'manual observation' : 'modeled estimate';
  const shadeText = describeShadeSourceSummary(area.shadeSources);
  const hours = `${area.sunHours.toFixed(1)} direct-sun hr (${sourceText})`;

  if (
    actualScore >= requiredScore &&
    !(required === 'partShade' && area.exposure === 'fullSun') &&
    !(required === 'fullShade' && area.exposure !== 'fullShade')
  ) {
    return {
      action: 'Keep placement unless spacing or access suggests a move.',
      label: 'sun ready',
      level: 'good',
      message: `${hours} matches the crop preference.`,
    };
  }

  const underLit = actualScore < requiredScore;
  const workable = Math.abs(requiredScore - actualScore) <= 1;
  const shadeSuffix = shadeText ? `, away from ${shadeText}` : '';

  return {
    action: underLit
      ? `${workable ? 'Move brighter' : 'Move much brighter'}${shadeSuffix}, or paint a field correction.`
      : 'Move to gentler exposure if heat stress appears.',
    label: workable ? 'sun check' : 'sun mismatch',
    level: workable ? 'workable' : 'underperform',
    message: underLit
      ? `${hours} is ${workable ? 'close to' : 'below'} the crop preference.`
      : `${hours} is brighter than preferred.`,
  };
}

export function describeShadeSourceSummary(
  sources: SunShadeSource[] | undefined,
) {
  if (!sources?.length) {
    return '';
  }

  const tallCrop = sources.find((source) =>
    ['tallCrop', 'trellisedCrop'].includes(source.kind),
  );
  const savedShadeSource = sources.find(
    (source) => source.kind === 'treeObstacle',
  );
  const source = tallCrop ?? savedShadeSource ?? sources[0];

  if (!source) {
    return '';
  }

  return `${shadeKindLabels[source.kind]} shade from ${source.label}`;
}

const shadeKindLabels: Record<SunShadeSource['kind'], string> = {
  fenceWall: 'wall/fence',
  structure: 'structure',
  tallCrop: 'tall-crop',
  treeObstacle: 'saved-source',
  trellisedCrop: 'trellised-crop',
  trellis: 'trellis',
};
