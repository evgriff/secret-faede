import { describe, expect, it } from 'vitest';

import { findPlanWarnings } from '../garden/gardenPlanning';
import { generateAutoLayoutCandidates } from './autoLayoutEngine';
import {
  applyAutoLayoutCandidateToGarden,
  buildAutoLayoutProposalPreview,
} from './autoLayoutProposalDiff';
import { createLayoutFixture, createSunLayer } from './autoLayoutTestFixtures';

describe('auto layout proposal preview', () => {
  it('summarizes added proposal geometry before apply', () => {
    const garden = createLayoutFixture();
    const sunLayer = createSunLayer(garden);
    const [candidate] = generateAutoLayoutCandidates(garden, { sunLayer });

    if (!candidate) {
      throw new Error('Expected an auto-layout candidate.');
    }

    const preview = buildAutoLayoutProposalPreview({
      candidate,
      currentWarnings: findPlanWarnings(garden, {
        sunLayer,
        sunSeason: 'summer',
      }),
      garden,
      sunLayer,
      sunSeason: 'summer',
    });

    expect(preview.summary.addedCount).toBe(
      candidate.plantings.length + candidate.structures.length,
    );
    expect(preview.summary.removedCount).toBe(0);
    expect(
      applyAutoLayoutCandidateToGarden(garden, candidate).plantings,
    ).toEqual(expect.arrayContaining(candidate.plantings));
  });

  it('keeps real-world auto-layout plantings anchored when previewing another proposal', () => {
    const garden = createLayoutFixture();
    const sunLayer = createSunLayer(garden);
    const [firstCandidate, secondCandidate] = generateAutoLayoutCandidates(
      garden,
      { sunLayer },
    );

    if (!firstCandidate || !secondCandidate) {
      throw new Error('Expected multiple auto-layout candidates.');
    }

    const gardenWithGrowingProposal = {
      ...applyAutoLayoutCandidateToGarden(garden, firstCandidate),
      plantings: applyAutoLayoutCandidateToGarden(
        garden,
        firstCandidate,
      ).plantings.map((planting, index) =>
        index === 0
          ? {
              ...planting,
              allowRelocation: false,
              status: 'growing' as const,
            }
          : planting,
      ),
    };
    const anchoredPlanting = gardenWithGrowingProposal.plantings[0];

    const afterGarden = applyAutoLayoutCandidateToGarden(
      gardenWithGrowingProposal,
      secondCandidate,
    );

    expect(
      afterGarden.plantings.some(
        (planting) => planting.id === anchoredPlanting?.id,
      ),
    ).toBe(true);
  });
});
