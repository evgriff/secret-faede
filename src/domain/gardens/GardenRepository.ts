import type { GardenPlot, GardenSummary, SaveGardenPlotInput } from './types';

export interface GardenRepository {
  deletePlot(gardenId: string, plotId: string, uid: string): Promise<void>;
  getById(gardenId: string, uid: string): Promise<GardenSummary | null>;
  listPlots(gardenId: string, uid: string): Promise<GardenPlot[]>;
  listForUser(uid: string): Promise<GardenSummary[]>;
  savePlot(
    gardenId: string,
    plot: SaveGardenPlotInput,
    uid: string,
  ): Promise<GardenPlot>;
}
