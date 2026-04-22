import type { PlantingMode, StructureType } from './GardenRepository';

export interface TemplatePlanting {
  blockDepthFt?: number | null;
  blockWidthFt?: number | null;
  cropId: string;
  mode: PlantingMode;
  notes?: string;
  plantCount?: number | null;
  rowLengthFt?: number | null;
  xFt: number;
  yFt: number;
}

export interface TemplateStructure {
  depthFt: number;
  label: string;
  mulched?: boolean;
  plantings?: TemplatePlanting[];
  type: StructureType;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export function single(
  cropId: string,
  xFt: number,
  yFt: number,
): TemplatePlanting {
  return { cropId, mode: 'single', xFt, yFt };
}

export function cluster(
  cropId: string,
  plantCount: number,
  xFt: number,
  yFt: number,
): TemplatePlanting {
  return { cropId, mode: 'cluster', plantCount, xFt, yFt };
}

export function row(
  cropId: string,
  rowLengthFt: number,
  xFt: number,
  yFt: number,
): TemplatePlanting {
  return { cropId, mode: 'row', rowLengthFt, xFt, yFt };
}

export function block(
  cropId: string,
  blockWidthFt: number,
  blockDepthFt: number,
  xFt: number,
  yFt: number,
): TemplatePlanting {
  return { blockDepthFt, blockWidthFt, cropId, mode: 'block', xFt, yFt };
}

export function trellis(
  cropId: string,
  rowLengthFt: number,
  xFt: number,
  yFt: number,
): TemplatePlanting {
  return { cropId, mode: 'trellisLine', rowLengthFt, xFt, yFt };
}

export function bed(
  label: string,
  xFt: number,
  yFt: number,
  plantings: TemplatePlanting[],
): TemplateStructure {
  return {
    depthFt: 5,
    label,
    mulched: true,
    plantings,
    type: 'raisedBed',
    widthFt: 8,
    xFt,
    yFt,
  };
}

export function container(
  label: string,
  xFt: number,
  yFt: number,
  plantings: TemplatePlanting[],
): TemplateStructure {
  return {
    depthFt: 2,
    label,
    plantings,
    type: 'container',
    widthFt: 2,
    xFt,
    yFt,
  };
}

export function path(
  label: string,
  xFt: number,
  yFt: number,
  widthFt: number,
  depthFt: number,
): TemplateStructure {
  return { depthFt, label, type: 'pathway', widthFt, xFt, yFt };
}

export function trellisStructure(
  label: string,
  xFt: number,
  yFt: number,
  widthFt: number,
): TemplateStructure {
  return { depthFt: 0.5, label, type: 'trellis', widthFt, xFt, yFt };
}
