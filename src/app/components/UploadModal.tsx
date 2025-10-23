import React, { useState, useCallback, useRef } from 'react';
import { UploadFileItem, UploadableFile, UploadStatus } from './UploadFileItem';

export interface UploadModalProps {
  onClose: () => void;
  apiURL: string;
  onAnalyze: (uploadedFiles: UploadableFile[]) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, apiURL, onAnalyze }) => {
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileIdCounter = useRef(0);

  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newUploads: UploadableFile[] = Array.from(selectedFiles).map(file => ({
      id: `file-${fileIdCounter.current++}`,
      file,
      status: 'pending',
      progress: 0,
    }));
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

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    const uploadPromises = pendingFiles.map(uploadableFile => {
      return new Promise<void>((resolve) => {
        const { id, file } = uploadableFile;
        updateFileStatus(id, 'uploading', { progress: 0 });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('docname', file.name);
        formData.append('abstract', ``);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${apiURL}/upload_document`, true);
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            updateFileStatus(id, 'uploading', { progress: percentComplete });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              updateFileStatus(id, 'success', { progress: 100, docnumber: response.docnumber });
            } else {
              updateFileStatus(id, 'error', { error: response.error || 'Upload failed.' });
            }
          } else {
            const errorMsg = JSON.parse(xhr.responseText)?.error || `Server error: ${xhr.status}`;
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
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col p-8">
       <div className="flex-shrink-0 flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Upload Documents</h2>
        <button onClick={onClose} disabled={isUploading} className="text-gray-400 hover:text-white text-3xl disabled:opacity-50">&times;</button>
      </div>

      <div className="flex-1 flex gap-8 overflow-hidden">
        {/* Left Side: Dropzone */}
        <div className="w-1/3 flex flex-col">
            <div 
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`flex-1 border-2 border-dashed rounded-xl flex flex-col justify-center items-center p-8 text-center transition-colors ${isDragOver ? 'border-red-500 bg-[#222]' : 'border-gray-600'}`}>
                <img src="/tag.svg" alt="Tags" className="h-5 w-5" />
                <p className="mt-4 text-lg text-gray-300">Drag & Drop files here</p>
                <p className="text-sm text-gray-500">or</p>
                <label htmlFor="file-upload" className="mt-2 cursor-pointer px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-md hover:bg-gray-600 transition">
                    Browse Files
                </label>
                <input id="file-upload" type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            </div>
        </div>

        {/* Right Side: File List & Actions */}
        <div className="w-2/3 flex flex-col bg-[#282828] rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Upload Queue ({files.length})</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {files.length > 0 ? (
                    files.map(f => <UploadFileItem key={f.id} uploadableFile={f} onRemove={() => removeFile(f.id)} />)
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        Select files to begin.
                    </div>
                )}
            </div>
             <div className="flex-shrink-0 pt-6 border-t border-gray-700 flex justify-end gap-4">
               <button 
                  onClick={handleUpload} 
                  disabled={pendingFilesCount === 0 || isUploading}
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : `Upload Pending (${pendingFilesCount})`}
                </button>
                 <button 
                  onClick={handleAnalyze} 
                  disabled={successfulUploadsCount === 0 || isUploading}
                  className="px-6 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-600 transition disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Analyze with AI ({successfulUploadsCount})
                </button>
                <button 
                  onClick={onClose} 
                  disabled={isUploading}
                  className="px-6 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition disabled:bg-gray-500 disabled:cursor-not-allowed"
                >
                  Close
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};