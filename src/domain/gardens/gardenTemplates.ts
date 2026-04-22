import { getCropById } from '../crops/cropCatalog';
import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type ClimateProfile,
  type CropProfile,
  type Garden,
  type GardenLocation,
  type Planting,
  type Structure,
} from './GardenRepository';
import {
  bed,
  block,
  cluster,
  container,
  path,
  row,
  single,
  type TemplatePlanting,
  type TemplateStructure,
  trellis,
  trellisStructure,
} from './gardenTemplateHelpers';
import { withPlantingInstances } from './plantingInstances';

export type GardenSetupPlotType =
  | 'containers'
  | 'inGround'
  | 'mixed'
  | 'raisedBed';

export interface GardenTemplate {
  description: string;
  id: string;
  name: string;
  plotDepthFt: number;
  plotType: GardenSetupPlotType;
  plotWidthFt: number;
  starterLevel: 'beginner' | 'experienced';
  structures: TemplateStructure[];
  summary: string;
}

export interface GardenSetupRequest {
  climateProfile: ClimateProfile;
  gardenName: string;
  location: GardenLocation;
  plotDepthFt: number;
  plotType: GardenSetupPlotType;
  plotWidthFt: number;
  templateId: string;
}

export const blankTemplateId = 'blank';

export const gardenTemplates: GardenTemplate[] = [
  {
    description:
      'One productive raised bed with familiar crops and a simple trellis edge.',
    id: 'small-raised-bed',
    name: 'Small raised bed',
    plotDepthFt: 8,
    plotType: 'raisedBed',
    plotWidthFt: 12,
    starterLevel: 'beginner',
    structures: [
      {
        depthFt: 4,
        label: '4 x 8 raised bed',
        mulched: true,
        plantings: [
          block('lettuce', 3, 3, 2.5, 3),
          cluster('basil', 2, 5.5, 3),
          row('carrot', 5, 4, 4),
          trellis('snap-pea', 6, 6, 2),
        ],
        type: 'raisedBed',
        widthFt: 8,
        xFt: 2,
        yFt: 2,
      },
      trellisStructure('Bed trellis', 2, 1.4, 8),
    ],
    summary: 'A forgiving 4 x 8 bed for greens, roots, herbs, and peas.',
  },
  {
    description:
      'Containers for renters, balconies, patios, and compact sunny corners.',
    id: 'patio-containers',
    name: 'Patio containers',
    plotDepthFt: 8,
    plotType: 'containers',
    plotWidthFt: 10,
    starterLevel: 'beginner',
    structures: [
      container('Tomato pot', 1, 1, [single('cherry-tomato', 1.8, 1.8)]),
      container('Basil pot', 4, 1, [cluster('basil', 2, 4.8, 1.8)]),
      container('Herb pot', 7, 1, [cluster('parsley', 2, 7.8, 1.8)]),
      container('Salad tub', 2, 4.4, [block('lettuce', 2, 3, 3, 5.2)]),
      container('Pepper pot', 6.5, 4.4, [single('pepper-sweet', 7.3, 5.2)]),
    ],
    summary:
      'A sunny patio plan with pots for tomatoes, herbs, greens, and peppers.',
  },
  {
    description:
      'Fast greens and roots arranged for repeat harvests and easy replanting.',
    id: 'salad-garden',
    name: 'Salad garden',
    plotDepthFt: 8,
    plotType: 'raisedBed',
    plotWidthFt: 12,
    starterLevel: 'beginner',
    structures: [
      {
        depthFt: 3.5,
        label: 'Spring salad bed',
        mulched: true,
        plantings: [
          block('lettuce', 3, 3, 2.5, 2.4),
          block('spinach', 3, 2, 5.6, 2.2),
          row('radish', 5, 2.8, 4.9),
          row('scallion', 5, 6.3, 4.9),
        ],
        type: 'raisedBed',
        widthFt: 9,
        xFt: 1.5,
        yFt: 1.5,
      },
    ],
    summary: 'Cut-and-come-again greens, radishes, and scallions.',
  },
  {
    description:
      'A compact high-yield layout with multiple beds for meals, snacks, and storage.',
    id: 'feed-the-family',
    name: 'Feed-the-family',
    plotDepthFt: 18,
    plotType: 'mixed',
    plotWidthFt: 24,
    starterLevel: 'experienced',
    structures: [
      bed('Tomato and basil bed', 1, 1, [
        trellis('tomato', 8, 3, 2),
        cluster('basil', 4, 5, 4),
      ]),
      bed('Bean and cucumber bed', 11, 1, [
        trellis('cucumber', 6, 13, 2),
        row('bush-bean', 7, 15, 4.5),
      ]),
      bed('Roots and greens bed', 1, 7, [
        block('carrot', 3, 5, 3, 8.5),
        block('kale', 4, 2, 6, 10),
      ]),
      bed('Squash and flowers bed', 11, 7, [
        single('zucchini', 13, 9.5),
        cluster('nasturtium', 3, 17, 10),
      ]),
      path('Main path', 10, 0.5, 3, 17),
    ],
    summary: 'Four beds for warm-season staples, roots, greens, and flowers.',
  },
  {
    description:
      'A mixed edible bed with herbs and flowers that support pollinators near crops.',
    id: 'pollinator-herb-mixed-bed',
    name: 'Pollinator/herb bed',
    plotDepthFt: 10,
    plotType: 'mixed',
    plotWidthFt: 14,
    starterLevel: 'beginner',
    structures: [
      {
        depthFt: 6,
        label: 'Herb and flower bed',
        mulched: true,
        plantings: [
          cluster('basil', 3, 3, 3),
          cluster('chives', 3, 5.5, 3),
          cluster('thyme', 3, 8, 3),
          cluster('marigold', 4, 3, 6),
          cluster('calendula', 4, 6.5, 6),
          cluster('borage', 2, 10, 5.5),
        ],
        type: 'inGroundBed',
        widthFt: 10,
        xFt: 2,
        yFt: 2,
      },
    ],
    summary: 'Herbs and flowers around edible crops for a useful mixed bed.',
  },
];

export function createGardenFromSetup(
  baseGarden: Garden,
  request: GardenSetupRequest,
): Garden {
  const template = gardenTemplates.find(
    (entry) => entry.id === request.templateId,
  );
  const structures = template
    ? template.structures.map((structure, index) =>
        createTemplateStructure(structure, index),
      )
    : [];
  const plantings = template
    ? template.structures.flatMap((structure, structureIndex) =>
        (structure.plantings ?? []).map((planting, plantingIndex) =>
          createTemplatePlanting(planting, structureIndex, plantingIndex),
        ),
      )
    : [];
  return {
    ...createDefaultGarden(baseGarden.userId),
    climateProfile: request.climateProfile,
    harvestEvents: baseGarden.harvestEvents,
    id: baseGarden.id,
    journalEntries: baseGarden.journalEntries,
    name: request.gardenName.trim() || 'Home garden',
    notificationLogs: baseGarden.notificationLogs,
    plantings,
    plot: {
      ...baseGarden.plot,
      depthFt: request.plotDepthFt,
      location: request.location,
      widthFt: request.plotWidthFt,
    },
    structures,
    updatedAtIso: new Date().toISOString(),
    userId: baseGarden.userId,
  };
}

function createTemplateStructure(
  template: TemplateStructure,
  index: number,
): Structure {
  return {
    ...createDefaultStructure({
      id: `template-structure-${index + 1}`,
      type: template.type,
      xFt: template.xFt,
      yFt: template.yFt,
    }),
    depthFt: template.depthFt,
    label: template.label,
    mulched: template.mulched ?? false,
    widthFt: template.widthFt,
  };
}

function createTemplatePlanting(
  template: TemplatePlanting,
  structureIndex: number,
  plantingIndex: number,
): Planting {
  const crop = getCropById(template.cropId);
  const plant = createDefaultPlanting({
    id: `template-planting-${structureIndex + 1}-${plantingIndex + 1}`,
    label: crop?.commonName ?? template.cropId,
    xFt: template.xFt,
    yFt: template.yFt,
  });

  return withPlantingInstances({
    ...plant,
    blockDepthFt: template.blockDepthFt ?? null,
    blockWidthFt: template.blockWidthFt ?? null,
    cropId: crop?.id ?? template.cropId,
    matureHeightInches: crop?.matureHeightInches ?? null,
    matureSpreadInches: crop?.matureSpreadInches ?? null,
    mode: template.mode,
    notes: template.notes ?? crop?.notes ?? '',
    plantCount: template.plantCount ?? inferPlantCount(crop, template),
    rowLengthFt: template.rowLengthFt ?? null,
    rowSpacingFt: crop?.rowSpacingInches ? crop.rowSpacingInches / 12 : null,
    rowSpacingInches: crop?.rowSpacingInches ?? null,
    spacingInches: crop?.spacingInches ?? null,
    sunRequirement: crop?.sunRequirement ?? null,
    trellisLengthFt:
      template.mode === 'trellisLine' ? (template.rowLengthFt ?? 6) : null,
    weeklyWaterNeedInches: crop?.weeklyWaterNeedInches ?? null,
  });
}

function inferPlantCount(crop: CropProfile | null, template: TemplatePlanting) {
  const spacingFt = Math.max((crop?.spacingInches ?? 12) / 12, 0.5);

  if (template.mode === 'row' || template.mode === 'trellisLine') {
    return Math.max(Math.floor((template.rowLengthFt ?? 6) / spacingFt), 1);
  }

  if (template.mode === 'block') {
    return Math.max(
      Math.floor((template.blockWidthFt ?? 3) / spacingFt) *
        Math.floor((template.blockDepthFt ?? 3) / spacingFt),
      1,
    );
  }

  return template.plantCount ?? 1;
}
