import React, { useEffect, useRef, useState } from 'react';
import { useDocumentMutations } from '../../hooks/useDocumentMutations';
import { useToast } from '../context/ToastContext';
import { DocumentItemProps } from '../../interfaces/PropsInterfaces';
import Image from 'next/image';
import { Spinner } from './Spinner';

export const DocumentItem: React.FC<DocumentItemProps> = ({
  doc,
  onDocumentClick,
  apiURL,
  onTagSelect,
  isProcessing,
  itemTags = [],
  isTagsLoading = false,
  showFavoriteButton = true,
  lang,
  t
}) => {
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [imageError, setImageError] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { toggleFavorite } = useDocumentMutations();
  const [isFavorite, setIsFavorite] = useState(doc.is_favorite);

  const { showToast } = useToast();

  useEffect(() => {
    setIsFavorite(doc.is_favorite);
  }, [doc.is_favorite]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavoriteStatus = !isFavorite;
    // Optimistic update locally
    setIsFavorite(newFavoriteStatus);

    try {
      await toggleFavorite({ docId: doc.doc_id, isFavorite: newFavoriteStatus });

      if (newFavoriteStatus) {
        showToast(t('AddedToFavorites'), 'success');
      } else {
        showToast(t('RemovedFromFavorites'), 'info');
      }
    } catch (error) {
      setIsFavorite(!newFavoriteStatus); // Revert on error
      showToast(t('FailedToUpdateFavoriteStatus'), 'error');
    }
  };

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

  const getFileTypeIcon = () => {
    switch (doc.media_type) {
      case 'pdf':
        return '/file-pdf.svg';
      case 'excel':
        return '/file-excel.svg';
      case 'powerpoint':
        return '/file-powerpoint.svg';
      case 'word':
        return '/file-word.svg';
      case 'zip':
        return '/file-zip.svg';
      case 'text':
        return '/file-document.svg';
      case 'audio':
        return '/file-audio.svg';
      case 'cad':
        return '/file-cad.svg';
      case 'code':
        return '/file-code.svg';
      case 'email':
        return '/file-email.svg';
      case 'font':
        return '/file-font.svg';
      case 'database':
        return '/file-database.svg';
      case 'vector':
        return '/file-vector.svg';
      case 'archive':
        return '/file-archive.svg';
      case 'executable':
        return '/file-executable.svg';
      case 'disc':
        return '/file-disc.svg';
      case 'visio':
        return '/file-visio.svg';
      case 'onenote':
        return '/file-onenote.svg';
      default:
        return null;
    }
  };

  const displayDate = formatDateOnly(doc.date);
  const thumbnailUrl = doc.thumbnail_url && doc.thumbnail_url.trim() ? (doc.thumbnail_url.startsWith('http') ? doc.thumbnail_url : `${apiURL}/${doc.thumbnail_url}`)
    : null;
  const cleanDocName = doc.docname ? doc.docname.replace(/\.[^/.]+$/, "") : "";
  const typeIcon = getFileTypeIcon();

  return (
    <div
      onClick={() => onDocumentClick(doc)}
      className="cursor-pointer group flex flex-col relative"
    >
      {isProcessing && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg z-10">
          <Spinner size="sm" />
        </div>
      )}
      <div className="relative aspect-w-16 aspect-h-9 mb-2">
        {thumbnailUrl && !imageError ? (
          <Image
            src={thumbnailUrl}
            alt="Thumbnail"
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover rounded-lg bg-gray-200 dark:bg-gray-800 transition"
            onError={() => setImageError(true)}
            draggable={false}
            unoptimized={true}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Image
              src={typeIcon || '/file.svg'}
              alt="File Type"
              width={64}
              height={64}
              className="opacity-40 dark:opacity-60"
            />
          </div>
        )}

        {doc.media_type === 'video' && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-40 transition rounded-lg">
            <Image src="/play-icon.svg" alt="Play Video" width={48} height={48} className="opacity-80 group-hover:opacity-100 transition-transform group-hover:scale-110" />
          </div>
        )}

        {typeIcon && !imageError && (
          <div className="pointer-events-none z-10">
            <Image src={typeIcon} alt={`${doc.media_type} Icon`} width={32} height={32} className="absolute bottom-2 right-2 drop-shadow-md" />
          </div>
        )}

        {showFavoriteButton && (
          <button
            onClick={handleFavoriteClick}
            className="absolute top-2 left-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black bg-opacity-30 text-white hover:text-yellow-400"
          >
            <Image src={isFavorite ? "/icons/star-filled.svg" : "/icons/star-outline.svg"} alt="" width={24} height={24} />
          </button>
        )}
      </div>

      <div className="flex flex-col flex-grow">
        <h3 className="font-bold text-base text-gray-900 dark:text-white truncate group-hover:text-gray-600 dark:group-hover:text-gray-400 transition" title={cleanDocName}>{cleanDocName || "No title available."}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{displayDate}</p>
        <div className="relative mt-auto pt-1 mb-1 h-5">
          {isTagsLoading ? (
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
                      onClick={(e) => handleTagClick(e, tag.text)}
                      className="truncate min-w-0 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 text-xs font-medium px-2 py-0.5 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                      title={tag.text}
                    >
                      {tag.text}
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
                      {itemTags.map((tagObject, index) => (
                        <button key={index} onClick={(e) => handleTagClick(e, tagObject.text)} className="bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 text-xs font-medium px-2 py-0.5 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
                          {tagObject.text}
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
