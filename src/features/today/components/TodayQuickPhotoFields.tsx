import type { ChangeEvent } from 'react';

import { getMediaCaptureCopy } from '../../../shared/media/mediaCaptureCopy';
import { PhotoAttachmentPreview } from '../../../shared/media/PhotoAttachmentPreview';
import styles from './TodayQuickActionSheet.module.css';

export function TodayQuickPhotoFields({
  canUseNativeCamera,
  isOffline,
  onCapturePhoto,
  onPhotoFilesChange,
  onPhotoMessageChange,
  photoFiles,
  photoMessage,
}: {
  canUseNativeCamera: boolean;
  isOffline: boolean;
  onCapturePhoto(): Promise<File | null>;
  onPhotoFilesChange(files: File[]): void;
  onPhotoMessageChange(message: string | null): void;
  photoFiles: File[];
  photoMessage: string | null;
}) {
  const mediaCopy = getMediaCaptureCopy({
    canUseNativeCamera,
    isOffline,
    surface: 'today',
  });

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    onPhotoFilesChange(Array.from(event.currentTarget.files ?? []));
    onPhotoMessageChange(null);
  }

  async function handleCapturePhoto() {
    const photo = await onCapturePhoto();

    if (!photo) {
      onPhotoMessageChange('Camera did not return a photo.');
      return;
    }

    onPhotoFilesChange([...photoFiles, photo]);
    onPhotoMessageChange('Photo ready to attach.');
  }

  return (
    <>
      <label className={styles.fullField}>
        <span>{mediaCopy.pickerLabel}</span>
        <input
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          type="file"
        />
        <small>{mediaCopy.pickerHint}</small>
      </label>
      {canUseNativeCamera ? (
        <div className={styles.fullField}>
          <button onClick={() => void handleCapturePhoto()} type="button">
            {mediaCopy.cameraLabel}
          </button>
          <small>{photoMessage ?? mediaCopy.cameraHint}</small>
        </div>
      ) : null}
      <PhotoAttachmentPreview
        files={photoFiles}
        isOffline={isOffline}
        onClear={() => onPhotoFilesChange([])}
        surface="today"
      />
    </>
  );
}
