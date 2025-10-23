import React from 'react';

export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'success' | 'error';

export interface UploadableFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  docnumber?: number;
  error?: string;
}

interface UploadFileItemProps {
  uploadableFile: UploadableFile;
  onRemove: () => void;
}

export const UploadFileItem: React.FC<UploadFileItemProps> = ({ uploadableFile, onRemove }) => {
  const { file, status, progress, error } = uploadableFile;
  const isActionable = status === 'pending' || status === 'error';
  
  const getStatusIndicator = () => {
    switch (status) {
      case 'uploading':
        return <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>;
      case 'processing':
        return <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>;
      case 'success':
        return <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>;
      case 'error':
        return <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>;
      default:
        return <div className="w-6 h-6 bg-gray-600 rounded-full"></div>;
    }
  };

  return (
    <div className="bg-[#333] p-4 rounded-lg flex items-center gap-4">
      <div className="flex-shrink-0">
        {getStatusIndicator()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-200 truncate">{file.name}</p>
        <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        {(status === 'uploading' || status === 'processing') && (
          <div className="w-full bg-gray-600 rounded-full h-1.5 mt-1">
            <div className={`h-1.5 rounded-full ${status === 'uploading' ? 'bg-blue-500' : 'bg-yellow-500'}`} style={{ width: `${progress}%` }}></div>
          </div>
        )}
        {status === 'error' && <p className="text-xs text-red-400 mt-1 truncate">{error}</p>}
      </div>
      {isActionable && (
         <button onClick={onRemove} className="text-gray-400 hover:text-white">&times;</button>
      )}
    </div>
  );
};