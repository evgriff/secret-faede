import { describe, expect, it } from 'vitest';

import { getPhotoOfflineDetail, getSaveFeedback } from './syncFeedback';

describe('syncFeedback', () => {
  it('keeps idle online state quiet', () => {
    expect(
      getSaveFeedback({
        isOffline: false,
        status: 'idle',
        surface: 'plan',
      }),
    ).toMatchObject({
      label: 'Online',
      shouldRender: false,
      tone: 'success',
    });
  });

  it('explains queued field saves without implying a cloud write already happened', () => {
    expect(
      getSaveFeedback({
        isOffline: true,
        status: 'queued',
        surface: 'today',
      }),
    ).toMatchObject({
      detail:
        'Field action is saved here and will sync when connection returns.',
      label: 'Saved locally',
      shouldRender: true,
      tone: 'warning',
    });
  });

  it('makes feed offline media limits explicit while preserving text saves', () => {
    expect(
      getSaveFeedback({
        isOffline: true,
        photoCount: 1,
        status: 'error',
        surface: 'feed',
      }),
    ).toMatchObject({
      detail:
        'Photo upload needs a connection. Save text only or reconnect for media.',
      label: 'Action needs attention',
      tone: 'danger',
    });
    expect(getPhotoOfflineDetail('today')).toContain(
      'Save the text field note now',
    );
  });

  it('tells Plan users when local edits are unsaved versus queued', () => {
    expect(
      getSaveFeedback({
        hasUnsavedChanges: true,
        isOffline: true,
        status: 'idle',
        surface: 'plan',
      }),
    ).toMatchObject({
      label: 'Unsaved local edits',
      tone: 'warning',
    });
  });
});
