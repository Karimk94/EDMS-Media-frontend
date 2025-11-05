"use client";

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { GalleryModal } from './GalleryModal';
import '../styles/Journey.css';

interface JourneyEvent {
  title: string;
  thumbnail: string;
  gallery: string[];
}

interface JourneyData {
  [year: string]: JourneyEvent[];
}

interface JourneyProps {
  apiURL: string;
  t: Function;
}

export const Journey: React.FC<JourneyProps> = ({ apiURL, t }) => {
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{ title: string; images: string[]; startIndex: number } | null>(null);

  const [svgPath, setSvgPath] = useState('');
  const [svgHeight, setSvgHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const yearRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLength, setPathLength] = useState(0);

  const getThumbnailUrl = (thumbnailPath: string) => {
      if (!thumbnailPath) {
          return '/no-image.svg';
      }
      const baseUrl = apiURL.endsWith('/') ? apiURL.slice(0, -1) : apiURL;
      const finalPath = thumbnailPath.startsWith('/') ? thumbnailPath.slice(1) : thumbnailPath;
      return `${baseUrl}/${finalPath}`;
  };


  useEffect(() => {
    const fetchJourneyData = async () => {
      try {
        const response = await fetch(`${apiURL}/journey`);
        if (!response.ok) throw new Error('Failed to fetch journey data');
        const data = await response.json();
        setJourneyData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    };
    fetchJourneyData();
  }, [apiURL]);

  useLayoutEffect(() => {
    if (isLoading || !journeyData || !containerRef.current) {
      return;
    }

    const calculatePath = () => {
      if (!containerRef.current) return;

      const pathCommands: string[] = [];
      const containerWidth = containerRef.current.clientWidth;
      
      const contentWidth = Math.min(600, containerWidth * 0.7);
      const contentLeft = (containerWidth - contentWidth) / 2;
      const contentRight = contentLeft + contentWidth;
      const gutter = 50;
      const marginBetween = 160;
      const halfMargin = marginBetween / 2;
      
      const lineLeftX = contentLeft - gutter;
      const lineRightX = contentRight + gutter;
      
      let currentY = 20;
      let currentX = lineRightX; 

      pathCommands.push(`M ${currentX} ${currentY}`);

      yearRefs.current.forEach((ref, index) => {
        if (!ref) return;

        const isEven = (index + 1) % 2 === 0; 
        
        const sectionTop = ref.offsetTop;
        const sectionHeight = ref.clientHeight;
        
        const horizontalLineY = sectionTop + sectionHeight + halfMargin;

        if (isEven) {
          // 1. Vertical line down on RIGHT
          pathCommands.push(`L ${lineRightX} ${horizontalLineY}`);
          // 2. Horizontal line across bottom to the LEFT
          pathCommands.push(`L ${lineLeftX} ${horizontalLineY}`);
          currentX = lineLeftX;
        } else {
          // --- Path for ODD rows (2024, etc.) ---
          if (index === 0) {
            // First item, move from start to the left side
            pathCommands.push(`L ${lineLeftX} ${currentY}`);
          }
          // 1. Vertical line down on LEFT
          pathCommands.push(`L ${lineLeftX} ${horizontalLineY}`);
          // 2. Horizontal line across bottom to the RIGHT
          pathCommands.push(`L ${lineRightX} ${horizontalLineY}`);
          currentX = lineRightX;
        }
        currentY = horizontalLineY;
      });

      setSvgPath(pathCommands.join(' '));
      setSvgHeight(currentY + 40);
      if (pathRef.current) {
        setPathLength(pathRef.current.getTotalLength());
      }
    };

    const timer = setTimeout(calculatePath, 100);
    window.addEventListener('resize', calculatePath);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePath);
    };

  }, [isLoading, journeyData]);


  const openGallery = (title: string, gallery: string[], startIndex: number) => {
    setModalData({ title, images: gallery.map(src => `${apiURL}/image/${src.split('/')[1].split('.')[0]}`), startIndex });
  };

  const closeGallery = () => {
    setModalData(null);
  };

  if (isLoading) {
    return <div className="text-center p-10">{t('loadingJourney')}</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">{error}</div>;
  }

  const sortedYears = journeyData ? Object.keys(journeyData).sort((a, b) => Number(a) - Number(b)) : [];
  yearRefs.current = [];

  return (
    <div className="journey-container" ref={containerRef}>

      <svg className="journey-svg-line" width="100%" height={svgHeight}>
        <path d={svgPath} className="journey-svg-path-track" />
        <path
            ref={pathRef}
            d={svgPath}
            className="journey-svg-path-progress"
            style={{
                strokeDasharray: pathLength,
                strokeDashoffset: pathLength,
            }}
        >
            <animate
                attributeName="stroke-dashoffset"
                values={`${pathLength};0;${pathLength}`}
                dur="90s"
                repeatCount="indefinite"
            />
        </path>
      </svg>

      <svg className="journey-svg-dot-container" width="100%" height={svgHeight}>
        <defs>
          <path id="journey-animation-path" d={svgPath} />
        </defs>
        <circle cx="0" cy="0" r="10" className="journey-svg-dot">
          <animateMotion
            dur="90s"
            repeatCount="indefinite"
            fill="forwards"
            keyPoints="0;1;0"
            keyTimes="0;0.5;1"
            calcMode="linear"
          >
            <mpath href="#journey-animation-path" />
          </animateMotion>
        </circle>
      </svg>
      
      <div className="journey-content-column">
        {sortedYears.map((year, index) => (
          <div
            key={year}
            className="journey-year-section"
            ref={el => { yearRefs.current[index] = el; }}
          >
            <div className="year-header">{year}</div>
            <div className="year-content-wrapper">
              <div className="events-grid">
                {journeyData && journeyData[year].map((event, eventIndex) => {
                  
                  const count = Array.isArray(event.gallery) ? event.gallery.length : 1;
                  
                  const displayCount = Math.min(count, 4);
                  const displayThumbnails = new Array(displayCount).fill(event.thumbnail).reverse();

                  return (
                    <div
                      className="flex flex-col items-center group cursor-pointer"
                      key={eventIndex}
                      onClick={() => openGallery(event.title, event.gallery, 0)}
                      title={`Event: ${event.title} (${count} ${count === 1 ? 'item' : 'items'})`}
                    >
                      <div className="relative w-full aspect-[16/9]">
                        {count > 1 && (
                          <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg transform scale-95 translate-y-2 opacity-50 group-hover:opacity-70 transition-all duration-300"></div>
                        )}

                        {displayThumbnails.map((thumbUrl, idx) => {
                          const zIndex = 10 - idx;
                          const translateX = idx * 4;
                          const translateY = idx * 4;
                          const finalThumbnailUrl = getThumbnailUrl(thumbUrl);

                          return (
                            <div
                              key={`${eventIndex}-${idx}`}
                              className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-105"
                              style={{
                                zIndex: zIndex,
                                transform: `translate(${translateX}px, ${translateY}px)`,
                                border: '2px solid white', 
                                borderRadius: '1rem',
                                overflow: 'hidden'
                              }}
                            >
                              <img
                                src={finalThumbnailUrl}
                                alt={`Thumbnail ${idx + 1} for event ${event.title}`}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = '/no-image.svg'; }}
                              />
                            </div>
                          );
                        })}

                        {count > 4 && (
                          <div
                            className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs font-semibold px-1.5 py-0.5 rounded z-20"
                            style={{
                              transform: `translateY(${Math.min(3, displayThumbnails.length - 1) * 4}px) translateX(${Math.min(3, displayThumbnails.length - 1) * 4}px)`
                            }}
                          >
                            +{count - 4}
                          </div>
                        )}
                      </div>
                      <h3 className="mt-2 font-semibold text-sm text-center text-black-800 dark:text-black-200 truncate w-full group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
                        {event.title}
                      </h3>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalData && (
        <GalleryModal
          title={modalData.title}
          images={modalData.images}
          startIndex={modalData.startIndex}
          onClose={closeGallery}
        />
      )}
    </div>
  );
};