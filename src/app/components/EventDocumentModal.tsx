import React, { useState, useEffect } from 'react';
import { Document } from './DocumentItem'; // Assuming Document type is shared
import { Loader } from './Loader';

interface EventDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEventId: number | null;
  initialEventName: string; // Pass the event name
  apiURL: string;
}

export const EventDocumentModal: React.FC<EventDocumentModalProps> = ({
  isOpen,
  onClose,
  initialEventId,
  initialEventName,
  apiURL,
}) => {
  const [currentDoc, setCurrentDoc] = useState<Document | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentForPage = async (eventId: number, page: number) => {
    if (!eventId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiURL}/events/${eventId}/documents?page=${page}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch document page ${page}`);
      }
      const data = await response.json();
      setCurrentDoc(data.document); // Backend now returns a single document object
      setCurrentPage(data.page);
      setTotalPages(data.total_pages);
    } catch (err: any) {
      console.error("Error fetching event document:", err);
      setError(err.message);
      setCurrentDoc(null); // Clear doc on error
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch the first document when the modal opens or eventId changes
  useEffect(() => {
    if (isOpen && initialEventId) {
      fetchDocumentForPage(initialEventId, 1); // Start at page 1
    } else {
      // Reset state when modal is closed or eventId is null
      setCurrentDoc(null);
      setCurrentPage(1);
      setTotalPages(1);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialEventId]); // apiURL is stable, fetch function uses it internally


  const handlePrev = () => {
    if (currentPage > 1 && initialEventId) {
      fetchDocumentForPage(initialEventId, currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && initialEventId) {
      fetchDocumentForPage(initialEventId, currentPage + 1);
    }
  };

  const renderMedia = () => {
    if (!currentDoc) return <p className="text-gray-400">No document selected.</p>;

    const mediaUrl = `${apiURL}/${currentDoc.media_type}/${currentDoc.doc_id}`;

    switch (currentDoc.media_type) {
      case 'image':
        return <img src={mediaUrl} alt={currentDoc.docname} className="max-w-full max-h-[70vh] mx-auto rounded-lg object-contain" />;
      case 'video':
        return (
          <video controls autoPlay className="w-full max-h-[70vh] rounded-lg bg-black">
            <source src={mediaUrl} type="video/mp4" /> {/* Adjust type if needed */}
            Your browser does not support the video tag.
          </video>
        );
      case 'pdf':
        return <iframe src={mediaUrl} className="w-full h-[70vh] border-0 rounded-lg bg-white" title={currentDoc.docname} />;
      default:
        return <p className="text-gray-400">Unsupported media type.</p>;
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#282828] text-gray-200 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 relative flex-shrink-0 flex justify-between items-center border-b border-gray-700">
          <h2 className="text-lg font-bold text-white truncate pr-10">{initialEventName}</h2>
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-white text-3xl z-10">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-grow p-4 relative flex items-center justify-center min-h-[300px]">
          {isLoading ? (
            <Loader />
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : currentDoc ? (
            <>
               {/* Previous Button */}
               {currentPage > 1 && (
                 <button
                    onClick={handlePrev}
                    disabled={isLoading}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-40 text-white p-2 rounded-full hover:bg-opacity-60 transition disabled:opacity-50 z-10"
                    aria-label="Previous Document"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                 </button>
               )}

               {/* Media Display */}
               <div className="w-full h-full flex items-center justify-center">
                   {renderMedia()}
               </div>

              {/* Next Button */}
              {currentPage < totalPages && (
                 <button
                    onClick={handleNext}
                    disabled={isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-40 text-white p-2 rounded-full hover:bg-opacity-60 transition disabled:opacity-50 z-10"
                    aria-label="Next Document"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                 </button>
              )}
            </>
          ) : (
            <p className="text-gray-400">No document found for this page.</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 flex-shrink-0 flex justify-between items-center border-t border-gray-700 text-sm text-gray-400">
            <span>{currentDoc?.docname || '...'}</span>
            <span>{currentPage} / {totalPages}</span>
        </div>
      </div>
    </div>
  );
};