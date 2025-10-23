import React from 'react';
import { SearchBar } from './SearchBar';
import { AdvancedFilters } from './AdvancedFilters'; 
import { TagFilter } from './TagFilter';
import { YearFilter } from './YearFilter';

interface PersonOption {
  value: number;
  label: string;
}

interface HeaderProps {
  onSearch: (searchTerm: string) => void;
  onClearCache: () => void;
  onClearFilters: () => void; // New prop for clearing filters
  dateFrom: Date | null;
  setDateFrom: (date: Date | null) => void;
  dateTo: Date | null;
  setDateTo: (date: Date | null) => void;
  selectedPerson: PersonOption[] | null;
  setSelectedPerson: (person: PersonOption[] | null) => void;
  personCondition: 'any' | 'all';
  setPersonCondition: (condition: 'any' | 'all') => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  selectedYears: number[]; // Updated type
  setSelectedYears: (years: number[]) => void; // Updated type
  apiURL: string;
  onOpenUploadModal: () => void;
  isProcessing: boolean;
  hasActiveFilters: boolean; // New prop to show/hide clear button
}

export const Header: React.FC<HeaderProps> = ({ 
  onSearch, onClearCache, onClearFilters,
  dateFrom, setDateFrom, dateTo, setDateTo, 
  selectedPerson, setSelectedPerson,
  personCondition, setPersonCondition,
  selectedTags, setSelectedTags,
  selectedYears, setSelectedYears,
  apiURL,
  onOpenUploadModal,
  isProcessing,
  hasActiveFilters
}) => (
  <header className="sticky top-0 z-40 bg-[#212121] border-b border-gray-700 px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between h-16">
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-white">
          <span className="text-red-500">Smart</span> EDMS 
        </h1>
      </div>

      <div className="flex-1 flex justify-center px-4 items-center gap-4">
        <div className="w-full max-w-md">
          <SearchBar onSearch={onSearch} />
        </div>
        <TagFilter 
          apiURL={apiURL}
          selectedTags={selectedTags}
          setSelectedTags={setSelectedTags}
        />
        <YearFilter
          selectedYears={selectedYears}
          setSelectedYears={setSelectedYears}
        />
        <AdvancedFilters
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          selectedPerson={selectedPerson}
          setSelectedPerson={setSelectedPerson}
          personCondition={personCondition}
          setPersonCondition={setPersonCondition}
          apiURL={apiURL}
        />
        {/* Conditional Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-3 py-2 bg-gray-700 text-white text-xs font-medium rounded-md hover:bg-red-600 transition flex items-center gap-1"
            title="Clear all active filters (except search)"
          >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="red" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
             </svg>
            Clear Filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        {isProcessing && (
          <div className="flex items-center gap-2 text-white text-sm">
            <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Processing...</span>
          </div>
        )}
        <button
          onClick={onOpenUploadModal}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Upload
        </button>
        <button hidden={true}
          onClick={onClearCache}
          className="px-3 py-2 bg-gray-700 text-white text-xs font-medium rounded-md hover:bg-gray-600 transition"
        >
          Clear Cache
        </button>
      </div>
    </div>
  </header>
);