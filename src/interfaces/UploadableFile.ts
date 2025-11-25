export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'success' | 'error';

export interface UploadableFile {
    id: string;
    file: File;
    status: UploadStatus;
    progress: number;
    docnumber?: number;
    error?: string;
    editedFileName: string;
    editedDateTaken: Date | null;
    dateSource?: 'exif' | 'filename_full' | 'filename_partial' | 'file';
}
