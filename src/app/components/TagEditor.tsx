import React, { useState, useEffect, useRef } from 'react';

const getSelectStyles = (theme: 'light' | 'dark') => ({
  control: (base: any) => ({ 
    ...base, 
    backgroundColor: theme === 'dark' ? 'var(--color-bg-input)' : 'var(--color-bg-input)',
    borderColor: theme === 'dark' ? 'var(--color-border-secondary)' : 'var(--color-border-secondary)',
    boxShadow: 'none',
    '&:hover': {
      borderColor: theme === 'dark' ? 'var(--color-border-primary)' : 'var(--color-border-primary)',
    }
  }),
  menu: (base: any) => ({ 
    ...base, 
    backgroundColor: theme === 'dark' ? 'var(--color-bg-tertiary)' : 'var(--color-bg-modal)' 
  }),
  option: (base: any, { isFocused }: any) => ({ 
    ...base, 
    backgroundColor: isFocused ? (theme === 'dark' ? 'var(--color-border-secondary)' : 'var(--color-bg-secondary)') : (theme === 'dark' ? 'var(--color-bg-tertiary)' : 'var(--color-bg-modal)'),
    color: 'var(--color-text-primary)', 
    padding: '8px 12px'
  }),
  input: (base: any) => ({ ...base, color: 'var(--color-text-primary)' }),
  placeholder: (base: any) => ({...base, color: 'var(--color-text-muted)'}),
});

interface TagEditorProps {
  docId: number;
  apiURL: string;
  lang: 'en' | 'ar';
  theme: 'light' | 'dark';
}

export const TagEditor: React.FC<TagEditorProps> = ({ docId, apiURL, lang, theme }) => {
  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggestionVisible, setIsSuggestionVisible] = useState(false);
  const [suggestionDirection, setSuggestionDirection] = useState<'down' | 'up'>('down');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectStyles = getSelectStyles(theme);

  useEffect(() => {
      const fetchInitialData = async () => {
          setIsLoading(true);
          try {
              const [docTagsRes, allTagsRes] = await Promise.all([
                  fetch(`${apiURL}/tags/${docId}?lang=${lang}`),
                  fetch(`${apiURL}/tags?lang=${lang}`),
              ]);
              const docTagsData = docTagsRes.ok ? await docTagsRes.json() : { tags: [] };
              const allTagsData = allTagsRes.ok ? await allTagsRes.json() : [];
              setTags(docTagsData.tags || []);
              setAllTags((allTagsData || []).sort((a: string, b: string) => a.localeCompare(b)));
          } catch (error) {
              console.error('Failed to fetch tags:', error);
          } finally {
              setIsLoading(false);
          }
      };
      fetchInitialData();
  }, [docId, apiURL, lang]);

  useEffect(() => {
    if (!isSuggestionVisible || !inputRef.current) {
      setSuggestions([]);
      return;
    }

    const availableTags = allTags.filter(
      (tag) => !tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );

    let filtered = availableTags;
    if (inputValue) {
      const lowercasedInput = inputValue.toLowerCase();
      filtered = availableTags.filter(tag => tag.toLowerCase().includes(lowercasedInput));
    }

    setSuggestions(filtered.slice(0, 15));

    const inputRect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - inputRect.bottom;
    // Estimate suggestion list height (approximate)
    const estimatedHeight = Math.min(filtered.length, 15) * 30 + 10; // ~30px per item + padding
    setSuggestionDirection(spaceBelow < estimatedHeight + 20 && inputRect.top > estimatedHeight + 20 ? 'up' : 'down');

  }, [inputValue, allTags, tags, isSuggestionVisible]);


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsSuggestionVisible(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  const handleAddTag = async (tagToAdd: string) => {
     const trimmedTag = tagToAdd.trim();
    if (trimmedTag === '' || tags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
        setInputValue('');
        setIsSuggestionVisible(false);
        return;
    };

    const newTags = [...tags, trimmedTag].sort((a,b)=> a.localeCompare(b));
    setTags(newTags);
    if (!allTags.some(t => t.toLowerCase() === trimmedTag.toLowerCase())) {
         setAllTags([...allTags, trimmedTag].sort((a,b) => a.localeCompare(b)));
    }
    setInputValue('');
    setIsSuggestionVisible(false);

    try {
      const response = await fetch(`${apiURL}/tags/${docId}?lang=${lang}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag: trimmedTag }),
      });
      if (!response.ok) {
          setTags(tags);
           setAllTags(allTags.filter(t => t.toLowerCase() !== trimmedTag.toLowerCase()));
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to add tag');
      }
    } catch (error: any) {
      console.error('Failed to add tag:', error);
      alert(`Error adding tag: ${error.message}`);
      setTags(tags);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
     const originalTags = [...tags];
     setTags(tags.filter((tag) => tag.toLowerCase() !== tagToRemove.toLowerCase()));

    try {
      const response = await fetch(`${apiURL}/tags/${docId}/${encodeURIComponent(tagToRemove)}`, { method: 'DELETE' });
        if (!response.ok) {
            setTags(originalTags);
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete tag');
        }
    } catch (error: any) {
      console.error('Failed to delete tag:', error);
       alert(`Error deleting tag: ${error.message}`);
       setTags(originalTags);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTag(inputValue); }
    else if (e.key === 'Escape') { setIsSuggestionVisible(false); }
  };

  const handleToggleSuggestions = () => {
    if (isSuggestionVisible) setIsSuggestionVisible(false);
    else { setInputValue(''); setIsSuggestionVisible(true); }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleAddTag(suggestion);
  };

  return (
    <div className="mt-4" ref={wrapperRef}>
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Tags</h4>
      {isLoading ? <p className="text-sm text-gray-500">Loading tags...</p> : (
        <>
            <div className="flex flex-wrap gap-2 mb-3 bg-gray-100 dark:bg-[#121212] p-2 rounded-md min-h-[40px]">
                {tags.length > 0 ? tags.map((tag, index) => (
                    <div key={index} className="flex items-center bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium px-2.5 py-1 rounded-md">
                        <span>{tag}</span>
                        <button onClick={() => handleRemoveTag(tag)} className="ml-2 -mr-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white focus:outline-none" aria-label={`Remove ${tag}`} >
                             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"> <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /> </svg>
                        </button>
                    </div>
                )) : <span className="text-sm text-gray-500 italic px-1">No tags yet.</span>}
            </div>

            {/* Input Wrapper - Make it relative */}
            <div className="relative">
                <div className="flex">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onFocus={() => setIsSuggestionVisible(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Add or search for a tag..."
                        className="w-full px-3 py-2 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-l-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                        style={{...selectStyles.input, ...selectStyles.control}}
                        aria-autocomplete="list" aria-controls="tag-suggestions" aria-expanded={isSuggestionVisible}
                    />
                    <button onClick={handleToggleSuggestions} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md hover:bg-gray-200 dark:hover:bg-gray-600 transition" aria-label="Browse tags" >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"> <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /> </svg>
                    </button>
                </div>

                 {isSuggestionVisible && suggestions.length > 0 && (
                    <ul
                        id="tag-suggestions" role="listbox"
                        style={{...selectStyles.menu}}
                        className={`absolute left-0 right-0 z-50 border border-gray-300 dark:border-gray-600 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg
                                    ${suggestionDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}
                    >
                        {suggestions.map((suggestion, index) => (
                            <li
                                key={index}
                                onMouseDown={() => handleSuggestionClick(suggestion)}
                                className="px-3 py-2 text-gray-900 dark:text-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-500"
                                style={selectStyles.option(null, { isFocused: false })}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = getSelectStyles(theme).option(null, { isFocused: true }).backgroundColor}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = getSelectStyles(theme).option(null, { isFocused: false }).backgroundColor}
                                role="option" aria-selected="false"
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