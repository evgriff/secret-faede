export type SaveFeedbackStatus =
  | 'error'
  | 'idle'
  | 'queued'
  | 'saved'
  | 'saving';
export type SaveFeedbackSurface = 'feed' | 'plan' | 'today';

export interface SaveFeedback {
  detail: string | null;
  label: string;
  shouldRender: boolean;
  tone: 'danger' | 'neutral' | 'success' | 'warning';
}

export function getSaveFeedback({
  hasUnsavedChanges = false,
  isOffline,
  photoCount = 0,
  status,
  surface,
}: {
  hasUnsavedChanges?: boolean;
  isOffline: boolean;
  photoCount?: number;
  status: SaveFeedbackStatus;
  surface: SaveFeedbackSurface;
}): SaveFeedback {
  if (status === 'error') {
    return {
      detail:
        photoCount > 0 && isOffline
          ? getPhotoOfflineDetail(surface)
          : 'Try again when the connection is stable.',
      label:
        surface === 'plan' ? 'Save needs attention' : 'Action needs attention',
      shouldRender: true,
      tone: 'danger',
    };
  }

  if (status === 'saving') {
    return {
      detail: 'Writing the change now.',
      label: 'Saving',
      shouldRender: true,
      tone: 'neutral',
    };
  }

  if (status === 'queued') {
    return {
      detail: getQueuedDetail(surface),
      label: surface === 'feed' ? 'Queued locally' : 'Saved locally',
      shouldRender: true,
      tone: 'warning',
    };
  }

  if (hasUnsavedChanges) {
    return {
      detail: isOffline
        ? 'Save before leaving; the draft will stay in this browser until it can sync.'
        : 'Save when ready to update your private draft.',
      label: isOffline ? 'Unsaved local edits' : 'Unsaved edits',
      shouldRender: true,
      tone: 'warning',
    };
  }

  if (status === 'saved') {
    return {
      detail: surface === 'plan' ? 'Private draft saved.' : 'Change saved.',
      label: 'Saved',
      shouldRender: true,
      tone: 'success',
    };
  }

  if (isOffline) {
    return {
      detail: getOfflineReadyDetail(surface),
      label: 'Offline ready',
      shouldRender: true,
      tone: 'warning',
    };
  }

  return {
    detail: null,
    label: 'Online',
    shouldRender: false,
    tone: 'success',
  };
}

export function getPhotoOfflineDetail(surface: SaveFeedbackSurface) {
  return surface === 'today'
    ? 'Photo upload needs a connection. Save the text field note now or reconnect for media.'
    : 'Photo upload needs a connection. Save text only or reconnect for media.';
}

function getQueuedDetail(surface: SaveFeedbackSurface) {
  if (surface === 'plan') {
    return 'Private draft is saved in this browser and will sync when connection returns.';
  }

  if (surface === 'today') {
    return 'Field action is saved here and will sync when connection returns.';
  }

  return 'Text memory is saved here and will sync when connection returns.';
}

function getOfflineReadyDetail(surface: SaveFeedbackSurface) {
  if (surface === 'plan') {
    return 'Plan edits can save locally. Publish after reconnecting.';
  }

  if (surface === 'today') {
    return 'Tasks and text field notes can save locally. Photos need connection.';
  }

  return 'Text memories and harvests can save locally. Photos need connection.';
}
