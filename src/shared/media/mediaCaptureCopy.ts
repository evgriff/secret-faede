export type MediaCaptureSurface = 'feed' | 'today';

export interface MediaCaptureCopy {
  cameraLabel: string;
  cameraHint: string;
  pickerHint: string;
  pickerLabel: string;
}

export function getMediaCaptureCopy({
  canUseNativeCamera,
  isOffline,
  surface,
}: {
  canUseNativeCamera: boolean;
  isOffline: boolean;
  surface: MediaCaptureSurface;
}): MediaCaptureCopy {
  const offlineHint =
    surface === 'today'
      ? 'Photos are not queued offline. Keep the field note text, or reconnect before attaching media.'
      : 'Photos are not queued offline. Save text only, or reconnect before attaching media.';

  if (isOffline) {
    return {
      cameraLabel: canUseNativeCamera ? 'Open camera' : 'Camera unavailable',
      cameraHint: offlineHint,
      pickerHint: offlineHint,
      pickerLabel: 'Choose or take photo',
    };
  }

  if (canUseNativeCamera) {
    return {
      cameraLabel: 'Open camera',
      cameraHint: 'Uses the native camera. Upload starts when you save.',
      pickerHint:
        'You can also choose an existing image. Upload starts when you save.',
      pickerLabel: 'Choose photo',
    };
  }

  return {
    cameraLabel: 'Camera unavailable',
    cameraHint: 'Use the browser photo picker on this device.',
    pickerHint:
      'Uses the browser photo picker. Mobile browsers may offer camera capture.',
    pickerLabel: 'Choose or take photo',
  };
}

export function getSelectedPhotoDraftDetail({
  isOffline,
  photoCount,
  surface,
}: {
  isOffline: boolean;
  photoCount: number;
  surface: MediaCaptureSurface;
}) {
  const countLabel = `${photoCount} photo${photoCount === 1 ? '' : 's'}`;

  if (isOffline) {
    return `${countLabel} selected. Selected photos stay only in this form until you reconnect.`;
  }

  return surface === 'today'
    ? `${countLabel} ready for this field note.`
    : `${countLabel} ready to upload when you save.`;
}
