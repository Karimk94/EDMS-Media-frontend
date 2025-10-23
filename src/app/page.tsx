"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DocumentList } from './components/DocumentList';
import { Pagination } from './components/Pagination';
import { ImageModal } from './components/ImageModal';
import { VideoModal } from './components/VideoModal';
import { PdfModal } from './components/PdfModal';
import { Document } from './components/DocumentItem';
import { UploadModal } from './components/UploadModal';
import { UploadableFile } from './components/UploadFileItem';
import { DocumentItemSkeleton } from './components/DocumentItemSkeleton';
import { MemoriesStack } from './components/MemoriesStack'; // Import the new component

// Define type for the active section
type ActiveSection = 'recent' | 'favorites' | 'events' | 'memories'; // Add 'memories' view

// Define structure for Event items if different from Document
interface EventItem {
  event_id: number;
  title: string;
  date: string; // Or Date object
  description?: string;
}

interface PersonOption {
  value: number;
  label: string;
}

const formatToApiDate = (date: Date | null): string => {
  if (!date) return '';
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};


export default function HomePage() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('recent');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [memoryStackItems, setMemoryStackItems] = useState<Document[]>([]); // For the stack display
  const [isShowingFullMemories, setIsShowingFullMemories] = useState<boolean>(false); // Flag for memory detail view

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMemoryStack, setIsLoadingMemoryStack] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filter States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonOption[] | null>(null);
  const [personCondition, setPersonCondition] = useState<'any' | 'all'>('any');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  // Modal States
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Document | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<Document | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [processingDocs, setProcessingDocs] = useState<number[]>([]);


  const API_PROXY_URL = '/api';

  // --- Main Data Fetching Logic ---
  const fetchSectionData = useCallback(async (isMemoryFetch = false) => {
    // Only set loading if it's not the initial memory stack load
    if (!isLoadingMemoryStack || isMemoryFetch) {
         setIsLoading(true);
    }
    setError(null);
    setDocuments([]);
    setEvents([]);

    let url: URL;
    const params = new URLSearchParams();
    params.append('page', String(currentPage));

    // Apply filters UNLESS it's the specific full memories view
    if (!isMemoryFetch) {
        if (searchTerm) params.append('search', searchTerm);
        if (selectedPerson && selectedPerson.length > 0) {
        const personNames = selectedPerson.map(p => p.label.split(' - ')[0]).join(',');
        params.append('persons', personNames);
        if (selectedPerson.length > 1) {
            params.append('person_condition', personCondition);
        }
        }
        if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
        }
        const formattedDateFrom = formatToApiDate(dateFrom);
        if (formattedDateFrom) params.append('date_from', formattedDateFrom);
        const formattedDateTo = formatToApiDate(dateTo);
        if (formattedDateTo) params.append('date_to', formattedDateTo);
        if (selectedYears.length > 0) {
            params.append('years', selectedYears.join(','));
        }
    } else {
        // Specific filters for the full memories view based on RTADOCDATE
        const now = new Date();
        params.append('memoryMonth', String(now.getMonth() + 1)); // Tell backend it's a memory query for this month
        // Optionally add day: params.append('memoryDay', String(now.getDate()));
        params.append('sort', 'rtadocdate_desc'); // Sort memories chronologically using RTADOCDATE
    }


    try {
      let endpoint = '';
      let dataSetter: React.Dispatch<React.SetStateAction<any[]>> = setDocuments; // Default setter
      let dataKey = 'documents'; // Default key in response JSON
      let totalPagesKey = 'total_pages';

      if (isMemoryFetch) {
          endpoint = '/documents'; // Use main endpoint with memory params
          dataSetter = setDocuments;
          dataKey = 'documents';
      } else {
          switch (activeSection) {
            case 'recent':
              endpoint = '/documents';
              params.append('sort', 'date_desc'); // Sort by CREATION_DATE for recent
              dataSetter = setDocuments;
              dataKey = 'documents';
              break;
            case 'favorites':
              console.log("Fetching favorites (Backend needed)");
              endpoint = '/favorites'; // Assumed endpoint
              dataSetter = setDocuments;
              dataKey = 'favorites'; // Assumed key
              break;
            case 'events':
              console.log("Fetching events (Backend needed)");
              endpoint = '/events'; // Assumed endpoint
              dataSetter = setEvents; // Use event setter
              dataKey = 'events'; // Assumed key
              break;
             default: // Should not happen
                  throw new Error(`Invalid section: ${activeSection}`);
          }
      }

      if (endpoint) {
          url = new URL(`${API_PROXY_URL}${endpoint}`, window.location.origin);
          url.search = params.toString();

          // --- Placeholder for Favorites/Events ---
          if ((activeSection === 'favorites' || activeSection === 'events') && !isMemoryFetch) {
               await new Promise(resolve => setTimeout(resolve, 300));
               dataSetter([]);
               setTotalPages(1);
          } else {
               // --- Actual Fetch for Recent/Memories ---
               const response = await fetch(url);
               if (!response.ok) throw new Error(`Failed to fetch ${isMemoryFetch ? 'memories' : activeSection}. Status: ${response.status}`);
               const data = await response.json();
               dataSetter(data[dataKey] || []);
               setTotalPages(data[totalPagesKey] || 1);
          }
      } else if (!isMemoryFetch) {
          // Handle case where endpoint is empty but not a memory fetch (shouldn't occur with current logic)
          setDocuments([]);
          setEvents([]);
          setTotalPages(1);
      }


    } catch (err: any) {
      console.error(`Error fetching ${isMemoryFetch ? 'memories detail' : activeSection}:`, err);
      setError(`Failed to fetch ${isMemoryFetch ? 'memories' : activeSection}. Is the API ready? ${err.message}`);
      setDocuments([]);
      setEvents([]);
      setTotalPages(1);
    } finally {
      // Only stop loading if it's not the background memory stack load
      if (!isLoadingMemoryStack || isMemoryFetch){
           setIsLoading(false);
      }
    }
  }, [activeSection, currentPage, searchTerm, dateFrom, dateTo, selectedPerson, personCondition, selectedTags, selectedYears, isLoadingMemoryStack]); // isShowingFullMemories is managed separately


  // --- Fetch Memory Stack Items (Separate Logic) ---
  const fetchMemoryStack = async () => {
    setIsLoadingMemoryStack(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const url = new URL(`${API_PROXY_URL}/memories`, window.location.origin);
      url.searchParams.append('month', String(month));
      // url.searchParams.append('day', String(now.getDate())); // Optional: Fetch for specific day
      url.searchParams.append('limit', '5'); // Limit for stack display

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch memory stack items.');
      const data = await response.json();
      setMemoryStackItems(data.memories || []);
    } catch (err: any) {
      console.error("Error fetching memory stack:", err);
      setMemoryStackItems([]); // Clear on error
    } finally {
      setIsLoadingMemoryStack(false);
    }
  };

  useEffect(() => {
    // Fetch main section data OR full memories data
    if (isShowingFullMemories) {
         fetchSectionData(true); // Pass flag to fetch all memories
    } else {
        fetchSectionData(false); // Fetch based on activeSection and filters
    }
  }, [fetchSectionData, isShowingFullMemories, currentPage]); // Re-fetch when page changes or view toggles

  // Trigger memory stack fetch only once on mount
  useEffect(() => {
    fetchMemoryStack();
  }, []);

  // --- Processing Docs Status Check ---
   useEffect(() => {
    const storedProcessingDocs = localStorage.getItem('processingDocs');
    if (storedProcessingDocs) {
      try {
        const parsedDocs = JSON.parse(storedProcessingDocs);
        if (Array.isArray(parsedDocs)) {
             setProcessingDocs(parsedDocs);
        } else {
             localStorage.removeItem('processingDocs');
        }
      } catch (e) {
          localStorage.removeItem('processingDocs');
      }
    }
  }, []);

  useEffect(() => {
    if (processingDocs.length === 0) {
        localStorage.removeItem('processingDocs');
        return;
    }
    localStorage.setItem('processingDocs', JSON.stringify(processingDocs));
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_PROXY_URL}/processing_status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docnumbers: processingDocs }),
        });
        if (!response.ok) {
           console.error("Processing status check failed:", response.statusText);
           return;
        }
        const data = await response.json();
        const stillProcessing = data.processing || [];

        // Check if the list has actually changed before updating state
        if (JSON.stringify(stillProcessing.sort()) !== JSON.stringify(processingDocs.sort())) {
            setProcessingDocs(stillProcessing);
            if (stillProcessing.length === 0) {
                 clearInterval(interval);
                 // Refresh only if showing recent items OR full memories
                 if (activeSection === 'recent' || isShowingFullMemories) {
                     fetchSectionData(isShowingFullMemories);
                 }
            }
        } else if (stillProcessing.length === 0) {
             // If response confirms empty and state is already empty, just clear interval
             clearInterval(interval);
             setProcessingDocs([]); // Ensure state is cleared if response is empty
        }
      } catch (error) {
        console.error("Error checking processing status:", error);
        // Optional: Implement backoff or stop checking after too many errors
      }
    }, 7000); // Check every 7 seconds
    return () => clearInterval(interval); // Cleanup interval on unmount or dependency change
   }, [processingDocs, fetchSectionData, activeSection, isShowingFullMemories]);


  // --- Handlers ---
  const handleSearch = (newSearchTerm: string) => {
    setIsShowingFullMemories(false);
    setActiveSection('recent'); // Default to recent on new search
    setSearchTerm(newSearchTerm);
    setCurrentPage(1);
  };

   const handleClearFilters = () => {
    setIsShowingFullMemories(false);
    setActiveSection('recent'); // Default to recent when clearing
    setSearchTerm('');
    setDateFrom(null);
    setDateTo(null);
    setSelectedPerson(null);
    setSelectedTags([]);
    setSelectedYears([]);
    setCurrentPage(1);
  };

  const handleClearCache = async () => {
    if (window.confirm('Are you sure you want to clear the thumbnail cache?')) {
        try {
        const response = await fetch(`${API_PROXY_URL}/clear_cache`, { method: 'POST' });
         if (!response.ok) throw new Error(`Cache clear failed: ${response.statusText}`);
        window.alert('Thumbnail cache cleared.');
        fetchSectionData(isShowingFullMemories);
        fetchMemoryStack();
        } catch (err: any) {
          console.error("Cache clear error:", err);
          window.alert(`Failed to clear cache: ${err.message}`);
        }
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleSectionChange = (section: ActiveSection) => {
    if (section !== activeSection || isShowingFullMemories) {
        setIsShowingFullMemories(false);
        setActiveSection(section);
        setCurrentPage(1);
    }
  };

  const handleDocumentClick = (doc: Document) => {
    if (doc.media_type === 'video') setSelectedVideo(doc);
    else if (doc.media_type === 'pdf') setSelectedPdf(doc);
    else setSelectedDoc(doc);
  };

  const handleEventClick = (event: EventItem) => {
      console.log("Event clicked:", event);
  }

  const handleTagSelect = (tag: string) => {
     setIsShowingFullMemories(false);
     setActiveSection('recent'); // Switch to recent when tag is selected from anywhere
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
     setCurrentPage(1); // Reset page for new filter
  };

    const handleYearSelect = (years: number[]) => {
      setIsShowingFullMemories(false);
      setActiveSection('recent'); // Switch to recent when year is selected
      setSelectedYears(years);
      setCurrentPage(1);
    };


  const handleUpdateAbstractSuccess = () => {
    fetchSectionData(isShowingFullMemories);
    setSelectedDoc(null);
     // If the updated doc was part of the memory stack, refetch stack too
     if (memoryStackItems.some(item => item.doc_id === selectedDoc?.doc_id)) {
          fetchMemoryStack();
     }
  };

  const handleAnalyze = (uploadedFiles: UploadableFile[]) => {
    const docnumbers = uploadedFiles.map(f => f.docnumber!).filter(Boolean);
    setIsUploadModalOpen(false);

    // Set processing state immediately
    const newProcessingDocs = Array.from(new Set([...processingDocs, ...docnumbers]));
    setProcessingDocs(newProcessingDocs);

    // Switch to recent view *after* setting processing state
    setIsShowingFullMemories(false);
    setActiveSection('recent');
    setCurrentPage(1); // Go to first page of recent to see new items potentially

    // Immediately trigger fetch for recent (will show items, potentially without thumbnails yet)
    fetchSectionData(false);

    // Send request to backend to start processing
    fetch(`${API_PROXY_URL}/process_uploaded_documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docnumbers }),
    })
    .catch(error => {
      console.error("Error initiating processing:", error);
      // Remove docnumbers from processing state only if initiation fails critically
      setProcessingDocs(prev => prev.filter(d => !docnumbers.includes(d)));
      // Optionally show an error message to the user
    });
  };

  // --- Handler for clicking the memory stack ---
  const handleMemoryStackClick = () => {
      console.log("Memory stack clicked - showing full memories");
      setIsShowingFullMemories(true);
      // setActiveSection('memories'); // No longer needed as isShowingFullMemories controls view
      setCurrentPage(1);
      // No need to clear filters here, fetchSectionData(true) handles specific memory fetching
  };

  const hasActiveFilters = Boolean(searchTerm || dateFrom || dateTo || selectedPerson?.length || selectedTags.length || selectedYears.length);


  // --- Rendering ---
  const renderContent = () => {
    if (isLoading) {
      return (
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
            {Array.from({ length: 15 }).map((_, index) => <DocumentItemSkeleton key={index} />)}
        </div>
      );
    }

    if (error) {
      // Use a more visible error display
      return <div className="text-center text-red-600 bg-red-100 p-4 rounded-md border border-red-300">{error}</div>;
    }

    // Special rendering for full memories view
     if (isShowingFullMemories) {
        if (documents.length === 0) {
            return <p className="text-center text-gray-500 py-10">No memories found for this month in past years.</p>;
        }
        return (
            <>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Memories from {new Date().toLocaleString('default', { month: 'long' })} (Past Years)
                </h2>
                <DocumentList
                    documents={documents} // documents state now holds the full memories list
                    onDocumentClick={handleDocumentClick}
                    apiURL={API_PROXY_URL}
                    onTagSelect={handleTagSelect}
                    isLoading={false}
                    processingDocs={processingDocs} // Show processing status if applicable
                />
            </>
        );
     }

    // Rendering for other sections (Recent, Favorites, Events)
    if (activeSection === 'events') {
      if (events.length === 0) {
        return <p className="text-center text-gray-500 py-10">No events found matching your criteria. (Backend needed)</p>;
      }
      return (
         <div className="space-y-4">
           {events.map(event => (
             <div key={event.event_id} className="bg-white p-4 rounded-lg cursor-pointer hover:bg-gray-100 shadow" onClick={() => handleEventClick(event)}>
                <h3 className="font-semibold text-gray-800">{event.title}</h3>
                <p className="text-sm text-gray-600">{event.date}</p>
                {event.description && <p className="text-sm text-gray-500 mt-1">{event.description}</p>}
             </div>
           ))}
         </div>
      );
    } else { // Recent or Favorites (uses documents state)
       if (documents.length === 0) {
          return <p className="text-center text-gray-500 py-10">
            No documents found matching your criteria.
            {activeSection === 'favorites' && " (Backend needed)"}
         </p>;
       }
      // Pass text color class to DocumentList if needed, or handle in DocumentItem
      return (
        <DocumentList
          documents={documents}
          onDocumentClick={handleDocumentClick}
          apiURL={API_PROXY_URL}
          onTagSelect={handleTagSelect}
          isLoading={false}
          processingDocs={processingDocs}
        />
      );
    }
  };

  const getSectionButtonClass = (section: ActiveSection) => {
    // Consolidated classes for better readability
    const base = "flex items-center px-4 py-2 text-sm font-medium rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100";
    const active = "bg-red-600 text-white";
    const inactive = "bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-red-500";

    const isCurrentlyActive = (isShowingFullMemories && section === 'memories') || (!isShowingFullMemories && section === activeSection);

    return `${base} ${isCurrentlyActive ? active : inactive}`;
  };

  return (
    // Set base background and text color here for the whole page
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Header
        onSearch={handleSearch}
        onClearCache={handleClearCache}
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        selectedPerson={selectedPerson} setSelectedPerson={setSelectedPerson}
        personCondition={personCondition} setPersonCondition={setPersonCondition}
        selectedTags={selectedTags} setSelectedTags={setSelectedTags}
        selectedYears={selectedYears} setSelectedYears={handleYearSelect}
        apiURL={API_PROXY_URL}
        onOpenUploadModal={() => setIsUploadModalOpen(true)}
        isProcessing={processingDocs.length > 0}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Navigation Tabs */}
      <nav className="bg-gray-100 px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-200">
          <div className="flex space-x-4 items-center">
              <button onClick={() => handleSectionChange('recent')} className={getSectionButtonClass('recent')}>
                 <img src="/clock.svg" alt="" className="w-4 h-4 mr-2 inline-block"/>
                 Recently Added
              </button>
              <button onClick={() => handleSectionChange('favorites')} className={getSectionButtonClass('favorites')}>
                 <img src="/star.svg" alt="" className="w-4 h-4 mr-2 inline-block"/>
                 Favorites
              </button>
               <button onClick={() => handleSectionChange('events')} className={getSectionButtonClass('events')}>
                  <img src="/history-calendar.svg" alt="" className="w-4 h-4 mr-2 inline-block"/>
                  Events
              </button>
               {/* "Memories" button now switches to the full memory view */}
               <button onClick={handleMemoryStackClick} className={getSectionButtonClass('memories')}>
                   <img src="/history.svg" alt="" className="w-4 h-4 mr-2 inline-block"/>
                   Memories
               </button>
          </div>
      </nav>

      {/* Main content area */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">

        {renderContent()}

        {/* Pagination - Show only if not loading and more than one page */}
        {!isLoading && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}

         {/* Memory Stack Section - Only shown when NOT viewing full memories */}
         {!isShowingFullMemories && (
             <section className="mt-16 pt-8 border-t border-gray-200">
                 <h2 className="text-xl font-semibold text-gray-700 mb-4">On this month in the past...</h2>
                 {isLoadingMemoryStack ? (
                     // Simple skeleton for the stack area
                     <div className="h-40 w-full max-w-xs bg-gray-200 rounded-lg animate-pulse"></div>
                 ) : memoryStackItems.length > 0 ? (
                     <div className="max-w-xs"> {/* Constrain width */}
                        <MemoriesStack
                            memories={memoryStackItems}
                            apiURL={API_PROXY_URL}
                            onClick={handleMemoryStackClick}
                        />
                     </div>
                 ) : (
                    // Placeholder when no memories found
                    <div className="bg-gray-100 p-6 rounded-lg text-center text-gray-500">
                        No memories found for this month.
                    </div>
                 )}
            </section>
         )}

      </main>

      {/* Modals - Keep dark background for focus */}
      {selectedDoc && (
        <ImageModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          apiURL={API_PROXY_URL}
          onUpdateAbstractSuccess={handleUpdateAbstractSuccess}
        />
      )}
       {selectedVideo && (
        <VideoModal
          doc={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          apiURL={API_PROXY_URL}
        />
      )}
      {selectedPdf && (
        <PdfModal
          doc={selectedPdf}
          onClose={() => setSelectedPdf(null)}
          apiURL={API_PROXY_URL}
        />
      )}
      {isUploadModalOpen && (
        <UploadModal
            onClose={() => {
              setIsUploadModalOpen(false);
               if (activeSection === 'recent' || isShowingFullMemories) {
                    fetchSectionData(isShowingFullMemories);
               }
            }}
            apiURL={API_PROXY_URL}
            onAnalyze={handleAnalyze}
        />
      )}
    </div>
  );
}