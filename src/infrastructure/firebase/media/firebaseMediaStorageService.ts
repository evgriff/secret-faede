import type {
  JournalPhotoUploadRequest,
  MediaStorageService,
} from '../../../domain/media/MediaStorageService';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirebaseStorageClient } from '../app';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export class FirebaseMediaStorageService implements MediaStorageService {
  constructor(private readonly environment: AppEnvironment) {}

  async uploadJournalPhoto(request: JournalPhotoUploadRequest) {
    const uploadedAtIso = new Date().toISOString();
    const photoId = createPhotoId();
    const fileName = sanitizeFileName(request.file.name);
    const storagePath = `gardenWorkspaces/main/journal/${request.entryId}/${request.userId}/${photoId}-${fileName}`;
    const storageRef = ref(
      getFirebaseStorageClient(this.environment),
      storagePath,
    );
    const snapshot = await uploadBytes(storageRef, request.file, {
      contentType: request.file.type || 'application/octet-stream',
      customMetadata: {
        entryId: request.entryId,
        gardenId: request.gardenId,
        userId: request.userId,
      },
    });
    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      contentType: request.file.type || 'application/octet-stream',
      downloadUrl,
      fileName,
      height: null,
      id: photoId,
      sizeBytes: request.file.size,
      storagePath,
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

function sanitizeFileName(value: string) {
  const cleanValue = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '');

  return cleanValue || 'photo';
}
