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
import HtmlThemeUpdater from './components/HtmlThemeUpdater';
import { Sidebar } from './components/Sidebar';
import { TagFilter } from './components/TagFilter';
import { YearFilter } from './components/YearFilter';
import { AdvancedFilters } from './components/AdvancedFilters';
import { registerLocale } from 'react-datepicker'; 
import { enGB } from 'date-fns/locale/en-GB';

type ActiveSection = 'recent' | 'favorites' | 'events' | 'memories' | 'journey';

interface User {
  username: string;
  security_level: 'Editor' | 'Viewer';
  lang?: 'en' | 'ar';
  theme?: 'light' | 'dark';
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

registerLocale('en-GB', enGB);

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
  const [theme, setTheme] = useState<'light' | 'dark'>('light'); // Add theme state
  const t = useTranslations(lang);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const API_PROXY_URL = '/api';

  useEffect(() => {
    const checkUser = async () => {
      try {
        const response = await fetch('/api/auth/user');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setLang(data.user.lang || 'en');
          setTheme(data.user.theme || 'light'); // Set theme from user data
        } else {
          router.push('/login');
        }
      } catch (err) {
        router.push('/login');
      }
    };
    checkUser();
  }, [router]);

  // Handle theme change and persist to backend
  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    if (!user) return;
    try {
      // Optimistically update UI
      setTheme(newTheme);
      
      // Update backend
      await fetch('/api/user/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      });
      
      // Update user state
      setUser(prevUser => prevUser ? ({ ...prevUser, theme: newTheme }) : null);

    } catch (error) {
      console.error('Failed to update theme', error);
      // Revert on failure (optional)
      setTheme(newTheme === 'light' ? 'dark' : 'light'); 
    }
  };

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
      params.append('lang', lang);

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
              dataKey = 'documents';
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
              `Failed to fetch ${isMemoryFetch ? 'memories' : activeSection
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
          `Failed to fetch ${isMemoryFetch ? 'memories' : activeSection
          }. Is the API ready? ${err.message}`
        );
        setDocuments([]);
        setEvents([]);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
        if (!initialLoadDone) {
          setIsSidebarOpen(false);
          setInitialLoadDone(true);
        }
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
      initialLoadDone,
      lang
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
  }, [fetchSectionData, isShowingFullMemories, currentPage, user, lang]);

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
    if (section === 'memories') {
      handleMemoryStackClick();
    } else if (section !== activeSection || isShowingFullMemories) {
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
    setActiveSection('memories');
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
    dateFrom || dateTo || selectedPerson?.length || selectedTags.length || selectedYears.length
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
        <div className="text-center text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-200 p-4 rounded-md border border-red-300 dark:border-red-700">
          {error}
        </div>
      );
    }

    // --- Full Memories View ---
    if (isShowingFullMemories) {
      if (documents.length === 0) {
        return (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10">
            {t('noMemoriesFound')}
          </p>
        );
      }
      return (
        <>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('memoriesFromPast')}
          </h2>
          <DocumentList
            documents={documents}
            onDocumentClick={handleDocumentClick}
            apiURL={API_PROXY_URL}
            onTagSelect={handleTagSelect}
            isLoading={false}
            processingDocs={processingDocs}
            onToggleFavorite={handleToggleFavorite}
            lang={lang}
          />
        </>
      );
    }

    // --- Events View ---
    if (activeSection === 'events') {
      if (events.length === 0) {
        return (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10">
            {t('noDocumentsFound')}
          </p>
        );
      }
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-8">
          {events.map((event) => (
            <EventStack
              key={event.id}
              event={event}
              apiURL={API_PROXY_URL}
              onClick={() => handleEventClick(event.id)}
            />
          ))}
        </div>
      );
    }

    else {
      if (documents.length === 0) {
        return (
          <p className="text-center text-gray-500 dark:text-gray-400 py-10">
            {t('noDocumentsFound')}
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
          lang={lang}
        />
      );
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
        <div>{t('loading')}</div>
      </div>
    );
  }

  const rtlMainClass = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <>
      <HtmlLangUpdater lang={lang} />
      <HtmlThemeUpdater theme={theme} />
      <div className={`flex flex-col h-screen ${rtlMainClass}`}>
        <Header
          onSearch={handleSearch}
          onClearCache={handleClearCache}
          apiURL={API_PROXY_URL}
          onOpenUploadModal={() => setIsUploadModalOpen(true)}
          isProcessing={processingDocs.length > 0}
          onLogout={handleLogout}
          isEditor={user.security_level === 'Editor'}
          lang={lang}
          setLang={setLang}
          t={t}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          theme={theme}
          onThemeChange={handleThemeChange}
        />

        <div className={`flex flex-1 overflow-hidden ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
          <Sidebar
            isSidebarOpen={isSidebarOpen}
            activeSection={activeSection}
            handleSectionChange={handleSectionChange}
            isShowingFullMemories={isShowingFullMemories}
            t={t}
            lang={lang}
          />

          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-[#1f1f1f] text-gray-900 dark:text-gray-100 p-4 sm:p-6 lg:p-8 min-w-0">

            {activeSection !== 'journey' && !isShowingFullMemories && (
              <div className={`flex items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700 justify-end ${lang === 'ar' ? 'flex-row-reverse' : ''}`}>
                <TagFilter
                  apiURL={API_PROXY_URL}
                  selectedTags={selectedTags}
                  setSelectedTags={(tags) => {
                    setSelectedTags(tags);
                    setCurrentPage(1);
                  }}
                  t={t}
                  lang={lang}
                />
                <YearFilter
                  selectedYears={selectedYears}
                  setSelectedYears={(years) => {
                    setSelectedYears(years);
                    setCurrentPage(1);
                  }}
                  t={t}
                />
                <AdvancedFilters
                  dateFrom={dateFrom}
                  setDateFrom={(date) => {
                    setDateFrom(date);
                    setCurrentPage(1);
                  }}
                  dateTo={dateTo}
                  setDateTo={(date) => {
                    setDateTo(date);
                    setCurrentPage(1);
                  }}
                  selectedPerson={selectedPerson}
                  setSelectedPerson={(person) => {
                    setSelectedPerson(person);
                    setCurrentPage(1);
                  }}
                  personCondition={personCondition}
                  setPersonCondition={(condition) => {
                    setPersonCondition(condition);
                    setCurrentPage(1);
                  }}
                  apiURL={API_PROXY_URL}
                  t={t}
                  lang={lang}
                  theme={theme}
                />
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="px-3 py-2 bg-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-red-900 dark:hover:text-red-300 transition flex items-center gap-1"
                    title="Clear all active filters"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {t('clearFilters')}
                  </button>
                )}
              </div>
            )}

            {/* --- Main Content --- */}
            {activeSection === 'journey' ? (
              <Journey apiURL={API_PROXY_URL} t={t} />
            ) : (
              renderContent()
            )}

            {/* --- Pagination (conditonal) --- */}
            {activeSection !== 'journey' && !isLoading && totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                t={t}
              />
            )}

            {/* --- Memories Stack (conditional) --- */}
            {activeSection !== 'journey' && !isShowingFullMemories && (
              <section className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4">
                  {t('memoriesFromPast')}
                </h2>
                {isLoadingMemoryStack ? (
                  <div className="h-40 w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                ) : memoryStackItems.length > 0 ? (
                  <div className="max-w-xs">
                    <MemoriesStack
                      memories={memoryStackItems}
                      apiURL={API_PROXY_URL}
                      onClick={handleMemoryStackClick}
                    />
                  </div>
                ) : (
                  <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg text-center text-gray-500 dark:text-gray-400">
                    {t('noMemoriesFound')}
                  </div>
                )}
              </section>
            )}
          </main>
        </div>

        {/* Modals */}
        {selectedDoc && <ImageModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} apiURL={API_PROXY_URL} onUpdateAbstractSuccess={handleUpdateMetadataSuccess} onToggleFavorite={handleToggleFavorite} isEditor={user?.security_level === 'Editor'} t={t} lang={lang} theme={theme} />}
        {selectedVideo && <VideoModal doc={selectedVideo} onClose={() => setSelectedVideo(null)} apiURL={API_PROXY_URL} onUpdateAbstractSuccess={handleUpdateMetadataSuccess} onToggleFavorite={handleToggleFavorite} isEditor={user?.security_level === 'Editor'} t={t} lang={lang} theme={theme} />}
        {selectedPdf && <PdfModal doc={selectedPdf} onClose={() => setSelectedPdf(null)} apiURL={API_PROXY_URL} onUpdateAbstractSuccess={handleUpdateMetadataSuccess} onToggleFavorite={handleToggleFavorite} isEditor={user?.security_level === 'Editor'} t={t} lang={lang} theme={theme} />}
        {isUploadModalOpen && user?.security_level === 'Editor' && <UploadModal onClose={() => setIsUploadModalOpen(false)} apiURL={API_PROXY_URL} onAnalyze={handleAnalyze} theme={theme} />}
        <EventDocumentModal
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          initialEventId={selectedEventIdForModal}
          initialEventName={selectedEventNameForModal}
          apiURL={API_PROXY_URL}
          theme={theme}
        />
      </div>
    </>
  );
}