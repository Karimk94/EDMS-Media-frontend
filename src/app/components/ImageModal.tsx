import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import { useAnalysis } from '../../hooks/useAnalysis';
import { useDocumentContent } from '../../hooks/useDocumentContent';
import { useDocumentMutations } from '../../hooks/useDocumentMutations';
import { useDownload } from '../../hooks/useDownload';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { ImageModalProps } from '../../interfaces/PropsInterfaces';
import { AnalysisView } from './AnalysisView';
import { CollapsibleSection } from './CollapsibleSection';
import { LoadingButton } from './LoadingButton';
import { ModalNavigationBar } from './ModalNavigationBar';
import { ReadOnlyTagDisplay } from './ReadOnlyTagDisplay';
import { TagEditor } from './TagEditor';
import { useReviewStatus } from '../../hooks/useReviewStatus';
import { useRerunAnalysis } from '../../hooks/useSystemOperations';
import { useToast } from '../context/ToastContext';
import { useDocumentMetadata } from '../../hooks/useDocumentMetadata';

const safeParseDate = (dateString: string): Date | null => {
  if (!dateString || dateString === "N/A") return null;
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

export const ImageModal: React.FC<ImageModalProps> = ({
  doc,
  onClose,
  apiURL,
  onUpdateAbstractSuccess,
  isEditor,
  t,
  lang,
  theme,
  currentDocIndex,
  totalInGroup,
  isGrouped,
  onNavigateNext,
  onNavigatePrevious,
  canNavigateNext,
  canNavigatePrevious,
  searchTerm,
  searchMatchField,
  searchFieldValue,
}) => {
  const focusTrapRef = useFocusTrap(onClose);
  const [view, setView] = useState<'image' | 'analysis'>('image');
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const originalImageBlob = useRef<Blob | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const lastImageSrcRef = useRef<string | null>(null);

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [documentDate, setDocumentDate] = useState<Date | null>(safeParseDate(doc.date));
  const [initialDate, setInitialDate] = useState<Date | null>(safeParseDate(doc.date));

  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [abstract, setAbstract] = useState(doc.abstract || doc.title || '');
  const [initialAbstract, setInitialAbstract] = useState(doc.abstract || doc.title || '');

  const [isFavorite, setIsFavorite] = useState(doc.is_favorite);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const { download, isDownloading } = useDownload();
  const { setDocumentStatus } = useReviewStatus([doc.doc_id], apiURL, isEditor);
  const { mutateAsync: rerunAnalysis } = useRerunAnalysis();
  const { showToast } = useToast();

  const handleMarkVerified = async () => {
    try {
      await setDocumentStatus({ docId: doc.doc_id, status: 'verified' });
      showToast(t('statusUpdated') || 'Status updated successfully', 'success');
    } catch (e: any) {
      showToast(t('errorUpdatingStatus') || 'Error updating status', 'error');
    }
  };

  const handleMarkPending = async () => {
    try {
      await setDocumentStatus({ docId: doc.doc_id, status: 'pending' });
      showToast(t('statusUpdated') || 'Status updated successfully', 'success');
    } catch (e: any) {
      showToast(t('errorUpdatingStatus') || 'Error updating status', 'error');
    }
  };

  const handleRerunAnalysis = async () => {
    try {
      await rerunAnalysis({ docId: doc.doc_id, apiURL });
      showToast(t('analysisQueued') || 'Document queued for analysis', 'success');
    } catch (e: any) {
      showToast(t('errorQueuingAnalysis') || 'Error queuing analysis', 'error');
    }
  };

  useEffect(() => {
    const previousImageSrc = lastImageSrcRef.current;
    lastImageSrcRef.current = null;

    setView('image');
    setAnalysisResult(null);
    originalImageBlob.current = null;
    setImageSrc(null);

    return () => {
      if (previousImageSrc) {
        URL.revokeObjectURL(previousImageSrc);
      }
    };
  }, [doc.doc_id]);

  const { data: imageBlob, isLoading: isFetchingImage, error: imageError } = useDocumentContent(doc.doc_id, {
    responseType: 'blob',
    enabled: !!doc.doc_id
  });

  const getFallbackThumbnailUrl = () => {
    if (doc.thumbnail_url && doc.thumbnail_url.trim()) {
      if (doc.thumbnail_url.startsWith('http')) return doc.thumbnail_url;
      const clean = doc.thumbnail_url.replace(/^\//, '');
      return apiURL ? `${apiURL.replace(/\/+$/, '')}/${clean}` : `/${clean}`;
    }
    const cleanCache = `cache/${doc.doc_id}.jpg`;
    return apiURL ? `${apiURL.replace(/\/+$/, '')}/${cleanCache}` : `/${cleanCache}`;
  };

  useEffect(() => {
    setIsLoading(isFetchingImage);
    if (imageError) {
      setError(imageError.message || 'Failed to load image');
    }
    if (imageBlob) {
      originalImageBlob.current = imageBlob as Blob;
      let isCancelled = false;

      const blobType = (imageBlob as Blob).type?.toLowerCase() || '';
      // If already a browser-supported image format (e.g. backend converted to image/jpeg or native png/webp/gif)
      if (blobType === 'image/jpeg' || blobType === 'image/png' || blobType === 'image/webp' || blobType === 'image/gif') {
        const newUrl = URL.createObjectURL(imageBlob as Blob);
        lastImageSrcRef.current = newUrl;
        setImageSrc(newUrl);
        setIsLoading(false);
        return () => {
          isCancelled = true;
          if (lastImageSrcRef.current) {
            URL.revokeObjectURL(lastImageSrcRef.current);
            lastImageSrcRef.current = null;
          }
        };
      }

      const isHeicOrHeif =
        blobType.includes('heic') ||
        blobType.includes('heif') ||
        /\.(heic|heif)$/i.test(doc.docname || '');

      if (isHeicOrHeif) {
        setIsLoading(true);
        (async () => {
          try {
            const heic2anyModule = await import('heic2any');
            const heic2any: any =
              typeof heic2anyModule === 'function'
                ? heic2anyModule
                : typeof heic2anyModule.default === 'function'
                ? heic2anyModule.default
                : typeof (heic2anyModule.default as any)?.default === 'function'
                ? (heic2anyModule.default as any).default
                : null;

            if (!heic2any) {
              throw new Error('heic2any decoder is not available');
            }

            const converted = await heic2any({
              blob: imageBlob as Blob,
              toType: 'image/jpeg',
              quality: 0.92,
              multiple: false,
            });
            if (isCancelled) return;
            const finalBlob = Array.isArray(converted) ? converted[0] : converted;
            const newUrl = URL.createObjectURL(finalBlob);
            lastImageSrcRef.current = newUrl;
            setImageSrc(newUrl);
          } catch (err) {
            console.warn('HEIC/HEIF client conversion failed, falling back to server preview/thumbnail:', err);
            if (isCancelled) return;
            lastImageSrcRef.current = null;
            setImageSrc(getFallbackThumbnailUrl());
          } finally {
            if (!isCancelled) {
              setIsLoading(false);
            }
          }
        })();
      } else {
        const newUrl = URL.createObjectURL(imageBlob as Blob);
        lastImageSrcRef.current = newUrl;
        setImageSrc(newUrl);
      }

      return () => {
        isCancelled = true;
        if (lastImageSrcRef.current) {
          URL.revokeObjectURL(lastImageSrcRef.current);
          lastImageSrcRef.current = null;
        }
      };
    }
  }, [isFetchingImage, imageError, imageBlob, doc.docname, doc.doc_id, doc.thumbnail_url, apiURL]);

  useEffect(() => {
    setIsFavorite(doc.is_favorite);
  }, [doc.is_favorite]);

  const { data: metaData } = useDocumentMetadata(doc.doc_id, {
    enabled: !!doc.doc_id,
  });

  useEffect(() => {
    setIsEditingAbstract(false);
    setIsEditingDate(false);
  }, [doc.doc_id]);

  useEffect(() => {
    // Authoritative metadata from useDocumentMetadata takes precedence if matched to current doc
    const hasAuthoritativeMeta = metaData && Number(metaData.doc_id) === Number(doc.doc_id);
    const resolvedAbstract = hasAuthoritativeMeta
      ? (metaData.abstract || '')
      : (doc.abstract || doc.title || '');

    const resolvedDate = hasAuthoritativeMeta && metaData.date
      ? safeParseDate(metaData.date)
      : safeParseDate(doc.date);

    if (!isEditingAbstract) {
      setAbstract(resolvedAbstract);
      setInitialAbstract(resolvedAbstract);
    }
    if (!isEditingDate) {
      setDocumentDate(resolvedDate);
      setInitialDate(resolvedDate);
    }
  }, [doc.doc_id, doc.abstract, doc.title, doc.date, metaData, isEditingAbstract, isEditingDate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullScreen) {
          setIsFullScreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isFullScreen]);

  const { analyzeImage } = useAnalysis();

  const handleAnalyze = async () => {
    if (!originalImageBlob.current) return;
    setIsAnalyzing(true);
    setError(null);

    // Create a File object from the blob
    const file = new File([originalImageBlob.current], `${doc.doc_id}.jpg`, { type: 'image/jpeg' });

    try {
      const data = await analyzeImage({ imageFile: file, docId: doc.doc_id });
      setAnalysisResult(data);
      setView('analysis');
    } catch (err: any) {
      setError(`Face Service Error: ${err.message}`);
      setView('image');
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  const { updateMetadata, toggleFavorite } = useDocumentMutations();

  const handleUpdateMetadata = async () => {
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
      if (formattedNewDate !== formattedInitialDate) {
        payload.date_taken = formattedNewDate;
        needsUpdate = true;
      }
    }

    if (!needsUpdate) {
      setIsEditingDate(false);
      setIsEditingAbstract(false);
      return;
    }

    try {
      await updateMetadata(payload);

      if (payload.abstract !== undefined) {
        setInitialAbstract(payload.abstract);
        setAbstract(payload.abstract);
        doc.abstract = payload.abstract;
      }
      if (payload.date_taken !== undefined) {
        setInitialDate(documentDate);
        if (payload.date_taken) doc.date = payload.date_taken;
      }

      setIsEditingDate(false);
      setIsEditingAbstract(false);
      onUpdateAbstractSuccess();
    } catch (err: any) {
      // Error handling managed by hook/global
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavoriteStatus = !isFavorite;
    setIsFavorite(newFavoriteStatus);

    try {
      await toggleFavorite({ docId: doc.doc_id, isFavorite: newFavoriteStatus });
    } catch (error) {
      setIsFavorite(!newFavoriteStatus);
    }
  };

  const handleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const handleDownload = () => {
    download({ docId: doc.doc_id, docname: doc.docname || 'download', apiURL, mediaType: doc.media_type });
  };

  const modalBg = theme === 'dark' ? 'bg-[#282828]' : 'bg-white';
  const textPrimary = theme === 'dark' ? 'text-gray-200' : 'text-gray-900';
  const textSecondary = theme === 'dark' ? 'text-gray-300' : 'text-gray-700';
  const textMuted = theme === 'dark' ? 'text-gray-400' : 'text-gray-600';
  const textHeader = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const inputBg = theme === 'dark' ? 'bg-[#121212]' : 'bg-white';
  const borderSecondary = theme === 'dark' ? 'border-gray-600' : 'border-gray-300';
  const buttonBg = theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200';
  const buttonHoverBg = theme === 'dark' ? 'hover:bg-gray-600' : 'hover:bg-gray-300';
  const buttonText = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const closeButtonColor = theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-900';
  const imageContainerBg = theme === 'dark' ? 'bg-black' : 'bg-gray-100';


  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={onClose}>
      <div ref={focusTrapRef} className={`${modalBg} ${textPrimary} rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative`} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="pt-6 pr-6 pl-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start top-0 z-20 bg-inherit rounded-t-xl">

          {/* Left: Favorite & Title */}
          <div className="flex items-start gap-3 flex-grow min-w-0">
            {/* Favorite Button */}
            <button
              onClick={handleToggleFavorite}
              className={`p-2 rounded-full transition-colors ${isFavorite ? 'bg-black bg-opacity-10' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} flex-shrink-0 mt-0.5`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Image src={isFavorite ? "/icons/star-filled.svg" : "/icons/star-outline.svg"} alt="" width={24} height={24} />
            </button>
            <h2 className={`text-xl font-bold ${textHeader} break-words pt-1 mt-0.5`}>
              {doc.docname.replace(/\.[^/.]+$/, "")}
              <span className="ml-2 text-sm font-normal text-gray-400">File preview</span>
            </h2>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {/* Download Button */}
            {isEditor && (
            <>
              <button onClick={handleMarkVerified} className={`p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors flex items-center`} title={t('markVerified') || 'Mark as Completed'}>
                <Image src="/icons/status-completed.svg" width={24} height={24} alt="" />
              </button>
              <button onClick={handleMarkPending} className={`p-2 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors flex items-center`} title={t('markPending') || 'Mark as Not Analysed'}>
                <Image src="/icons/status-pending.svg" width={24} height={24} alt="" />
              </button>
              <button onClick={handleRerunAnalysis} className={`p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-blue-600 flex items-center`} title={t('rerunAnalysis') || 'Rerun Analysis'}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
              </button>
              <LoadingButton onClick={handleDownload} isLoading={isDownloading} loadingText={null} spinnerSize="sm" className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-2 border-l border-gray-300 dark:border-gray-600 pl-4`} title="Download">
                <Image src="/download.svg" alt="Download" width={24} height={24} className="dark:invert" />
              </LoadingButton>
            </>
            )}

            {/* Full Screen Button */}
            <button onClick={handleFullScreen} className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`} title="Full Screen">
              <Image src="/expand.svg" alt="Full Screen" width={24} height={24} className="dark:invert" />
            </button>

            {/* Close Button */}
            <button onClick={onClose} className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-2`}>
              <Image src="/icons/close.svg" alt="" width={24} height={24} className={`${closeButtonColor.includes('hover:text-white') ? 'invert' : 'dark:invert'}`} />
            </button>
          </div>
        </div>

        {/* Navigation Bar for Collaged Documents */}
        <ModalNavigationBar
          currentDocIndex={currentDocIndex}
          totalInGroup={totalInGroup}
          isGrouped={isGrouped}
          onNavigateNext={onNavigateNext}
          onNavigatePrevious={onNavigatePrevious}
          canNavigateNext={canNavigateNext}
          canNavigatePrevious={canNavigatePrevious}
          searchTerm={searchTerm}
          searchMatchField={searchMatchField}
          searchFieldValue={searchFieldValue}
          lang={lang}
          t={t}
        />

        <div className="p-6">
          {isLoading && (
            <div className="flex flex-col justify-center items-center h-64 gap-4">
              <div className="w-full h-48 skeleton-loader rounded-lg"></div>
              <div className="w-3/4 h-6 skeleton-loader rounded"></div>
              <div className="w-1/2 h-4 skeleton-loader rounded"></div>
            </div>
          )}
          {error && <p className="text-center p-10 text-red-400">{error}</p>}

          {view === 'image' && imageSrc && !error && (
            <div>
              <div
                ref={imageContainerRef}
                className={
                  isFullScreen
                    ? `fixed inset-0 z-[60] bg-black flex items-center justify-center h-full w-full`
                    : `text-center ${imageContainerBg} rounded-lg flex items-center justify-center min-h-[40vh] relative group`
                }
              >
                <div className={
                  isFullScreen
                    ? "relative w-full h-full"
                    : "relative w-full min-h-[40vh] max-h-[60vh]"
                }>
                  <Image src={imageSrc}
                    alt={doc.docname.replace(/\.[^/.]+$/, "")}
                    fill
                    className="object-contain"
                    draggable={false}
                    unoptimized={true}
                    onError={() => {
                      const fallback = getFallbackThumbnailUrl();
                      if (imageSrc !== fallback) {
                        setImageSrc(fallback);
                      }
                    }} />
                </div>
                {isFullScreen && (
                  <button
                    onClick={handleFullScreen}
                    className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors z-[70]"
                  >
                    <Image src="/icons/close.svg" alt="" width={32} height={32} className="invert" />
                  </button>
                )}
              </div>
              <div className="mt-4">
                <CollapsibleSection title={t('details')} theme={theme}>
                  {/* Abstract Section */}
                  {(isEditor || abstract) && (
                    <div className="mb-4">
                      <h3 className={`font-semibold ${textSecondary} mb-1`}>{t('aiDescription')}</h3>
                      {isEditor ? (
                        isEditingAbstract ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={abstract}
                              onChange={(e) => setAbstract(e.target.value)}
                              className={`w-full h-24 px-3 py-2 ${inputBg} ${textPrimary} border ${borderSecondary} rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none`}
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">{t('save')}</button>
                              <button onClick={handleCancelEditAbstract} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700">{t('cancel')}</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between">
                            <p className={`text-sm ${textMuted} mt-1 pr-4 whitespace-pre-wrap break-words`}>{abstract || t('noAbstract')}</p>
                            <button onClick={handleEditAbstract} className={`px-4 py-1 ${buttonBg} ${buttonText} text-xs rounded-md ${buttonHoverBg} flex-shrink-0`}>{t('edit')}</button>
                          </div>
                        )
                      ) : (
                        <p className={`text-sm ${textMuted} mt-1 pr-4 whitespace-pre-wrap break-words`}>{abstract}</p>
                      )}
                    </div>
                  )}

                  {/* Date Taken Section */}
                  <div className="mb-4">
                    <h3 className={`font-semibold ${textSecondary} mb-1`}>{t('dateTaken')}</h3>
                    {isEditor ? (
                      isEditingDate ? (
                        <div className="flex items-center gap-2">
                          <DatePicker
                            selected={documentDate}
                            onChange={handleDateChange}
                            dateFormat="dd/MM/yyyy"
                            className={`w-full px-3 py-2 ${inputBg} ${textPrimary} border ${borderSecondary} rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none`}
                            wrapperClassName="w-full"
                            isClearable
                            placeholderText="Click to select date"
                            autoComplete='off'
                            locale="en-GB"
                          />
                          <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex-shrink-0">{t('save')}</button>
                          <button onClick={handleCancelEditDate} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 flex-shrink-0">{t('cancel')}</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className={`text-sm ${textMuted} p-2 flex-grow`}>
                            {documentDate ? documentDate.toLocaleDateString('en-GB') : t('noDateSet')}
                          </p>
                          <button onClick={handleEditDate} className={`px-4 py-1 ${buttonBg} ${buttonText} text-xs rounded-md ${buttonHoverBg} flex-shrink-0`}>{t('edit')}</button>
                        </div>
                      )
                    ) : (
                      <p className={`text-sm ${textMuted} p-2 flex-grow`}>
                        {documentDate ? documentDate.toLocaleDateString('en-GB') : t('noDateSet')}
                      </p>
                    )}
                  </div>

                  {isEditor ? (
                    <TagEditor docId={doc.doc_id} apiURL={apiURL} lang={lang} theme={theme} t={t} />
                  ) : (
                    <ReadOnlyTagDisplay docId={doc.doc_id} apiURL={apiURL} lang={lang} t={t} />
                  )}
                </CollapsibleSection>
              </div>
              {doc.media_type === 'image' && isEditor && (
                <div className="text-center">
                  <LoadingButton
                    onClick={handleAnalyze}
                    isLoading={isAnalyzing}
                    loadingText={t('processing')}
                    className="mt-6 px-8 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition w-64 h-14 flex items-center justify-center mx-auto disabled:bg-red-800 disabled:cursor-not-allowed"
                  >
                    {t('analyzeForFaces')}
                  </LoadingButton>
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
                onUpdateAbstractSuccess();
                setView('image');
                setAnalysisResult(null);
                setError(null);
              }}
              lang={lang}
              theme={theme}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
  );
};
