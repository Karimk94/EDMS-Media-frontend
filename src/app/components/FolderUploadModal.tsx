import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { UploadFileItem } from './UploadFileItem';
import { LoadingButton } from './LoadingButton';
import ExifReader from 'exifreader';
import { UploadStatus, UploadableFile } from '../../interfaces';
import { apiClient } from '../../lib/apiClient';

const formatDateTimeForAPI = (date: Date | null): string | null => {
  if (!date) return null;
  const pad = (num: number) => num.toString().padStart(2, '0');
  if (isNaN(date.getTime())) return null;
  try {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch (e) {
    console.error("Error formatting date:", e, date);
    return null;
  }
};

const parseDateFromFilename = (filename: string): { date: Date | null, source: 'filename_full' | 'filename_partial' | null } => {
  let match;

  match = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    if (!isNaN(date.getTime()) && date.getFullYear() === parseInt(match[1])) {
      return { date, source: 'filename_full' };
    }
  }

  match = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    if (!isNaN(date.getTime()) && date.getFullYear() === parseInt(match[1])) {
      return { date, source: 'filename_full' };
    }
  }

  match = filename.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (match) {
    const date = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
    if (!isNaN(date.getTime()) && date.getFullYear() === parseInt(match[3])) {
      return { date, source: 'filename_full' };
    }
  }

  match = filename.match(/\b(19[5-9]\d|20[0-3]\d)\b/);
  if (match) {
    const date = new Date(parseInt(match[1]), 0, 1);
    if (!isNaN(date.getTime())) {
      return { date, source: 'filename_partial' };
    }
  }

  return { date: null, source: null };
};

const removeExtension = (filename: string) => {
  return filename.replace(/\.[^/.]+$/, "");
};

/**
 * Extracts the root folder name from a webkitRelativePath.
 * e.g., "MyFolder/subfolder/file.jpg" -> "MyFolder"
 */
const extractRootFolderName = (relativePath: string): string => {
  const parts = relativePath.split('/');
  return parts.length > 1 ? parts[0] : '';
};

import { FolderUploadModalProps } from '../../interfaces/PropsInterfaces';
import Image from 'next/image';

export const FolderUploadModal: React.FC<FolderUploadModalProps> = ({ onClose, apiURL, theme, parentId, parentName, onUploadComplete, t, initialFiles, onUploadSuccess }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasUploaded, setHasUploaded] = useState(false);
  const fileIdCounter = useRef(0);

  // New state for folder upload with event creation
  const [isFolderUpload, setIsFolderUpload] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [createdFolderId, setCreatedFolderId] = useState<string | null>(null);
  const [createdEventId, setCreatedEventId] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hasUploaded) onUploadComplete();
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, hasUploaded, onUploadComplete]);

  // Pre-seed files dropped directly from the OS onto the folder grid
  useEffect(() => {
    if (!initialFiles || initialFiles.length === 0) return;
    processFilesIntoUploadable(initialFiles).then(uploads => {
      setFiles(uploads);
    });
    // Only run once on mount — intentionally omitting processFilesIntoUploadable
    // from deps to avoid stale-closure issues with the counter ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      console.warn(`Could not read EXIF data for ${file.name}:`, error);
    }
    return null;
  };

  const processFilesIntoUploadable = async (fileArray: File[]): Promise<UploadableFile[]> => {
    const newUploadPromises = fileArray.map(async (file) => {
      let finalDate: Date | null = null;
      let dateSource: UploadableFile['dateSource'] = undefined;

      const exifDate = await extractExifDate(file);

      if (exifDate) {
        finalDate = exifDate;
        dateSource = 'exif';
      } else {
        const { date: filenameDate, source: filenameSource } = parseDateFromFilename(file.name);
        if (filenameDate && filenameSource) {
          finalDate = filenameDate;
          dateSource = filenameSource;
        } else if (file.lastModified) {
          finalDate = new Date(file.lastModified);
          dateSource = 'file';
        }
      }

      // Preserve relative path for folder uploads (e.g. "subfolder/file.pdf")
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;

      return {
        id: `file-${fileIdCounter.current++}`,
        file,
        status: 'pending',
        progress: 0,
        editedFileName: removeExtension(file.name),
        editedDateTaken: finalDate,
        dateSource: dateSource,
        relativePath,
      } as UploadableFile;
    });

    return Promise.all(newUploadPromises);
  };

  const handleFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newUploads = await processFilesIntoUploadable(Array.from(selectedFiles));
    setFiles(prev => [...prev, ...newUploads]);
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    
    // webkitdirectory gives us all files recursively — filter out any empty entries
    const fileArray = Array.from(selectedFiles).filter(f => f.size > 0 || f.name !== '');
    
    // Check if this is a folder upload (files have webkitRelativePath with folder structure)
    const firstFile = fileArray[0] as File & { webkitRelativePath?: string };
    if (firstFile?.webkitRelativePath) {
      const rootFolder = extractRootFolderName(firstFile.webkitRelativePath);
      if (rootFolder) {
        setIsFolderUpload(true);
        setFolderName(rootFolder);
      }
    }
    
    const newUploads = await processFilesIntoUploadable(fileArray);
    setFiles(prev => [...prev, ...newUploads]);
    // Reset input so same folder can be re-selected if needed
    e.target.value = '';
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    handleFiles(event.dataTransfer.files);
  };

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

  const handleUpdateFileName = (id: string, newName: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, editedFileName: newName } : f));
  };

  const handleUpdateDateTaken = (id: string, newDate: Date | null) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, editedDateTaken: newDate, dateSource: undefined } : f));
  };

  /**
   * Creates a new folder and event for folder uploads, or uses existing ones if they exist.
   * When uploading to the same folder (same parent_id), it reuses the existing folder.
   * When an event with the same name exists, it reuses the existing event.
   */
  const createFolderAndEvent = async (): Promise<{ folderId: string | null; eventId: number | null }> => {
    if (!isFolderUpload || !folderName.trim()) {
      return { folderId: parentId, eventId: null };
    }

    setIsCreatingFolder(true);
    let newFolderId: string | null = parentId;
    let newEventId: number | null = null;

    try {
      // 1. First, check if an event with this name already exists
      const eventsResponse = await apiClient.get(`${apiURL}/events?search=${encodeURIComponent(folderName.trim())}&fetch_all=true`);
      const existingEvent = eventsResponse.events?.find((e: any) => 
        e.name?.toLowerCase() === folderName.trim().toLowerCase()
      );
      
      if (existingEvent) {
        // Event already exists - reuse it
        newEventId = existingEvent.id;
        setCreatedEventId(newEventId);
        showToast(t('eventFound') || `Found existing event "${folderName}", adding files to it`, 'info');
        
        // If we're uploading to the same parent folder, reuse the existing folder
        // (don't create a new one, just use the current parent_id)
        if (parentId) {
          newFolderId = parentId;
          setCreatedFolderId(newFolderId);
        } else {
          // No parent folder specified, but event exists - create a new folder for organization
          const folderResponse = await apiClient.post(`${apiURL}/folders`, {
            name: folderName.trim(),
            description: `Folder uploaded from: ${folderName}`,
            parent_id: parentId
          });

          if (folderResponse.folder_id) {
            newFolderId = String(folderResponse.folder_id);
            setCreatedFolderId(newFolderId);
            showToast(t('folderCreated') || `Folder "${folderName}" created successfully`, 'success');
          } else {
            throw new Error(folderResponse.message || 'Failed to create folder');
          }
        }
      } else {
        // No existing event - create both folder and event as before
        // 1. Create the folder
        const folderResponse = await apiClient.post(`${apiURL}/folders`, {
          name: folderName.trim(),
          description: `Folder uploaded from: ${folderName}`,
          parent_id: parentId
        });

        if (folderResponse.folder_id) {
          newFolderId = String(folderResponse.folder_id);
          setCreatedFolderId(newFolderId);
          showToast(t('folderCreated') || `Folder "${folderName}" created successfully`, 'success');
        } else {
          throw new Error(folderResponse.message || 'Failed to create folder');
        }

        // 2. Create the event in LKP_PHOTO_EVENT
        const eventResponse = await apiClient.post(`${apiURL}/events`, {
          name: folderName.trim()
        });

        if (eventResponse.id) {
          newEventId = eventResponse.id;
          setCreatedEventId(newEventId);
          showToast(t('eventCreated') || `Event "${folderName}" created successfully`, 'success');
        } else if (eventResponse.message?.includes('already exists')) {
          // Race condition: event was created between check and create - find it
          const eventsResponse2 = await apiClient.get(`${apiURL}/events?search=${encodeURIComponent(folderName.trim())}&fetch_all=true`);
          const existingEvent2 = eventsResponse2.events?.find((e: any) => 
            e.name?.toLowerCase() === folderName.trim().toLowerCase()
          );
          if (existingEvent2) {
            newEventId = existingEvent2.id;
            setCreatedEventId(newEventId);
          }
        }
      }

    } catch (error: any) {
      console.error('Error creating folder/event:', error);
      showToast(error.message || t('errorCreatingFolder') || 'Error creating folder', 'error');
      // Continue with upload to original parent if folder creation fails
    } finally {
      setIsCreatingFolder(false);
    }

    return { folderId: newFolderId, eventId: newEventId };
  };

  /**
   * Links a document to an event
   */
  const linkDocumentToEvent = async (docId: number, eventId: number): Promise<boolean> => {
    try {
      await apiClient.put(`${apiURL}/document/${docId}/event`, { event_id: eventId });
      return true;
    } catch (error) {
      console.error(`Error linking document ${docId} to event ${eventId}:`, error);
      return false;
    }
  };

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setHasUploaded(true);

    // If this is a folder upload, create folder and event first
    let uploadParentId = parentId;
    let eventId: number | null = null;

    if (isFolderUpload && folderName.trim()) {
      const { folderId, eventId: createdEventId } = await createFolderAndEvent();
      uploadParentId = folderId;
      eventId = createdEventId;
    }

    const uploadPromises = pendingFiles.map(uploadableFile => {
      return new Promise<void>(async (resolve) => {
        const { id, file, editedFileName, editedDateTaken } = uploadableFile;
        updateFileStatus(id, 'uploading', { progress: 0 });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('docname', (editedFileName && editedFileName.trim()) ? editedFileName.trim() : removeExtension(file.name));
        formData.append('abstract', ``);

        if (uploadParentId) {
          formData.append('parent_id', uploadParentId);
        }

        const formattedDate = formatDateTimeForAPI(editedDateTaken);
        if (formattedDate) {
          formData.append('date_taken', formattedDate);
        }

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${apiURL}/upload_document`, true);
        xhr.setRequestHeader('X-App-Source', 'edms-media');

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            updateFileStatus(id, 'uploading', { progress: percentComplete });
          }
        };

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              if (response.success) {
                updateFileStatus(id, 'success', { progress: 100, docnumber: response.docnumber });
                
                // Link document to event if we have an event ID
                if (eventId && response.docnumber) {
                  await linkDocumentToEvent(response.docnumber, eventId);
                }
              } else {
                updateFileStatus(id, 'error', { error: response.error || t('uploadFailed') });
              }
            } catch (e) {
              updateFileStatus(id, 'error', { error: t('failedToParseServerResponse') });
            }
          } else {
            let errorMsg = `${t('serverError')} ${xhr.status}`;
            try {
              const response = JSON.parse(xhr.responseText);
              errorMsg = response.error || errorMsg;
            } catch (e) {
            }
            updateFileStatus(id, 'error', { error: errorMsg });
            showToast(errorMsg, 'error');
          }

          resolve();
        };

        xhr.onerror = () => {
          updateFileStatus(id, 'error', { error: t('networkErrorDuringUpload') });
          resolve();
        };

        xhr.send(formData);
      });
    });

    await Promise.all(uploadPromises);
    // Invalidate quota and user caches so the pie chart updates immediately
    queryClient.invalidateQueries({ queryKey: ['quota'] });
    queryClient.invalidateQueries({ queryKey: ['user'] });
    queryClient.invalidateQueries({ queryKey: ['folders'] });
    setIsUploading(false);

    // Collect successfully uploaded docnumbers and notify parent for processing status tracking
    const successfulDocnumbers = files
      .filter(f => f.status === 'success' && f.docnumber != null)
      .map(f => f.docnumber as number);
    
    if (onUploadSuccess && successfulDocnumbers.length > 0) {
      onUploadSuccess(successfulDocnumbers);
    }
  };

  const handleClose = () => {
    if (hasUploaded) {
      onUploadComplete();
    } else {
      onClose();
    }
  };

  const pendingFilesCount = files.filter(f => f.status === 'pending').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex flex-col p-4 md:p-8" role="dialog" aria-modal="true" aria-label={t('uploadToFolder')}>
      {/* Distinct Header for Folder Upload */}
      <div className="flex-shrink-0 flex justify-between items-center mb-6 bg-blue-900/30 p-4 rounded-lg border border-blue-800">
        <div className="flex flex-col">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Image src="/folder.svg" alt="" width={24} height={24} className="brightness-0 invert" />
            {t('uploadToFolder')}
          </h2>
          <p className="text-sm text-gray-300 mt-1">
            {t('targetDirectory')} <span className="text-blue-300 font-bold underline">{parentName || t('home')}</span>
          </p>
        </div>
        <button onClick={handleClose} disabled={isUploading || isCreatingFolder} className="text-gray-400 hover:text-white disabled:opacity-50 p-1"><Image src="/icons/close.svg" alt="" width={24} height={24} className="invert" /></button>
      </div>

      {/* Folder Upload Section - Show when a folder is selected */}
      {isFolderUpload && (
        <div className="flex-shrink-0 mb-4 bg-indigo-900/30 p-4 rounded-lg border border-indigo-700">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Image src="/folder.svg" alt="" width={20} height={20} className="brightness-0 invert" />
              <span className="text-white font-medium">{t('folderUploadDetected') || 'Folder detected:'}</span>
            </div>
            <div className="flex-1 flex items-center gap-3">
              <label className="text-gray-300 text-sm">{t('folderName') || 'Folder Name:'}</label>
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-md bg-gray-800 border border-gray-600 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                placeholder={t('enterFolderName') || 'Enter folder name'}
                disabled={isUploading || isCreatingFolder || hasUploaded}
              />
            </div>
            <p className="text-xs text-gray-400">
              {t('folderUploadInfo') || 'A new folder and event will be created with this name, and all files will be uploaded to it.'}
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-8 overflow-hidden">
        <div className="w-full md:w-1/3 flex flex-col">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col justify-center items-center p-4 md:p-8 text-center transition-colors min-h-[150px] ${isDragOver ? 'border-blue-500 bg-[#222]' : 'border-gray-600'}`}>
            <Image src="/upload.svg" alt="Upload Icon" width={40} height={40} className="text-gray-400 mb-2 invert" />
            <p className="mt-2 text-lg text-gray-300">{t('dragAndDrop')}</p>
            <p className="text-sm text-gray-500">{t('or')}</p>

            {/* Browse individual files */}
            <label htmlFor="folder-file-upload" className="mt-2 cursor-pointer px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition">
              {t('browseFiles')}
            </label>
            <input id="folder-file-upload" type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} disabled={isUploading || isCreatingFolder} />

            {/* Browse an entire folder (all children + sub-children) */}
            <label
              htmlFor="folder-directory-upload"
              className="mt-2 cursor-pointer px-4 py-2 bg-indigo-700 text-white text-sm font-medium rounded-md hover:bg-indigo-800 transition flex items-center gap-2"
              title={t('selectFolderTooltip')}
            >
              <Image src="/folder.svg" alt="" width={16} height={16} className="brightness-0 invert" />
              {t('selectFolder')}
            </label>
            <input
              id="folder-directory-upload"
              type="file"
              className="hidden"
              // @ts-ignore — webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              multiple
              onChange={handleFolderSelect}
              disabled={isUploading || isCreatingFolder}
            />
            <p className="mt-2 text-xs text-gray-500">{t('selectsAllFilesRecursively')}</p>

            {/* Rate limit notice */}
            <p className="mt-3 text-xs text-amber-400 bg-amber-900/30 px-3 py-2 rounded-md border border-amber-700/50">
              ⚠️ {t('uploadRateLimit')}
            </p>
          </div>
        </div>

        <div className="w-full md:w-2/3 flex flex-col bg-[#282828] rounded-xl p-4 md:p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="bg-blue-600 w-2 h-2 rounded-full"></span>
            {t('fileQueue')} ({files.length})
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-4">
            {files.length > 0 ? (
              files.map(f => (
                <UploadFileItem
                  key={f.id}
                  uploadableFile={f}
                  onRemove={() => removeFile(f.id)}
                  onUpdateFileName={handleUpdateFileName}
                  onUpdateDateTaken={handleUpdateDateTaken}
                />
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <p>{t('noFilesSelected')}</p>
                <p className="text-xs text-gray-600 mt-1">{t('filesWillBeAddedTo')} {isFolderUpload ? (folderName || t('newFolder')) : parentName}</p>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 pt-4 md:pt-6 border-t border-gray-700 flex flex-col sm:flex-row justify-end gap-2 md:gap-4">
            <LoadingButton
              onClick={handleUpload}
              isLoading={isUploading || isCreatingFolder}
              loadingText={isCreatingFolder ? (t('creatingFolder') || 'Creating folder...') : t('uploading')}
              disabled={pendingFilesCount === 0}
              className="px-4 py-2 md:px-6 md:py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {`${t('upload')} ${pendingFilesCount} ${t('items')}`}
            </LoadingButton>
            <button
              onClick={handleClose}
              disabled={isUploading || isCreatingFolder}
              className="px-4 py-2 md:px-6 md:py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {hasUploaded ? t('finish') : t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};