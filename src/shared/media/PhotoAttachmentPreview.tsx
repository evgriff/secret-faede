import { useEffect, useState } from 'react';

import type { MediaCaptureSurface } from './mediaCaptureCopy';
import { getSelectedPhotoDraftDetail } from './mediaCaptureCopy';
import styles from './PhotoAttachmentPreview.module.css';

interface PhotoPreview {
  key: string;
  name: string;
  sizeLabel: string;
  url: string;
}

export function PhotoAttachmentPreview({
  files,
  isOffline,
  onClear,
  onSaveTextOnly,
  surface,
}: {
  files: File[];
  isOffline: boolean;
  onClear(): void;
  onSaveTextOnly?: () => void;
  surface: MediaCaptureSurface;
}) {
  const [previews, setPreviews] = useState<PhotoPreview[]>([]);

  useEffect(() => {
    const nextPreviews = files.map((file, index) => ({
      key: `${file.name || 'photo'}-${file.size}-${file.lastModified}-${index}`,
      name: file.name || 'Garden photo',
      sizeLabel: formatFileSize(file.size),
      url: URL.createObjectURL(file),
    }));

    setPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [files]);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className={styles.previewPanel}>
      <p className={styles.previewDetail}>
        {getSelectedPhotoDraftDetail({
          isOffline,
          photoCount: files.length,
          surface,
        })}
      </p>
      <div className={styles.previewGrid}>
        {previews.map((preview) => (
          <figure className={styles.previewItem} key={preview.key}>
            <img alt={`Preview of ${preview.name}`} src={preview.url} />
            <figcaption>
              <span>{preview.name}</span>
              <strong>{preview.sizeLabel}</strong>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className={styles.previewActions}>
        {isOffline && onSaveTextOnly ? (
          <button onClick={onSaveTextOnly} type="button">
            Save text only
          </button>
        ) : null}
        <button onClick={onClear} type="button">
          Remove photos
        </button>
      </div>
    </div>
  );
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
