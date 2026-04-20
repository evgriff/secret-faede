export interface GardenPlot {
  depthFt: number;
  gridUnitFt: 1;
  snapUnitFt: 0.5;
  widthFt: number;
}

export interface GardenPlant {
  id: string;
  type: 'plant';
  xFt: number;
  yFt: number;
}

export interface Garden {
  plants: GardenPlant[];
  plot: GardenPlot;
  userId: string;
}

export const defaultGardenPlot: GardenPlot = {
  depthFt: 8,
  gridUnitFt: 1,
  snapUnitFt: 0.5,
  widthFt: 12,
};

export function createDefaultGarden(userId: string): Garden {
  return {
    plants: [],
    plot: defaultGardenPlot,
    userId,
  };
}

export interface GardenRepository {
  getGarden(userId: string): Promise<Garden | null>;
  saveGarden(garden: Garden): Promise<void>;
}
