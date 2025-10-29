"use client";

import React, { useState, useEffect } from 'react';
import { GalleryModal } from './GalleryModal';

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
}

export const Journey: React.FC<JourneyProps> = ({ apiURL }) => {
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{ title: string; images: string[]; startIndex: number } | null>(null);

  useEffect(() => {
    const fetchJourneyData = async () => {
      try {
        const response = await fetch(`${apiURL}/journey`);
        if (!response.ok) {
          throw new Error('Failed to fetch journey data');
        }
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
    return <div className="text-center p-10">Loading Journey...</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">{error}</div>;
  }

  return (
    <div className="bg-[#f4f7f6] text-[#333] p-5 font-sans">
      <div className="max-w-4xl mx-auto mb-8 text-center">
      </div>
      <div className="relative max-w-4xl mx-auto after:content-[''] after:absolute after:w-1 after:bg-[#d1e3ff] after:top-0 after:bottom-0 after:left-1/2 after:-ml-0.5 after:z-10">
        {journeyData && Object.keys(journeyData).sort((a, b) => Number(b) - Number(a)).map(year => (
          <React.Fragment key={year}>
            <div className="py-2.5 px-5 bg-[#004a99] text-white rounded-full text-2xl font-bold text-center relative z-20 w-32 mx-auto my-8 shadow-lg" data-year={year}>{year}</div>
            {journeyData[year].map((event, index) => (
              <div className={`p-2.5 relative bg-transparent w-1/2 box-border z-20 md:px-10 ${index % 2 === 0 ? 'left-1/2 pl-8' : 'left-0 pr-8'} `} data-year={year} key={index}>
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden transition-transform transition-shadow duration-300 ease-in-out cursor-pointer hover:transform hover:-translate-y-1 hover:shadow-2xl">
                  <div className="relative">
                    {event.gallery.slice(0, 3).map((image, i) => (
                      <div
                        key={i}
                        className="w-full h-48 bg-gray-200 absolute top-0 left-0"
                        style={{
                          zIndex: event.gallery.length - i,
                          transform: `translate(${i * 4}px, ${i * 4}px)`,
                          border: '2px solid white',
                          borderRadius: '1rem',
                          overflow: 'hidden'
                        }}
                        onClick={() => openGallery(event.title, event.gallery, i)}
                      >
                        <img
                          className="w-full h-full object-cover"
                          src={`${apiURL}/${image}`}
                          alt={`Thumbnail for ${event.title}`}
                          onError={(e) => { (e.target as HTMLImageElement).src = '/no-image.svg'; }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="p-4 text-center mt-48">
                    <h3 className="m-0 font-medium text-lg text-[#004a99]">{event.title}</h3>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
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