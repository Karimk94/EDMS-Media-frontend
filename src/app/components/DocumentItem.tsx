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
}

interface DocumentItemProps {
    doc: Document;
    onDocumentClick: (doc: Document) => void;
    apiURL: string;   // All URLs go through the proxy
    onTagSelect: (tag: string) => void;
    isProcessing: boolean;
}

export const DocumentItem: React.FC<DocumentItemProps> = ({ doc, onDocumentClick, apiURL, onTagSelect, isProcessing }) => {
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [itemTags, setItemTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(true);

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
  
  const MAX_VISIBLE_TAGS = 4;
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

  // Construct the asset URL through the proxy
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
      </div>

      <div className="flex flex-col flex-grow">
        <h3 className="font-bold text-base text-black truncate group-hover:text-gray-400 transition">{doc.docname || "No title available."}</h3>
        <p className="text-xs text-gray-400">{doc.date}</p>
        
        <div className="relative mt-auto pt-1">
          {isLoadingTags ? (
            <div className="flex flex-wrap gap-1 animate-pulse">
                <div className="h-5 bg-gray-700 rounded w-12"></div>
                <div className="h-5 bg-gray-700 rounded w-16"></div>
            </div>
          ) : (
            itemTags.length > 0 && (
              <>
                <div className="flex flex-wrap">
                  {visibleTags.map((tag, index) => (
                    <button key={index} onClick={(e) => handleTagClick(e, tag)} className="bg-gray-200 text-black text-xs font-medium mr-1 mb-1 px-2 py-0.5 rounded-md hover:bg-gray-300">
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
                      className="bg-gray-300 text-black text-xs font-medium mr-1 mb-1 px-2 py-0.5 rounded-md hover:bg-gray-400 transition-colors"
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
                    <div className="flex flex-wrap">
                      {itemTags.map((tag, index) => (
                        <button key={index} onClick={(e) => handleTagClick(e, tag)} className="bg-gray-200 text-black text-xs font-medium mr-1 mb-1 px-2 py-0.5 rounded-md hover:bg-gray-300">
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