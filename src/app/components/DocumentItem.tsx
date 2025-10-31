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
}

export const DocumentItem: React.FC<DocumentItemProps> = ({ doc, onDocumentClick, apiURL, onTagSelect, isProcessing, onToggleFavorite }) => {
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
        const response = await fetch(`${apiURL}/tags/${doc.doc_id}`);
        if (response.ok) {
          const data = await response.json();
          setItemTags(data.tags || []);
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
  }, [doc.doc_id, apiURL, isProcessing]);
  
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
          className="w-full h-full object-cover rounded-lg bg-gray-800 group-hover:opacity-80 transition"
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.539 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.196-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col flex-grow">
        <h3 className="font-bold text-base text-black truncate group-hover:text-gray-400 transition">{doc.docname || "No title available."}</h3>
        <p className="text-xs text-gray-400">{displayDate}</p>
        
        <div className="relative mt-auto pt-1">
          {isLoadingTags ? (
            <div className="flex flex-wrap gap-1 animate-pulse">
                <div className="h-5 bg-gray-700 rounded w-12"></div>
                <div className="h-5 bg-gray-700 rounded w-16"></div>
            </div>
          ) : (
            itemTags.length > 0 && (
              <>
                <div className="flex flex-nowrap items-center gap-1">
                  {visibleTags.map((tag, index) => (
                    <button 
                      key={index} 
                      onClick={(e) => handleTagClick(e, tag)} 
                      className="truncate max-w-32 flex-shrink-0 bg-gray-200 text-black text-xs font-medium px-2 py-0.5 rounded-md hover:bg-gray-300"
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
                      className="flex-shrink-0 bg-gray-300 text-black text-xs font-medium px-2 py-0.5 rounded-md hover:bg-gray-400 transition-colors"
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
                    className="absolute bottom-full left-0 mb-2 w-auto min-w-[150px] max-w-xs bg-white rounded-md shadow-lg p-2 z-10"
                  >
                    <div className="flex flex-wrap gap-1">
                      {itemTags.map((tag, index) => (
                        <button key={index} onClick={(e) => handleTagClick(e, tag)} className="bg-gray-200 text-black text-xs font-medium px-2 py-0.5 rounded-md hover:bg-gray-300">
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