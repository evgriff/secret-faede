import type {
  JournalPhotoUploadRequest,
  MediaStorageService,
} from '../../../domain/media/MediaStorageService';

export class MockMediaStorageService implements MediaStorageService {
  async uploadJournalPhoto(request: JournalPhotoUploadRequest) {
    const uploadedAtIso = new Date().toISOString();
    const photoId = createPhotoId();
    const fileName = request.file.name || 'photo';
    const downloadUrl = await readFileAsDataUrl(request.file);

    return {
      contentType: request.file.type || 'application/octet-stream',
      downloadUrl,
      fileName,
      height: null,
      id: photoId,
      sizeBytes: request.file.size,
      storagePath: `mock/gardenWorkspaces/main/journal/${request.entryId}/${photoId}-${fileName}`,
      uploadedAtIso,
      width: null,
    };
  }
}

function createPhotoId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `photo-${Date.now()}`;
}

function readFileAsDataUrl(file: File) {
  if (typeof FileReader === 'undefined') {
    return Promise.resolve(
      `mock://${encodeURIComponent(file.name || 'photo')}`,
    );
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read photo.'));
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  });
}
