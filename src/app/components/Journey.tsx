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

  // --- State for SVG path ---
  const [svgPath, setSvgPath] = useState('');
  const [svgHeight, setSvgHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const yearRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  const sortedYears = journeyData ? Object.keys(journeyData).sort((a, b) => Number(b) - Number(a)) : [];
  yearRefs.current = [];

  return (
    <div className="journey-container" ref={containerRef}>

      {/* --- SVG 1: The BLUE LINE (BACKGROUND) --- */}
      {/* We keep the z-index split to ensure the dot is always on top */}
      <svg className="journey-svg-line" width="100%" height={svgHeight}>
        <path d={svgPath} className="journey-svg-path-track" />
      </svg>

      {/* --- SVG 2: The WHITE DOT (FOREGROUND) --- */}
      <svg className="journey-svg-dot-container" width="100%" height={svgHeight}>
        <defs>
          <path id="journey-animation-path" d={svgPath} />
        </defs>
        <circle cx="0" cy="0" r="10" className="journey-svg-dot">
          <animateMotion
            dur="45s"
            repeatCount="1"
            fill="forwards"
            keyPoints="0;1"
            keyTimes="0;1"
            calcMode="linear"
          >
            <mpath href="#journey-animation-path" />
          </animateMotion>
        </circle>
      </svg>
      
      {/* --- Content Column (Single, Centered) --- */}
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
                {journeyData && journeyData[year].map((event, eventIndex) => (
                  <div className="event-card" key={eventIndex} onClick={() => openGallery(event.title, event.gallery, 0)}>
                    <div className="event-thumbnail">
                      <img
                        src={`${apiURL}/${event.thumbnail}`}
                        alt={`Thumbnail for ${event.title}`}
                        onError={(e) => { (e.target as HTMLImageElement).src = '/no-image.svg'; }}
                      />
                    </div>
                    <div className="event-title">
                      <h3>{event.title}</h3>
                    </div>
                  </div>
                ))}
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

