"use client";

import React, { useState, useEffect, useRef } from 'react';

interface YearFilterProps {
  selectedYears: number[];
  setSelectedYears: (years: number[]) => void;
}

export const YearFilter: React.FC<YearFilterProps> = ({ selectedYears, setSelectedYears }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const startYear = 2005;
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i);

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

  const handleYearClick = (year: number) => {
    const newSelectedYears = selectedYears.includes(year)
      ? selectedYears.filter(y => y !== year)
      : [...selectedYears, year];
    setSelectedYears(newSelectedYears.sort((a, b) => b - a));
  };

  const handleClearYears = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedYears([]);
  };

  const getButtonText = () => {
    if (selectedYears.length === 0) return 'Year';
    if (selectedYears.length === 1) return selectedYears[0].toString();
    return `${selectedYears.length} Years`;
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-md hover:bg-gray-600 transition"
      >
        <img src="/calendar.svg" alt="Years" className="h-5 w-5" />
        {getButtonText()}
        {selectedYears.length > 0 && (
          <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {selectedYears.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-[#282828] border border-gray-600 rounded-lg shadow-lg z-50 p-2">
          {selectedYears.length > 0 && (
             <button
                onClick={handleClearYears}
                className="w-full text-center px-3 py-1.5 text-xs text-red-400 hover:text-red-300 rounded-md mb-2 border border-red-400 hover:border-red-300"
              >
                Clear All Years
              </button>
          )}
          <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
            {years.map(year => (
              <button
                key={year}
                onClick={() => handleYearClick(year)}
                className={`w-full text-center px-3 py-1.5 text-sm rounded-md transition ${
                  selectedYears.includes(year)
                    ? 'bg-red-600 text-white'
                    : 'text-gray-200 hover:bg-gray-500'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};