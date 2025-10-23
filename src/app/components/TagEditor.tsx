import React, { useState, useEffect, useRef } from 'react';

interface TagEditorProps {
  docId: number;
  apiURL: string;
}

export const TagEditor: React.FC<TagEditorProps> = ({ docId, apiURL }) => {
  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggestionVisible, setIsSuggestionVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [docTagsRes, allTagsRes] = await Promise.all([
          fetch(`${apiURL}/tags/${docId}`),
          fetch(`${apiURL}/tags`),
        ]);

        const docTagsData = docTagsRes.ok ? await docTagsRes.json() : { tags: [] };
        const allTagsData = allTagsRes.ok ? await allTagsRes.json() : [];

        setTags(docTagsData.tags || []);
        setAllTags(allTagsData || []);
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [docId, apiURL]);

  useEffect(() => {
    if (!isSuggestionVisible) {
      setSuggestions([]);
      return;
    }

    const availableTags = allTags.filter(
      (tag) => !tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );

    if (inputValue) {
      const lowercasedInput = inputValue.toLowerCase();
      const filtered = availableTags.filter(tag => tag.toLowerCase().includes(lowercasedInput));
      setSuggestions(filtered.slice(0, 10));
    } else {
      setSuggestions(availableTags.slice(0, 20));
    }
  }, [inputValue, allTags, tags, isSuggestionVisible]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsSuggestionVisible(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [wrapperRef]);

  const handleAddTag = async (tagToAdd: string) => {
    const trimmedTag = tagToAdd.trim();
    if (trimmedTag === '' || tags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
        setInputValue('');
        setIsSuggestionVisible(false);
        return;
    };

    try {
      const response = await fetch(`${apiURL}/tags/${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: trimmedTag }),
      });
      if (response.ok) {
        setTags([...tags, trimmedTag].sort());
        if (!allTags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
            setAllTags([...allTags, trimmedTag].sort());
        }
        setInputValue('');
        setIsSuggestionVisible(false);
      } else {
        throw new Error('Failed to add tag');
      }
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    try {
      await fetch(`${apiURL}/tags/${docId}/${encodeURIComponent(tagToRemove)}`, {
        method: 'DELETE',
      });
      setTags(tags.filter((tag) => tag !== tagToRemove));
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag(inputValue);
    } else if (e.key === 'Escape') {
        setIsSuggestionVisible(false);
    }
  }

  const handleToggleSuggestions = () => {
    if (isSuggestionVisible) {
        setIsSuggestionVisible(false);
    } else {
        setInputValue('');
        setIsSuggestionVisible(true);
    }
  }

  return (
    <div className="mt-4">
      <h4 className="font-semibold text-gray-300 mb-2">Tags</h4>
      {isLoading ? <p className="text-sm text-gray-500">Loading tags...</p> : (
        <>
            <div className="flex flex-wrap gap-2 mb-3 bg-[#121212] p-2 rounded-md min-h-[40px]">
                {tags.length > 0 ? tags.map((tag, index) => (
                    <div key={index} className="flex items-center bg-gray-600 text-gray-200 text-xs font-medium px-2.5 py-1 rounded-md">
                    <span>{tag}</span>
                    <button 
                        onClick={() => handleRemoveTag(tag)} 
                        className="ml-2 -mr-1 text-gray-400 hover:text-white focus:outline-none"
                        aria-label={`Remove ${tag}`}
                    >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    </div>
                )) : <span className="text-sm text-gray-500 italic px-1">No tags yet.</span>}
            </div>

            <div className="relative" ref={wrapperRef}>
                <div className="flex">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={() => setIsSuggestionVisible(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Add or search for a tag..."
                        className="w-full px-3 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-l-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                    <button 
                        onClick={handleToggleSuggestions}
                        className="px-3 py-2 bg-gray-700 text-white border border-l-0 border-gray-600 rounded-r-md hover:bg-gray-600 transition"
                        aria-label="Browse tags"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                    </button>
                </div>
                {isSuggestionVisible && suggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-[#333] border border-gray-600 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {suggestions.map((suggestion, index) => (
                        <li
                        key={index}
                        onClick={() => handleAddTag(suggestion)}
                        className="px-3 py-2 text-gray-200 cursor-pointer hover:bg-gray-500"
                        >
                        {suggestion}
                        </li>
                    ))}
                    </ul>
                )}
            </div>
        </>
      )}
    </div>
  );
};