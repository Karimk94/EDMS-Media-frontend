"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { MemoriesStack } from './components/MemoriesStack';
import { EventStack, EventItem as EventStackItem } from './components/EventStack';
import { EventDocumentModal } from './components/EventDocumentModal';
import { Journey } from './components/Journey';
import { useTranslations } from './hooks/useTranslations';
import HtmlLangUpdater from './components/HtmlLangUpdater';

type ActiveSection = 'recent' | 'favorites' | 'events' | 'memories' | 'journey';

interface User {
  username: string;
  security_level: 'Editor' | 'Viewer';
  lang?: 'en' | 'ar';
}

interface PersonOption {
  value: number;
  label: string;
}

const formatToApiDateTime = (date: Date | null): string => {
  if (!date) return '';
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}`;
};

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<ActiveSection>('recent');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [events, setEvents] = useState<EventStackItem[]>([]);
  const [memoryStackItems, setMemoryStackItems] = useState<Document[]>([]);
  const [isShowingFullMemories, setIsShowingFullMemories] =
    useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMemoryStack, setIsLoadingMemoryStack] =
    useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<PersonOption[] | null>(
    null
  );
  const [personCondition, setPersonCondition] = useState<'any' | 'all'>('any');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);

  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Document | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<Document | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [processingDocs, setProcessingDocs] = useState<number[]>([]);

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEventIdForModal, setSelectedEventIdForModal] = useState<number | null>(null);
  const [selectedEventNameForModal, setSelectedEventNameForModal] = useState<string>('');

  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const t = useTranslations(lang);

  const API_PROXY_URL = '/api';

useEffect(() => {
    const checkUser = async () => {
      try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setLang(data.user.lang || 'en');
        } else {
          router.push('/login');
        }
      } catch (err) {
        router.push('/login');
      }
    };
    checkUser();
  }, [router]);

  const fetchSectionData = useCallback(
    async (isMemoryFetch = false) => {
      if (!isLoadingMemoryStack || isMemoryFetch || activeSection === 'events') {
          setIsLoading(true);
      }
      setError(null);
      if (activeSection === 'events') {
          setEvents([]);
      } else {
          setDocuments([]);
      }

      let url: URL;
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('pageSize', '20');

      if (!isMemoryFetch) {
        if (searchTerm) params.append('search', searchTerm);
        if (selectedPerson && selectedPerson.length > 0) {
          const personNames = selectedPerson
            .map((p) => p.label.split(' - ')[0])
            .join(',');
          params.append('persons', personNames);
          if (selectedPerson.length > 1) {
            params.append('person_condition', personCondition);
          }
        }
        if (selectedTags.length > 0) {
          params.append('tags', selectedTags.join(','));
        }
        const formattedDateFrom = formatToApiDateTime(dateFrom);
        if (formattedDateFrom) params.append('date_from', formattedDateFrom);
        const formattedDateTo = formatToApiDateTime(dateTo);
        if (formattedDateTo) params.append('date_to', formattedDateTo);
        if (selectedYears.length > 0) {
          params.append('years', selectedYears.join(','));
        }
      } else {
        const now = new Date();
        params.append('memoryMonth', String(now.getMonth() + 1));
        params.append('sort', 'rtadocdate_desc'); 
      }

      try {
        let endpoint = '';
        let dataSetter: React.Dispatch<React.SetStateAction<any[]>> =
          setDocuments;
        let dataKey = 'documents';
        let totalPagesKey = 'total_pages';

        if (isMemoryFetch) {
          endpoint = '/documents';
          dataSetter = setDocuments as React.Dispatch<React.SetStateAction<Document[]>>;
          dataKey = 'documents';
        } else {
          switch (activeSection) {
            case 'recent':
              endpoint = '/documents';
              params.append('sort', 'date_desc');
              dataSetter = setDocuments as React.Dispatch<React.SetStateAction<Document[]>>;
              dataKey = 'documents';
              break;
            case 'favorites':
              endpoint = '/favorites';
              dataSetter = setDocuments as React.Dispatch<React.SetStateAction<Document[]>>;
              dataKey = 'favorites';
              break;
            case 'events':
              endpoint = '/events';
              dataSetter = setEvents as React.Dispatch<React.SetStateAction<EventStackItem[]>>;
              dataKey = 'events'; 
              params.append('fetch_all', 'false');
              break;
              case 'journey':
              endpoint = '/journey';
              dataSetter = setDocuments as React.Dispatch<React.SetStateAction<Document[]>>;
              dataKey = 'events'; 
              break;
            default:
              throw new Error(`Invalid section: ${activeSection}`);
          }
        }

        if (endpoint) {
          url = new URL(`${API_PROXY_URL}${endpoint}`, window.location.origin);
          url.search = params.toString();

          const response = await fetch(url);
          if (!response.ok)
            throw new Error(
              `Failed to fetch ${
                isMemoryFetch ? 'memories' : activeSection
              }. Status: ${response.status}`
            );
          const data = await response.json();

          dataSetter(data[dataKey] || []);
          setTotalPages(data[totalPagesKey] || 1);
        } else if (!isMemoryFetch) {
          setDocuments([]);
          setEvents([]);
          setTotalPages(1);
        }
      } catch (err: any) {
        console.error(
          `Error fetching ${isMemoryFetch ? 'memories detail' : activeSection}:`,
          err
        );
        setError(
          `Failed to fetch ${
            isMemoryFetch ? 'memories' : activeSection
          }. Is the API ready? ${err.message}`
        );
        setDocuments([]);
        setEvents([]);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeSection,
      currentPage,
      searchTerm,
      dateFrom,
      dateTo,
      selectedPerson,
      personCondition,
      selectedTags,
      selectedYears,
      isLoadingMemoryStack,
    ]
  );

  // --- fetchMemoryStack ---
   const fetchMemoryStack = async () => {
    setIsLoadingMemoryStack(true);
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const url = new URL(`${API_PROXY_URL}/memories`, window.location.origin);
      url.searchParams.append('month', String(month));
      url.searchParams.append('limit', '5');

      const response = await fetch(url);
      if (!response.ok)
        throw new Error('Failed to fetch memory stack items.');
      const data = await response.json();
      setMemoryStackItems(data.memories || []);
    } catch (err: any) {
      console.error('Error fetching memory stack:', err);
      setMemoryStackItems([]);
    } finally {
      setIsLoadingMemoryStack(false);
    }
  };

   useEffect(() => {
    if (user) {
      if (isShowingFullMemories) {
        fetchSectionData(true);
      } else {
        fetchSectionData(false);
      }
    }
  }, [fetchSectionData, isShowingFullMemories, currentPage, user]);

  useEffect(() => {
    if (user) {
      fetchMemoryStack();
    }
  }, [user]);

   useEffect(() => {
    if (user) {
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
    }
  }, [user]);

  useEffect(() => {
    if (user) {
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
            console.error(
              'Processing status check failed:',
              response.statusText
            );
            return;
          }
          const data = await response.json();
          const stillProcessing = data.processing || [];

          if (
            JSON.stringify(stillProcessing.sort()) !==
            JSON.stringify(processingDocs.sort())
          ) {
            setProcessingDocs(stillProcessing);
            if (stillProcessing.length === 0) {
              clearInterval(interval);
              if (activeSection === 'recent' || activeSection === 'events' || isShowingFullMemories) {
                fetchSectionData(isShowingFullMemories);
              }
            }
          } else if (stillProcessing.length === 0) {
            clearInterval(interval);
            setProcessingDocs([]);
          }
        } catch (error) {
          console.error('Error checking processing status:', error);
        }
      }, 7000);
      return () => clearInterval(interval);
    }
  }, [
    processingDocs,
    fetchSectionData,
    activeSection,
    isShowingFullMemories,
    user,
  ]);

   const handleSearch = (newSearchTerm: string) => {
    setIsShowingFullMemories(false);
    setSearchTerm(newSearchTerm);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setIsShowingFullMemories(false);
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
        const response = await fetch(`${API_PROXY_URL}/clear_cache`, {
          method: 'POST',
        });
        if (!response.ok)
          throw new Error(`Cache clear failed: ${response.statusText}`);
        window.alert('Thumbnail cache cleared.');
        fetchSectionData(isShowingFullMemories);
        fetchMemoryStack();
      } catch (err: any) {
        console.error('Cache clear error:', err);
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

  const handleEventClick = (eventId: number) => {
    const clickedEvent = events.find(e => e.id === eventId);
    if (clickedEvent) {
        setSelectedEventIdForModal(eventId);
        setSelectedEventNameForModal(clickedEvent.name);
        setIsEventModalOpen(true);
    } else {
        console.warn(`Could not find event details for ID: ${eventId}`);
    }
  };

  const handleTagSelect = (tag: string) => {
    setIsShowingFullMemories(false);
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
    setCurrentPage(1);
  };

  const handleYearSelect = (years: number[]) => {
    setIsShowingFullMemories(false);
    setSelectedYears(years);
    setCurrentPage(1);
  };

  const handleUpdateMetadataSuccess = () => {
    fetchSectionData(isShowingFullMemories);
    const updatedDocId = selectedDoc?.doc_id || selectedVideo?.doc_id || selectedPdf?.doc_id;
    if (updatedDocId && memoryStackItems.some((item) => item.doc_id === updatedDocId)) {
      fetchMemoryStack();
    }
    setSelectedDoc(null);
    setSelectedVideo(null);
    setSelectedPdf(null);
  };

  const handleAnalyze = (uploadedFiles: UploadableFile[]) => {
    const docnumbers = uploadedFiles.map((f) => f.docnumber!).filter(Boolean);
    setIsUploadModalOpen(false);
    const newProcessingDocs = Array.from(new Set([...processingDocs, ...docnumbers]));
    setProcessingDocs(newProcessingDocs);
    setIsShowingFullMemories(false);
    setActiveSection('recent');
    setCurrentPage(1);
    fetch(`${API_PROXY_URL}/process_uploaded_documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docnumbers }),
    }).catch((error) => {
      console.error('Error initiating processing:', error);
      setProcessingDocs((prev) => prev.filter((d) => !docnumbers.includes(d)));
    });
  };

  const handleMemoryStackClick = () => {
    setIsShowingFullMemories(true);
    setCurrentPage(1);
  };

  const handleToggleFavorite = async (docId: number, isFavorite: boolean) => {
    try {
      const response = await fetch(`${API_PROXY_URL}/favorites/${docId}`, {
        method: isFavorite ? 'POST' : 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to update favorite status');
      }
      if (activeSection === 'favorites' || activeSection === 'recent') {
          setDocuments(
            documents.map((d) =>
              d.doc_id === docId ? { ...d, is_favorite: isFavorite } : d
            )
          );
      }
      if (activeSection === 'favorites' && !isFavorite) {
          fetchSectionData(false);
      }
       setMemoryStackItems(
           memoryStackItems.map(m => m.doc_id === docId ? { ...m, is_favorite: isFavorite } : m)
       );
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        setUser(null);
        router.push('/login');
      } else {
        console.error('Logout failed');
        alert('Logout failed. Please try again.');
      }
    } catch (error) {
      console.error('Error during logout:', error);
      alert('An error occurred during logout.');
    }
  };

  const hasActiveFilters = Boolean(
    searchTerm || dateFrom || dateTo || selectedPerson?.length || selectedTags.length || selectedYears.length
  );

  // --- renderContent ---
    const renderContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
          {Array.from({ length: 15 }).map((_, index) => (
            <DocumentItemSkeleton key={index} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-600 bg-red-100 p-4 rounded-md border border-red-300">
          {error}
        </div>
      );
    }

    // --- Full Memories View ---
    if (isShowingFullMemories) {
      if (documents.length === 0) {
        return (
          <p className="text-center text-gray-500 py-10">
            No memories found for this month in past years.
          </p>
        );
      }
      return (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Memories from{' '}
            {new Date().toLocaleString('default', { month: 'long' })} (Past
            Years)
          </h2>
          <DocumentList
            documents={documents}
            onDocumentClick={handleDocumentClick}
            apiURL={API_PROXY_URL}
            onTagSelect={handleTagSelect}
            isLoading={false}
            processingDocs={processingDocs}
            onToggleFavorite={handleToggleFavorite}
          />
        </>
      );
    }

    // --- Events View ---
    if (activeSection === 'events') {
      if (events.length === 0) {
        return (
          <p className="text-center text-gray-500 py-10">
            No events with linked documents found matching your criteria.
          </p>
        );
      }
      // Render a grid of EventStack components
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
          {events.map((event) => (
            <EventStack
              key={event.id}
              event={event}
              apiURL={API_PROXY_URL}
              onClick={handleEventClick}
            />
          ))}
        </div>
      );
    }

    // --- Default: Recent or Favorites (Document List) ---
    else {
      if (documents.length === 0) {
        return (
          <p className="text-center text-gray-500 py-10">
            No documents found matching your criteria.
          </p>
        );
      }
      return (
        <DocumentList
          documents={documents}
          onDocumentClick={handleDocumentClick}
          apiURL={API_PROXY_URL}
          onTagSelect={handleTagSelect}
          isLoading={false}
          processingDocs={processingDocs}
          onToggleFavorite={handleToggleFavorite}
        />
      );
    }
  };

  // --- getSectionButtonClass ---
   const getSectionButtonClass = (section: ActiveSection) => {
    const base =
      'flex items-center px-4 py-2 text-sm font-medium rounded-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100';
    const active = 'bg-red-600 text-white';
    const inactive =
      'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-red-500';

    const isCurrentlyActive =
      (isShowingFullMemories && section === 'memories') ||
      (!isShowingFullMemories && section === activeSection);

    return `${base} ${isCurrentlyActive ? active : inactive}`;
  };

  // --- Main return ---
  if (!user) return null; // Or loading

return (
  <>
  <HtmlLangUpdater lang={lang} />
  <div className="min-h-screen bg-gray-50 text-gray-900">
    {user && <Header
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
      onLogout={handleLogout}
      isEditor={user.security_level === 'Editor'}
      lang={lang}
      setLang={setLang}
      t={t}
      />}

    <nav className="bg-gray-100 px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-200">
      <div className="flex space-x-4 items-center">
           <button onClick={() => handleSectionChange('recent')} className={getSectionButtonClass('recent')}>
              <img src="/clock.svg" alt="" className="w-4 h-4 mr-2 inline-block" style={{ filter: activeSection === 'recent' && !isShowingFullMemories ? 'brightness(0) invert(1)' : 'none' }} /> {t('recentlyAdded')}
          </button>
          <button onClick={() => handleSectionChange('favorites')} className={getSectionButtonClass('favorites')}>
              <img src="/star.svg" alt="" className="w-4 h-4 mr-2 inline-block" style={{ filter: activeSection === 'favorites' && !isShowingFullMemories ? 'brightness(0) invert(1)' : 'none' }} /> {t('favorites')}
          </button>
          <button onClick={() => handleSectionChange('events')} className={getSectionButtonClass('events')}>
              <img src="/history-calendar.svg" alt="" className="w-4 h-4 mr-2 inline-block" style={{ filter: activeSection === 'events' && !isShowingFullMemories ? 'brightness(0) invert(1)' : 'none' }} /> {t('events')}
          </button>
          <button onClick={handleMemoryStackClick} className={getSectionButtonClass('memories')}>
              <img src="/history.svg" alt="" className="w-4 h-4 mr-2 inline-block" style={{ filter: isShowingFullMemories ? 'brightness(0) invert(1)' : 'none' }} /> {t('memories')}
          </button>
          <button onClick={() => handleSectionChange('journey')} className={getSectionButtonClass('journey')}>
              <img src="/journey.svg" alt="" className="w-4 h-4 mr-2 inline-block" style={{ filter: activeSection === 'journey' ? 'brightness(0) invert(1)' : 'none' }} /> {t('journey')}
          </button>
      </div>
    </nav>

    <main className="px-4 sm:px-6 lg:px-8 py-8">
      {activeSection === 'journey' ? (
        <Journey apiURL={API_PROXY_URL} />
      ) : (
        renderContent()
      )}

      {activeSection !== 'journey' && !isLoading && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          t={t}
        />
      )}

       {activeSection !== 'journey' && !isShowingFullMemories && (
        <section className="mt-16 pt-8 border-t border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            On this month in the past...
          </h2>
          {isLoadingMemoryStack ? (
            <div className="h-40 w-full max-w-xs bg-gray-200 rounded-lg animate-pulse"></div>
          ) : memoryStackItems.length > 0 ? (
            <div className="max-w-xs">
              <MemoriesStack
                memories={memoryStackItems}
                apiURL={API_PROXY_URL}
                onClick={handleMemoryStackClick}
              />
            </div>
          ) : (
            <div className="bg-gray-100 p-6 rounded-lg text-center text-gray-500">
              No memories found for this month.
            </div>
          )}
        </section>
      )}
    </main>

     {selectedDoc && <ImageModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} apiURL={API_PROXY_URL} onUpdateAbstractSuccess={handleUpdateMetadataSuccess} onToggleFavorite={handleToggleFavorite} isEditor={user?.security_level === 'Editor'} t={t} />}
     {selectedVideo && <VideoModal doc={selectedVideo} onClose={() => setSelectedVideo(null)} apiURL={API_PROXY_URL} onUpdateAbstractSuccess={handleUpdateMetadataSuccess} onToggleFavorite={handleToggleFavorite} isEditor={user?.security_level === 'Editor'} t={t}/>}
     {selectedPdf && <PdfModal doc={selectedPdf} onClose={() => setSelectedPdf(null)} apiURL={API_PROXY_URL} onUpdateAbstractSuccess={handleUpdateMetadataSuccess} onToggleFavorite={handleToggleFavorite} isEditor={user?.security_level === 'Editor'} t={t}/>}
     {isUploadModalOpen && user?.security_level === 'Editor' && <UploadModal onClose={() => setIsUploadModalOpen(false)} apiURL={API_PROXY_URL} onAnalyze={handleAnalyze} />}

     <EventDocumentModal
       isOpen={isEventModalOpen}
       onClose={() => setIsEventModalOpen(false)}
       initialEventId={selectedEventIdForModal}
       initialEventName={selectedEventNameForModal}
       apiURL={API_PROXY_URL}
     />
  </div>
  </>
);
}
