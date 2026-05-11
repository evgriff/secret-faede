import { render, screen, within } from '@testing-library/react';

import { getCropById } from '../../domain/crops/cropCatalog';
import {
  detroitClimateProfile,
  createDefaultGarden,
} from '../../domain/gardens/GardenRepository';
import { createSeasonCropSelection } from './components/choosePlantsSelection';
import { PlanOperationsPanel } from './components/PlanOperationsPanel';

describe('Plan layout suggestion flow', () => {
  it('renders truthful busy stages on the singular layout workflow surface', () => {
    const tomato = getCropById('tomato');

    if (!tomato) {
      throw new Error('Expected tomato crop fixture.');
    }

    const garden = {
      ...createDefaultGarden('test-user'),
      climateProfile: {
        ...detroitClimateProfile,
        source: 'user' as const,
      },
      seasonPlan: {
        ...createDefaultGarden('test-user').seasonPlan,
        wantedCrops: [createSeasonCropSelection(tomato)],
      },
    };

    const { rerender } = render(
      <PlanOperationsPanel
        autoLayoutSuggestion={null}
        currentWarnings={[]}
        garden={garden}
        onApplyAutoLayoutCandidate={() => {}}
        onDismissAutoLayoutSuggestion={() => {}}
        onGenerateAutoLayoutSuggestion={() => {}}
        optimizerIncludesDraftSave={true}
        optimizerMessage="Saving the current draft before checking another arrangement."
        optimizerStatus="savingDraft"
        suggestion={null}
        sunLayer={null}
        sunSeason="summer"
      />,
    );

    expectBusyStage({
      message: 'Saving the current draft before checking another arrangement.',
      stageLabel: 'Saving draft',
    });

    rerender(
      <PlanOperationsPanel
        autoLayoutSuggestion={null}
        currentWarnings={[]}
        garden={garden}
        onApplyAutoLayoutCandidate={() => {}}
        onDismissAutoLayoutSuggestion={() => {}}
        onGenerateAutoLayoutSuggestion={() => {}}
        optimizerIncludesDraftSave={true}
        optimizerMessage="Collecting the current spacing, access, and support constraints."
        optimizerStatus="collectingConstraints"
        suggestion={null}
        sunLayer={null}
        sunSeason="summer"
      />,
    );

    expectBusyStage({
      message:
        'Collecting the current spacing, access, and support constraints.',
      stageLabel: 'Collecting constraints',
    });

    rerender(
      <PlanOperationsPanel
        autoLayoutSuggestion={null}
        currentWarnings={[]}
        garden={garden}
        onApplyAutoLayoutCandidate={() => {}}
        onDismissAutoLayoutSuggestion={() => {}}
        onGenerateAutoLayoutSuggestion={() => {}}
        optimizerIncludesDraftSave={true}
        optimizerMessage="Generating one checked whole-plot suggestion."
        optimizerStatus="generatingSuggestion"
        suggestion={null}
        sunLayer={null}
        sunSeason="summer"
      />,
    );

    expectBusyStage({
      message: 'Generating one checked whole-plot suggestion.',
      stageLabel: 'Generating suggestion',
    });

    rerender(
      <PlanOperationsPanel
        autoLayoutSuggestion={null}
        currentWarnings={[]}
        garden={garden}
        onApplyAutoLayoutCandidate={() => {}}
        onDismissAutoLayoutSuggestion={() => {}}
        onGenerateAutoLayoutSuggestion={() => {}}
        optimizerIncludesDraftSave={true}
        optimizerMessage="Validating the suggestion against the current must-fix issues."
        optimizerStatus="validatingSuggestion"
        suggestion={null}
        sunLayer={null}
        sunSeason="summer"
      />,
    );

    expectBusyStage({
      message: 'Validating the suggestion against the current must-fix issues.',
      stageLabel: 'Validating suggestion',
    });

    rerender(
      <PlanOperationsPanel
        autoLayoutSuggestion={null}
        currentWarnings={[]}
        garden={garden}
        onApplyAutoLayoutCandidate={() => {}}
        onDismissAutoLayoutSuggestion={() => {}}
        onGenerateAutoLayoutSuggestion={() => {}}
        optimizerIncludesDraftSave={true}
        optimizerMessage="Preparing the before-and-after preview for review."
        optimizerStatus="preparingPreview"
        suggestion={null}
        sunLayer={null}
        sunSeason="summer"
      />,
    );

    expectBusyStage({
      message: 'Preparing the before-and-after preview for review.',
      stageLabel: 'Preparing preview',
    });
  });

  it('shows a plain keep-current result when no better layout is found', () => {
    const tomato = getCropById('tomato');

    if (!tomato) {
      throw new Error('Expected tomato crop fixture.');
    }

    const defaultGarden = createDefaultGarden('test-user');
    const garden = {
      ...defaultGarden,
      seasonPlan: {
        ...defaultGarden.seasonPlan,
        wantedCrops: [createSeasonCropSelection(tomato)],
      },
    };

    render(
      <PlanOperationsPanel
        autoLayoutSuggestion={null}
        currentWarnings={[]}
        garden={garden}
        onApplyAutoLayoutCandidate={() => {}}
        onDismissAutoLayoutSuggestion={() => {}}
        onGenerateAutoLayoutSuggestion={() => {}}
        optimizerIncludesDraftSave={true}
        optimizerMessage="No better layout found right now. Keep the current layout or adjust the plan, then check again."
        optimizerStatus="noBetterLayout"
        suggestion={null}
        sunLayer={null}
        sunSeason="summer"
      />,
    );

    const workflow = screen.getByRole('region', {
      name: 'Layout suggestion workflow',
    });

    expect(
      within(workflow).getByText(
        'No simpler checked arrangement looked better than the current draft.',
      ),
    ).toBeVisible();
    expect(
      within(workflow).getByRole('button', { name: 'Generate layout' }),
    ).toBeEnabled();
  });
});

function expectBusyStage({
  message,
  stageLabel,
}: {
  message: string;
  stageLabel: string;
}) {
  const workflow = screen.getByRole('region', {
    name: 'Layout suggestion workflow',
  });
  const stageItem = within(workflow).getByText(stageLabel).closest('li');

  expect(within(workflow).getByText(message)).toBeVisible();
  expect(within(workflow).getByRole('button')).toBeDisabled();
  expect(stageItem).toHaveAttribute('data-state', 'active');
}
