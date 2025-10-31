import React from 'react';
import { Document } from './DocumentItem'; // Assuming Document type is suitable

interface MemoriesStackProps {
  memories: Document[]; // Prop type remains array, but we'll check runtime value
  apiURL: string;
  onClick: () => void; // Function to call when the stack is clicked
}

export const MemoriesStack: React.FC<MemoriesStackProps> = ({ memories, apiURL, onClick }) => {
  // Explicitly check for non-empty array first
  if (!Array.isArray(memories) || memories.length === 0) {
    // console.log("MemoriesStack: Returning null because memories is not a valid array or is empty.");
    return null;
  }

  // Ensure we have a valid first memory object before proceeding further
  const firstMemory = memories[0];
  if (!firstMemory) {
      console.warn("MemoriesStack: Returning null because first memory item is invalid.");
      return null;
  }

  const count = memories.length;
  // Create a copy for slicing to avoid potential side effects if prop wasn't cloned upstream
  const memoriesCopy = [...memories];
  // Slice first, then reverse the smaller array for display order
  const displayMemories = memoriesCopy.slice(0, 3).reverse(); // Max 3 visible cards in stack

  // Construct the asset URL through the proxy
  const getThumbnailUrl = (doc: Document) => {
      // Add a check within getThumbnailUrl as well
      if (!doc || !doc.thumbnail_url) {
          // console.log(`MemoriesStack: Using fallback image for doc_id ${doc?.doc_id} because thumbnail_url is missing.`);
          return '/no-image.svg'; // Fallback image if thumbnail_url is missing
      }
      // Ensure the base URL doesn't end with / if thumbnail_url starts with /
      const baseUrl = apiURL.endsWith('/') ? apiURL.slice(0, -1) : apiURL;
      const thumbnailUrlPath = doc.thumbnail_url.startsWith('/') ? doc.thumbnail_url.slice(1) : doc.thumbnail_url;
      return `${baseUrl}/${thumbnailUrlPath}`;
  };


  // Safely get the year from the top memory item's date
  const getTopMemoryYear = () => {
    // console.log("MemoriesStack: Checking firstMemory.date:", firstMemory.date);

    if (!firstMemory.date || typeof firstMemory.date !== 'string' || firstMemory.date === "N/A") {
        // console.log("MemoriesStack: Date is missing, not a string, or 'N/A'. Returning null.");
        return null;
    }

try {
        let dateObj: Date | null = null;
        // Attempt to parse DD-MM-YYYY format
        const parts = firstMemory.date.split(' ')[0].split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                 dateObj = new Date(year, month - 1, day);
            }
        }

        if (!dateObj || isNaN(dateObj.getTime())) {
            dateObj = new Date(firstMemory.date);
        }

        // Check if the final date object is valid
        if (!dateObj || isNaN(dateObj.getTime())) {
            return null;
        }

        const year = dateObj.getFullYear();
        // console.log("MemoriesStack: Extracted year:", year);

        // Final check if getFullYear somehow returns NaN (though unlikely if dateObj is valid)
        if (isNaN(year)) {
             //console.log("MemoriesStack: Year is NaN after getFullYear(). Returning null.");
             return null;
        }
        return year;
     } catch (e) {
         console.error("MemoriesStack: Error during date parsing:", e); // Log any unexpected errors
         return null;
     }
  };

  const topMemoryYear = getTopMemoryYear();
  // console.log("MemoriesStack: Final topMemoryYear value:", topMemoryYear);

  return (
    <div
      className="relative w-full aspect-[16/9] cursor-pointer group"
      onClick={onClick}
      title={`Memories from this month (${count} ${count === 1 ? 'item' : 'items'})`}
    >
      {/* Background/Shadow Element (Optional) */}
      <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 rounded-lg transform scale-95 translate-y-2 opacity-50 group-hover:opacity-70 transition-all duration-300"></div>

      {/* Stacked Images */}
      {/* Map over the already sliced and reversed displayMemories array */}
      {displayMemories.map((memory, index) => {
        // --- Add validation for each item in the array ---
        if (!memory || typeof memory !== 'object' || !memory.doc_id) {
            console.warn(`MemoriesStack encountered invalid memory item at index ${index}:`, memory);
            return null; // Skip rendering this invalid item
        }
        // --- End validation ---

        // Calculate dynamic styles for stacking effect (index is now reversed: 0=top, 1=middle, 2=bottom)
        const zIndex = 10 - index;
        const scale = 1 - index * 0.05; // Slightly decrease scale for items behind
        const translateY = index * 8; // Offset vertically
        // Adjust rotation based on reversed index
        const rotate = (index === 0 ? 0 : index === 1 ? -1.5 : 2) * (displayMemories.length > 1 ? 1 : 0);
        // Ensure thumbnail URL is safely retrieved
        const thumbnailUrl = getThumbnailUrl(memory);


        return (
          <div
            key={memory.doc_id} // Use the validated doc_id
            className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-105"
            style={{
              zIndex: zIndex,
              transform: `scale(${scale}) translateY(${translateY}px) rotate(${rotate}deg)`,
            }}
          >
            <img
              src={thumbnailUrl} // Use the potentially fallback URL
              alt={`Memory from ${memory.date || 'Unknown Date'}`} // Add fallback for alt text date
              className="w-full h-full object-cover rounded-lg shadow-lg border-2 border-white dark:border-gray-800 bg-gray-300 dark:bg-gray-600"
              onError={(e) => { (e.target as HTMLImageElement).src = '/no-image.svg'; }}
            />
            {/* Overlay for the top image (optional) */}
            {index === 0 && ( // Index 0 is now the top card after reverse
               <div className="absolute inset-0 bg-black bg-opacity-10 group-hover:bg-opacity-0 transition-opacity rounded-lg"></div>
            )}
          </div>
        );
      })}

       {/* Count Overlay if more than 3 items */}
      {count > 3 && (
        <div
          className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs font-semibold px-2 py-1 rounded z-20"
          // Position relative to last visible card (which has index 2 if 3 are shown)
          style={{ transform: `translateY(${Math.min(2, displayMemories.length - 1) * 8}px)` }}
        >
          +{count - 3} more
        </div>
      )}

       {/* Year Label on top card - Conditionally render only if year is valid */}
      {topMemoryYear !== null && (
         <div
           className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs font-bold px-2 py-1 rounded z-20"
            // Match rotation of the top card (index 0 after reverse)
            style={{ transform: `rotate(${ (displayMemories.length > 1 ? 0 : 0) * (displayMemories.length % 2 === 0 ? 2 : -1.5) }deg)` }}
         >
           {topMemoryYear} {/* Show year of the top memory */}
         </div>
      )}
    </div>
  );
};