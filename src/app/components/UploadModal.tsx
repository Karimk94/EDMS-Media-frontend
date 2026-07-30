import React, { useState, useRef, useEffect } from 'react';
import { UploadFileItem } from './UploadFileItem';
import ExifReader from 'exifreader';
import { UploadStatus, UploadableFile } from '../../interfaces';
import { useToast } from '../context/ToastContext';

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

import { UploadModalProps } from '../../interfaces/PropsInterfaces';

import { useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { LoadingButton } from './LoadingButton';

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, apiURL, theme, t }) => {
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileIdCounter = useRef(0);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  const handleFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newUploadPromises = Array.from(selectedFiles).map(async (file) => {

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

      return {
        id: `file-${fileIdCounter.current++}`,
        file,
        status: 'pending',
        progress: 0,
        editedFileName: removeExtension(file.name),
        editedDateTaken: finalDate,
        dateSource: dateSource
      } as UploadableFile;
    });

    const newUploads = await Promise.all(newUploadPromises);
    setFiles(prev => [...prev, ...newUploads]);
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

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    const uploadPromises = pendingFiles.map(uploadableFile => {
      return new Promise<void>((resolve) => {
        const { id, file, editedFileName, editedDateTaken } = uploadableFile;
        updateFileStatus(id, 'uploading', { progress: 0 });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('docname', (editedFileName && editedFileName.trim()) ? editedFileName.trim() : removeExtension(file.name));
        formData.append('abstract', ``);

        const formattedDate = formatDateTimeForAPI(editedDateTaken);
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
                successCount++;
              } else {
                const errorMsg = response.error || t('uploadFailed');
                updateFileStatus(id, 'error', { error: errorMsg });
                errorCount++;
              }
            } catch (e) {
              updateFileStatus(id, 'error', { error: t('failedToParseServerResponse') });
              errorCount++;
            }
          } else {
            let errorMsg = `${t('serverError')} ${xhr.status}`;
            try {
              const response = JSON.parse(xhr.responseText);
              errorMsg = response.error || errorMsg;
            } catch (e) {
            }
            updateFileStatus(id, 'error', { error: errorMsg });
            errorCount++;
          }
          resolve();
        };

        xhr.onerror = () => {
          updateFileStatus(id, 'error', { error: t('networkErrorDuringUpload') });
          errorCount++;
          resolve();
        };

        xhr.send(formData);
      });
    });

    await Promise.all(uploadPromises);
    setIsUploading(false);

    if (errorCount === 0 && successCount > 0) {
      showToast(`${t('SuccessfullyUploaded')} ${successCount} ${t('file(s)')}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } else if (errorCount > 0 && successCount > 0) {
      showToast(`${t('uploadCompletedWith')} ${errorCount} ${t('error(s)')} `, 'warning');
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } else if (errorCount > 0 && successCount === 0) {
      showToast(t('AllUploadsFailed'), 'error');
    }
  };

  const pendingFilesCount = files.filter(f => f.status === 'pending').length;
  const successfulUploadsCount = files.filter(f => f.status === 'success' && f.docnumber != null).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex flex-col p-4 md:p-8" role="dialog" aria-modal="true" aria-label={t('uploadDocument')}>
      <div className="flex-shrink-0 flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">{t('uploadDocuments')}</h2>
        <button onClick={onClose} disabled={isUploading} className="text-gray-400 hover:text-white text-3xl disabled:opacity-50">&times;</button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-8 overflow-hidden">
        <div className="w-full md:w-1/3 flex flex-col">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className={`flex-1 border-2 border-dashed rounded-xl flex flex-col justify-center items-center p-4 md:p-8 text-center transition-colors min-h-[150px] ${isDragOver ? 'border-red-500 bg-[#222]' : 'border-gray-600'}`}>
            <Image src="/upload.svg" alt="Upload Icon" width={40} height={40} className="text-gray-400 mb-2 invert" />
            <p className="mt-2 text-lg text-gray-300">{t('dragAndDrop')}</p>
            <p className="text-sm text-gray-500">{t('or')}</p>
            <label htmlFor="file-upload" className="mt-2 cursor-pointer px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-md hover:bg-gray-600 transition">
              {t('browseFiles')}
            </label>
            <input id="file-upload" type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>
        </div>

        <div className="w-full md:w-2/3 flex flex-col bg-[#282828] rounded-xl p-4 md:p-6">
          <h3 className="text-lg font-semibold text-white mb-4">{t('uploadQueue')} ({files.length})</h3>
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
              <div className="h-full flex items-center justify-center text-gray-500">
                {t('selectFilesToBegin')}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 pt-4 md:pt-6 border-t border-gray-700 flex flex-col sm:flex-row justify-end gap-2 md:gap-4">
            <LoadingButton
              onClick={handleUpload}
              isLoading={isUploading}
              loadingText={t('uploading')}
              disabled={pendingFilesCount === 0}
              className="px-4 py-2 md:px-6 md:py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {`${t('uploadPending')} (${pendingFilesCount})`}
            </LoadingButton>
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 md:px-6 md:py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition disabled:bg-gray-500 disabled:cursor-not-allowed"
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};