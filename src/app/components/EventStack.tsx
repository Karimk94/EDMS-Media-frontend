import React from 'react';

// Define the structure for an Event item with thumbnails
export interface EventItem {
  id: number;
  name: string;
  thumbnail_urls: string[]; // Expecting an array of thumbnail URLs
}

interface EventStackProps {
  event: EventItem;
  apiURL: string;
  onClick: (eventId: number) => void; // Pass event ID on click
}

export const EventStack: React.FC<EventStackProps> = ({ event, apiURL, onClick }) => {
  // Ensure we have a valid event object and thumbnails
  if (!event || !Array.isArray(event.thumbnail_urls)) {
    console.warn("EventStack: Received invalid event data.", event);
    return null; // Don't render if data is invalid
  }

  const thumbnails = event.thumbnail_urls;
  const count = thumbnails.length; // Use the actual count of thumbnails received

  // Slice first, then reverse the smaller array for display order (max 4 visible)
  const displayThumbnails = thumbnails.slice(0, 4).reverse();

  // Construct the asset URL through the proxy
  const getThumbnailUrl = (thumbnailPath: string) => {
      if (!thumbnailPath) {
          return '/no-image.svg'; // Fallback image
      }
      // Ensure the base URL doesn't end with / if thumbnailPath starts with /
      const baseUrl = apiURL.endsWith('/') ? apiURL.slice(0, -1) : apiURL;
      const finalPath = thumbnailPath.startsWith('/') ? thumbnailPath.slice(1) : thumbnailPath;
      // Assume thumbnailPath already includes 'cache/' if applicable
      return `${baseUrl}/${finalPath}`;
  };

  return (
    <div
      className="flex flex-col items-center group cursor-pointer"
      onClick={() => onClick(event.id)}
      title={`Event: ${event.name} (${count} ${count === 1 ? 'item' : 'items'})`}
    >
      <div className="relative w-full aspect-[16/9]">
        {/* Background/Shadow Element (Optional) */}
        {count > 1 && (
            <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg transform scale-95 translate-y-2 opacity-50 group-hover:opacity-70 transition-all duration-300"></div>
        )}

        {/* Stacked Images */}
        {displayThumbnails.map((thumbUrl, index) => {
          // Calculate dynamic styles for stacking effect (index is reversed: 0=top, ... 3=bottom)
          const zIndex = 10 - index;
          const scale = 1 - index * 0.04; // Slightly decrease scale
          const translateY = index * 6; // Offset vertically
          // Adjust rotation based on reversed index for visual appeal
          const rotate = (index === 0 ? 0 : index % 2 === 1 ? -1 : 1.5) * (displayThumbnails.length > 1 ? 1 : 0);
          const finalThumbnailUrl = getThumbnailUrl(thumbUrl);

          return (
            <div
              key={`${event.id}-${index}`} // Use a combination key
              className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-105"
              style={{
                zIndex: zIndex,
                transform: `scale(${scale}) translateY(${translateY}px) rotate(${rotate}deg)`,
              }}
            >
              <img
                src={finalThumbnailUrl}
                alt={`Thumbnail ${index + 1} for event ${event.name}`}
                className="w-full h-full object-cover rounded-lg shadow-md border border-white dark:border-gray-800 bg-gray-300 dark:bg-gray-600"
                onError={(e) => { (e.target as HTMLImageElement).src = '/no-image.svg'; }}
              />
              {/* Overlay for the top image (optional) */}
              {index === 0 && (
                 <div className="absolute inset-0 bg-black bg-opacity-10 group-hover:bg-opacity-0 transition-opacity rounded-lg"></div>
              )}
            </div>
          );
        })}

         {/* Count Overlay if more than 4 items */}
        {count > 4 && (
          <div
            className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs font-semibold px-1.5 py-0.5 rounded z-20"
            // Position relative to last visible card
            style={{ transform: `translateY(${Math.min(3, displayThumbnails.length - 1) * 6}px)` }}
          >
            +{count - 4}
          </div>
        )}
      </div>
      {/* Event Name */}
      <h3 className="mt-2 font-semibold text-sm text-center text-black-800 dark:text-black-200 truncate w-full group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
        {event.name}
      </h3>
    </div>
  );
};