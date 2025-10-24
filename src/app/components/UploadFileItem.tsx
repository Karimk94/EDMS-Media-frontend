import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';

export type UploadStatus = 'pending' | 'uploading' | 'processing' | 'success' | 'error';

// Updated interface to include editable fields
export interface UploadableFile {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  docnumber?: number;
  error?: string;
  // Editable fields
  editedFileName: string;
  editedDateTaken: Date | null;
}

interface UploadFileItemProps {
  uploadableFile: UploadableFile;
  onRemove: () => void;
  // Add handlers to update state in parent
  onUpdateFileName: (id: string, newName: string) => void;
  onUpdateDateTaken: (id: string, newDate: Date | null) => void;
}

// Helper to format Date to datetime-local string (YYYY-MM-DDTHH:mm)
const formatDateForInput = (date: Date | null): string => {
  if (!date) return '';
  // Adjust for local timezone offset before formatting
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
};

// Helper to parse datetime-local string back to Date
const parseDateFromInput = (dateString: string): Date | null => {
  if (!dateString) return null;
  try {
    // Directly parse the local datetime string
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch (e) {
    console.error("Error parsing date:", e);
    return null;
  }
};


export const UploadFileItem: React.FC<UploadFileItemProps> = ({
  uploadableFile,
  onRemove,
  onUpdateFileName,
  onUpdateDateTaken
}) => {
  const { id, file, status, progress, error, editedFileName, editedDateTaken } = uploadableFile;
  const isActionable = status === 'pending' || status === 'error';
  const [showDatePicker, setShowDatePicker] = useState(false); // State for date picker visibility

  // Handle local changes and propagate up
  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateFileName(id, e.target.value);
  };

  const handleDateChange = (date: Date | null) => {
    onUpdateDateTaken(id, date);
    setShowDatePicker(false); // Close picker after selection
  };

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
    <div className="bg-[#333] p-4 rounded-lg flex items-start gap-4">
      <div className="flex-shrink-0 mt-1">
        {getStatusIndicator()}
      </div>
      <div className="flex-1 min-w-0">
        {/* File Name Input */}
        {isActionable ? (
          <input
            type="text"
            value={editedFileName}
            onChange={handleFileNameChange}
            className="w-full text-sm font-medium bg-transparent text-gray-200 border-b border-gray-500 focus:border-red-500 focus:outline-none mb-1 p-0.5"
            placeholder="Enter file name"
          />
        ) : (
          <p className="text-sm font-medium text-gray-200 truncate">{editedFileName}</p>
        )}

        <p className="text-xs text-gray-400 mb-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>

        {isActionable && (
          <div className="relative mt-1">
            <label className="text-xs text-gray-400 mr-2">Date Taken:</label>
            <DatePicker
              selected={editedDateTaken}
              onChange={handleDateChange}
              dateFormat="Pp"
              isClearable
              placeholderText="Select date"
              className="w-auto text-xs bg-[#121212] text-gray-200 border border-gray-600 rounded focus:ring-1 focus:ring-red-500 focus:outline-none py-0.5 px-1"
            />
          </div>
        )}
        {!isActionable && editedDateTaken && (
          <p className="text-xs text-gray-400 mt-1">
            Date Taken: {editedDateTaken.toLocaleString()}
          </p>
        )}


        {(status === 'uploading' || status === 'processing') && (
          <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
            <div className={`h-1.5 rounded-full ${status === 'uploading' ? 'bg-blue-500' : 'bg-yellow-500'}`} style={{ width: `${progress}%` }}></div>
          </div>
        )}
        {status === 'error' && <p className="text-xs text-red-400 mt-1 truncate">{error}</p>}
      </div>
      {isActionable && (
        <button onClick={onRemove} className="text-gray-400 hover:text-white mt-1 text-xl leading-none">&times;</button>
      )}
    </div>
  );
};