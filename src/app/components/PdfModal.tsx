import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import { useDocumentMutations } from '../../hooks/useDocumentMutations';
import { useDownload } from '../../hooks/useDownload';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { PdfModalProps } from '../../interfaces/PropsInterfaces';
import { LoadingButton } from './LoadingButton';
import { ModalNavigationBar } from './ModalNavigationBar';
import { ReadOnlyTagDisplay } from './ReadOnlyTagDisplay';
import { TagEditor } from './TagEditor';

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

export const PdfModal: React.FC<PdfModalProps> = ({
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
  const [isDetailsVisible, setIsDetailsVisible] = useState(true);

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [documentDate, setDocumentDate] = useState<Date | null>(safeParseDate(doc.date));
  const [initialDate, setInitialDate] = useState<Date | null>(safeParseDate(doc.date));

  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [abstract, setAbstract] = useState(doc.title || '');
  const [initialAbstract, setInitialAbstract] = useState(doc.title || '');

  const [isFavorite, setIsFavorite] = useState(doc.is_favorite);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const { download, isDownloading } = useDownload();

  useEffect(() => {
    setIsFavorite(doc.is_favorite);
  }, [doc.is_favorite]);

  useEffect(() => {
    setAbstract(doc.title || '');
    setInitialAbstract(doc.title || '');
    const newDate = safeParseDate(doc.date);
    setDocumentDate(newDate);
    setInitialDate(newDate);
    setIsEditingAbstract(false);
    setIsEditingDate(false);
  }, [doc.title, doc.date]);

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

      if (payload.abstract !== undefined) setInitialAbstract(payload.abstract);
      if (payload.date_taken !== undefined) setInitialDate(documentDate);

      setIsEditingDate(false);
      setIsEditingAbstract(false);
      onUpdateAbstractSuccess();
    } catch (err: any) {
      // Error handling is managed by the hook or globally, but we can keep local state integrity if needed
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 md:p-8" role="dialog" aria-modal="true" aria-label="PDF viewer" onClick={onClose}>
      <div ref={focusTrapRef} className="bg-white dark:bg-[#282828] text-gray-900 dark:text-gray-200 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="pt-6 pr-6 pl-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start top-0 z-20 bg-inherit rounded-t-xl">

          {/* Left: Favorite & Title */}
          <div className="flex items-start gap-3 flex-grow min-w-0">
            {/* Favorite Button */}
            <button
              onClick={handleToggleFavorite}
              className="text-gray-600 dark:text-white hover:text-yellow-400 p-1 flex-shrink-0 mt-0.5"
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Image src={isFavorite ? "/icons/star-filled.svg" : "/icons/star-outline.svg"} alt="" width={24} height={24} />
            </button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white break-words pt-1 mt-0.5">
              {doc.docname ? doc.docname.replace(/\.[^/.]+$/, "") : "Unknown Document"}
              <span className="ml-2 text-sm font-normal text-gray-400">File preview</span>
            </h2>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {/* Download Button */}
            {isEditor && (
            <LoadingButton onClick={handleDownload} isLoading={isDownloading} loadingText={null} spinnerSize="sm" className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors" title="Download">
              <Image src="/download.svg" alt="Download" width={24} height={24} className="dark:invert" />
            </LoadingButton>
            )}

            {/* Full Screen Button */}
            <button onClick={handleFullScreen} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors" title="Full Screen">
              <Image src="/expand.svg" alt="Full Screen" width={24} height={24} className="dark:invert" />
            </button>

            {/* Details Toggle Button */}
            <button
              onClick={() => setIsDetailsVisible(!isDetailsVisible)}
              className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              title={isDetailsVisible ? "Hide Details" : "Show Details"}
            >
              <Image src="/icons/info.svg" alt="" width={24} height={24} className="dark:invert" />
            </button>

            {/* Close Button */}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white ml-2 p-1"><Image src="/icons/close.svg" alt="" width={24} height={24} className="dark:invert" /></button>
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
          t={t}
        />

        {/* Content Area */}
        <div className={`flex-grow p-4 grid ${isDetailsVisible ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'} gap-4 min-h-0 transition-all duration-300`}>
          {/* PDF Viewer */}
          <div ref={pdfContainerRef} className={`${isFullScreen ? 'fixed inset-0 z-[60]' : (isDetailsVisible ? 'md:col-span-2' : 'col-span-1')} h-full bg-white rounded-lg`}>
            <iframe
              src={`${apiURL}/pdf/${doc.doc_id}`}
              className="w-full h-full border-0 rounded-lg"
              title={doc.docname ? doc.docname.replace(/\.[^/.]+$/, "") : "PDF Document"}
            />
            {isFullScreen && (
              <button
                onClick={handleFullScreen}
                className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors z-[70]"
              >
                <Image src="/icons/close.svg" alt="" width={32} height={32} className="invert" />
              </button>
            )}
          </div>

          {/* Details Panel */}
          <div className={`transition-all duration-300 ${isDetailsVisible ? 'md:col-span-1 opacity-100' : 'hidden opacity-0'} p-4 bg-gray-50 dark:bg-[#1f1f1f] rounded-lg overflow-y-auto`}>
            {/* Abstract Section */}
            {(isEditor || abstract) && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('aiDescription')}</h3>
                {isEditor ? (
                  isEditingAbstract ? (
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={abstract}
                        onChange={(e) => setAbstract(e.target.value)}
                        className="w-full h-24 px-3 py-2 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={handleUpdateMetadata} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">{t('save')}</button>
                        <button onClick={handleCancelEditAbstract} className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700">{t('cancel')}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 pr-4">{abstract || 'No abstract available.'}</p>
                      <button onClick={handleEditAbstract} className="px-4 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-xs rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex-shrink-0">{t('edit')}</button>
                    </div>
                  )
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 pr-4">{abstract}</p>
                )}
              </div>
            )}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('dateTaken')}</h3>
              {isEditor ? (
                isEditingDate ? (
                  <div className="flex items-center gap-2">
                    <DatePicker
                      selected={documentDate}
                      onChange={handleDateChange}
                      dateFormat="dd/MM/yyyy"
                      className="w-full px-3 py-2 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
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
                    <p className="text-sm text-gray-600 dark:text-gray-400 p-2 flex-grow">
                      {documentDate ? documentDate.toLocaleDateString('en-GB') : 'No date set'}
                    </p>
                    <button onClick={handleEditDate} className="px-4 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-xs rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 flex-shrink-0">{t('edit')}</button>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 p-2 flex-grow">
                  {documentDate ? documentDate.toLocaleDateString('en-GB') : 'No date set'}
                </p>
              )}
            </div>
            {isEditor ? (
              <TagEditor docId={doc.doc_id} apiURL={apiURL} lang={lang} theme={theme} t={t} />
            ) : (
              <ReadOnlyTagDisplay docId={doc.doc_id} apiURL={apiURL} lang={lang} t={t} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
