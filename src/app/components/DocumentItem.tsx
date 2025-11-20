import React, { useState, useRef, useEffect } from 'react';

export interface Document {
  doc_id: number;
  title: string;
  abstract?: string;
  docnumber: string;
  docname: string;
  date: string;
  thumbnail_url: string;
  media_type: 'image' | 'video' | 'pdf';
  tags?: string[];
  is_favorite?: boolean;
}

interface DocumentItemProps {
  doc: Document;
  onDocumentClick: (doc: Document) => void;
  apiURL: string;
  onTagSelect: (tag: string) => void;
  isProcessing: boolean;
  onToggleFavorite: (docId: number, isFavorite: boolean) => void;
  lang: 'en' | 'ar';
}

export const DocumentItem: React.FC<DocumentItemProps> = ({ doc, onDocumentClick, apiURL, onTagSelect, isProcessing, onToggleFavorite, lang }) => {
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [itemTags, setItemTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);
  const [isFavorite, setIsFavorite] = useState(doc.is_favorite);

  useEffect(() => {
    setIsFavorite(doc.is_favorite);
  }, [doc.is_favorite]);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavoriteStatus = !isFavorite;
    setIsFavorite(newFavoriteStatus);
    onToggleFavorite(doc.doc_id, newFavoriteStatus);
  };

  useEffect(() => {
    const fetchTags = async () => {
      setIsLoadingTags(true);
      try {
        const response = await fetch(`${apiURL}/tags/${doc.doc_id}?lang=${lang}`);
        if (response.ok) {
          const data = await response.json();
          const tagStrings = (data.tags || []).map((t: any) => t.text);
          setItemTags(tagStrings);
        } else {
          setItemTags([]);
        }
      } catch (error) {
        console.error(`Failed to fetch tags for doc ${doc.doc_id}`, error);
        setItemTags([]);
      } finally {
        setIsLoadingTags(false);
      }
    };
    if (!isProcessing) {
      fetchTags();
    }
  }, [doc.doc_id, apiURL, isProcessing, lang]);

  const MAX_VISIBLE_TAGS = 3;
  const hasOverflow = itemTags.length > MAX_VISIBLE_TAGS;

  const visibleTags = hasOverflow
    ? itemTags.slice(0, MAX_VISIBLE_TAGS)
    : itemTags;

  const hiddenCount = itemTags.length - visibleTags.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsPopupVisible(false);
      }
    };

    if (isPopupVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopupVisible]);

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsPopupVisible(false);
    }, 300);
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    onTagSelect(tag);
  };

  const formatDateOnly = (dateTimeString: string): string => {
    if (!dateTimeString || dateTimeString === "N/A") {
      return "N/A";
    }
    try {
      const date = new Date(dateTimeString);
      if (isNaN(date.getTime())) {
        return dateTimeString.split(' ')[0];
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      console.warn("Could not format date string:", dateTimeString, e);
      return dateTimeString.split(' ')[0];
    }
  };

  const displayDate = formatDateOnly(doc.date);

  const thumbnailUrl = `${apiURL}/${doc.thumbnail_url.startsWith('cache') ? '' : 'api/'}${doc.thumbnail_url}`;

  const cleanDocName = doc.docname ? doc.docname.replace(/\.[^/.]+$/, "") : "";

  return (
    <div
      onClick={() => onDocumentClick(doc)}
      className="cursor-pointer group flex flex-col relative"
    >
      {isProcessing && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg z-10">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <div className="relative aspect-w-16 aspect-h-9 mb-2">
        <img
          src={thumbnailUrl}
          alt="Thumbnail"
          className="w-full h-full object-cover rounded-lg bg-gray-200 dark:bg-gray-800 group-hover:opacity-80 transition"
          onError={(e) => { (e.target as HTMLImageElement).src = '/no-image.svg'; }}
        />
        {doc.media_type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-40 transition rounded-lg">
            <img src="/play-icon.svg" alt="Play Video" className="w-12 h-12 opacity-80 group-hover:opacity-100 transition-transform group-hover:scale-110" />
          </div>
        )}
        {doc.media_type === 'pdf' && (
          <div className="absolute top-2 right-2 bg-white bg-opacity-70 rounded-full p-1 pointer-events-none">
            <img src="/file.svg" alt="PDF Icon" className="w-4 h-4" />
          </div>
        )}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-2 left-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black bg-opacity-30 text-white hover:text-yellow-400"
        >
          <svg className={`w-6 h-6 ${isFavorite ? 'text-yellow-400' : 'text-gray-300'}`} fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={isFavorite ? 1 : 2}
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01 .321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5Z"
            />          </svg>
        </button>
      </div>

      <div className="flex flex-col flex-grow">
        <h3 className="font-bold text-base text-gray-900 dark:text-white truncate group-hover:text-gray-600 dark:group-hover:text-gray-400 transition" title={cleanDocName}>{cleanDocName || "No title available."}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{displayDate}</p>
        <div className="relative mt-auto pt-1 mb-1 h-5">
          {isLoadingTags ? (
            <div className="flex flex-wrap gap-1">
              <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-12"></div>
              <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
            </div>
          ) : (
            itemTags.length > 0 && (
              <>
                <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
                  {visibleTags.map((tag, index) => (
                    <button
                      key={index}
                      onClick={(e) => handleTagClick(e, tag)}
                      className="truncate min-w-0 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 text-xs font-medium px-2 py-0.5 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                      title={tag}
                    >
                      {tag}
                    </button>
                  ))}
                  {hasOverflow && (
                    <button
                      ref={buttonRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsPopupVisible(prev => !prev);
                      }}
                      className="flex-shrink-0 bg-gray-300 text-gray-800 dark:bg-gray-600 dark:text-gray-200 text-xs font-medium px-2 py-0.5 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                    >
                      +{hiddenCount}
                    </button>
                  )}
                </div>
                {isPopupVisible && hasOverflow && (
                  <div
                    ref={popupRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    className="absolute bottom-full left-0 mb-2 w-auto min-w-[150px] max-w-xs bg-white dark:bg-gray-800 rounded-md shadow-lg p-2 z-10 border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex flex-wrap gap-1">
                      {itemTags.map((tag, index) => (
                        <button key={index} onClick={(e) => handleTagClick(e, tag)} className="bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 text-xs font-medium px-2 py-0.5 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
};