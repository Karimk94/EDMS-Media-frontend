import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
  t: Function;
  lang: 'en' | 'ar';
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, t, lang }) => {
  const [input, setInput] = useState('');

  const handleSearch = () => onSearch(input.trim());
  
  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClear = () => {
    setInput('');
    onSearch('');
  };

  return (
    <div
      className={`flex w-full relative items-stretch rounded-full border border-gray-300 dark:border-gray-600 
                  bg-gray-100 dark:bg-[#121212] overflow-hidden transition-shadow
                  focus-within:ring-2 focus-within:ring-gray-500 focus-within:border-gray-500`}
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyUp={handleKeyUp}
        placeholder={t('search')}
        className={`flex-1 py-2 bg-transparent text-gray-900 dark:text-gray-200 
                    border-none focus:ring-0 outline-none placeholder-gray-500
                    ${lang === 'ar' ? 'pr-4 pl-10' : 'pl-4 pr-10'}`}
      />

      {input.length > 0 && (
        <button
          onClick={handleClear}
          className={`absolute top-0 bottom-0 my-auto p-2 text-gray-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white 
                      ${lang === 'ar' ? 'left-[68px]' : 'right-[68px]'}`}
          aria-label="Clear search"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <button
        onClick={handleSearch}
        className={`px-5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center justify-center
                    ${lang === 'ar' ? 'border-r border-gray-300 dark:border-gray-600' : 'border-l border-gray-300 dark:border-gray-600'}`}
        aria-label="Search"
      >
        <svg
          className="w-5 h-5 text-gray-600 dark:text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </button>
    </div>
  );
};