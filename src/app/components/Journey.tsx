"use client";

import React, { useState, useEffect } from 'react';
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

  return (
    <div className="journey-container">
      {/* Elements for the line and animated dot */}
      <div className="timeline-line"></div>
      <div className="animated-dot"></div>
      
      <div className="journey-content-column">
        {sortedYears.map((year) => (
          <div key={year} className="journey-year-section">
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