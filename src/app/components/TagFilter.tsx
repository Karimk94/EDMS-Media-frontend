"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';

interface TagFilterProps {
  apiURL: string;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
}

export const TagFilter: React.FC<TagFilterProps> = ({ apiURL, selectedTags, setSelectedTags }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [tagsFetched, setTagsFetched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const TAG_CHUNK_SIZE = 50;
  const [visibleTagCount, setVisibleTagCount] = useState(TAG_CHUNK_SIZE);

  const handleOpen = async () => {
    setIsOpen(true);
    if (!tagsFetched) {
      setIsLoading(true);
      try {
        const response = await fetch(`${apiURL}/tags`);
        if (!response.ok) throw new Error('Failed to fetch tags');
        const data = await response.json();
        setAllTags(data);
        setTagsFetched(true);
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleTagClick = (tag: string) => {
    const newSelectedTags = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(newSelectedTags);
  };

  const handleClearTags = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing
    setSelectedTags([]);
  };

  const filteredTags = useMemo(() => {
    return allTags.filter(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allTags, searchTerm]);

  const sortedTags = useMemo(() => {
    const selected = new Set(selectedTags);
    return [...filteredTags].sort((a, b) => {
      const aIsSelected = selected.has(a);
      const bIsSelected = selected.has(b);
      if (aIsSelected && !bIsSelected) return -1;
      if (!aIsSelected && bIsSelected) return 1;
      return a.localeCompare(b);
    });
  }, [filteredTags, selectedTags]);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50;
      if (isNearBottom && visibleTagCount < sortedTags.length) {
        setVisibleTagCount(prevCount => Math.min(prevCount + TAG_CHUNK_SIZE, sortedTags.length));
      }
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => isOpen ? setIsOpen(false) : handleOpen()}
        className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-md hover:bg-gray-600 transition"
      >
        <img src="/tag.svg" alt="Tags" className="h-5 w-5" />
        Tags
        {selectedTags.length > 0 && (
          <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {selectedTags.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-[#282828] border border-gray-600 rounded-lg shadow-lg z-50 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">Filter by Tags</h3>
            {selectedTags.length > 0 && (
               <button
                  onClick={handleClearTags}
                  className="px-2 py-0.5 text-xs text-red-400 hover:text-red-300 rounded-md border border-red-400 hover:border-red-300"
                >
                  Clear All
                </button>
            )}
          </div>
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
          {isLoading ? (
            <p className="text-gray-400">Loading tags...</p>
          ) : (
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="max-h-60 overflow-y-auto flex flex-wrap gap-2 content-start"
            >
              {sortedTags.slice(0, visibleTagCount).map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition ${
                    selectedTags.includes(tag)
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                  }`}
                >
                  {tag}
                </button>
              ))}
               {sortedTags.length === 0 && !searchTerm && (
                 <p className="text-sm text-gray-500 italic px-1">No tags available.</p>
               )}
               {sortedTags.length === 0 && searchTerm && (
                 <p className="text-sm text-gray-500 italic px-1">No tags match '{searchTerm}'.</p>
               )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};