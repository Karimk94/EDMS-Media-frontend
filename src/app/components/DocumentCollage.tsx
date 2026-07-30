'use client';

import Image from 'next/image';
import React, { useState } from 'react';
import { Document } from '../../models/Document';

interface DocumentCollageProps {
  documents: Document[]; // Documents with the same name
  onCollageClick: (doc: Document) => void;
  apiURL: string;
  lang?: string;
}

/**
 * Displays a "stacked" collage effect for multiple documents with the same name.
 * Shows up to 3 stacked thumbnails with a count badge.
 */
export const DocumentCollage: React.FC<DocumentCollageProps> = ({
  documents,
  onCollageClick,
  apiURL,
  lang = 'en'
}) => {
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  if (documents.length === 0) return null;

  // Display up to 3 stacked images
  const displayedCount = Math.min(3, documents.length);
  const stackOffsets = [0, 8, 16]; // Pixel offsets for stacking effect

  const handleClick = () => {
    onCollageClick(documents[0]);
  };

  const buildThumbnailUrl = (thumbnailUrl: string) => {
    if (!thumbnailUrl?.trim()) return null;
    if (thumbnailUrl.startsWith('http')) return thumbnailUrl;
    const cleanApiUrl = apiURL.replace(/\/$/, '');
    const cleanThumbnailUrl = thumbnailUrl.replace(/^\//, '');
    return `${cleanApiUrl}/${cleanThumbnailUrl}`;
  };

  const cleanDocName = documents[0].docname ? documents[0].docname.replace(/\.[^/.]+$/, "") : "";
  const displayDate = documents[0].date ? documents[0].date.split(' ')[0] : "";

  return (
    <div
      className="cursor-pointer group flex flex-col relative"
      onClick={handleClick}
      title={`${documents.length} documents with same name`}
    >
      {/* Stacked thumbnails */}
      <div className="relative aspect-w-16 aspect-h-9 mb-5">
        {Array.from({ length: displayedCount }).map((_, idx) => {
          const doc = documents[idx];
          const offset = stackOffsets[idx];
          const isTop = idx === 0;
          const thumbnailSrc = imageErrors[doc.doc_id] ? null : buildThumbnailUrl(doc.thumbnail_url);

          return (
            <div
              key={doc.doc_id}
              className={`absolute w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border-2 border-white dark:border-gray-600 shadow-md transition-transform duration-200 ${
                isTop ? 'group-hover:shadow-lg group-hover:scale-105' : ''
              }`}
              style={{
                transform: `translateY(${offset}px) translateX(${offset * (lang === 'ar' ? -1 : 1)}px)`,
                zIndex: displayedCount - idx,
              }}
            >
              {thumbnailSrc ? (
                <Image
                  src={thumbnailSrc}
                  alt={doc.docname}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  onError={() => setImageErrors(prev => ({ ...prev, [doc.doc_id]: true }))}
                  draggable={false}
                  unoptimized={true}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700">
                  <span className="text-gray-600 dark:text-gray-300 text-xs text-center px-2">
                    {doc.docname.split('.').pop()?.toUpperCase() || 'FILE'}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Count badge - only show if more than 1 */}
        {documents.length > 1 && (
          <div className="absolute bottom-2 right-2 z-20 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg">
            {documents.length > 9 ? '9+' : documents.length}
          </div>
        )}

        {/* Hover overlay with indicator */}
        <div className="absolute inset-0 z-10 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-lg transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-center">
            <div className="text-sm font-semibold">{documents.length}</div>
            <div className="text-xs">documents</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-grow">
        <h3 className="font-bold text-base text-gray-900 dark:text-white truncate group-hover:text-gray-600 dark:group-hover:text-gray-400 transition" title={cleanDocName}>
          {cleanDocName || "No title available."}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">{displayDate}</p>
      </div>
    </div>
  );
};
