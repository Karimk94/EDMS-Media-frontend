import React, { useState } from 'react';
import { Document } from './DocumentItem';
import { TagEditor } from './TagEditor';
import { CollapsibleSection } from './CollapsibleSection';
import DatePicker from 'react-datepicker';

interface VideoModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
}

const safeParseDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

const formatToApiDate = (date: Date | null): string | null => {
    if (!date) return null;
    const pad = (num: number) => num.toString().padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const VideoModal: React.FC<VideoModalProps> = ({ doc, onClose, apiURL }) => {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [documentDate, setDocumentDate] = useState<Date | null>(safeParseDate(doc.date));
  const [initialDate, setInitialDate] = useState<Date | null>(safeParseDate(doc.date));
  
  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [abstract, setAbstract] = useState(doc.title || '');
  const [initialAbstract, setInitialAbstract] = useState(doc.title || '');

  const handleDateChange = (date: Date | null) => {
    setDocumentDate(date);
  };

  const handleEditDate = () => {
    setInitialDate(documentDate);
    setIsEditingDate(true);
  };

  const handleCancelEditDate = () => {
    setDocumentDate(initialDate);
    setIsEditingDate(false);
  };
  
  const handleEditAbstract = () => {
    setInitialAbstract(abstract);
    setIsEditingAbstract(true);
  };

  const handleCancelEditAbstract = () => {
    setAbstract(initialAbstract);
    setIsEditingAbstract(false);
  };

  const handleUpdateMetadata = async () => {
    try {
      const response = await fetch(`${apiURL}/update_metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            doc_id: doc.doc_id, 
            abstract: abstract,
            date_taken: formatToApiDate(documentDate) 
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update metadata');
      alert('Metadata updated successfully');
      setIsEditingDate(false);
      setIsEditingAbstract(false);
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#282828] text-gray-200 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl">&times;</button>
          <h2 className="text-xl font-bold text-white mb-4">{doc.docname}</h2>
          <video controls autoPlay className="w-full max-h-[70vh] rounded-lg bg-black">
            <source src={`${apiURL}/video/${doc.doc_id}`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="mt-4 mb-6">
            <CollapsibleSection title="Details">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-300 mb-1">Abstract</h3>
                  {isEditingAbstract ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={abstract}
                        onChange={(e) => setAbstract(e.target.value)}
                        className="w-full h-24 px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save</button>
                        <button onClick={handleCancelEditAbstract} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-gray-400 mt-1 pr-4">{abstract || 'No abstract available.'}</p>
                      <button onClick={handleEditAbstract} className="px-4 py-1 bg-gray-700 text-white text-xs rounded-md hover:bg-gray-600 flex-shrink-0">Edit</button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-gray-300 mb-1">Date Taken</h3>
                  {isEditingDate ? (
                    <div className="flex items-center gap-2">
                      <DatePicker
                        selected={documentDate}
                        onChange={handleDateChange}
                        dateFormat="MMMM d, yyyy"
                        className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                        isClearable
                      />
                      <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save</button>
                      <button onClick={handleCancelEditDate} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-400 p-2">
                        {documentDate ? documentDate.toLocaleDateString() : 'No date set'}
                      </p>
                      <button onClick={handleEditDate} className="px-4 py-1 bg-gray-700 text-white text-xs rounded-md hover:bg-gray-600">Edit</button>
                    </div>
                  )}
                </div>

                <TagEditor docId={doc.doc_id} apiURL={apiURL} />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </div>
  );
};