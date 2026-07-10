import type { PhotoAttachment } from '../../v2/domain/operations';

export interface JournalPhotoUploadRequest {
  entryId: string;
  file: File;
  gardenId: string;
  userId: string;
}

export interface UploadedPhotoAttachment extends PhotoAttachment {
  downloadUrl: string;
}

export interface MediaStorageService {
  uploadJournalPhoto(
    request: JournalPhotoUploadRequest,
  ): Promise<UploadedPhotoAttachment>;
}
