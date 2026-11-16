import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { useToast } from '../context/ToastContext';
import { apiClient } from '../../lib/apiClient';

interface LinkOriginalModalProps {
  isOpen: boolean;
  onClose: () => void;
  docId: number;
  docname: string;
  apiURL: string;
  theme: 'light' | 'dark';
  t: Function;
  currentOriginalDocnumber?: number | null;
  currentOriginalDocname?: string | null;
  onSuccess: (originalDocnumber: number, originalDocname: string) => void;
  onUnlinkSuccess?: () => void;
}

export const LinkOriginalModal: React.FC<LinkOriginalModalProps> = ({
  isOpen,
  onClose,
  docId,
  docname,
  apiURL,
  theme,
  t,
  currentOriginalDocnumber,
  currentOriginalDocname,
  onSuccess,
  onUnlinkSuccess,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'upload' | 'docnumber'>('upload');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Doc number input state
  const [inputDocnumber, setInputDocnumber] = useState<string>('');

  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadAndLink = async () => {
    if (!selectedFile) {
      showToast(t('pleaseSelectFile') || 'Please select an original file to upload', 'error');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('docname', selectedFile.name.replace(/\.[^/.]+$/, ''));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiURL}/document/${docId}/upload_original`, true);
    xhr.setRequestHeader('X-App-Source', 'edms-media');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setIsSubmitting(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          if (resp.success) {
            showToast(t('originalLinkedSuccess') || 'Original document uploaded and linked successfully!', 'success');
            onSuccess(Number(resp.original_docnumber), resp.original_docname || selectedFile.name);
            onClose();
          } else {
            showToast(resp.error || 'Failed to upload original document', 'error');
          }
        } catch {
          showToast('Failed to parse server response', 'error');
        }
      } else {
        let errorMsg = `Server error ${xhr.status}`;
        try {
          const resp = JSON.parse(xhr.responseText);
          errorMsg = resp.detail || resp.error || errorMsg;
        } catch {}
        showToast(errorMsg, 'error');
      }
    };

    xhr.onerror = () => {
      setIsSubmitting(false);
      showToast(t('networkError') || 'Network error during upload', 'error');
    };

    xhr.send(formData);
  };

  const handleLinkByDocnumber = async () => {
    const num = parseInt(inputDocnumber.trim(), 10);
    if (isNaN(num) || num <= 0) {
      showToast(t('invalidDocNumber') || 'Please enter a valid document number', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const resp = await apiClient.post(`${apiURL}/document/${docId}/link_original`, {
        original_docnumber: num,
        relation_type: 'ORIGINAL',
      });
      showToast(t('originalLinkedSuccess') || `Original document #${num} linked successfully!`, 'success');
      onSuccess(num, `Doc #${num}`);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to link document', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm(t('confirmUnlink') || 'Are you sure you want to unlink the original master document?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.delete(`${apiURL}/document/${docId}/link_original`);
      showToast(t('originalUnlinkedSuccess') || 'Original document unlinked successfully', 'success');
      if (onUnlinkSuccess) onUnlinkSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to unlink document', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 text-white rounded-2xl border border-slate-700 w-full max-w-lg overflow-hidden shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="14" height="14" rx="2" />
                <path d="M7 21h12a2 2 0 0 0 2-2V7" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {currentOriginalDocnumber
                  ? (t('changeOriginalDocument') || 'Change Original Master Document')
                  : (t('addOriginalDocument') || 'Add Original Master Picture')}
              </h3>
              <p className="text-xs text-gray-400 truncate max-w-xs">
                {docname} (#{docId})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <Image src="/icons/close.svg" alt="" width={20} height={20} className="invert" />
          </button>
        </div>

        {/* Current status if already linked */}
        {currentOriginalDocnumber && (
          <div className="mt-4 p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <div>
                <span className="text-gray-400">{t('currentlyLinked') || 'Currently Linked'}:</span>{' '}
                <strong className="text-amber-300">
                  {currentOriginalDocname || `Doc #${currentOriginalDocnumber}`}
                </strong>
                <span className="text-gray-400 ml-1">(#{currentOriginalDocnumber})</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUnlink}
              disabled={isSubmitting}
              className="text-xs text-red-400 hover:text-red-300 underline font-semibold disabled:opacity-50"
            >
              {t('unlink') || 'Unlink'}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-800 mt-4 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition ${
              activeTab === 'upload'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t('uploadOriginalFile') || 'Upload Original File'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docnumber')}
            className={`flex-1 py-2 text-xs font-semibold text-center border-b-2 transition ${
              activeTab === 'docnumber'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t('linkByDocNumber') || 'Link by Document #'}
          </button>
        </div>

        {/* Tab 1: Upload File */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,.cr2,.cr3,.nef,.dng,.raw,.arw,.tiff,.tif,.heic"
            />
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                isDragOver
                  ? 'border-amber-500 bg-amber-950/30'
                  : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mb-2">
                    ✓
                  </div>
                  <p className="font-semibold text-sm text-gray-200 truncate max-w-xs">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(selectedFile.size)}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-3 text-xs text-amber-400 hover:underline"
                  >
                    {t('chooseDifferentFile') || 'Choose different file'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Image src="/upload.svg" alt="" width={32} height={32} className="opacity-40 invert mb-2" />
                  <p className="text-xs text-gray-300 font-medium">
                    {t('dragDropOriginal') || 'Drag & drop unedited original file here, or click to browse'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    RAW, CR2, NEF, DNG, ARW, TIFF, JPEG
                  </p>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {isSubmitting && uploadProgress > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{t('uploading') || 'Uploading to _Originals...'}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              {t('manualUploadNotice') ||
                'The original file will be stored in the _Originals subfolder and automatically linked to this picture.'}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleUploadAndLink}
                disabled={!selectedFile || isSubmitting}
                className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('uploading') || 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Image src="/upload.svg" alt="" width={14} height={14} className="invert" />
                    {t('uploadAndLink') || 'Upload & Link Original'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Link by Doc Number */}
        {activeTab === 'docnumber' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                {t('enterOriginalDocnumber') || 'Original Document Number (PROFILE.DOCNUMBER)'}
              </label>
              <input
                type="number"
                value={inputDocnumber}
                onChange={(e) => setInputDocnumber(e.target.value)}
                placeholder="e.g. 1987654"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                disabled={isSubmitting}
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                {t('linkByDocnumberHelp') ||
                  'If the original unedited file is already stored in the DMS, enter its document number to link it.'}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleLinkByDocnumber}
                disabled={!inputDocnumber.trim() || isSubmitting}
                className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('linking') || 'Linking...'}
                  </>
                ) : (
                  <>
                    <span>🔗</span>
                    {t('linkDocument') || 'Link Document'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

