import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useToast } from '../context/ToastContext';
import { useTags } from '../../hooks/useTags';

const getSelectStyles = (theme: 'light' | 'dark') => ({
  control: (base: any) => ({
    ...base,
    backgroundColor: theme === 'dark' ? 'var(--color-bg-input)' : 'white',
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
  placeholder: (base: any) => ({ ...base, color: 'var(--color-text-muted)' }),
});

import { TagObject } from '../../interfaces/TagObject';
import { TagEditorProps } from '../../interfaces/PropsInterfaces';

export const TagEditor: React.FC<TagEditorProps> = ({ docId, apiURL, lang, theme, t }) => {
  // Use the new hook
  const {
    documentTags: tags,
    allTags,
    isLoadingDocumentTags: isLoading,
    addTag,
    removeTag,
    toggleShortlist
  } = useTags({ lang, docId });

  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionVisible, setIsSuggestionVisible] = useState(false);
  const [suggestionDirection, setSuggestionDirection] = useState<'down' | 'up'>('down');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectStyles = getSelectStyles(theme);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isSuggestionVisible || !inputRef.current) {
      if (suggestions.length > 0) {
        setSuggestions([]);
      }
      return;
    }

    const availableTags = (allTags || []).filter(
      (tag) => !tags.some(t => t.text.toLowerCase() === tag.toLowerCase())
    );

    let filtered = availableTags;
    if (inputValue) {
      const lowercasedInput = inputValue.toLowerCase();
      filtered = availableTags.filter(tag => tag.toLowerCase().includes(lowercasedInput));
    }

    setSuggestions(filtered.slice(0, 15));

    const inputRect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - inputRect.bottom;
    const estimatedHeight = Math.min(filtered.length, 15) * 30 + 10;
    setSuggestionDirection(spaceBelow < estimatedHeight + 20 && inputRect.top > estimatedHeight + 20 ? 'up' : 'down');

  }, [inputValue, allTags, tags, isSuggestionVisible, suggestions.length]);


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsSuggestionVisible(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  const handleAddTagClick = async (tagToAdd: string) => {
    const trimmedTag = tagToAdd.trim();
    if (trimmedTag === '' || tags.some(t => t.text.toLowerCase() === trimmedTag.toLowerCase())) {
      setInputValue('');
      setIsSuggestionVisible(false);
      return;
    };

    try {
      setInputValue('');
      setIsSuggestionVisible(false);
      await addTag(trimmedTag);
    } catch (error: any) {
      console.error('Failed to add tag:', error);
      showToast(`${t('errorAddingTag')}: ${error.message}`, 'error');
    }
  };

  const handleRemoveTagClick = async (tagToRemove: string) => {
    try {
      await removeTag(tagToRemove);
    } catch (error: any) {
      console.error('Failed to delete tag:', error);
      showToast(`${t('errorDeletingTag')}: ${error.message}`, 'error');
    }
  };

  const handleToggleShortlistClick = async (tag: TagObject) => {
    if (tag.type === 'person') return;

    try {
      await toggleShortlist(tag.text);
    } catch (error) {
      console.error('Error toggling shortlist:', error);
      showToast(t("failedUpdateShortlist"), 'error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddTagClick(inputValue); }
    else if (e.key === 'Escape') { setIsSuggestionVisible(false); }
  };

  const handleToggleSuggestions = () => {
    if (isSuggestionVisible) setIsSuggestionVisible(false);
    else { setInputValue(''); setIsSuggestionVisible(true); }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleAddTagClick(suggestion);
  };

  return (
    <div className="mt-4" ref={wrapperRef}>
      <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('tags')}</h4>
      {isLoading ? <p className="text-sm text-gray-500">{t('LoadingTags')}...</p> : (
        <>
          <div className="flex flex-wrap gap-2 mb-3 bg-gray-100 dark:bg-[#121212] p-2 rounded-md min-h-[40px]">
            {tags.length > 0 ? tags.map((tag, index) => (
              <div key={index} className={`flex items-center bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-medium px-2 py-1 rounded-md ${tag.type === 'person' ? 'border border-blue-400 dark:border-blue-600' : ''}`}>
                {/* Shortlist Star Button (Only for Keywords) */}
                {tag.type === 'keyword' && (
                  <button
                    onClick={() => handleToggleShortlistClick(tag)}
                    className="mr-1.5 text-yellow-500 hover:text-yellow-400 focus:outline-none"
                    title={tag.shortlisted ? "Remove from shortlist" : "Add to shortlist"}
                  >
                    {tag.shortlisted === 1 ? (
                      <Image src="/icons/star-filled.svg" alt="" width={14} height={14} />
                    ) : (
                      <Image src="/icons/star-outline.svg" alt="" width={14} height={14} />
                    )}
                  </button>
                )}

                <span>{tag.text}</span>

                <button onClick={() => handleRemoveTagClick(tag.text)} className="ml-2 -mr-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white focus:outline-none" aria-label={`Remove ${tag.text}`} >
                  <Image src="/icons/close.svg" alt="" width={12} height={12} className="dark:invert" />
                </button>
              </div>
            )) : <span className="text-sm text-gray-500 italic px-1">{t('noTagsAssigned')}.</span>}
          </div>

          {/* Input Wrapper */}
          <div className="relative">
            <div className="flex">
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setIsSuggestionVisible(true)}
                onKeyDown={handleKeyDown}
                placeholder="Add or search for a tag..."
                className="w-full px-3 py-2 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-l-md focus:ring-2 focus:ring-red-500 focus:outline-none"
                style={{ ...selectStyles.input, ...selectStyles.control }}
                aria-autocomplete="list" aria-controls="tag-suggestions" aria-expanded={isSuggestionVisible}
              />
              <button onClick={handleToggleSuggestions} className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md hover:bg-gray-200 dark:hover:bg-gray-600 transition" aria-label="Browse tags" >
                <Image src="/icons/more-vertical.svg" alt="" width={20} height={20} className="dark:invert" />
              </button>
            </div>

            {isSuggestionVisible && suggestions.length > 0 && (
              <ul
                id="tag-suggestions" role="listbox"
                style={{ ...selectStyles.menu }}
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