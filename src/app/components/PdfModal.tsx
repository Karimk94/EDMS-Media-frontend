import React, { useState, useEffect } from 'react';
import { Document } from './DocumentItem';
import { TagEditor } from './TagEditor';
import { EventEditor } from './EventEditor';
import DatePicker from 'react-datepicker';
import { ReadOnlyTagDisplay } from './ReadOnlyTagDisplay';
import { ReadOnlyEventDisplay } from './ReadOnlyEventDisplay';

interface EventOption {
  value: number;
  label: string;
}

interface PdfModalProps {
  doc: Document;
  onClose: () => void;
  apiURL: string;
  onUpdateAbstractSuccess: () => void;
  onToggleFavorite: (docId: number, isFavorite: boolean) => void;
  isEditor: boolean;
  t: Function;
  lang: 'en' | 'ar';
  theme: 'light' | 'dark';
}

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

export const PdfModal: React.FC<PdfModalProps> = ({ doc, onClose, apiURL, onUpdateAbstractSuccess, onToggleFavorite, isEditor, t, lang, theme }) => {
  const [isDetailsVisible, setIsDetailsVisible] = useState(true);

  const [isEditingDate, setIsEditingDate] = useState(false);
  const [documentDate, setDocumentDate] = useState<Date | null>(safeParseDate(doc.date));
  const [initialDate, setInitialDate] = useState<Date | null>(safeParseDate(doc.date));

  const [isEditingAbstract, setIsEditingAbstract] = useState(false);
  const [abstract, setAbstract] = useState(doc.title || '');
  const [initialAbstract, setInitialAbstract] = useState(doc.title || '');

  const [isFavorite, setIsFavorite] = useState(doc.is_favorite);
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null);

  useEffect(() => {
    const fetchDocumentEvent = async () => {
      try {
        const response = await fetch(`${apiURL}/document/${doc.doc_id}/event`);
        if (response.ok) {
          const eventData = await response.json();
          if (eventData && eventData.event_id && eventData.event_name) {
            setSelectedEvent({ value: eventData.event_id, label: eventData.event_name });
          } else {
            setSelectedEvent(null);
          }
        } else if (response.status !== 404) {
          console.error(`Failed to fetch document event (${response.status}):`, await response.text());
        } else {
          setSelectedEvent(null);
        }
      } catch (err) {
        console.error("Network or parsing error fetching document event:", err);
        setSelectedEvent(null);
      }
    };
    setSelectedEvent(null);
    fetchDocumentEvent();
  }, [doc.doc_id, apiURL]);

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
      const response = await fetch(`${apiURL}/update_metadata`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error((await response.json()).error || 'Failed to update metadata');
      const resultMessage = await response.json();

      if (payload.abstract !== undefined) setInitialAbstract(payload.abstract);
      if (payload.date_taken !== undefined) setInitialDate(documentDate);

      setIsEditingDate(false);
      setIsEditingAbstract(false);
      onUpdateAbstractSuccess();
    } catch (err: any) {
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavoriteStatus = !isFavorite;
    setIsFavorite(newFavoriteStatus);
    onToggleFavorite(doc.doc_id, newFavoriteStatus);
  };

  const handleEventChangeInModal = async (docIdParam: number, eventId: number | null): Promise<boolean> => {
    try {
      const response = await fetch(`${apiURL}/document/${docIdParam}/event`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update event association');
      }
      return true;
    } catch (error: any) {
      console.error('Failed to update event association:', error);
      return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 md:p-8" onClick={onClose}>
      <div className="bg-white dark:bg-[#282828] text-gray-900 dark:text-gray-200 rounded-xl w-full max-w-6xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 relative flex-shrink-0 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {/* Favorite Button */}
            <button
              onClick={handleToggleFavorite}
              className="text-gray-600 dark:text-white hover:text-yellow-400 p-1"
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <svg className={`w-6 h-6 ${isFavorite ? 'text-yellow-400' : 'text-gray-400 dark:text-gray-300'}`} fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={isFavorite ? 1 : 2}
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01 .321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5Z"
                />               </svg>
            </button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{doc.docname.replace(/\.[^/.]+$/, "")}</h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Details Toggle Button */}
            <button
              onClick={() => setIsDetailsVisible(!isDetailsVisible)}
              className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
              title={isDetailsVisible ? "Hide Details" : "Show Details"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {/* Close Button */}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-3xl">&times;</button>
          </div>
        </div>

        {/* Content Area */}
        <div className={`flex-grow p-4 grid ${isDetailsVisible ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1'} gap-4 min-h-0 transition-all duration-300`}>
          {/* PDF Viewer */}
          <div className={`${isDetailsVisible ? 'md:col-span-2' : 'col-span-1'} h-full`}>
            <iframe
              src={`${apiURL}/pdf/${doc.doc_id}`}
              className="w-full h-full border-0 rounded-lg bg-white"
              title={doc.docname.replace(/\.[^/.]+$/, "")}
            />
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
              <EventEditor
                docId={doc.doc_id}
                apiURL={apiURL}
                selectedEvent={selectedEvent}
                setSelectedEvent={setSelectedEvent}
                onEventChange={handleEventChangeInModal}
                theme={theme}
              />
            ) : (
              <ReadOnlyEventDisplay event={selectedEvent} t={t} />
            )}
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