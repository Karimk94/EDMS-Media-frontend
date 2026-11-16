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
    relativePath?: string; // Relative path within a selected folder (e.g. "subfolder/file.pdf")
    retryCount?: number;   // Number of failed upload attempts for this file
    idempotencyKey?: string; // Stable key sent to the backend; reused on every retry so the backend can deduplicate
}
