import type { GardenRepository } from '../../../domain/gardens/GardenRepository';
import type {
  GardenPlot,
  GardenSummary,
  SaveGardenPlotInput,
} from '../../../domain/gardens/types';
import { mockGardens } from './mockGardens';
import { mockPlotsByGardenId } from './mockPlots';

export class MockGardenRepository implements GardenRepository {
  async getById(gardenId: string): Promise<GardenSummary | null> {
    return mockGardens.find((garden) => garden.id === gardenId) ?? null;
  }

  async listPlots(gardenId: string): Promise<GardenPlot[]> {
    return [...(mockPlotsByGardenId[gardenId] ?? [])];
  }

  async listForUser(): Promise<GardenSummary[]> {
    return [...mockGardens];
  }

  async savePlot(
    gardenId: string,
    plot: SaveGardenPlotInput,
  ): Promise<GardenPlot> {
    const existingPlots = mockPlotsByGardenId[gardenId] ?? [];
    const nextPlot: GardenPlot = { ...plot };
    const existingIndex = existingPlots.findIndex(
      (candidate) => candidate.id === plot.id,
    );

    if (existingIndex >= 0) {
      existingPlots.splice(existingIndex, 1, nextPlot);
    } else {
      existingPlots.push(nextPlot);
    }

    mockPlotsByGardenId[gardenId] = existingPlots;

    return nextPlot;
  }

  async deletePlot(gardenId: string, plotId: string): Promise<void> {
    const existingPlots = mockPlotsByGardenId[gardenId];

    if (!existingPlots) {
      return;
    }

    mockPlotsByGardenId[gardenId] = existingPlots.filter(
      (plot) => plot.id !== plotId,
    );
  }
}
