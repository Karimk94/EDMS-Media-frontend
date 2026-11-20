import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { LoadingButton } from './LoadingButton';
import ExifReader from 'exifreader';
import Image from 'next/image';
import { apiClient } from '../../lib/apiClient';
import { DualUploadModalProps } from '../../interfaces/PropsInterfaces';

export interface PairedUploadItem {
  id: string;
  editedFile: File;
  originalFile?: File | null;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  editedDocnumber?: number;
  originalDocnumber?: number;
  error?: string;
  editedDateTaken?: Date | null;
  hasMatchedOriginal: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDateTimeForAPI = (date: Date | null): string | null => {
  if (!date) return null;
  const pad = (num: number) => num.toString().padStart(2, '0');
  if (isNaN(date.getTime())) return null;
  try {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  } catch {
    return null;
  }
};

const removeExtension = (filename: string): string => {
  return filename.replace(/\.[^/.]+$/, '');
};

/**
 * Normalizes a filename to its base stem by stripping extensions
 * and common post-processing suffixes (e.g. _edit, _edited, -edited, _final, _retouched, _v1).
 */
const getNormalizedStem = (filename: string): string => {
  const base = removeExtension(filename).trim().toLowerCase();
  return base
    .replace(/[-_]?(edited|edit|retouched|final|master|processed|v\d+|copy)$/i, '')
    .replace(/[-_]$/, '');
};

type ResultFilter = 'all' | 'paired' | 'missing' | 'failed';

export const DualUploadModal: React.FC<DualUploadModalProps> = ({
  onClose,
  apiURL,
  theme,
  parentId,
  parentName,
  onUploadComplete,
  t,
  onUploadSuccess,
}) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [rawEditedFiles, setRawEditedFiles] = useState<File[]>([]);
  const [rawOriginalFiles, setRawOriginalFiles] = useState<File[]>([]);
  const [editedDirectoryName, setEditedDirectoryName] = useState<string>('');
  const [parentDirectoryName, setParentDirectoryName] = useState<string>('');
  const [eventFolderName, setEventFolderName] = useState<string>('');
  const [manualPairs, setManualPairs] = useState<Record<string, string>>({}); // editedFileName -> originalFileName or '__NONE__'

  const [isUploading, setIsUploading] = useState(false);
  const [uploadItems, setUploadItems] = useState<PairedUploadItem[]>([]);
  const [hasStartedUpload, setHasStartedUpload] = useState(false);
  const [isUploadFinished, setIsUploadFinished] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');

  const [isLeftDragOver, setIsLeftDragOver] = useState(false);
  const [isRightDragOver, setIsRightDragOver] = useState(false);

  const leftFolderInputRef = useRef<HTMLInputElement>(null);
  const leftFilesInputRef = useRef<HTMLInputElement>(null);
  const rightFolderInputRef = useRef<HTMLInputElement>(null);
  const rightFilesInputRef = useRef<HTMLInputElement>(null);
  const eventFolderInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key if not currently uploading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isUploading) {
        if (hasStartedUpload) onUploadComplete();
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isUploading, hasStartedUpload, onUploadComplete]);

  // Handle files selection
  const addEditedFiles = (newFiles: FileList | File[] | null) => {
    if (!newFiles) return;
    const array = Array.from(newFiles).filter((f) => f.size > 0 && f.name);
    setRawEditedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const filtered = array.filter((f) => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
  };

  const addOriginalFiles = (newFiles: FileList | File[] | null) => {
    if (!newFiles) return;
    const array = Array.from(newFiles).filter((f) => f.size > 0 && f.name);
    setRawOriginalFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const filtered = array.filter((f) => !existingNames.has(f.name));
      return [...prev, ...filtered];
    });
  };

  const handleEditedFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    e.currentTarget.value = '';
    addEditedFiles(files);
  };

  const handleOriginalFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || []);
    e.currentTarget.value = '';
    addOriginalFiles(files);
  };

  /**
   * Intelligently analyzes a selected folder's files.
   * If it finds an edited/selected subfolder alongside parent files,
   * it automatically splits them across the Edited and Original windows in 1 click!
   */
  const tryAutoSplitFolder = (fileArray: File[]): boolean => {
    const firstRelativePath = fileArray
      .map((file) => (file as File & { webkitRelativePath?: string }).webkitRelativePath)
      .find((path) => Boolean(path));
    if (!firstRelativePath) {
      return false;
    }

    const rootFolderName = firstRelativePath.split('/')[0];

    const rootFiles: File[] = [];
    const subfolderMap = new Map<string, File[]>();

    fileArray.forEach((f) => {
      const relativePath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || '';
      const parts = relativePath.split('/');
      if (parts.length === 2) {
        rootFiles.push(f);
      } else if (parts.length >= 3) {
        const subName = parts[1];
        const existing = subfolderMap.get(subName) || [];
        existing.push(f);
        subfolderMap.set(subName, existing);
      }
    });

    if (subfolderMap.size === 0) {
      return false;
    }

    // A single child folder is unambiguous, whatever it is named.
    let matchedSubfolder: string | null =
      subfolderMap.size === 1 ? Array.from(subfolderMap.keys())[0] : null;

    // Otherwise, look for common edited/selected folder names.
    const SUBFOLDER_KEYWORDS =
      /^(selected|selects|select|selection|selections|edited|edits|edit|retouched|retouch|final|finals|exports|export|processed|process|approved|best|done|output|deliverables|v\d+|jpegs|jpgs)$/i;

    if (!matchedSubfolder) {
      for (const subName of Array.from(subfolderMap.keys())) {
        if (
          SUBFOLDER_KEYWORDS.test(subName) ||
          /select|edit|retouch|final|export|process|approved/i.test(subName)
        ) {
          matchedSubfolder = subName;
          break;
        }
      }
    }

    // Match by file stem similarity when the folder names are inconclusive.
    if (!matchedSubfolder && rootFiles.length > 0) {
      const rootStems = new Set(rootFiles.map((f) => getNormalizedStem(f.name)));
      let bestMatchCount = 0;
      let bestSub: string | null = null;
      for (const [subName, subFiles] of Array.from(subfolderMap.entries())) {
        const matchCount = subFiles.filter((f) => rootStems.has(getNormalizedStem(f.name))).length;
        if (matchCount > bestMatchCount) {
          bestMatchCount = matchCount;
          bestSub = subName;
        }
      }
      if (bestMatchCount > 0 && bestSub) {
        matchedSubfolder = bestSub;
      }
    }

    if (matchedSubfolder) {
      const edited = subfolderMap.get(matchedSubfolder)!;
      let originals: File[] = rootFiles;
      if (originals.length === 0) {
        for (const [subName, subFiles] of Array.from(subfolderMap.entries())) {
          if (subName !== matchedSubfolder) {
            originals = subFiles;
            break;
          }
        }
      }

      setRawEditedFiles(edited);
      setRawOriginalFiles(originals);
      setEditedDirectoryName(`${rootFolderName}/${matchedSubfolder}`);
      setParentDirectoryName(`${rootFolderName} (..\\)`);
      setEventFolderName(rootFolderName);
      showToast(
        t('autoDetectedFolderStructure') ||
          `Auto-detected: ${edited.length} edited in '${matchedSubfolder}', ${originals.length} originals in parent directory (..\\)`,
        'success'
      );
      return true;
    }

    return false;
  };

  /**
   * Handles selection of the Edited folder.
   * Auto-detects if user picked a parent folder containing an edited subfolder!
   */
  const handleEditedFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileArray = Array.from(e.currentTarget.files || []).filter((f) => f.size > 0 && f.name);
    e.currentTarget.value = '';
    if (fileArray.length === 0) return;

    if (tryAutoSplitFolder(fileArray)) {
      return;
    }

    const relativePath = (fileArray[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (relativePath) {
      const rootFolderName = relativePath.split('/')[0];
      setEditedDirectoryName(rootFolderName);
      setParentDirectoryName('');
      setEventFolderName(rootFolderName);
    }

    addEditedFiles(fileArray);
  };

  /**
   * Handles selection of the Parent folder for originals.
   */
  const handleParentFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileArray = Array.from(e.currentTarget.files || []).filter((f) => f.size > 0 && f.name);
    e.currentTarget.value = '';
    if (fileArray.length === 0) return;

    // If left side was empty, check if this parent folder contains an edited subfolder
    if (rawEditedFiles.length === 0 && tryAutoSplitFolder(fileArray)) {
      return;
    }

    // If left side already has files, filter out files that are inside the edited subfolder
    let originals = fileArray;
    if (editedDirectoryName) {
      const subNameClean = editedDirectoryName.split('/').pop()?.toLowerCase();
      originals = fileArray.filter((f) => {
        const relativePath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || '';
        const parts = relativePath.split('/');
        if (parts.length >= 3 && subNameClean && parts[1].toLowerCase() === subNameClean) {
          return false;
        }
        return true;
      });
    }

    const relativePath = (fileArray[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (relativePath) {
      const rootFolderName = relativePath.split('/')[0];
      setParentDirectoryName(`${rootFolderName} (..\\)`);
      if (rawEditedFiles.length > 0) {
        setEventFolderName(rootFolderName);
      }
    }

    addOriginalFiles(originals);
  };

  /**
   * 1-Click Event / Parent folder selector handler
   */
  const handleEventFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileArray = Array.from(e.currentTarget.files || []).filter((f) => f.size > 0 && f.name);
    e.currentTarget.value = '';
    if (fileArray.length === 0) return;

    if (!tryAutoSplitFolder(fileArray)) {
      const relativePath = (fileArray[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
      if (relativePath) {
        const rootFolderName = relativePath.split('/')[0];
        setEditedDirectoryName(rootFolderName);
        setEventFolderName(rootFolderName);
      }
      addEditedFiles(fileArray);
    }
  };

  // Build the paired mapping whenever file lists or manual overrides change
  const pairedView = useMemo(() => {
    const originalByStem = new Map<string, File[]>();
    const originalByName = new Map<string, File>();

    rawOriginalFiles.forEach((f) => {
      originalByName.set(f.name, f);
      const stem = getNormalizedStem(f.name);
      const list = originalByStem.get(stem) || [];
      list.push(f);
      originalByStem.set(stem, list);
    });

    const usedOriginalNames = new Set<string>();

    const pairs = rawEditedFiles.map((edited) => {
      const manualSelection = manualPairs[edited.name];
      let matchedOriginal: File | null = null;

      if (manualSelection === '__NONE__') {
        matchedOriginal = null;
      } else if (manualSelection && originalByName.has(manualSelection)) {
        matchedOriginal = originalByName.get(manualSelection)!;
        usedOriginalNames.add(matchedOriginal.name);
      } else {
        // Automatic matching
        // 1. Exact base name match first
        const exactBase = removeExtension(edited.name).toLowerCase();
        const candidateExact = rawOriginalFiles.find(
          (o) => !usedOriginalNames.has(o.name) && removeExtension(o.name).toLowerCase() === exactBase
        );

        if (candidateExact) {
          matchedOriginal = candidateExact;
          usedOriginalNames.add(candidateExact.name);
        } else {
          // 2. Normalized stem match (stripping _edited, etc.)
          const stem = getNormalizedStem(edited.name);
          const candidates = (originalByStem.get(stem) || []).filter((o) => !usedOriginalNames.has(o.name));
          if (candidates.length > 0) {
            matchedOriginal = candidates[0];
            usedOriginalNames.add(matchedOriginal.name);
          }
        }
      }

      return {
        edited,
        original: matchedOriginal,
      };
    });

    // Determine unmatched originals in parent directory
    const unmatchedOriginals = rawOriginalFiles.filter((o) => !usedOriginalNames.has(o.name));

    return { pairs, unmatchedOriginals };
  }, [rawEditedFiles, rawOriginalFiles, manualPairs]);

  const handleManualPairChange = (editedName: string, selectedOriginalName: string) => {
    setManualPairs((prev) => ({
      ...prev,
      [editedName]: selectedOriginalName,
    }));
  };

  const removeEditedFile = (filename: string) => {
    setRawEditedFiles((prev) => prev.filter((f) => f.name !== filename));
    setManualPairs((prev) => {
      const next = { ...prev };
      delete next[filename];
      return next;
    });
  };

  const clearEdited = () => {
    setRawEditedFiles([]);
    setEditedDirectoryName('');
    setEventFolderName('');
    setManualPairs({});
  };

  const clearOriginals = () => {
    setRawOriginalFiles([]);
    setParentDirectoryName('');
    setManualPairs({});
  };

  const extractExifDate = async (file: File): Promise<Date | null> => {
    try {
      const tags = await ExifReader.load(file);
      const dateTimeOriginal = tags['Creation Time']?.value ?? tags['CreateDate']?.value;
      if (dateTimeOriginal) {
        const parsedDate = new Date(dateTimeOriginal);
        if (!isNaN(parsedDate.getTime())) return parsedDate;
      }
    } catch {
      // Exif not present or non-image
    }
    return file.lastModified ? new Date(file.lastModified) : null;
  };

  /**
   * Finds or automatically creates the `_Originals` folder under parentId in DMS.
   */
  const getOrCreateOriginalsFolder = async (targetParentId: string | null): Promise<string> => {
    try {
      const queryUrl = targetParentId
        ? `${apiURL}/folders?parent_id=${targetParentId}`
        : `${apiURL}/folders`;
      const res = await apiClient.get(queryUrl);
      const items = Array.isArray(res) ? res : res.contents || res.items || [];
      const existing = items.find(
        (item: any) =>
          (item.name || '').toLowerCase() === '_originals' ||
          (item.name || '').toLowerCase() === '_original'
      );
      if (existing) {
        return String(existing.id || existing.docnumber || existing.folder_id);
      }
    } catch (e) {
      console.warn('Could not list folders to check for _Originals, creating directly:', e);
    }

    const createRes = await apiClient.post(`${apiURL}/folders`, {
      name: '_Originals',
      description: 'Original unedited master files',
      parent_id: targetParentId,
    });

    if (createRes.folder_id) {
      return String(createRes.folder_id);
    }
    throw new Error(createRes.message || 'Failed to create _Originals folder');
  };

  const createFolderAndEvent = async (
    folderName: string
  ): Promise<{ folderId: string | null; eventId: number | null }> => {
    const name = folderName.trim();
    if (!name) return { folderId: parentId, eventId: null };

    const eventsResponse = await apiClient.get(
      `${apiURL}/events?search=${encodeURIComponent(name)}&fetch_all=true`
    );
    const existingEvent = eventsResponse.events?.find(
      (event: { name?: string; id?: number }) => event.name?.toLowerCase() === name.toLowerCase()
    );

    if (existingEvent) {
      showToast(t('eventFound') || `Found existing event "${name}", adding files to it`, 'info');
      if (parentId) return { folderId: parentId, eventId: existingEvent.id };
    }

    const folderResponse = await apiClient.post(`${apiURL}/folders`, {
      name,
      description: `Folder uploaded from: ${name}`,
      parent_id: parentId,
    });
    if (!folderResponse.folder_id) {
      throw new Error(folderResponse.message || 'Failed to create folder');
    }
    const folderId = String(folderResponse.folder_id);

    if (existingEvent) return { folderId, eventId: existingEvent.id };

    const eventResponse = await apiClient.post(`${apiURL}/events`, { name });
    if (eventResponse.id) {
      showToast(t('eventCreated') || `Event "${name}" created successfully`, 'success');
      return { folderId, eventId: eventResponse.id };
    }
    if (eventResponse.message?.includes('already exists')) {
      const refreshedEvents = await apiClient.get(
        `${apiURL}/events?search=${encodeURIComponent(name)}&fetch_all=true`
      );
      const racedEvent = refreshedEvents.events?.find(
        (event: { name?: string; id?: number }) => event.name?.toLowerCase() === name.toLowerCase()
      );
      if (racedEvent) return { folderId, eventId: racedEvent.id };
    }

    throw new Error(eventResponse.message || `Failed to create event "${name}"`);
  };

  const linkDocumentToEvent = async (docnumber: number, eventId: number) => {
    try {
      await apiClient.put(`${apiURL}/document/${docnumber}/event`, { event_id: eventId });
    } catch (error) {
      console.error(`Error linking document ${docnumber} to event ${eventId}:`, error);
    }
  };

  /**
   * Uploads an individual file via XMLHttpRequest with progress tracking.
   */
  const uploadSingleFile = (
    file: File,
    docname: string,
    targetFolderId: string | null,
    options: {
      isOriginal: boolean;
      skipAi: boolean;
      originalDocnumber?: number | null;
      dateTaken?: Date | null;
      onProgress?: (progress: number) => void;
    }
  ): Promise<{ success: boolean; docnumber?: number; error?: string }> => {
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docname', docname);
      formData.append('abstract', '');

      if (targetFolderId) {
        formData.append('parent_id', targetFolderId);
      }
      if (options.dateTaken) {
        const formatted = formatDateTimeForAPI(options.dateTaken);
        if (formatted) formData.append('date_taken', formatted);
      }
      if (options.isOriginal) {
        formData.append('is_original', 'true');
      }
      if (options.skipAi) {
        formData.append('skip_ai', 'true');
      }
      if (options.originalDocnumber) {
        formData.append('original_docnumber', String(options.originalDocnumber));
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${apiURL}/upload_document`, true);
      xhr.setRequestHeader('X-App-Source', 'edms-media');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && options.onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          options.onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const resp = JSON.parse(xhr.responseText);
            if (resp.success) {
              resolve({ success: true, docnumber: Number(resp.docnumber) });
            } else {
              resolve({ success: false, error: resp.error || 'Upload failed' });
            }
          } catch {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        } else {
          let errorMsg = `Server error ${xhr.status}`;
          try {
            const resp = JSON.parse(xhr.responseText);
            errorMsg = resp.error || resp.detail || errorMsg;
          } catch {}
          resolve({ success: false, error: errorMsg });
        }
      };

      xhr.onerror = () => resolve({ success: false, error: 'Network error during upload' });
      xhr.ontimeout = () => resolve({ success: false, error: 'Upload timed out' });

      xhr.send(formData);
    });
  };

  /**
   * Orchestrates the paired batch upload.
   */
  const handleStartUpload = async () => {
    if (pairedView.pairs.length === 0) {
      showToast(t('noFilesToUpload') || 'No files selected to upload', 'error');
      return;
    }

    let uploadParentId = parentId;
    let eventId: number | null = null;
    if (eventFolderName.trim()) {
      try {
        const eventFolder = await createFolderAndEvent(eventFolderName);
        uploadParentId = eventFolder.folderId;
        eventId = eventFolder.eventId;
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : 'Failed to create folder and event',
          'error'
        );
        return;
      }
    }

    setIsUploading(true);
    setHasStartedUpload(true);
    setIsUploadFinished(false);

    // Initial items state
    const initialItems: PairedUploadItem[] = pairedView.pairs.map((p, idx) => ({
      id: `pair-${idx}`,
      editedFile: p.edited,
      originalFile: p.original,
      status: 'pending',
      progress: 0,
      hasMatchedOriginal: p.original != null,
    }));
    setUploadItems(initialItems);

    let originalsFolderId: string | null = null;
    const hasAnyOriginals = pairedView.pairs.some((p) => p.original != null);

    if (hasAnyOriginals) {
      try {
        originalsFolderId = await getOrCreateOriginalsFolder(uploadParentId);
      } catch (err: any) {
        showToast(err.message || 'Failed to prepare _Originals folder', 'error');
        setIsUploading(false);
        return;
      }
    }

    const successfulEditedDocnumbers: number[] = [];

    // Process pairs sequentially to maintain stable progress and avoid overwhelming DMS SOAP connections
    for (let i = 0; i < initialItems.length; i++) {
      const item = initialItems[i];

      setUploadItems((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading', progress: 5 } : it))
      );

      let originalDocnumber: number | null = null;

      // 1. Upload original file if paired
      if (item.originalFile && originalsFolderId) {
        setUploadItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, progress: 20 } : it))
        );

        const origResult = await uploadSingleFile(
          item.originalFile,
          removeExtension(item.originalFile.name),
          originalsFolderId,
          {
            isOriginal: true,
            skipAi: true, // Only edited gets AI processed
            onProgress: (p) => {
              setUploadItems((prev) =>
                prev.map((it, idx) =>
                  idx === i ? { ...it, progress: Math.min(45, Math.round(p * 0.45)) } : it
                )
              );
            },
          }
        );

        if (!origResult.success || !origResult.docnumber) {
          setUploadItems((prev) =>
            prev.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    status: 'error',
                    error: `Original upload failed: ${origResult.error || 'Unknown error'}`,
                  }
                : it
            )
          );
          continue;
        }

        originalDocnumber = origResult.docnumber;
        if (eventId) {
          await linkDocumentToEvent(originalDocnumber, eventId);
        }
      }

      // 2. Upload edited file (with originalDocnumber linked and AI processing active)
      const dateTaken = await extractExifDate(item.editedFile);

      setUploadItems((prev) =>
        prev.map((it, idx) =>
          idx === i ? { ...it, progress: 50, originalDocnumber: originalDocnumber || undefined } : it
        )
      );

      const editedResult = await uploadSingleFile(
        item.editedFile,
        removeExtension(item.editedFile.name),
        uploadParentId,
        {
          isOriginal: false,
          skipAi: false, // Edited file IS analyzed by the AI pipeline!
          originalDocnumber: originalDocnumber,
          dateTaken: dateTaken,
          onProgress: (p) => {
            setUploadItems((prev) =>
              prev.map((it, idx) =>
                idx === i ? { ...it, progress: Math.min(95, 50 + Math.round(p * 0.45)) } : it
              )
            );
          },
        }
      );

      if (editedResult.success && editedResult.docnumber) {
        successfulEditedDocnumbers.push(editedResult.docnumber);
        if (eventId) {
          await linkDocumentToEvent(editedResult.docnumber, eventId);
        }

        // Fallback explicit linking if original was present to guarantee relation persistence
        if (originalDocnumber) {
          try {
            await apiClient.post(`${apiURL}/document/${editedResult.docnumber}/link_original`, {
              original_docnumber: originalDocnumber,
              relation_type: 'ORIGINAL',
            });
          } catch (linkErr) {
            console.warn('Fallback link_original call warning:', linkErr);
          }
        }

        setUploadItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'success',
                  progress: 100,
                  editedDocnumber: editedResult.docnumber,
                  originalDocnumber: originalDocnumber || undefined,
                }
              : it
          )
        );
      } else {
        setUploadItems((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? {
                  ...it,
                  status: 'error',
                  error: editedResult.error || 'Failed to upload edited photo',
                }
              : it
          )
        );
      }
    }

    // Refresh caches
    queryClient.invalidateQueries({ queryKey: ['quota'] });
    queryClient.invalidateQueries({ queryKey: ['user'] });
    queryClient.invalidateQueries({ queryKey: ['folders'] });
    queryClient.invalidateQueries({ queryKey: ['folderContents'] });
    queryClient.invalidateQueries({ queryKey: ['documentMetadata'] });
    queryClient.invalidateQueries({ queryKey: ['documents'] });

    setIsUploading(false);
    setIsUploadFinished(true);

    if (successfulEditedDocnumbers.length > 0) {
      showToast(
        `${t('uploadComplete') || 'Upload complete!'}: ${successfulEditedDocnumbers.length} photo(s) processed`,
        'success'
      );
      if (onUploadSuccess) {
        onUploadSuccess(successfulEditedDocnumbers);
      }
    }
  };

  const handleClose = () => {
    if (hasStartedUpload) {
      onUploadComplete();
    } else {
      onClose();
    }
  };

  // Metrics for Results Screen
  const matchedPairsCount = pairedView.pairs.filter((p) => p.original != null).length;
  const standaloneEditedCount = pairedView.pairs.filter((p) => p.original == null).length;

  const totalSuccessCount = uploadItems.filter((i) => i.status === 'success').length;
  const pairedSuccessCount = uploadItems.filter((i) => i.status === 'success' && i.originalDocnumber).length;
  const missingOriginalSuccessCount = uploadItems.filter(
    (i) => i.status === 'success' && !i.originalDocnumber
  ).length;
  const failedCount = uploadItems.filter((i) => i.status === 'error').length;

  // Filtered view for Results Screen
  const filteredResultItems = useMemo(() => {
    if (resultFilter === 'paired') {
      return uploadItems.filter((i) => i.status === 'success' && i.originalDocnumber);
    }
    if (resultFilter === 'missing') {
      return uploadItems.filter((i) => i.status === 'success' && !i.originalDocnumber);
    }
    if (resultFilter === 'failed') {
      return uploadItems.filter((i) => i.status === 'error');
    }
    return uploadItems;
  }, [uploadItems, resultFilter]);

  const copyResultsReport = () => {
    const lines = [
      `=== ${t('resultsSummary') || 'EDMS Media Upload Results Summary'} ===`,
      `Total: ${uploadItems.length}`,
      `Successful: ${totalSuccessCount}`,
      `Paired with Originals: ${pairedSuccessCount}`,
      `Missing Originals in Parent (..\\): ${missingOriginalSuccessCount}`,
      `Failed: ${failedCount}`,
      '',
    ];

    if (missingOriginalSuccessCount > 0) {
      lines.push(`--- ${t('missingOriginals') || 'Edited files with NO matching original in parent directory'} ---`);
      uploadItems
        .filter((i) => i.status === 'success' && !i.originalDocnumber)
        .forEach((i, idx) => {
          lines.push(`${idx + 1}. ${i.editedFile.name} (Doc #${i.editedDocnumber || 'N/A'})`);
        });
      lines.push('');
    }

    if (pairedSuccessCount > 0) {
      lines.push(`--- ${t('pairedAndLinked') || 'Paired & Linked Documents'} ---`);
      uploadItems
        .filter((i) => i.status === 'success' && i.originalDocnumber)
        .forEach((i, idx) => {
          lines.push(
            `${idx + 1}. Edited: ${i.editedFile.name} (Doc #${i.editedDocnumber}) <-> Original: ${
              i.originalFile?.name || 'Original'
            } (Doc #${i.originalDocnumber})`
          );
        });
    }

    navigator.clipboard.writeText(lines.join('\n'));
    showToast(t('reportCopied') || 'Results summary copied to clipboard', 'info');
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[60] flex flex-col p-4 md:p-6 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Dual Upload Modal"
    >
      {/* Header */}
      <div className="flex-shrink-0 flex justify-between items-center mb-4 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 p-4 rounded-xl border border-blue-800/60 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/30 flex items-center justify-center border border-blue-500/40">
            <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              {t('dualUpload') || 'Upload with Originals'}
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {t('pairedMode') || 'Paired Archive Mode'}
              </span>
            </h2>
            <p className="text-xs md:text-sm text-gray-300">
              {t('targetDirectory') || 'Target Directory:'}{' '}
              <span className="text-blue-300 font-semibold underline">{parentName || t('home')}</span>
              {' · '}
              <span className="text-gray-400">
                {t('originalsSubfolderInfo') || 'Originals are safely stored in'} <code className="text-amber-300">_Originals</code>
              </span>
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          disabled={isUploading}
          className="text-gray-400 hover:text-white disabled:opacity-40 p-2 rounded-lg hover:bg-white/10 transition"
          aria-label="Close"
        >
          <Image src="/icons/close.svg" alt="" width={22} height={22} className="invert" />
        </button>
      </div>

      {/* Main Body: Upload Selection vs. Results Screen */}
      {!hasStartedUpload ? (
        <div className="flex-1 flex flex-col overflow-hidden gap-4">
          {/* 1-Click Smart Event Folder Selection Banner */}
          <div className="bg-gradient-to-r from-blue-950/70 via-slate-900/90 to-amber-950/70 border border-slate-700/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl">✨</span>
              <div className="min-w-0">
                <h4 className="text-white text-xs md:text-sm font-semibold truncate">
                  {t('oneClickEventFolderTitle') || '1-Click Auto-Detect: Select Event Folder'}
                </h4>
                <p className="text-gray-300 text-[11px] md:text-xs truncate">
                  {t('oneClickEventFolderDesc') || 'Select the parent folder containing your edited subfolder to auto-detect both in one click.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <input
                type="file"
                // @ts-ignore
                webkitdirectory="true"
                directory="true"
                ref={eventFolderInputRef}
                className="hidden"
                onChange={handleEventFolderSelect}
              />
              <button
                type="button"
                onClick={() => eventFolderInputRef.current?.click()}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-amber-600 hover:from-blue-500 hover:to-amber-500 text-white font-bold text-xs rounded-lg shadow-md transition flex items-center gap-2"
              >
                <Image src="/folder.svg" alt="" width={15} height={15} className="brightness-0 invert" />
                {t('selectEventFolderBtn') || 'Select Parent / Event Folder'}
              </button>
            </div>
          </div>

          {/* Top Half: Left & Right Dropzones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-shrink-0">
            {/* Left Zone: Edited Photos */}
            <div
              className={`rounded-xl p-4 border-2 border-dashed transition-all flex flex-col ${
                isLeftDragOver ? 'border-blue-500 bg-blue-950/30' : 'border-blue-700/50 bg-slate-900/60'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsLeftDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsLeftDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsLeftDragOver(false);
                addEditedFiles(e.dataTransfer.files);
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                  <h3 className="font-semibold text-blue-200 text-sm md:text-base">
                    {t('editedDocuments') || '1. Edited Documents'}
                  </h3>
                </div>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">
                  {t('aiAnalyzed') || 'AI Analyzed & Published'}
                </span>
              </div>

              {editedDirectoryName ? (
                <div className="flex items-center gap-1.5 text-xs text-blue-300 bg-blue-950/40 px-2.5 py-1 rounded border border-blue-800/40 mb-2">
                  <span className="font-medium text-gray-400">{t('folder') || 'Folder'}:</span>
                  <span className="font-semibold truncate">{editedDirectoryName}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-2">
                  {t('editedFilesDesc') || 'Retouched photos that will be processed by the full AI pipeline.'}
                </p>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
                <input
                  type="file"
                  multiple
                  ref={leftFilesInputRef}
                  className="hidden"
                  onChange={handleEditedFilesSelect}
                />
                <input
                  type="file"
                  multiple
                  // @ts-ignore
                  webkitdirectory="true"
                  directory="true"
                  ref={leftFolderInputRef}
                  className="hidden"
                  onChange={handleEditedFolderSelect}
                />
                <button
                  type="button"
                  onClick={() => leftFolderInputRef.current?.click()}
                  className="px-3.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow transition flex items-center gap-1.5"
                >
                  <Image src="/folder.svg" alt="" width={15} height={15} className="brightness-0 invert" />
                  {t('selectFolder') || 'Select Edited Folder'}
                </button>
                <button
                  type="button"
                  onClick={() => leftFilesInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-blue-200 border border-blue-700/50 rounded-lg transition flex items-center gap-1.5"
                >
                  <Image src="/upload.svg" alt="" width={14} height={14} className="invert" />
                  {t('selectFiles') || 'Select Files'}
                </button>
                {rawEditedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={clearEdited}
                    className="ml-auto text-xs text-red-400 hover:text-red-300 px-2 py-1"
                  >
                    {t('clear') || 'Clear'} ({rawEditedFiles.length})
                  </button>
                )}
              </div>
            </div>

            {/* Right Zone: Original Photos (Defaults to Parent Directory ..\) */}
            <div
              className={`rounded-xl p-4 border-2 border-dashed transition-all flex flex-col ${
                isRightDragOver ? 'border-amber-500 bg-amber-950/30' : 'border-amber-700/50 bg-slate-900/60'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsRightDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsRightDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsRightDragOver(false);
                addOriginalFiles(e.dataTransfer.files);
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <h3 className="font-semibold text-amber-200 text-sm md:text-base">
                    {t('originalDocuments') || '2. Original Documents (RAW / Master)'}
                  </h3>
                </div>
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                  {t('rawArchive') || 'Archive Master'}
                </span>
              </div>

              {/* Directory Indicator */}
              <div className="flex items-center justify-between text-xs text-amber-300 bg-amber-950/40 px-2.5 py-1 rounded border border-amber-800/40 mb-2">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-semibold text-amber-400">{t('parentDirectory') || 'Parent Directory (..\\)'}:</span>
                  <span className="text-gray-200 truncate">
                    {parentDirectoryName && rawOriginalFiles.length > 0
                      ? `${parentDirectoryName} (${rawOriginalFiles.length} ${t('file') || 'files'})`
                      : rawEditedFiles.length > 0
                        ? (t('parentDirectoryNotSelected') || 'Not selected yet (click below to select ..\\)')
                        : (t('parentDirHint') || 'Default: Parent directory (..\\) of the edited folder')}
                  </span>
                </div>
                {rawOriginalFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => rightFolderInputRef.current?.click()}
                    className="text-xs underline text-amber-300 hover:text-amber-100 flex-shrink-0 ml-2"
                  >
                    {t('changeDirectory') || 'Change Directory'}
                  </button>
                )}
              </div>

              {/* Prominent Action Callout when Edited files are loaded but Originals are pending */}
              {rawEditedFiles.length > 0 && rawOriginalFiles.length === 0 ? (
                <div className="my-auto py-3 px-3 rounded-lg border border-dashed border-amber-500/60 bg-amber-950/30 flex flex-col items-center text-center">
                  <p className="text-amber-200 text-xs font-semibold mb-1">
                    {t('parentFolderRequiredNotice') || 'Original files are in the parent directory (..\\). Select the parent folder to load them:'}
                  </p>
                  <p className="text-gray-400 text-[11px] mb-2.5 max-w-sm">
                    {t('loadOriginalsHelp') || `Original master files are in the parent directory of your edited folder "${editedDirectoryName}". Click below to select the parent folder.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => rightFolderInputRef.current?.click()}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg shadow transition flex items-center gap-1.5"
                  >
                    <Image src="/folder.svg" alt="" width={15} height={15} className="brightness-0" />
                    {t('selectParentFolderBtn') || 'Select Parent Folder (..\\) Now'}
                  </button>
                </div>
              ) : null}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
                <input
                  type="file"
                  multiple
                  ref={rightFilesInputRef}
                  className="hidden"
                  onChange={handleOriginalFilesSelect}
                />
                <input
                  type="file"
                  multiple
                  // @ts-ignore
                  webkitdirectory="true"
                  directory="true"
                  ref={rightFolderInputRef}
                  className="hidden"
                  onChange={handleParentFolderSelect}
                />
                <button
                  type="button"
                  onClick={() => rightFolderInputRef.current?.click()}
                  className="px-3.5 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow transition flex items-center gap-1.5"
                >
                  <Image src="/folder.svg" alt="" width={15} height={15} className="brightness-0 invert" />
                  {parentDirectoryName ? (t('changeDirectory') || 'Change Directory') : (t('selectFolder') || 'Select Parent Folder (..\\)')}
                </button>
                <button
                  type="button"
                  onClick={() => rightFilesInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-700/50 rounded-lg transition flex items-center gap-1.5"
                >
                  <Image src="/upload.svg" alt="" width={14} height={14} className="invert" />
                  {t('selectFiles') || 'Select Files'}
                </button>
                {rawOriginalFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={clearOriginals}
                    className="ml-auto text-xs text-red-400 hover:text-red-300 px-2 py-1"
                  >
                    {t('clear') || 'Clear'} ({rawOriginalFiles.length})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Half: Match Preview Table */}
          <div className="flex-1 bg-slate-900/80 rounded-xl border border-slate-800 p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold text-sm text-gray-200">
                  {t('pairingPreview') || 'Pairing Preview & Review'}
                </h4>
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-gray-300">
                  {matchedPairsCount} {t('matchedPairs') || 'matched pair(s)'}
                </span>
                {standaloneEditedCount > 0 && (
                  <span className="text-xs bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded border border-amber-800/40">
                    ⚠️ {standaloneEditedCount} {t('noOriginalInParent') || 'missing original in parent directory'}
                  </span>
                )}
                {pairedView.unmatchedOriginals.length > 0 && (
                  <span className="text-xs bg-slate-800 text-gray-400 px-2 py-0.5 rounded">
                    {pairedView.unmatchedOriginals.length} {t('unmatchedOriginals') || 'extra in parent'}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">
                {t('autoMatchedHint') || 'Items are automatically paired by name. Adjust pairings using the dropdown.'}
              </p>
            </div>

            {/* Table / List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {pairedView.pairs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                  <Image src="/upload.svg" alt="" width={36} height={36} className="opacity-30 invert mb-2" />
                  <p className="text-sm font-medium">
                    {t('dropOrSelectFilesAbove') ||
                      'Select edited folder on the left; the parent directory (..\\) opens automatically on the right'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('pairingWillAutoCalculate') || 'Pairings will be automatically calculated and previewed here.'}
                  </p>
                </div>
              ) : (
                pairedView.pairs.map((pair, idx) => {
                  const isPaired = pair.original != null;
                  return (
                    <div
                      key={pair.edited.name}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-lg border text-xs gap-2 transition ${
                        isPaired
                          ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800'
                          : 'bg-amber-950/20 border-amber-900/40 hover:bg-amber-950/30'
                      }`}
                    >
                      {/* Left: Edited file */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <p className="font-medium text-gray-200 truncate">{pair.edited.name}</p>
                          <p className="text-[10px] text-gray-400">{formatFileSize(pair.edited.size)}</p>
                        </div>
                      </div>

                      {/* Center: Relationship indicator */}
                      <div className="flex items-center justify-center px-2 flex-shrink-0">
                        {isPaired ? (
                          <div className="flex items-center gap-1 text-green-400 bg-green-950/50 px-2 py-0.5 rounded border border-green-800/40 font-medium">
                            <span>↔</span>
                            <span>{t('paired') || 'Paired'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40 font-medium">
                            <span>⚠️</span>
                            <span>{t('noOriginalInParent') || 'Missing in Parent'}</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Original file selector */}
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        <select
                          className="bg-slate-900 text-gray-200 text-xs rounded border border-slate-700 px-2 py-1 max-w-[240px] truncate focus:ring-1 focus:ring-amber-500 outline-none"
                          value={pair.original ? pair.original.name : '__NONE__'}
                          onChange={(e) => handleManualPairChange(pair.edited.name, e.target.value)}
                        >
                          <option value="__NONE__">{t('noneStandalone') || 'None (Upload edited only)'}</option>
                          {rawOriginalFiles.map((orig) => (
                            <option key={orig.name} value={orig.name}>
                              {orig.name} ({formatFileSize(orig.size)})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeEditedFile(pair.edited.name)}
                          className="text-gray-400 hover:text-red-400 p-1"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex-shrink-0 flex items-center justify-between pt-2">
            <div className="text-xs text-gray-400">
              {pairedView.pairs.length > 0 && (
                <span>
                  {t('totalToUpload') || 'Ready to upload'}:{' '}
                  <strong className="text-white">{pairedView.pairs.length}</strong> photo(s) (
                  {matchedPairsCount} with originals,{' '}
                  {standaloneEditedCount > 0 ? (
                    <span className="text-amber-300 font-medium">
                      {standaloneEditedCount} missing in parent
                    </span>
                  ) : (
                    'all paired'
                  )}
                  )
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleStartUpload}
                disabled={pairedView.pairs.length === 0}
                className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Image src="/upload.svg" alt="" width={16} height={16} className="invert" />
                {t('startPairedUpload') || 'Start Paired Upload'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Results & Progress Screen */
        <div className="flex-1 bg-slate-900/90 rounded-xl border border-slate-800 p-5 flex flex-col overflow-hidden">
          {/* Top Results Header & KPI Badges */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
            <div>
              <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                {isUploading ? (
                  <>
                    <span className="w-3 h-3 rounded-full bg-blue-500 animate-ping" />
                    {t('uploadingPairs') || 'Uploading Paired Documents...'}
                  </>
                ) : (
                  <>
                    <span className="text-green-400 text-xl font-bold">✓</span>
                    {t('resultsSummary') || 'Upload Results Summary'}
                  </>
                )}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {isUploading
                  ? (t('uploadProgressDesc') || 'Original files are placed in _Originals and paired with edited photos.')
                  : `${t('successfulUploads') || 'Successful'}: ${totalSuccessCount} / ${uploadItems.length} · ${t('originalsFolder') || '_Originals'}`}
              </p>
            </div>

            {/* KPI Cards when finished */}
            {isUploadFinished && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 bg-green-950/60 border border-green-800/60 rounded-lg text-center">
                  <span className="block text-xs text-green-400 font-medium">{t('successfulUploads') || 'Success'}</span>
                  <span className="text-base font-bold text-green-300">{totalSuccessCount}</span>
                </div>
                <div className="px-3 py-1.5 bg-blue-950/60 border border-blue-800/60 rounded-lg text-center">
                  <span className="block text-xs text-blue-400 font-medium">{t('pairedAndLinked') || 'Paired'}</span>
                  <span className="text-base font-bold text-blue-300">{pairedSuccessCount}</span>
                </div>
                {missingOriginalSuccessCount > 0 && (
                  <div className="px-3 py-1.5 bg-amber-950/60 border border-amber-800/60 rounded-lg text-center">
                    <span className="block text-xs text-amber-400 font-medium">
                      ⚠️ {t('missingOriginals') || 'Missing Originals'}
                    </span>
                    <span className="text-base font-bold text-amber-300">{missingOriginalSuccessCount}</span>
                  </div>
                )}
                {failedCount > 0 && (
                  <div className="px-3 py-1.5 bg-red-950/60 border border-red-800/60 rounded-lg text-center">
                    <span className="block text-xs text-red-400 font-medium">{t('failed') || 'Failed'}</span>
                    <span className="text-base font-bold text-red-300">{failedCount}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Filter Bar (Visible when upload is finished) */}
          {isUploadFinished && (
            <div className="flex items-center justify-between pt-3 pb-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResultFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    resultFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  {t('filterAll') || 'All'} ({uploadItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('paired')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    resultFilter === 'paired'
                      ? 'bg-green-600 text-white'
                      : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                  }`}
                >
                  <span>✓</span> {t('filterPaired') || 'Paired with Original'} ({pairedSuccessCount})
                </button>
                {missingOriginalSuccessCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setResultFilter('missing')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                      resultFilter === 'missing'
                        ? 'bg-amber-600 text-white'
                        : 'bg-amber-950/50 text-amber-300 border border-amber-800/50 hover:bg-amber-900/50'
                    }`}
                  >
                    <span>⚠️</span> {t('filterMissingOriginals') || 'Missing Original in Parent'} ({missingOriginalSuccessCount})
                  </button>
                )}
                {failedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setResultFilter('failed')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                      resultFilter === 'failed'
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                    }`}
                  >
                    {t('filterFailed') || 'Failed'} ({failedCount})
                  </button>
                )}
              </div>

              {/* Action Buttons in Result Screen */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyResultsReport}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-gray-200 border border-slate-700 rounded-lg transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {t('copyReport') || 'Copy Report'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition"
                >
                  {t('done') || 'Done'}
                </button>
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="flex-1 overflow-y-auto space-y-2.5 mt-2 pr-1">
            {filteredResultItems.map((item, idx) => {
              const isPaired = Boolean(item.originalDocnumber);
              const isMissingOriginal = item.status === 'success' && !isPaired;

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border text-xs flex flex-col gap-2 transition ${
                    item.status === 'error'
                      ? 'bg-red-950/20 border-red-800/40'
                      : isMissingOriginal
                      ? 'bg-amber-950/20 border-amber-800/50'
                      : 'bg-slate-800/70 border-slate-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {/* Left: Edited Document info */}
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <span className="font-semibold text-gray-400">#{idx + 1}</span>
                      <div className="truncate">
                        <span className="font-medium text-white">{item.editedFile.name}</span>
                        {item.editedDocnumber && (
                          <span className="ml-2 font-mono text-[11px] bg-blue-900/50 text-blue-200 px-1.5 py-0.5 rounded border border-blue-700/50">
                            Doc #{item.editedDocnumber}
                          </span>
                        )}
                        <span className="ml-2 text-gray-500 text-[10px]">({formatFileSize(item.editedFile.size)})</span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="flex items-center gap-2">
                      {item.status === 'pending' && <span className="text-gray-400">{t('pending') || 'Pending'}</span>}
                      {item.status === 'uploading' && (
                        <span className="text-blue-400 font-semibold">{item.progress}%</span>
                      )}
                      {item.status === 'success' && (
                        <span className="text-green-400 font-semibold flex items-center gap-1">
                          <span>✓</span> {t('uploaded') || 'Uploaded'}
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="text-red-400 font-semibold">{item.error || 'Failed'}</span>
                      )}
                    </div>
                  </div>

                  {/* Original Document / Missing Original Status Row */}
                  {item.status === 'success' && (
                    <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      {isPaired ? (
                        <div className="flex items-center gap-2 text-green-300">
                          <span className="text-green-400 font-bold">↔</span>
                          <span>
                            {t('pairedWith') || 'Original'}:{' '}
                            <strong>{item.originalFile?.name || 'Master File'}</strong>
                          </span>
                          <span className="font-mono text-[10px] bg-green-950 text-green-300 px-1 rounded border border-green-800/60">
                            Doc #{item.originalDocnumber}
                          </span>
                          <span className="text-gray-400">({t('storedIn') || 'Stored in'} _Originals)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                          <span>⚠️</span>
                          <span>
                            {t('noOriginalInParent') ||
                              'No matching original found in parent directory (..\\) — Uploaded as standalone edited photo'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-gray-400 text-[10px]">
                        <span>AI:</span>
                        <span className="text-blue-300 font-medium">Queued for Analysis</span>
                      </div>
                    </div>
                  )}

                  {/* Progress bar (during active upload) */}
                  {isUploading && (
                    <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          item.status === 'error'
                            ? 'bg-red-500'
                            : item.status === 'success'
                            ? 'bg-green-500'
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Bar when uploading is still active */}
          {isUploading && (
            <div className="flex-shrink-0 pt-3 flex justify-between items-center text-xs text-gray-400 border-t border-slate-800 mt-2">
              <span>{t('uploadingPleaseWait') || 'Uploading files to OpenText DMS, please wait...'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
