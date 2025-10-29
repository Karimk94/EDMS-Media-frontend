import React, { useState, useEffect } from 'react';

interface ReadOnlyTagDisplayProps {
  docId: number;
  apiURL: string;
}

export const ReadOnlyTagDisplay: React.FC<ReadOnlyTagDisplayProps> = ({ docId, apiURL }) => {
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTags = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${apiURL}/tags/${docId}`);
        if (response.ok) {
          const data = await response.json();
          setTags((data.tags || []).sort((a: string, b: string) => a.localeCompare(b)));
        } else {
          setTags([]);
        }
      } catch (error) {
        console.error(`Failed to fetch tags for doc ${docId}`, error);
        setTags([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTags();
  }, [docId, apiURL]);

  return (
    <div className="mt-4">
      <h4 className="font-semibold text-gray-300 mb-2">Tags</h4>
      {isLoading ? <p className="text-sm text-gray-500">Loading tags...</p> : (
        <div className="flex flex-wrap gap-2 mb-3 bg-[#121212] p-2 rounded-md min-h-[40px]">
          {tags.length > 0 ? tags.map((tag, index) => (
            <div key={index} className="flex items-center bg-gray-600 text-gray-200 text-xs font-medium px-2.5 py-1 rounded-md">
              <span>{tag}</span>
            </div>
          )) : <span className="text-sm text-gray-500 italic px-1">No tags assigned.</span>}
        </div>
      )}
    </div>
  );
};
