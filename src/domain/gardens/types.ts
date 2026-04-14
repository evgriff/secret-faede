export type GardenRole = 'editor' | 'owner' | 'viewer';

export interface GardenDimensions {
  height: number;
  unit: 'ft';
  width: number;
}

export interface GardenSummary {
  dimensions: GardenDimensions;
  id: string;
  memberRole: GardenRole;
  name: string;
  plotCount: number;
  slug: string;
  timezone: string;
  updatedLabel: string;
}

export interface GardenPlot {
  height: number;
  id: string;
  name: string;
  rotation: number;
  width: number;
  x: number;
  y: number;
}

export interface SaveGardenPlotInput {
  height: number;
  id: string;
  name: string;
  rotation: number;
  width: number;
  x: number;
  y: number;
}
