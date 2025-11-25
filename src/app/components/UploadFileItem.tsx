import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import { UploadFileItemProps } from '../../interfaces';

const formatDateForInput = (date: Date | null): string => {
  if (!date) return '';
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
};

const parseDateFromInput = (dateString: string): Date | null => {
  if (!dateString) return null;
  try {
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
  const { id, file, status, progress, error, editedFileName, editedDateTaken, dateSource } = uploadableFile;
  const isActionable = status === 'pending' || status === 'error';
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateFileName(id, e.target.value);
  };

  const handleDateChange = (date: Date | null) => {
    onUpdateDateTaken(id, date);
    setShowDatePicker(false);
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

  const getDatePickerTitle = () => {
    switch (dateSource) {
      case 'file':
        return "Date Taken not found. Using file modification date as fallback.";
      case 'filename_partial':
        return "Date Taken not found. Using partial date (Year) from filename as fallback.";
      case 'filename_full':
        return "Date Taken not found. Using full date parsed from filename.";
      case 'exif':
        return "Date Taken (from EXIF metadata).";
      default:
        return "Date Taken";
    }
  };

  const isHighlighted = dateSource === 'file' || dateSource === 'filename_partial';

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
              dateFormat="dd/MM/yyyy"
              isClearable
              placeholderText="Select date"
              className={`w-auto text-xs bg-[#121212] text-gray-200 border rounded focus:ring-1 focus:ring-red-500 focus:outline-none py-0.5 px-1 ${isHighlighted ? 'border-yellow-500 border-2' : 'border-gray-600'
                }`}
              title={getDatePickerTitle()}
              autoComplete='off'
              locale="en-GB"
            />
          </div>
        )}
        {!isActionable && editedDateTaken && (
          <p className="text-xs text-gray-400 mt-1">
            Date Taken: {editedDateTaken.toLocaleString('en-GB')}
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