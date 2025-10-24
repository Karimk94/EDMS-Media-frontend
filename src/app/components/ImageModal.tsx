import React, { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker'; // Restored import
import { Document } from './DocumentItem';
import { Loader } from './Loader';
import { AnalysisView } from './AnalysisView';
import { TagEditor } from './TagEditor';
import { CollapsibleSection } from './CollapsibleSection';

// Helper to format Date to the expected API string format (YYYY-MM-DD HH:MM:SS)
const formatDateTimeForAPI = (date: Date | null): string | null => {
    if (!date) return null;
    const pad = (num: number) => num.toString().padStart(2, '0');
    if (isNaN(date.getTime())) {
        console.error("Invalid date passed to formatDateTimeForAPI:", date);
        return null;
    }
    try {
        // Use 00:00:00 for time part when only date is selected
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
        // Use UTC midnight to avoid timezone shifts
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


interface ImageModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
  onUpdateMetadataSuccess: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ doc, onClose, apiURL, onUpdateMetadataSuccess }) => {
  const [view, setView] = useState<'image' | 'analysis'>('image');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const originalImageBlob = useRef<Blob | null>(null);

  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [editableAbstract, setEditableAbstract] = useState('');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editableDateTaken, setEditableDateTaken] = useState<Date | null>(null);

  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const abstractTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!doc) {
        setIsLoading(false);
        setError("Document data is missing.");
        setImageSrc(null);
        originalImageBlob.current = null;
        setEditableAbstract('');
        setEditableDateTaken(null);
        return;
    }

    setEditableAbstract(doc.title || '');
    setEditableDateTaken(parseApiDateTime(doc.date || ''));
    setIsEditingAbstract(false);
    setIsEditingDate(false);
    setMetadataError(null);
    setView('image');
    setError(null);
    setIsLoading(true);
    setAnalysisResult(null); // Clear previous analysis result

    // Clear previous image URL immediately
    const prevImageSrc = imageSrc;
    setImageSrc(null);
    if (prevImageSrc) {
        URL.revokeObjectURL(prevImageSrc);
    }
    originalImageBlob.current = null;


     const fetchImage = async () => {
         try {
            if (!doc.doc_id) throw new Error("Document ID is missing.");
            const response = await fetch(`${apiURL}/image/${doc.doc_id}`);
            if (!response.ok) throw new Error(`Image not found in EDMS (Status: ${response.status}).`);
            const blob = await response.blob();
            originalImageBlob.current = blob;
            const newImageSrc = URL.createObjectURL(blob);
            setImageSrc(newImageSrc);
         } catch (err: any) {
            console.error("Fetch Image Error:", err);
            setError(err.message);
            setImageSrc(null);
            originalImageBlob.current = null;
         } finally {
            setIsLoading(false);
         }
     };

    fetchImage();

    // Enhanced cleanup
    return () => {
        const currentImageSrc = imageSrcRef.current; // Use a ref to hold the current URL for cleanup
        if (currentImageSrc) {
            URL.revokeObjectURL(currentImageSrc);
        }
        originalImageBlob.current = null;
    };
  }, [doc, apiURL]);

  // Ref to store imageSrc for cleanup purposes
  const imageSrcRef = useRef<string | null>(null);
  useEffect(() => {
      imageSrcRef.current = imageSrc;
  }, [imageSrc]);


   useEffect(() => {
    if (isEditingAbstract && abstractTextareaRef.current) {
        abstractTextareaRef.current.focus();
        abstractTextareaRef.current.select();
    }
   }, [isEditingAbstract]);

    const handleAnalyze = async () => {
        if (!originalImageBlob.current) {
             setError("Original image data not available for analysis.");
             return;
        }
        setIsAnalyzing(true);
        setError(null);
        setAnalysisResult(null);
        const formData = new FormData();
        formData.append('image_file', originalImageBlob.current, `${doc.doc_id}_upload.jpg`);

        try {
            const response = await fetch(`${apiURL}/analyze_image`, { method: 'POST', body: formData });
            if (!response.ok) {
                let errorMsg = 'Analysis failed.';
                try {
                    const errorJson = await response.json();
                    errorMsg = errorJson.error || `Analysis failed (Status: ${response.status})`;
                } catch (_) { errorMsg = `Analysis failed (Status: ${response.status})`; }
                throw new Error(errorMsg);
            }
            const data = await response.json();
             setAnalysisResult(data);
            setView('analysis');
        } catch (err: any) {
            console.error("Analysis Error:", err);
            setError(`Face Service Error: ${err.message}`);
             setView('image');
        } finally {
            setIsAnalyzing(false);
        }
    };

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

            // Update local state used for display *after* successful save
            if(abstractChanged) setEditableAbstract(editableAbstract.trim()); // Update displayed value
            if(dateChanged) setEditableDateTaken(editableDateTaken); // Update displayed value

            // Turn off editing modes
            setIsEditingAbstract(false);
            setIsEditingDate(false);

            onUpdateMetadataSuccess(); // Notify parent to refetch data
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

    if (!doc) {
        return (
             <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[70] p-4">
                 <div className="bg-[#282828] text-red-400 p-6 rounded-xl">Error: Document data is not available.</div>
             </div>
        );
    }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-[#282828] text-gray-200 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 md:p-6 relative flex-shrink-0 flex justify-between items-center border-b border-gray-700">
           <h2 className="text-lg md:text-xl font-bold text-white truncate pr-16">{doc.docname || 'Document'}</h2>
           <div className="absolute top-1/2 right-4 md:right-6 transform -translate-y-1/2 z-10">
              <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl md:text-3xl">&times;</button>
           </div>
         </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {isLoading && <Loader />}
          {error && <p className="text-center p-4 text-red-400 bg-red-900 bg-opacity-30 rounded border border-red-700 mb-4">{`Error: ${error}`}</p>}
          {metadataError && <p className="text-sm text-red-400 my-2 text-center bg-red-900 bg-opacity-30 p-2 rounded">{metadataError}</p>}

          {view === 'image' && !isLoading && (
            <div className="flex flex-col h-full">
              <div className="text-center mb-4 flex-shrink-0">
                {imageSrc ? (
                    <img src={imageSrc} alt={doc.docname} className="max-w-full max-h-[50vh] md:max-h-[60vh] mx-auto rounded-lg" />
                ) : !error ? (
                    <div className="h-[50vh] flex items-center justify-center text-gray-500">Image preview unavailable.</div>
                ) : null }
              </div>

             {imageSrc && (
                 <div className="space-y-4 flex-shrink-0">
                    <CollapsibleSection title="Details & Tags">
                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-1">
                                <label htmlFor="abstract-edit" className="block text-sm font-medium text-gray-300">Abstract</label>
                                {!isEditingAbstract && !isEditingDate && ( <button onClick={handleEditAbstract} className="text-xs text-blue-400 hover:text-blue-300" disabled={isSavingMetadata}>Edit</button> )}
                            </div>
                            {isEditingAbstract ? (
                                <>
                                    <textarea
                                        ref={abstractTextareaRef} id="abstract-edit" rows={4} value={editableAbstract}
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
                                            const validDate = date instanceof Date && !date ? date : null;
                                            setEditableDateTaken(validDate);
                                            if (metadataError) setMetadataError(null);
                                        }}
                                        dateFormat="MMMM d, yyyy"
                                        isClearable
                                        placeholderText="Select date"
                                        className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none" // Direct styling
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
                    </CollapsibleSection>
                 </div>
             )}

              {doc.media_type === 'image' && imageSrc && (
                <div className="text-center mt-6 flex-shrink-0 pb-4">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || isSavingMetadata || isLoading}
                    className="px-8 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition w-64 h-14 flex items-center justify-center mx-auto disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                     {isAnalyzing ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     ) : ( 'Analyze for Faces' )}
                  </button>
                  {isAnalyzing && error && !isLoading && <p className="text-sm text-red-400 mt-2">{error}</p>}
                </div>
              )}
            </div>
          )}

          {view === 'analysis' && analysisResult && (
             <AnalysisView
                result={analysisResult}
                docId={doc.doc_id}
                apiURL={apiURL}
                onUpdateAbstractSuccess={onUpdateMetadataSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
};