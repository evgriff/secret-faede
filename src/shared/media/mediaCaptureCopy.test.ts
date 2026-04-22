import { describe, expect, it } from 'vitest';

import {
  getMediaCaptureCopy,
  getSelectedPhotoDraftDetail,
} from './mediaCaptureCopy';

describe('mediaCaptureCopy', () => {
  it('keeps offline photo copy honest without promising a binary queue', () => {
    expect(
      getMediaCaptureCopy({
        canUseNativeCamera: true,
        isOffline: true,
        surface: 'feed',
      }),
    ).toMatchObject({
      cameraHint:
        'Photos are not queued offline. Save text only, or reconnect before attaching media.',
      cameraLabel: 'Open camera',
    });

    expect(
      getSelectedPhotoDraftDetail({
        isOffline: true,
        photoCount: 2,
        surface: 'today',
      }),
    ).toBe(
      '2 photos selected. Selected photos stay only in this form until you reconnect.',
    );
  });

  it('distinguishes native capture from the browser picker', () => {
    expect(
      getMediaCaptureCopy({
        canUseNativeCamera: true,
        isOffline: false,
        surface: 'feed',
      }),
    ).toMatchObject({
      cameraHint: 'Uses the native camera. Upload starts when you save.',
      pickerLabel: 'Choose photo',
    });

    expect(
      getMediaCaptureCopy({
        canUseNativeCamera: false,
        isOffline: false,
        surface: 'feed',
      }).pickerHint,
    ).toContain('browser photo picker');
  });
});
