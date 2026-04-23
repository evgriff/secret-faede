import type { PlantLocationMatchBand } from './plantCatalogTypes';

const WATCH_MATCH_MIN_SCORE = 45;
const GOOD_MATCH_MIN_SCORE = 66;
const STRONG_MATCH_MIN_SCORE = 82;

export const TENDER_PERENNIAL_MAX_SCORE = WATCH_MATCH_MIN_SCORE - 1;

export const plantLocationMatchLabels: Record<PlantLocationMatchBand, string> =
  {
    good: 'Good match',
    poor: 'Poor match',
    strong: 'Strong match',
    watch: 'Watch timing',
  };

export function getPlantLocationMatchBand(
  score: number,
): PlantLocationMatchBand {
  if (score >= STRONG_MATCH_MIN_SCORE) {
    return 'strong';
  }

  if (score >= GOOD_MATCH_MIN_SCORE) {
    return 'good';
  }

  return score >= WATCH_MATCH_MIN_SCORE ? 'watch' : 'poor';
}
