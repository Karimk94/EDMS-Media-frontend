'use client';

import Image from 'next/image';
import React from 'react';

interface ModalNavigationBarProps {
  currentDocIndex?: number;
  totalInGroup?: number;
  isGrouped?: boolean;
  onNavigateNext?: () => void;
  onNavigatePrevious?: () => void;
  canNavigateNext?: boolean;
  canNavigatePrevious?: boolean;
  searchTerm?: string;
  searchMatchField?: string;
  searchFieldValue?: string;
  lang?: 'en' | 'ar';
  t?: Function;
}

/**
 * Navigation bar for document modals when viewing collaged/grouped documents
 * Shows:
 * - Document position in group (e.g., "2 of 5")
 * - Navigation buttons to move between documents
 * - Search term information (what was searched for in this group)
 */
export const ModalNavigationBar: React.FC<ModalNavigationBarProps> = ({
  currentDocIndex = 0,
  totalInGroup = 1,
  isGrouped = false,
  onNavigateNext,
  onNavigatePrevious,
  canNavigateNext = false,
  canNavigatePrevious = false,
  searchTerm,
  searchMatchField,
  searchFieldValue,
  lang = 'en',
  t = (key: string) => key,
}) => {
  const hasGroupNavigation = isGrouped && totalInGroup > 1;
  const hasSearchContext = Boolean(searchTerm);

  if (!hasGroupNavigation && !hasSearchContext) {
    return null;
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border-b-2 border-blue-200 dark:border-blue-700 px-4 py-3 flex items-center justify-between gap-4">
      {/* Left side: Info about current document in group */}
      <div className="flex items-center gap-3 flex-1">
        {hasGroupNavigation && (
          <>
            <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {currentDocIndex + 1} / {totalInGroup}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {typeof t === 'function' ? t('documentGroup') : 'Document from group'}
            </div>
          </>
        )}

        {/* Show search context if available */}
        {searchTerm && (
          <div className={`text-xs text-gray-700 dark:text-gray-300 ${hasGroupNavigation ? 'ml-auto' : ''}`}>
            <div className="inline-flex max-w-full flex-col gap-1 bg-yellow-200 dark:bg-yellow-700 px-2 py-1 rounded">
              <span>
                Found: <strong>{searchTerm}</strong>
                {searchMatchField && <span> in {searchMatchField}</span>}
              </span>
              {searchFieldValue && (
                <span className="max-w-[60vw] truncate text-gray-700 dark:text-yellow-50" title={searchFieldValue}>
                  {searchFieldValue}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right side: Navigation buttons */}
      {hasGroupNavigation && (
      <div className="flex items-center gap-2">
        <button
          onClick={onNavigatePrevious}
          disabled={!canNavigatePrevious}
          className="p-2 hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition text-blue-700 dark:text-blue-300"
          title={typeof t === 'function' ? t('previousDocument') : 'Previous document'}
        >
          <Image
            src={lang === 'ar' ? '/icons/chevron-right.svg' : '/icons/chevron-left.svg'}
            alt="Previous"
            width={20}
            height={20}
            className="h-5 w-5 dark:invert"
          />
        </button>

        <button
          onClick={onNavigateNext}
          disabled={!canNavigateNext}
          className="p-2 hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded transition text-blue-700 dark:text-blue-300"
          title={typeof t === 'function' ? t('nextDocument') : 'Next document'}
        >
          <Image
            src={lang === 'ar' ? '/icons/chevron-left.svg' : '/icons/chevron-right.svg'}
            alt="Next"
            width={20}
            height={20}
            className="h-5 w-5 dark:invert"
          />
        </button>
      </div>
      )}
    </div>
  );
};
