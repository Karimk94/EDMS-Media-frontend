import React, { useState, useCallback, useRef, useEffect } from 'react';
import { UploadFileItem, UploadableFile, UploadStatus } from './UploadFileItem';
import ExifReader from 'exifreader'; // Example library for EXIF data
import { EventEditor } from './EventEditor';

const formatDateTimeForAPI = (date: Date | null): string | null => {
    if (!date) return null;
    const pad = (num: number) => num.toString().padStart(2, '0');
    // Ensure the date object is valid before formatting
    if (isNaN(date.getTime())) return null;
    try {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    } catch (e) {
        console.error("Error formatting date:", e, date);
        return null; // Return null if formatting fails
    }
};


export interface UploadModalProps {
  onClose: () => void;
  apiURL: string;
  onAnalyze: (uploadedFiles: UploadableFile[]) => void;
}

interface EventOption {
  value: number;
  label: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, apiURL, onAnalyze }) => {
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileIdCounter = useRef(0);
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);

  const extractExifDate = async (file: File): Promise<Date | null> => {
    try {
      const tags = await ExifReader.load(file);
      const dateTimeOriginal = tags['Creation Time']?.value ?? tags['CreateDate']?.value;

      if (dateTimeOriginal) {
      const parsedDate = new Date(dateTimeOriginal);

      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    } catch (error) {
      console.warn("Could not read EXIF data client-side:", error);
    }
    console.warn("Client-side EXIF date extraction requires a library (e.g., 'exifreader'). Falling back to null.");
    return null; // Default to null if no EXIF data or library not implemented
  };

  const handleFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newUploadPromises = Array.from(selectedFiles).map(async (file) => {
        // Attempt to get EXIF date, default to null if not found/possible
        const exifDate = await extractExifDate(file);
        return {
            id: `file-${fileIdCounter.current++}`,
            file,
            status: 'pending',
            progress: 0,
            editedFileName: file.name, // Initialize with original name
            editedDateTaken: exifDate, // Initialize with extracted EXIF date or null
        } as UploadableFile;
    });

    const newUploads = await Promise.all(newUploadPromises);
    setFiles(prev => [...prev, ...newUploads]);
  };

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    handleFiles(event.dataTransfer.files);
  }, []);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updateFileStatus = (id: string, status: UploadStatus, updates: Partial<UploadableFile> = {}) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status, ...updates } : f));
  };

  // Handlers to update specific fields from child
  const handleUpdateFileName = (id: string, newName: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, editedFileName: newName } : f));
  };

  const handleUpdateDateTaken = (id: string, newDate: Date | null) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, editedDateTaken: newDate } : f));
  };

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    const uploadPromises = pendingFiles.map(uploadableFile => {
      return new Promise<void>((resolve) => {
        const { id, file, editedFileName, editedDateTaken } = uploadableFile; // Get potentially edited values
        updateFileStatus(id, 'uploading', { progress: 0 });

        const formData = new FormData();
        formData.append('file', file);
        // Use editedFileName if available and not empty, otherwise original file name
        formData.append('docname', (editedFileName && editedFileName.trim()) ? editedFileName.trim() : file.name);
        formData.append('abstract', ``); // Keep abstract empty for now
        if (selectedEvent) {
          formData.append('event_id', String(selectedEvent.value));
        }

        // Add formatted date_taken if available
        const formattedDate = formatDateTimeForAPI(editedDateTaken);
        console.log(`File ${id}: Original Date:`, editedDateTaken, `Formatted Date for API:`, formattedDate); // Debug log
        if (formattedDate) {
          formData.append('date_taken', formattedDate);
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${apiURL}/upload_document`, true);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            updateFileStatus(id, 'uploading', { progress: percentComplete });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.success) {
                  updateFileStatus(id, 'success', { progress: 100, docnumber: response.docnumber });
                } else {
                  updateFileStatus(id, 'error', { error: response.error || 'Upload failed.' });
                }
            } catch (e) {
                 updateFileStatus(id, 'error', { error: 'Failed to parse server response.' });
            }
          } else {
             let errorMsg = `Server error: ${xhr.status}`;
             try {
                 const response = JSON.parse(xhr.responseText);
                 errorMsg = response.error || errorMsg;
             } catch (e) {
                 // Keep default error message
             }
             updateFileStatus(id, 'error', { error: errorMsg });
          }
          resolve();
        };

        xhr.onerror = () => {
          updateFileStatus(id, 'error', { error: 'Network error during upload.' });
          resolve();
        };

        xhr.send(formData);
      });
    });

    await Promise.all(uploadPromises);
    setIsUploading(false);
  };

  const handleAnalyze = () => {
    const successfulUploads = files.filter(f => f.status === 'success' && f.docnumber);
    if (successfulUploads.length > 0) {
      onAnalyze(successfulUploads);
    }
  };

  const pendingFilesCount = files.filter(f => f.status === 'pending').length;
  const successfulUploadsCount = files.filter(f => f.status === 'success' && f.docnumber != null).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex flex-col p-4 md:p-8"> {/* Increased z-index */}
       <div className="flex-shrink-0 flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Upload Documents</h2>
        <button onClick={onClose} disabled={isUploading} className="text-gray-400 hover:text-white text-3xl disabled:opacity-50">&times;</button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-8 overflow-hidden">
        {/* Left Side: Dropzone */}
        <div className="w-full md:w-1/3 flex flex-col">
            <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`flex-1 border-2 border-dashed rounded-xl flex flex-col justify-center items-center p-4 md:p-8 text-center transition-colors min-h-[150px] ${isDragOver ? 'border-red-500 bg-[#222]' : 'border-gray-600'}`}>
                <img src="/upload.svg" alt="Upload Icon" className="h-10 w-10 text-gray-400 mb-2" />
                <p className="mt-2 text-lg text-gray-300">Drag & Drop files here</p>
                <p className="text-sm text-gray-500">or</p>
                <label htmlFor="file-upload" className="mt-2 cursor-pointer px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-md hover:bg-gray-600 transition">
                    Browse Files
                </label>
                <input id="file-upload" type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            </div>
            <div className="mt-4">
              <EventEditor
                apiURL={apiURL}
                selectedEvent={selectedEvent}
                setSelectedEvent={setSelectedEvent}
              />
            </div>
        </div>

        {/* Right Side: File List & Actions */}
        <div className="w-full md:w-2/3 flex flex-col bg-[#282828] rounded-xl p-4 md:p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Upload Queue ({files.length})</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-4">
                {files.length > 0 ? (
                    files.map(f => (
                        <UploadFileItem
                            key={f.id}
                            uploadableFile={f}
                            onRemove={() => removeFile(f.id)}
                            onUpdateFileName={handleUpdateFileName} // Pass handler
                            onUpdateDateTaken={handleUpdateDateTaken} // Pass handler
                        />
                    ))
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        Select files to begin.
                    </div>
                )}
            </div>
             <div className="flex-shrink-0 pt-4 md:pt-6 border-t border-gray-700 flex flex-col sm:flex-row justify-end gap-2 md:gap-4">
               <button
                  onClick={handleUpload}
                  disabled={pendingFilesCount === 0 || isUploading}
                  className="px-4 py-2 md:px-6 md:py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : `Upload Pending (${pendingFilesCount})`}
                </button>
                 <button
                  onClick={handleAnalyze}
                  disabled={successfulUploadsCount === 0 || isUploading}
                  className="px-4 py-2 md:px-6 md:py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-600 transition disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Analyze with AI ({successfulUploadsCount})
                </button>
                <button
                  onClick={onClose}
                  disabled={isUploading}
                  className="px-4 py-2 md:px-6 md:py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                  Close
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};