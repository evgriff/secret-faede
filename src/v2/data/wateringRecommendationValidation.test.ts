import {
  calculate,
  makePlanting,
  target,
} from '../domain/watering/wateringTestFixtures';
import {
  currentWateringRecommendations,
  isCurrentWateringRecommendation,
} from './wateringRecommendationValidation';

describe('persisted watering recommendation compatibility', () => {
  const recommendation = {
    ...calculate({ targets: [target(makePlanting('tomato', 'Tomato'))] })
      .recommendations[0]!,
    workspaceRevisionId: 'revision-1',
  };

  it('accepts only recommendations generated for the published revision', () => {
    expect(isCurrentWateringRecommendation(recommendation, 'revision-1')).toBe(
      true,
    );
    expect(
      currentWateringRecommendations(
        [
          recommendation,
          { ...recommendation, workspaceRevisionId: 'revision-old' },
        ],
        'revision-1',
      ),
    ).toEqual([recommendation]);
  });

  it('rejects incomplete persisted model output before Feed or Today use it', () => {
    const { workspaceRevisionId: _removed, ...withoutRevision } =
      recommendation;
    void _removed;
    expect(
      isCurrentWateringRecommendation(
        { ...recommendation, forecastRainCreditInches: Number.NaN },
        'revision-1',
      ),
    ).toBe(false);
    expect(isCurrentWateringRecommendation(withoutRevision, 'revision-1')).toBe(
      false,
    );
  });
});
