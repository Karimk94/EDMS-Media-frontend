import React, { useState, useEffect, useRef } from 'react';
import { Document } from './DocumentItem';
import { Loader } from './Loader';
import { AnalysisView } from './AnalysisView';
import { TagEditor } from './TagEditor';
import { EventEditor } from './EventEditor';
import { CollapsibleSection } from './CollapsibleSection';
import DatePicker from 'react-datepicker';
import { ReadOnlyTagDisplay } from './ReadOnlyTagDisplay';
import { ReadOnlyEventDisplay } from './ReadOnlyEventDisplay';

interface EventOption {
  value: number; // Event ID
  label: string; // Event Name
}

interface ImageModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
  onUpdateAbstractSuccess: () => void;
  onToggleFavorite: (docId: number, isFavorite: boolean) => void;
  isEditor: boolean;
  t: Function;
}

const safeParseDate = (dateString: string): Date | null => {
  if (!dateString || dateString === "N/A") return null;
  // Try parsing YYYY-MM-DD HH:MM:SS first
  const dateTimeParts = dateString.split(' ');
  if (dateTimeParts.length === 2) {
    const dateParts = dateTimeParts[0].split('-');
    const timeParts = dateTimeParts[1].split(':');
    if (dateParts.length === 3 && timeParts.length === 3) {
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      const seconds = parseInt(timeParts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
        const date = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(date.getTime())) return date;
      }
    }
  }
  // Fallback for other potential formats or just date
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

export const ImageModal: React.FC<ImageModalProps> = ({ doc, onClose, apiURL, onUpdateAbstractSuccess, onToggleFavorite, isEditor, t }) => {
  const [view, setView] = useState<'image' | 'analysis'>('image');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const originalImageBlob = useRef<Blob | null>(null);

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [documentDate, setDocumentDate] = useState<Date | null>(safeParseDate(doc.date));
  const [initialDate, setInitialDate] = useState<Date | null>(safeParseDate(doc.date));

  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [abstract, setAbstract] = useState(doc.title || '');
  const [initialAbstract, setInitialAbstract] = useState(doc.title || '');

  const [isFavorite, setIsFavorite] = useState(doc.is_favorite); // State for favorite status
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null); // State for selected event

  // Fetch initial event for the document
  useEffect(() => {
      const fetchDocumentEvent = async () => {
          // console.log(`Attempting to fetch event for doc ${doc.doc_id}`); // Debug log
          try {
            const response = await fetch(`${apiURL}/document/${doc.doc_id}/event`); // Use the new GET endpoint
            if (response.ok) {
              const eventData = await response.json();
              if (eventData && eventData.event_id && eventData.event_name) {
                 // console.log(`Event found: ID=${eventData.event_id}, Name=${eventData.event_name}`); // Debug log
                setSelectedEvent({ value: eventData.event_id, label: eventData.event_name });
              } else {
                 // console.log(`No event associated with doc ${doc.doc_id}.`); // Debug log
                 setSelectedEvent(null);
              }
            } else if (response.status !== 404) { // Ignore 404 (no event linked)
                 console.error(`Failed to fetch document event (${response.status}):`, await response.text()); // Log other errors
            } else {
                 // console.log(`No event association found (404) for doc ${doc.doc_id}.`); // Debug log for 404
                 setSelectedEvent(null);
            }
          } catch (err) {
            console.error("Network or parsing error fetching document event:", err);
            setSelectedEvent(null); // Ensure state is null on error
          }
      };
      // Reset selectedEvent when doc changes, then fetch new one
      setSelectedEvent(null);
      fetchDocumentEvent();
  }, [doc.doc_id, apiURL]); // Dependencies


  useEffect(() => {
    const fetchImage = async () => {
      setIsLoading(true);
      setError(null);
      setView('image'); // Reset view on doc change
      setAnalysisResult(null); // Reset analysis result
      originalImageBlob.current = null; // Reset blob ref
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc); // Revoke previous object URL
        setImageSrc(null);
      }
      try {
        const response = await fetch(`${apiURL}/image/${doc.doc_id}`);
        if (!response.ok) throw new Error('Image not found in EDMS.');
        const blob = await response.blob();
        originalImageBlob.current = blob;
        setImageSrc(URL.createObjectURL(blob));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchImage();

    // Cleanup function to revoke URL when component unmounts or doc changes
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [doc.doc_id, apiURL]); // Rerun when doc_id changes

  // Update local favorite state if prop changes
  useEffect(() => {
    setIsFavorite(doc.is_favorite);
  }, [doc.is_favorite]);

    // Update local abstract and date state if doc prop changes
  useEffect(() => {
    setAbstract(doc.title || '');
    setInitialAbstract(doc.title || '');
    const newDate = safeParseDate(doc.date);
    setDocumentDate(newDate);
    setInitialDate(newDate);
    // Reset editing states if the document changes
    setIsEditingAbstract(false);
    setIsEditingDate(false);
  }, [doc.title, doc.date]); // Added doc.date


  const handleAnalyze = async () => {
    if (!originalImageBlob.current) return;
    setIsAnalyzing(true);
    setError(null);
    const formData = new FormData();
    formData.append('image_file', originalImageBlob.current, `${doc.doc_id}.jpg`);

    try {
      const response = await fetch(`${apiURL}/analyze_image`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error((await response.json()).error || 'Analysis failed.');
      setAnalysisResult(await response.json());
      setView('analysis');
    } catch (err: any) {
      setError(`Face Service Error: ${err.message}`);
      // Keep the view as 'image' on analysis error
      setView('image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDateChange = (date: Date | null) => {
    setDocumentDate(date);
  };

  const handleEditDate = () => {
    setInitialDate(documentDate); // Store current date before editing
    setIsEditingDate(true);
  };

  const handleCancelEditDate = () => {
    setDocumentDate(initialDate); // Restore initial date
    setIsEditingDate(false);
  };

  const handleEditAbstract = () => {
    setInitialAbstract(abstract); // Store current abstract before editing
    setIsEditingAbstract(true);
  };

  const handleCancelEditAbstract = () => {
    setAbstract(initialAbstract); // Restore initial abstract
    setIsEditingAbstract(false);
  };

  const handleUpdateMetadata = async () => {
    // Only include fields that have actually changed or are being edited
    const payload: { doc_id: number; abstract?: string; date_taken?: string | null } = {
      doc_id: doc.doc_id,
    };
    let needsUpdate = false;

    if (isEditingAbstract && abstract !== initialAbstract) {
        payload.abstract = abstract;
        needsUpdate = true;
    }
    if (isEditingDate) {
        const formattedNewDate = formatToApiDate(documentDate);
        const formattedInitialDate = formatToApiDate(initialDate);
         // Check if dates are different (handles null correctly)
        if (formattedNewDate !== formattedInitialDate) {
            payload.date_taken = formattedNewDate; // Send null if documentDate is null
            needsUpdate = true;
        }
    }

    if (!needsUpdate) {
        setIsEditingDate(false);
        setIsEditingAbstract(false);
        return; // No changes to save
    }

    console.log("Payload for metadata update:", payload); // Debug log

    try {
      const response = await fetch(`${apiURL}/update_metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update metadata');
      const resultMessage = await response.json();
      //alert(resultMessage.message || 'Metadata updated successfully');

      // Update initial states after successful save
      if (payload.abstract !== undefined) setInitialAbstract(payload.abstract);
      if (payload.date_taken !== undefined) setInitialDate(documentDate); // Use the state date

      setIsEditingDate(false);
      setIsEditingAbstract(false);
      onUpdateAbstractSuccess(); // Call prop to refresh list
    } catch (err: any) {
      //alert(`Error updating metadata: ${err.message}`);
       // Don't reset editing state on error, allow user to retry or cancel
    }
  };


  // Handler for Favorite button toggle
  const handleToggleFavorite = () => {
    const newFavoriteStatus = !isFavorite;
    setIsFavorite(newFavoriteStatus); // Optimistic UI update
    onToggleFavorite(doc.doc_id, newFavoriteStatus); // Call parent handler
  };

  // Handler for Event changes in the modal
  const handleEventChangeInModal = async (docIdParam: number, eventId: number | null): Promise<boolean> => {
      console.log(`Updating event association for doc ${docIdParam} to eventId ${eventId}`);
      try {
          const response = await fetch(`${apiURL}/document/${docIdParam}/event`, { // Use the new PUT endpoint
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event_id: eventId }), // Send event_id (can be null)
          });
          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Failed to update event association');
          }
          console.log("Backend event association updated successfully.");
          return true; // Indicate success
      } catch (error: any) {
          console.error('Failed to update event association:', error);
          //alert(`Error updating event: ${error.message}`);
          return false; // Indicate failure
      }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#282828] text-gray-200 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl z-10">&times;</button>
           {/* Favorite Button */}
           <button
             onClick={handleToggleFavorite}
             className="absolute top-4 left-4 text-white hover:text-yellow-400 z-10 p-2 bg-black bg-opacity-30 rounded-full"
             title={isFavorite ? "Remove from favorites" : "Add to favorites"}
           >
             <svg className={`w-6 h-6 ${isFavorite ? 'text-yellow-400' : 'text-gray-300'}`} fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isFavorite ? 1 : 2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.539 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588 1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
             </svg>
           </button>
          <h2 className="text-xl font-bold text-white mb-4 pl-12">{doc.docname}</h2>

          {isLoading && <Loader />}
          {error && <p className="text-center p-10 text-red-400">{error}</p>}

          {view === 'image' && imageSrc && !error && (
            <div>
              <div className="text-center">
                <img src={imageSrc} alt={doc.docname} className="max-w-full max-h-[60vh] mx-auto rounded-lg" />
              </div>
              <div className="mt-4">
                 <CollapsibleSection title="Details">
                    {/* Abstract Section */}
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-300 mb-1">Abstract</h3>
                      {isEditor ? (
                        isEditingAbstract ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={abstract}
                              onChange={(e) => setAbstract(e.target.value)}
                              className="w-full h-24 px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">{t('save')}</button>
                              <button onClick={handleCancelEditAbstract} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700">{t('cancel')}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <p className="text-sm text-gray-400 mt-1 pr-4">{abstract || 'No abstract available.'}</p>
                            <button onClick={handleEditAbstract} className="px-4 py-1 bg-gray-700 text-white text-xs rounded-md hover:bg-gray-600 flex-shrink-0">{t('edit')}</button>
                          </div>
                        )
                      ) : (
                        <p className="text-sm text-gray-400 mt-1 pr-4">{abstract || 'No abstract available.'}</p>
                      )}
                    </div>

                    {/* Date Taken Section */}
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-300 mb-1">{t('dateTaken')}</h3>
                      {isEditor ? (
                        isEditingDate ? (
                          <div className="flex items-center gap-2">
                            <DatePicker
                              selected={documentDate}
                              onChange={handleDateChange}
                              dateFormat="dd/MM/yyyy h:mm aa" 
                              showTimeSelect
                              timeInputLabel="Time:"
                              className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                              wrapperClassName="w-full"
                              isClearable
                              placeholderText="Click to select date and time"
                              autoComplete='off'
                              locale="en-GB"
                            />
                            <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex-shrink-0">{t('save')}</button>
                            <button onClick={handleCancelEditDate} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 flex-shrink-0">{t('cancel')}</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                             <p className="text-sm text-gray-400 p-2 flex-grow">
                              {documentDate ? documentDate.toLocaleString('en-GB') : t('noDateSet')}
                            </p>
                            <button onClick={handleEditDate} className="px-4 py-1 bg-gray-700 text-white text-xs rounded-md hover:bg-gray-600 flex-shrink-0">{t('edit')}</button>
                          </div>
                        )
                      ) : (
                        <p className="text-sm text-gray-400 p-2 flex-grow">
                          {documentDate ? documentDate.toLocaleString('en-GB') : t('noDateSet')}
                        </p>
                      )}
                    </div>


                    {/* --- Event Section (Conditional) --- */}
                    {isEditor ? (
                      <EventEditor
                          docId={doc.doc_id}
                          apiURL={apiURL}
                          selectedEvent={selectedEvent}
                          setSelectedEvent={setSelectedEvent} // Pass state setter
                          onEventChange={handleEventChangeInModal} // Pass handler for backend update
                      />
                    ) : (
                       <ReadOnlyEventDisplay event={selectedEvent} />
                    )}
                    {/* --- END Event Section --- */}

                    {/* --- Tag Section (Conditional) --- */}
                    {isEditor ? (
                       <TagEditor docId={doc.doc_id} apiURL={apiURL} />
                    ) : (
                        <ReadOnlyTagDisplay docId={doc.doc_id} apiURL={apiURL} />
                    )}
                     {/* --- END Tag Section --- */}
                </CollapsibleSection>
              </div>
              {doc.media_type === 'image' && isEditor && (
                <div className="text-center">
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="mt-6 px-8 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition w-64 h-14 flex items-center justify-center mx-auto disabled:bg-red-800 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? (
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      'Analyze for Faces'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {view === 'analysis' && analysisResult && !error && isEditor && (
            <AnalysisView
              result={analysisResult}
              docId={doc.doc_id}
              apiURL={apiURL}
              onUpdateAbstractSuccess={() => {
                  onUpdateAbstractSuccess(); // Call original prop
                  setView('image'); // Switch back to image view after successful abstract update
                  setAnalysisResult(null); // Clear analysis result
                  setError(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};