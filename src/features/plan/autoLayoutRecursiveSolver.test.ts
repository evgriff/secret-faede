import { describe, expect, it } from 'vitest';

import { compareAutoLayoutCandidates } from './autoLayoutCandidateRanking';
import { generateAutoLayoutCandidates } from './autoLayoutEngine';
import { createLayoutFixture, createSunLayer } from './autoLayoutTestFixtures';

describe('auto layout recursive solver', () => {
  it('keeps access-path warnings out of user-facing unresolved issue copy', () => {
    const garden = {
      ...createLayoutFixture(),
      structures: createLayoutFixture().structures.map((structure) =>
        structure.id === 'path-east'
          ? {
              ...structure,
              widthFt: 1,
            }
          : structure,
      ),
    };
    const [candidate] = generateAutoLayoutCandidates(garden, {
      maxSearchDepth: 1,
      sunLayer: createSunLayer(garden),
    });

    expect(candidate?.search.status).toBe('partial');
    expect(candidate?.search.activeWarningCount).toBeGreaterThan(0);
    expect(candidate?.search.unresolvedIssues).not.toContain('Path too narrow');

    const [ignoredCandidate] = generateAutoLayoutCandidates(garden, {
      ignoredWarningIds: ['path-width-path-east'],
      maxSearchDepth: 1,
      sunLayer: createSunLayer(garden),
    });

    expect(ignoredCandidate?.search.unresolvedIssues).not.toContain(
      'Path too narrow',
    );
  });

  it('caps recursive search and prunes repeated states instead of bouncing', () => {
    const baseGarden = createLayoutFixture();
    const garden = {
      ...baseGarden,
      seasonPlan: {
        ...baseGarden.seasonPlan,
        wantedCrops: baseGarden.seasonPlan.wantedCrops.map((selection) =>
          selection.cropId === 'tomato'
            ? {
                ...selection,
                cropId: 'pole-bean',
                id: 'season-pole-bean',
                supportAllowed: false,
              }
            : selection,
        ),
      },
    };
    const [candidate] = generateAutoLayoutCandidates(garden, {
      maxSearchDepth: 3,
      sunLayer: createSunLayer(garden),
    });

    expect(candidate?.search.status).toBe('partial');
    expect(candidate?.search.reachedDepth).toBe(3);
    expect(candidate?.search.repeatedStates).toBeGreaterThan(0);
    expect(candidate?.search.evaluatedStates).toBeLessThanOrEqual(
      candidate?.search.maxStates ?? 0,
    );
    expect(candidate?.search.unresolvedIssues).toEqual(
      expect.arrayContaining([expect.stringContaining('Pole bean')]),
    );
  });

  it('ranks conflict-free variants ahead of noisier surface-level moves', () => {
    const [candidate] = generateAutoLayoutCandidates(createLayoutFixture(), {
      maxSearchDepth: 0,
    });

    if (!candidate) {
      throw new Error('Expected a base candidate.');
    }

    const resolvedCandidate = {
      ...candidate,
      id: 'resolved',
      search: {
        ...candidate.search,
        activeWarningCount: 0,
        rankingScore: 0,
        status: 'resolved' as const,
        unresolvedIssues: [],
      },
      unplaced: [],
    };
    const noisyCandidate = {
      ...candidate,
      id: 'noisy',
      search: {
        ...candidate.search,
        activeWarningCount: 1,
        rankingScore: 100,
        status: 'partial' as const,
        unresolvedIssues: ['Spacing collision'],
      },
    };

    expect(
      [noisyCandidate, resolvedCandidate]
        .sort(compareAutoLayoutCandidates)
        .map((entry) => entry.id),
    ).toEqual(['resolved', 'noisy']);
  });
});
