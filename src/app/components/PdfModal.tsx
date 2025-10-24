import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import { Document } from './DocumentItem';
import { TagEditor } from './TagEditor';

// Helper to format Date to the expected API string format (YYYY-MM-DD HH:MM:SS)
const formatDateTimeForAPI = (date: Date | null): string | null => {
    if (!date) return null;
    const pad = (num: number) => num.toString().padStart(2, '0');
    if (isNaN(date.getTime())) {
        console.error("Invalid date passed to formatDateTimeForAPI:", date);
        return null;
    }
    try {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} 00:00:00`;
    } catch (e) {
        console.error("Error formatting date:", e, date);
        return null;
    }
};

// Helper to parse the API date string (YYYY-MM-DD HH:MM:SS) into a Date object
const parseApiDateTime = (dateTimeString: string): Date | null => {
    if (!dateTimeString || dateTimeString === "N/A" || typeof dateTimeString !== 'string') {
        return null;
    }
    try {
        const datePart = dateTimeString.split(' ')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
             console.warn(`Unexpected date part format: ${datePart} from ${dateTimeString}`);
             const genericDate = new Date(dateTimeString);
             if (!isNaN(genericDate.getTime())) {
                 genericDate.setHours(0,0,0,0);
                 return genericDate;
             }
             console.error(`Failed to parse date string completely: ${dateTimeString}`);
             return null;
        }
        const date = new Date(datePart + 'T00:00:00Z');
        if (isNaN(date.getTime())) {
            console.error(`Resulted in Invalid Date from: ${datePart} (original: ${dateTimeString})`);
            return null;
        }
        return date;
    } catch (e) {
        console.error("Error parsing date string:", dateTimeString, e);
        return null;
    }
};


interface PdfModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
  onUpdateMetadataSuccess: () => void;
}

export const PdfModal: React.FC<PdfModalProps> = ({ doc, onClose, apiURL, onUpdateMetadataSuccess }) => {
  const [isDetailsVisible, setIsDetailsVisible] = useState(true);

   const [isEditingAbstract, setIsEditingAbstract] = useState(false);
   const [editableAbstract, setEditableAbstract] = useState('');
   const [isEditingDate, setIsEditingDate] = useState(false);
   const [editableDateTaken, setEditableDateTaken] = useState<Date | null>(null);

   const [isSavingMetadata, setIsSavingMetadata] = useState(false);
   const [metadataError, setMetadataError] = useState<string | null>(null);
   const abstractTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!doc) return;
        setEditableAbstract(doc.title || '');
        setEditableDateTaken(parseApiDateTime(doc.date || ''));
        setIsEditingAbstract(false);
        setIsEditingDate(false);
        setMetadataError(null);
    }, [doc]);

    useEffect(() => {
        if (isEditingAbstract && abstractTextareaRef.current) {
            abstractTextareaRef.current.focus();
            abstractTextareaRef.current.select();
        }
    }, [isEditingAbstract]);

    const handleEditAbstract = () => setIsEditingAbstract(true);
    const handleEditDate = () => setIsEditingDate(true);

    const handleCancelAbstractEdit = () => {
        setEditableAbstract(doc?.title || '');
        setIsEditingAbstract(false);
        setMetadataError(null);
    };
    const handleCancelDateEdit = () => {
        setEditableDateTaken(parseApiDateTime(doc?.date || ''));
        setIsEditingDate(false);
        setMetadataError(null);
   };

    const handleSaveMetadata = async () => {
        if (!doc) return;
        setIsSavingMetadata(true);
        setMetadataError(null);
        const formattedDate = formatDateTimeForAPI(editableDateTaken);

        const payload: { doc_id: number; abstract?: string; date_taken?: string | null } = { doc_id: doc.doc_id };
        const originalDate = parseApiDateTime(doc.date || '');
        const abstractChanged = editableAbstract.trim() !== (doc.title || '');
        const dateChanged = (editableDateTaken?.getTime() ?? null) !== (originalDate?.getTime() ?? null);

        if (abstractChanged) payload.abstract = editableAbstract.trim();
        if (dateChanged) payload.date_taken = formattedDate;

        if (!abstractChanged && !dateChanged) {
            setIsEditingAbstract(false); setIsEditingDate(false); setIsSavingMetadata(false); return;
        }

       try {
           const response = await fetch(`${apiURL}/update_metadata`, {
               method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
           });
           if (!response.ok) {
               const errorData = await response.json();
               throw new Error(errorData.error || `Failed to save metadata (Status: ${response.status})`);
           }
            if(abstractChanged) setEditableAbstract(editableAbstract.trim());
            if(dateChanged) setEditableDateTaken(editableDateTaken);
            setIsEditingAbstract(false); setIsEditingDate(false);
            onUpdateMetadataSuccess();
       } catch (err: any) {
           console.error("Error saving metadata:", err);
           setMetadataError(`Error: ${err.message}`);
       } finally {
           setIsSavingMetadata(false);
       }
   };

    const originalDate = parseApiDateTime(doc?.date || '');
    const hasMetadataChanged = editableAbstract.trim() !== (doc?.title || '') ||
                             (editableDateTaken?.getTime() ?? null) !== (originalDate?.getTime() ?? null);

    if (!doc) return null; // Don't render if no doc

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[70] p-4 md:p-8" onClick={onClose}>
      <div className="bg-[#282828] text-gray-200 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 md:p-6 relative flex-shrink-0 flex justify-between items-center border-b border-gray-700">
          <h2 className="text-lg md:text-xl font-bold text-white truncate pr-20">{doc.docname || 'Document'}</h2>
          <div className="absolute top-1/2 right-4 md:right-6 transform -translate-y-1/2 flex items-center gap-2 md:gap-4 z-10">
             <button onClick={() => setIsDetailsVisible(!isDetailsVisible)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors" title={isDetailsVisible ? "Hide Details" : "Show Details"}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> </svg>
              </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl md:text-3xl">&times;</button>
          </div>
        </div>
        <div className={`flex-1 grid ${isDetailsVisible ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'} gap-2 md:gap-4 min-h-0 transition-all duration-300 p-2 md:p-4`}>
          <div className={`${isDetailsVisible ? 'md:col-span-2' : 'col-span-1'} h-full overflow-hidden rounded-lg`}>
            <iframe src={`${apiURL}/pdf/${doc.doc_id}`} className="w-full h-full border-0 bg-white" title={doc.docname} />
          </div>
          <div className={`transition-all duration-300 ${isDetailsVisible ? 'md:col-span-1 opacity-100 flex flex-col' : 'hidden opacity-0'} bg-[#1f1f1f] rounded-lg overflow-hidden`}>
               <div className="p-3 md:p-4 overflow-y-auto">
                    {metadataError && <p className="text-sm text-red-400 mb-2 text-center bg-red-900 bg-opacity-30 p-2 rounded">{metadataError}</p>}
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                             <label htmlFor={`abstract-edit-pdf-${doc.doc_id}`} className="block text-sm font-medium text-gray-300">Abstract</label>
                             {!isEditingAbstract && !isEditingDate && ( <button onClick={handleEditAbstract} className="text-xs text-blue-400 hover:text-blue-300" disabled={isSavingMetadata}>Edit</button> )}
                         </div>
                         {isEditingAbstract ? (
                             <>
                                 <textarea
                                    ref={abstractTextareaRef} id={`abstract-edit-pdf-${doc.doc_id}`} rows={4} value={editableAbstract}
                                    onChange={(e) => { setEditableAbstract(e.target.value); if (metadataError) setMetadataError(null); }}
                                    className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none max-h-40 overflow-y-auto"
                                    placeholder="Enter abstract..."
                                 />
                                 <div className="mt-2 flex gap-2">
                                     <button onClick={handleSaveMetadata} disabled={isSavingMetadata || !hasMetadataChanged} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]">
                                         {isSavingMetadata ? ( <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ) : ( 'Save' )}
                                     </button>
                                     <button onClick={handleCancelAbstractEdit} disabled={isSavingMetadata} className="px-4 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-md hover:bg-gray-700 transition disabled:opacity-50"> Cancel </button>
                                 </div>
                             </>
                         ) : (
                             <p className="text-sm text-gray-400 mt-1 min-h-[4rem] max-h-40 overflow-y-auto whitespace-pre-wrap bg-[#1f1f1f] p-2 border border-transparent rounded-md">
                                 {editableAbstract || <span className="italic text-gray-500">No abstract available.</span>}
                             </p>
                         )}
                    </div>
                     <div className="mb-4">
                         <div className="flex justify-between items-center mb-1">
                              <label className="block text-sm font-medium text-gray-300">Date Taken</label>
                              {!isEditingDate && !isEditingAbstract && ( <button onClick={handleEditDate} className="text-xs text-blue-400 hover:text-blue-300" disabled={isSavingMetadata}> Edit </button> )}
                         </div>
                         {isEditingDate ? (
                             <>
                                 <DatePicker
                                    selected={editableDateTaken}
                                    onChange={(date: Date | null) => {
                                        const validDate = date instanceof Date && !(date) ? date : null;
                                        setEditableDateTaken(validDate);
                                        if (metadataError) setMetadataError(null);
                                    }}
                                    dateFormat="MMMM d, yyyy"
                                    isClearable
                                    placeholderText="Select date"
                                    className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                                    wrapperClassName="w-full"
                                />
                                <div className="mt-2 flex gap-2">
                                     <button onClick={handleSaveMetadata} disabled={isSavingMetadata || !hasMetadataChanged} className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 transition disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center justify-center min-w-[60px]">
                                          {isSavingMetadata ? ( <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ) : ( 'Save' )}
                                     </button>
                                     <button onClick={handleCancelDateEdit} disabled={isSavingMetadata} className="px-4 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-md hover:bg-gray-700 transition disabled:opacity-50"> Cancel </button>
                                 </div>
                             </>
                         ) : (
                             <p className="text-sm text-gray-400 mt-1 min-h-[2.5rem] bg-[#1f1f1f] p-2 border border-transparent rounded-md flex items-center">
                                  {editableDateTaken
                                      ? editableDateTaken.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' })
                                      : <span className="italic text-gray-500">No date available.</span>
                                  }
                             </p>
                         )}
                     </div>
                   <TagEditor docId={doc.doc_id} apiURL={apiURL} />
               </div>
          </div>
        </div>
      </div>
    </div>
  );
};