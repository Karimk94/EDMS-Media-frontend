"use client";

import Image from 'next/image';

import { PersonOption } from '../../models/PersonOption';
import { AdvancedFilters } from './AdvancedFilters';
import { TagFilter } from './TagFilter';
import { YearFilter } from './YearFilter';

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
}

/**
 * The filter toolbar shown above the document grid (tags, years, date range, person, media type).
 */
export function FilterBar({
    apiURL, selectedTags, setSelectedTags, selectedYears, setSelectedYears,
    dateFrom, setDateFrom, dateTo, setDateTo, selectedPerson, setSelectedPerson,
    personCondition, setPersonCondition, filterMediaType, setFilterMediaType,
    hasActiveFilters, onClearFilters, onPageReset, t, lang, theme
}: FilterBarProps) {
    return (
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700 justify-end">
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
                    className="px-3 py-2 bg-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-red-100 hover:text-red-700 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-red-900 dark:hover:text-red-300 transition flex items-center gap-1"
                    title="Clear all active filters"
                >
                    <Image src="/icons/close.svg" alt="" width={16} height={16} className="dark:invert" />
                    {t('clearFilters')}
                </button>
            )}
        </div>
    );
}
