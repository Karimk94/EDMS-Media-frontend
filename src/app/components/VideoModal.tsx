import React, { useState, useEffect } from 'react';
import { Document } from './DocumentItem';
import { TagEditor } from './TagEditor';
import { EventEditor } from './EventEditor';
import { CollapsibleSection } from './CollapsibleSection';
import DatePicker from 'react-datepicker';
import { ReadOnlyTagDisplay } from './ReadOnlyTagDisplay';
import { ReadOnlyEventDisplay } from './ReadOnlyEventDisplay';

interface EventOption {
  value: number;
  label: string;
}

interface VideoModalProps {
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
    if (dateParts.length === 3) {
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[2], 10);
      const timeParts = dateTimeParts[1].split(':');
      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);
      const seconds = parseInt(timeParts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day) && !isNaN(hours) && !isNaN(minutes) && !isNaN(seconds)) {
        const date = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(date.getTime())) return date;
      }
    }
  }

  const slashParts = dateString.split('/');
  if (slashParts.length === 3) {
    const month = parseInt(slashParts[0], 10) - 1;
    const day = parseInt(slashParts[1], 10);
    const year = parseInt(slashParts[2], 10);
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
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

export const VideoModal: React.FC<VideoModalProps> = ({ doc, onClose, apiURL, onUpdateAbstractSuccess, onToggleFavorite, isEditor, t, lang, theme }) => {
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
      
      if (payload.abstract !== undefined) setInitialAbstract(payload.abstract);
      if (payload.date_taken !== undefined) setInitialDate(documentDate);

      setIsEditingDate(false);
      setIsEditingAbstract(false);
      onUpdateAbstractSuccess();
    } catch (err: any) {
       console.error("Error updating metadata", err);
    }
  };

  const handleToggleFavorite = () => {
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`${modalBg} ${textPrimary} rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="p-6 relative">
          <button onClick={onClose} className={`absolute top-4 right-4 ${closeButtonColor} text-3xl z-10`}>&times;</button>
          {/* Favorite Button */}
           <button
             onClick={handleToggleFavorite}
             className={`absolute top-4 left-4 ${textMuted} hover:text-yellow-400 z-10 p-2 bg-black bg-opacity-30 rounded-full`}
             title={isFavorite ? "Remove from favorites" : "Add to favorites"}
           >
             <svg className={`w-6 h-6 ${isFavorite ? 'text-yellow-400' : 'text-gray-300'}`} fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isFavorite ? 1 : 2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.539 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588 1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
             </svg>
           </button>
          <h2 className={`text-xl font-bold ${textHeader} mb-4 pl-12`}>{doc.docname.replace(/\.[^/.]+$/, "")}</h2>
          <video controls autoPlay className="w-full max-h-[70vh] rounded-lg bg-black">
            <source src={`${apiURL}/video/${doc.doc_id}`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="mt-4 mb-6">
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
                            <p className={`text-sm ${textMuted} mt-1 pr-4 whitespace-pre-wrap`}>{abstract || t('noAbstract')}</p>
                            <button onClick={handleEditAbstract} className={`px-4 py-1 ${buttonBg} ${buttonText} text-xs rounded-md ${buttonHoverBg} flex-shrink-0`}>{t('edit')}</button>
                        </div>
                        )
                    ) : (
                        <p className={`text-sm ${textMuted} mt-1 pr-4 whitespace-pre-wrap`}>{abstract}</p>
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
                          dateFormat="dd/MM/yyyy h:mm aa"
                          showTimeSelect
                          timeInputLabel="Time:"
                          className={`w-full px-3 py-2 ${inputBg} ${textPrimary} border ${borderSecondary} rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none`}
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
                        <p className={`text-sm ${textMuted} p-2 flex-grow`}>
                          {documentDate ? documentDate.toLocaleString('en-GB') : t('noDateSet')}
                        </p>
                        <button onClick={handleEditDate} className={`px-4 py-1 ${buttonBg} ${buttonText} text-xs rounded-md ${buttonHoverBg} flex-shrink-0`}>{t('edit')}</button>
                      </div>
                    )
                   ) : (
                    <p className={`text-sm ${textMuted} p-2 flex-grow`}>
                      {documentDate ? documentDate.toLocaleString('en-GB') : t('noDateSet')}
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
                    <ReadOnlyEventDisplay event={selectedEvent} />
                 )}
                 {isEditor ? (
                    <TagEditor docId={doc.doc_id} apiURL={apiURL} lang= {lang} theme={theme} />
                 ) : (
                    <ReadOnlyTagDisplay docId={doc.doc_id} apiURL={apiURL} lang={lang}/>
                 )}
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </div>
  );
};