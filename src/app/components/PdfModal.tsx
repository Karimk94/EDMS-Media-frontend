import React, { useState, useEffect } from 'react';
import { Document } from './DocumentItem';
import { TagEditor } from './TagEditor';
import { EventEditor } from './EventEditor'; // Import EventEditor
import DatePicker from 'react-datepicker';

// Define EventOption type locally if not imported
interface EventOption {
  value: number; // Event ID
  label: string; // Event Name
}

interface PdfModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
  onUpdateAbstractSuccess: () => void; // Added prop for consistency
  onToggleFavorite: (docId: number, isFavorite: boolean) => void; // Add favorite handler prop
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

export const PdfModal: React.FC<PdfModalProps> = ({ doc, onClose, apiURL, onUpdateAbstractSuccess, onToggleFavorite }) => {
  const [isDetailsVisible, setIsDetailsVisible] = useState(true);

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [documentDate, setDocumentDate] = useState<Date | null>(safeParseDate(doc.date));
  const [initialDate, setInitialDate] = useState<Date | null>(safeParseDate(doc.date));

  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [abstract, setAbstract] = useState(doc.title || '');
  const [initialAbstract, setInitialAbstract] = useState(doc.title || '');

  const [isFavorite, setIsFavorite] = useState(doc.is_favorite); // State for favorite status
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null); // State for selected event

  // Fetch initial event for the document (Placeholder - requires backend endpoint)
  useEffect(() => {
      const fetchDocumentEvent = async () => {
          // console.log(`Placeholder: Fetch event for doc ${doc.doc_id}`);
          // try {
          //   const response = await fetch(`${apiURL}/document/${doc.doc_id}/event`); // Example endpoint
          //   if (response.ok) {
          //     const eventData = await response.json();
          //     if (eventData && eventData.id && eventData.name) {
          //       setSelectedEvent({ value: eventData.id, label: eventData.name });
          //     }
          //   }
          // } catch (err) {
          //   console.error("Failed to fetch document event:", err);
          // }
      };
      fetchDocumentEvent();
  }, [doc.doc_id, apiURL]);

   // Update local favorite state if prop changes
  useEffect(() => {
    setIsFavorite(doc.is_favorite);
  }, [doc.is_favorite]);

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
      onUpdateAbstractSuccess(); // Call prop to refresh list
      // Note: Event changes are handled separately via handleEventChangeInModal
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

   // Handler for Favorite button toggle
  const handleToggleFavorite = (e: React.MouseEvent) => {
     e.stopPropagation(); // Prevent interfering with details toggle
    const newFavoriteStatus = !isFavorite;
    setIsFavorite(newFavoriteStatus); // Optimistic UI update
    onToggleFavorite(doc.doc_id, newFavoriteStatus); // Call parent handler
  };

   // Handler for Event changes in the modal (Placeholder - requires backend endpoint)
  const handleEventChangeInModal = async (docIdParam: number, eventId: number | null): Promise<boolean> => {
      console.log(`Placeholder: Update event for doc ${docIdParam} to eventId ${eventId}`);
      // Simulating success for now:
      await new Promise(res => setTimeout(res, 300));
      return true;
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 md:p-8" onClick={onClose}>
      <div className="bg-[#282828] text-gray-200 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 relative flex-shrink-0 flex justify-between items-center border-b border-gray-700">
          <div className="flex items-center gap-3">
             {/* Favorite Button */}
             <button
               onClick={handleToggleFavorite}
               className="text-white hover:text-yellow-400 p-1"
               title={isFavorite ? "Remove from favorites" : "Add to favorites"}
             >
               <svg className={`w-6 h-6 ${isFavorite ? 'text-yellow-400' : 'text-gray-300'}`} fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isFavorite ? 1 : 2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.539 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
               </svg>
             </button>
             <h2 className="text-xl font-bold text-white">{doc.docname}</h2>
          </div>
          <div className="flex items-center gap-4">
             {/* Details Toggle Button */}
             <button
                onClick={() => setIsDetailsVisible(!isDetailsVisible)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                title={isDetailsVisible ? "Hide Details" : "Show Details"}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
              </button>
            {/* Close Button */}
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">&times;</button>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-grow p-4 grid ${isDetailsVisible ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'} gap-4 min-h-0 transition-all duration-300`}>
          {/* PDF Viewer */}
          <div className={`${isDetailsVisible ? 'md:col-span-2' : 'col-span-1'} h-full`}>
            <iframe
                src={`${apiURL}/pdf/${doc.doc_id}`}
                className="w-full h-full border-0 rounded-lg bg-white"
                title={doc.docname}
            />
          </div>

          {/* Details Panel */}
          <div className={`transition-all duration-300 ${isDetailsVisible ? 'md:col-span-1 opacity-100' : 'hidden opacity-0'} p-4 bg-[#1f1f1f] rounded-lg overflow-y-auto`}>
               {/* Abstract Section */}
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

               {/* Date Taken Section */}
               <div className="mb-4">
                  <h3 className="font-semibold text-gray-300 mb-1">Date Taken</h3>
                  {isEditingDate ? (
                    <div className="flex items-center gap-2">
                      <DatePicker
                        selected={documentDate}
                        onChange={handleDateChange}
                        dateFormat="MMMM d, yyyy h:mm aa" // Adjusted format
                        showTimeSelect // Enable time selection
                        className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                        isClearable
                      />
                      <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">Save</button>
                      <button onClick={handleCancelEditDate} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-gray-400 p-2">
                        {documentDate ? documentDate.toLocaleString() : 'No date set'}
                      </p>
                      <button onClick={handleEditDate} className="px-4 py-1 bg-gray-700 text-white text-xs rounded-md hover:bg-gray-600">Edit</button>
                    </div>
                  )}
                </div>

                {/* Event Editor Section */}
                <EventEditor
                    docId={doc.doc_id}
                    apiURL={apiURL}
                    selectedEvent={selectedEvent}
                    setSelectedEvent={setSelectedEvent} // Pass state setter
                    onEventChange={handleEventChangeInModal} // Pass handler for backend update
                />

               {/* Tag Editor Section */}
               <TagEditor docId={doc.doc_id} apiURL={apiURL} />
          </div>
        </div>
      </div>
    </div>
  );
};
