import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (searchTerm: string) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [input, setInput] = useState('');

  const handleSearch = () => onSearch(input.trim());
  
  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClear = () => {
    setInput('');
    onSearch(''); // Trigger a search with no criteria
  };

  return (
    <div className="flex w-full relative items-stretch"> {/* Changed items-center to items-stretch */}
      <input 
        type="text" 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyUp={handleKeyUp}
        placeholder="Search..."
        className="flex-1 pl-4 pr-10 py-2 bg-[#121212] text-gray-200 border border-gray-600 rounded-l-full focus:ring-2 focus:ring-red-500 focus:outline-none focus:border-red-500 transition"
      />
      
      {/* Clear button (X) */}
      {input.length > 0 && (
        <button
          onClick={handleClear}
          className="absolute right-[68px] top-0 bottom-0 my-auto p-2 text-gray-400 hover:text-white"
          aria-label="Clear search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      )}

      {/* Search button */}
      <button 
        onClick={handleSearch}
        className="px-5 bg-gray-700 border border-gray-600 border-l-0 rounded-r-full hover:bg-gray-600 transition"
        aria-label="Search"
      >
        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
        </svg>
      </button>
    </div>
  );
};
