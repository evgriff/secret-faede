import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import type { GardenIssue, JournalEntry, PhotoAttachment } from '../../domain';
import type { SkippedWaterApplication } from '../../domain/watering';
import { FeedPage } from './FeedPage';
import type { FeedLinkProps, FeedTargetOption } from './types';

const gardenTarget: FeedTargetOption = {
  cropId: null,
  deepLink: '/app/plan',
  target: { id: null, kind: 'garden', label: 'Whole garden' },
  value: 'garden',
};
const tomatoTarget: FeedTargetOption = {
  cropId: 'tomato',
  deepLink: '/app/plan?plantingId=p1',
  target: { id: 'p1', kind: 'plantingGroup', label: 'Tomatoes' },
  value: 'planting:p1',
};

describe('FeedPage', () => {
  it('renders the compact summary, image-led stream, filters, and router links', async () => {
    const user = userEvent.setup();
    const { container } = renderFeed({
      journalEntries: [issue(), photoEntry()],
      wateringActivity: [
        {
          application: skippedWatering(),
          cropName: 'Tomatoes',
          kind: 'application',
          target: tomatoTarget,
        },
      ],
    });

    const summary = screen.getByRole('region', { name: 'Feed summary' });
    expect(within(summary).getByText('3')).toBeVisible();
    expect(within(summary).getByText('Open issues')).toBeVisible();
    expect(screen.getByRole('img', { name: 'tomatoes.jpg' })).toHaveAttribute(
      'src',
      '/tomatoes.jpg',
    );
    expect(screen.getByText('Skipped watering for Tomatoes')).toBeVisible();
    expect(screen.getByText('Zero water credited')).toBeVisible();
    expect(screen.getAllByText('You').length).toBeGreaterThan(0);
    expect(screen.queryByText('Water model')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Tomatoes' })[0],
    ).toHaveAttribute('data-to', '/app/plan?plantingId=p1');
    expect(container.querySelector('a[href]')).toBeNull();

    await user.type(
      screen.getByRole('searchbox', { name: 'Search' }),
      'aphids',
    );
    expect(screen.getByText('Aphids found')).toBeVisible();
    expect(screen.queryByText('First red tomato')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Status'), 'resolved');
    expect(screen.getByText('No matching memories')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('First red tomato')).toBeVisible();
  });

  it('preserves a composer draft across close and clears it only after save', async () => {
    const user = userEvent.setup();
    const onCreateEntry = vi.fn().mockResolvedValue('saved');
    renderFeed({ onCreateEntry });

    await user.click(screen.getByRole('button', { name: 'New entry' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Mulch check',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Details' }),
      'The soil is still cool.',
    );
    await user.click(screen.getByRole('button', { name: 'Close New entry' }));
    await user.click(screen.getByRole('button', { name: 'New entry' }));
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Mulch check',
    );

    await user.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(onCreateEntry).toHaveBeenCalledTimes(1));
    expect(onCreateEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'The soil is still cool.',
        kind: 'note',
        target: gardenTarget.target,
        title: 'Mulch check',
      }),
    );
    expect(
      screen.getByText('Entry saved to the private garden history.'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'New entry' }));
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('');
  });

  it('keeps a failed draft and prevents concurrent duplicate submissions', async () => {
    const user = userEvent.setup();
    let rejectSave: (error: Error) => void = () => undefined;
    const onCreateEntry = vi.fn(
      () =>
        new Promise<'saved'>((_, reject: (error: Error) => void) => {
          rejectSave = reject;
        }),
    );
    renderFeed({ onCreateEntry });

    await user.click(screen.getByRole('button', { name: 'New entry' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Storm note',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Details' }),
      'Branches bent overnight.',
    );
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(
      screen.getByRole('button', { name: 'Saving entry…' }),
    ).toBeDisabled();
    expect(onCreateEntry).toHaveBeenCalledTimes(1);

    rejectSave(new Error('Storage is unavailable.'));
    expect(await screen.findByText(/storage is unavailable/i)).toBeVisible();
    expect(screen.getByText(/your draft is still here/i)).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Storm note',
    );
    expect(onCreateEntry).toHaveBeenCalledTimes(1);
  });

  it('is honest offline, preserves volatile photos, and offers text-only save', async () => {
    const user = userEvent.setup();
    const onCreateEntry = vi.fn().mockResolvedValue('queued');
    renderFeed({ isOnline: false, onCreateEntry });

    await user.click(screen.getByRole('button', { name: 'New entry' }));
    await user.click(screen.getByRole('button', { name: 'Photo update' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Title' }),
      'Tomato color',
    );
    const file = new File(['image'], 'red-tomato.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/^Photos/), file);

    expect(screen.getAllByText('red-tomato.jpg')[0]).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Reconnect to upload photos' }),
    ).toBeDisabled();
    expect(
      screen.getByText(/not uploaded or queued while offline/i),
    ).toBeVisible();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'New entry' }));
    expect(screen.getAllByText('red-tomato.jpg')[0]).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Note' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Details' }),
      'Fruit is beginning to turn.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Save text without photos' }),
    );
    await waitFor(() => expect(onCreateEntry).toHaveBeenCalledTimes(1));
    expect(onCreateEntry).toHaveBeenCalledWith(
      expect.objectContaining({ files: [], kind: 'note' }),
    );
    expect(screen.getByText(/saved locally and queued to sync/i)).toBeVisible();
  });

  it('validates submission and surfaces issue-update failures', async () => {
    const user = userEvent.setup();
    const onCreateEntry = vi.fn().mockResolvedValue('saved');
    const onUpdateIssue = vi
      .fn()
      .mockRejectedValue(new Error('Issue write failed.'));
    renderFeed({ journalEntries: [issue()], onCreateEntry, onUpdateIssue });

    await user.click(screen.getByRole('button', { name: 'New entry' }));
    await user.click(screen.getByRole('button', { name: 'Save note' }));
    expect(screen.getByText('Add a short title.')).toBeVisible();
    expect(screen.getByText('Add a useful garden detail.')).toBeVisible();
    expect(onCreateEntry).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Close New entry' }));

    await user.click(screen.getByRole('button', { name: 'Resolved' }));
    expect(await screen.findByText('Issue write failed.')).toBeVisible();
  });

  it('renders load failures with a working retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn().mockResolvedValue(undefined);
    renderFeed({
      errorMessage: 'Feed query failed.',
      loadState: 'error',
      onRetry,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Feed query failed.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('corrects an existing watering record without deleting it', async () => {
    const user = userEvent.setup();
    const onCorrectWatering = vi.fn().mockResolvedValue('saved');
    renderFeed({
      onCorrectWatering,
      wateringActivity: [
        {
          application: skippedWatering(),
          cropName: 'Tomatoes',
          kind: 'application',
          target: tomatoTarget,
        },
      ],
    });

    await user.click(
      screen.getByRole('button', { name: 'Correct watering record' }),
    );
    await user.click(screen.getByRole('radio', { name: 'Partial' }));
    await user.type(
      screen.getByRole('spinbutton', { name: 'Amount actually applied' }),
      '0.3',
    );
    await user.selectOptions(screen.getByLabelText('Watering method'), 'drip');
    const date = screen.getByLabelText(/^Date/);
    await user.clear(date);
    await user.type(date, '2026-07-08');
    await user.click(screen.getByRole('button', { name: 'Save correction' }));

    await waitFor(() => expect(onCorrectWatering).toHaveBeenCalledTimes(1));
    expect(onCorrectWatering).toHaveBeenCalledWith({
      amount: { unit: 'gallons', value: 0.3 },
      applicationId: 'skip-1',
      method: 'drip',
      occurredOn: '2026-07-08',
      outcome: 'partial',
      skipReason: null,
    });
    expect(screen.getByText(/watering correction saved/i)).toBeVisible();
  });
});

function renderFeed(overrides: Partial<ComponentProps<typeof FeedPage>> = {}) {
  const props: ComponentProps<typeof FeedPage> = {
    LinkComponent: TestRouterLink,
    currentUserId: 'user-1',
    harvests: [],
    isOnline: true,
    journalEntries: [],
    onCreateEntry: vi.fn().mockResolvedValue('saved'),
    targets: [gardenTarget, tomatoTarget],
    timezone: 'America/Detroit',
    today: '2026-07-09',
    ...overrides,
  };
  return render(<FeedPage {...props} />);
}

function TestRouterLink({ children, className, to }: FeedLinkProps) {
  return (
    <button className={className} data-to={to} type="button">
      {children}
    </button>
  );
}

function issue(): GardenIssue {
  return {
    body: 'Aphids are under the lower leaves.',
    category: 'pest',
    createdAtIso: '2026-07-07T12:00:00.000Z',
    createdByUserId: 'user-1',
    id: 'issue-1',
    occurredOn: '2026-07-07',
    photos: [],
    resolvedAtIso: null,
    severity: 'medium',
    status: 'open',
    target: tomatoTarget.target,
    title: 'Aphids found',
    type: 'issue',
  };
}

function photoEntry(): JournalEntry {
  return {
    body: 'The first fruit is fully red.',
    createdAtIso: '2026-07-08T12:00:00.000Z',
    createdByUserId: 'user-1',
    id: 'photo-1',
    occurredOn: '2026-07-08',
    photos: [photo()],
    target: tomatoTarget.target,
    title: 'First red tomato',
    type: 'photo',
  };
}

function photo(): PhotoAttachment {
  return {
    contentType: 'image/jpeg',
    fileName: 'tomatoes.jpg',
    height: 800,
    id: 'image-1',
    sizeBytes: 1000,
    storagePath: '/tomatoes.jpg',
    uploadedAtIso: '2026-07-08T12:00:00.000Z',
    width: 1200,
  };
}

function skippedWatering(): SkippedWaterApplication {
  return {
    appliedAtIso: '2026-07-09T12:00:00.000Z',
    cropGroupId: 'p1',
    id: 'skip-1',
    method: 'hand',
    outcome: 'skipped',
    recordedAtIso: '2026-07-09T12:01:00.000Z',
    recordedByUserId: 'user-1',
    revision: 1,
    skipReason: 'Soil was already wet.',
  };
}
