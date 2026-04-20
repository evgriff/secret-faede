import type { PhotoAttachment } from '../gardens/GardenRepository';

export interface JournalPhotoUploadRequest {
  entryId: string;
  file: File;
  gardenId: string;
  userId: string;
}

export interface MediaStorageService {
  uploadJournalPhoto(
    request: JournalPhotoUploadRequest,
  ): Promise<PhotoAttachment>;
}
