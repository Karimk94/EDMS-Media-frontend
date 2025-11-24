import React, { useState, useEffect } from 'react';

interface GalleryModalProps {
  title: string;
  images: string[];
  startIndex: number;
  onClose: () => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({ title, images, startIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    setIsImageLoading(true);
  }, [currentIndex]);

  useEffect(() => {
    if (!isImageLoading) {
      const preloadCount = 3;
      const uniqueIndexesToPreload = new Set();

      for (let i = 1; i <= preloadCount; i++) {
        const nextIndex = (currentIndex + i) % images.length;
        if (nextIndex !== currentIndex) {
          uniqueIndexesToPreload.add(nextIndex);
        }
      }

      uniqueIndexesToPreload.forEach(index => {
        const img = new Image();
        img.src = images[index as number];
      });
    }
  }, [currentIndex, isImageLoading, images]);

  const goToPrevious = () => {
    const isFirstImage = currentIndex === 0;
    const newIndex = isFirstImage ? images.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const isLastImage = currentIndex === images.length - 1;
    const newIndex = isLastImage ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-80 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative bg-white rounded-2xl w-full max-w-6xl h-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 px-6 border-b border-gray-200 flex-shrink-0 flex justify-between items-center">
          <h2 className="m-0 text-[#004a99] text-xl font-medium truncate pr-4">{title}</h2>
          <span className="text-4xl text-gray-400 cursor-pointer leading-none transition-colors duration-200 ease-in-out hover:text-gray-800" onClick={onClose}>&times;</span>
        </div>

        {/* Main Content (Image Viewer) */}
        <div className="flex-grow flex items-center justify-center relative bg-gray-900/50 min-h-0">
          {isImageLoading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4">
              <div className="w-full h-full skeleton-loader rounded-lg"></div>
            </div>
          )}
          <img
            src={images[currentIndex]}
            alt={`${title} gallery image ${currentIndex + 1}`}
            className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${isImageLoading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => setIsImageLoading(false)}
            onError={() => setIsImageLoading(false)}
          />
          {/* Navigation Arrows */}
          <div className="absolute top-1/2 left-5 transform -translate-y-1/2 text-white text-3xl cursor-pointer bg-black/30 rounded-full p-2 hover:bg-black/50" onClick={goToPrevious}>&#10094;</div>
          <div className="absolute top-1/2 right-5 transform -translate-y-1/2 text-white text-3xl cursor-pointer bg-black/30 rounded-full p-2 hover:bg-black/50" onClick={goToNext}>&#10095;</div>
        </div>

        {/* Thumbnail Strip */}
        <div className="p-2 bg-gray-100 border-t border-gray-200 flex-shrink-0">
          <div className="flex justify-center space-x-2 overflow-x-auto pb-2">
            {images.map((src, index) => (
              <img
                key={index}
                src={src}
                alt={`Thumbnail ${index + 1}`}
                className={`h-20 w-20 object-cover rounded-md cursor-pointer flex-shrink-0 ${index === currentIndex ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-2 hover:ring-gray-400'}`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};