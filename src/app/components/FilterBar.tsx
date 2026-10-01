"use client";

import Image from 'next/image';

import { PersonOption } from '../../models/PersonOption';
import { AdvancedFilters } from './AdvancedFilters';
import { TagFilter } from './TagFilter';
import { YearFilter } from './YearFilter';
import { Spinner } from './Spinner';

interface FilterBarProps {
    apiURL: string;
    selectedTags: string[];
    setSelectedTags: (tags: string[]) => void;
    selectedYears: number[];
    setSelectedYears: (years: number[]) => void;
    dateFrom: Date | null;
    setDateFrom: (date: Date | null) => void;
    dateTo: Date | null;
    setDateTo: (date: Date | null) => void;
    selectedPerson: PersonOption[] | null;
    setSelectedPerson: (person: PersonOption[] | null) => void;
    personCondition: 'any' | 'all';
    setPersonCondition: (condition: 'any' | 'all') => void;
    filterMediaType: 'image' | 'video' | 'pdf' | null;
    setFilterMediaType: (type: 'image' | 'video' | 'pdf' | null) => void;
    hasActiveFilters: boolean;
    onClearFilters: () => void;
    onPageReset: () => void;
    t: Function;
    lang: 'en' | 'ar';
    theme: 'light' | 'dark';

    /** Optional search bar props (rendered in Folders section) */
    showSearch?: boolean;
    searchValue?: string;
    onSearchChange?: (val: string) => void;
    isSearching?: boolean;
    searchPlaceholder?: string;
}

/**
 * The filter toolbar shown above the document grid (tags, years, date range, person, media type, and optional folder search).
 */
export function FilterBar({
    apiURL, selectedTags, setSelectedTags, selectedYears, setSelectedYears,
    dateFrom, setDateFrom, dateTo, setDateTo, selectedPerson, setSelectedPerson,
    personCondition, setPersonCondition, filterMediaType, setFilterMediaType,
    hasActiveFilters, onClearFilters, onPageReset, t, lang, theme,
    showSearch, searchValue, onSearchChange, isSearching, searchPlaceholder
}: FilterBarProps) {
    const isRtl = lang === 'ar';

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            {showSearch && onSearchChange ? (
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <input
                        type="text"
                        placeholder={searchPlaceholder || t('searchInFolder') || "Search by name or content..."}
                        value={searchValue || ''}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className={`w-full py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#252525] text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition shadow-sm ${
                            isRtl ? 'pr-9 pl-9' : 'pl-9 pr-9'
                        }`}
                    />
                    <Image
                        src="/search-icon.svg"
                        alt=""
                        width={16}
                        height={16}
                        className={`absolute top-1/2 transform -translate-y-1/2 opacity-60 dark:invert pointer-events-none ${
                            isRtl ? 'right-3' : 'left-3'
                        }`}
                    />
                    {isSearching && (
                        <div className={`absolute top-1/2 transform -translate-y-1/2 ${
                            isRtl ? 'left-3' : 'right-3'
                        }`}>
                            <Spinner size="xs" />
                        </div>
                    )}
                    {searchValue && !isSearching && (
                        <button
                            type="button"
                            onClick={() => onSearchChange('')}
                            className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                isRtl ? 'left-2' : 'right-2'
                            }`}
                            aria-label="Clear search"
                        >
                            <Image src="/icons/close.svg" alt="" width={14} height={14} className="dark:invert" />
                        </button>
                    )}
                </div>
            ) : (
                <div />
            )}

            <div className="flex items-center gap-3 flex-wrap ml-auto">
                <TagFilter
                    apiURL={apiURL}
                    selectedTags={selectedTags}
                    setSelectedTags={(tags) => { setSelectedTags(tags); onPageReset(); }}
                    t={t}
                    lang={lang}
                />
                <YearFilter
                    selectedYears={selectedYears}
                    setSelectedYears={(years) => { setSelectedYears(years); onPageReset(); }}
                    t={t}
                />
                <AdvancedFilters
                    dateFrom={dateFrom}
                    setDateFrom={(date) => { setDateFrom(date); onPageReset(); }}
                    dateTo={dateTo}
                    setDateTo={(date) => { setDateTo(date); onPageReset(); }}
                    selectedPerson={selectedPerson}
                    setSelectedPerson={(person) => { setSelectedPerson(person); onPageReset(); }}
                    personCondition={personCondition}
                    setPersonCondition={(condition) => { setPersonCondition(condition); onPageReset(); }}
                    mediaType={filterMediaType}
                    setMediaType={(type) => { setFilterMediaType(type); onPageReset(); }}
                    apiURL={apiURL}
                    t={t}
                    lang={lang}
                    theme={theme}
                />
                {hasActiveFilters && (
                    <button
                        onClick={onClearFilters}
                        className="px-3 py-2 bg-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-red-900 dark:hover:text-red-300 transition flex items-center gap-1 shadow-sm"
                        title="Clear all active filters"
                    >
                        <Image src="/icons/close.svg" alt="" width={16} height={16} className="dark:invert" />
                        {t('clearFilters')}
                    </button>
                )}
            </div>
        </div>
    );
}
