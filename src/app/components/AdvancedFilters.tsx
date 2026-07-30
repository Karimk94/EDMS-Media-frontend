"use client";

import React, { useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import { GroupBase, OptionsOrGroups } from 'react-select';
import { AsyncPaginate } from 'react-select-async-paginate';
import Image from 'next/image';
import { fetchPersons } from '../../hooks/usePersons';
import { PersonOption } from '../../models/PersonOption';

import { AdvancedFiltersProps, DateRangePickerProps } from '../../interfaces/PropsInterfaces';

const DateRangePicker: React.FC<DateRangePickerProps> = ({ dateFrom, setDateFrom, dateTo, setDateTo, t }) => {
  const handleClear = () => {
    setDateFrom(null);
    setDateTo(null);
  };

  const handleDateFromChange = (date: Date | null) => {
    if (date) {
      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);
      setDateFrom(newDate);
    } else {
      setDateFrom(null);
    }
  };

  const handleDateToChange = (date: Date | null) => {
    if (date) {
      const newDate = new Date(date);
      newDate.setHours(23, 59, 59, 999);
      setDateTo(newDate);
    } else {
      setDateTo(null);
    }
  };


  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label htmlFor="dateFrom" className="text-sm text-gray-500 dark:text-gray-400 w-12">{t('from')}:</label>
        <DatePicker
          id="dateFrom"
          selected={dateFrom}
          onChange={handleDateFromChange}
          selectsStart
          startDate={dateFrom}
          endDate={dateTo}
          isClearable
          dateFormat="dd/MM/yyyy"
          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
          autoComplete='off'
          locale="en-GB"
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="dateTo" className="text-sm text-gray-500 dark:text-gray-400 w-12">{t('to')}:</label>
        <DatePicker
          id="dateTo"
          selected={dateTo}
          onChange={handleDateToChange}
          selectsEnd
          startDate={dateFrom}
          endDate={dateTo}
          minDate={dateFrom ?? undefined}
          isClearable
          dateFormat="dd/MM/yyyy"
          className="w-full px-3 py-2 bg-gray-50 dark:bg-[#121212] text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-red-500 focus:outline-none"
          autoComplete='off'
          locale="en-GB"
        />
      </div>
      {(dateFrom || dateTo) && (
        <button
          onClick={handleClear}
          className="w-full mt-2 text-center text-sm text-red-400 hover:text-red-300"
          aria-label="Clear date range"
        >
          {t('clearDates')}
        </button>
      )}
    </div>
  );
};

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
  }),
  multiValue: (base: any) => ({ ...base, backgroundColor: theme === 'dark' ? 'var(--color-border-secondary)' : 'var(--color-bg-tertiary)' }),
  multiValueLabel: (base: any) => ({ ...base, color: 'var(--color-text-primary)' }),
  multiValueRemove: (base: any) => ({ ...base, '&:hover': { backgroundColor: 'var(--color-border-primary)', color: 'var(--color-text-primary)' } }),
  singleValue: (base: any) => ({ ...base, color: 'var(--color-text-primary)' }),
  input: (base: any) => ({ ...base, color: 'var(--color-text-primary)' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base: any) => ({ ...base, color: 'var(--color-text-muted)' }),
  clearIndicator: (base: any) => ({ ...base, color: 'var(--color-text-muted)' }),
  placeholder: (base: any) => ({ ...base, color: 'var(--color-text-muted)' }),
});




export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  dateFrom, setDateFrom, dateTo, setDateTo,
  selectedPerson, setSelectedPerson,
  personCondition, setPersonCondition,
  mediaType, setMediaType,
  apiURL, t, lang, theme
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectStyles = getSelectStyles(theme);

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

  const activeFilterCount = [dateFrom, dateTo, selectedPerson && selectedPerson.length > 0, mediaType].filter(Boolean).length;

  const loadPersonOptions = async (
    search: string,
    loadedOptions: OptionsOrGroups<PersonOption, GroupBase<PersonOption>>,
    additional: { page: number } | undefined
  ) => {
    const page = additional?.page || 1;
    try {
      const data = await fetchPersons(page, search, lang);

      const options = data.options.map((person: any) => {
        const label = (lang === 'ar' && person.name_arabic)
          ? `${person.name_arabic} - ${person.name_english}`
          : `${person.name_english}${person.name_arabic ? ` - ${person.name_arabic}` : ''}`;

        return { value: person.id, label };
      });

      return {
        options,
        hasMore: data.hasMore,
        additional: {
          page: page + 1,
        },
      };
    } catch (error) {
      console.error("Error loading person options:", error);
      return { options: [], hasMore: false };
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white text-sm font-medium rounded-md hover:bg-gray-100 dark:hover:bg-gray-600 transition shadow-sm"
      >
        <Image src="/icons/filter.svg" alt="" width={20} height={20} className="dark:invert" />
        {t('filters')}
        {activeFilterCount > 0 && (
          <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-[#282828] border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 p-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('advancedFilters')}</h3>

          <div className="space-y-4">
            {/* Media Type Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('mediaType')}</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setMediaType(mediaType === 'image' ? null : 'image')}
                  className={`flex-1 flex items-center justify-center p-2 rounded-md border transition-colors ${mediaType === 'image'
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white dark:bg-[#121212] border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  title={t('images')}
                >
                  <Image src="/file-image.svg" alt={t('images')} width={20} height={20} className={`w-5 h-5 `} />
                </button>
                <button
                  onClick={() => setMediaType(mediaType === 'video' ? null : 'video')}
                  className={`flex-1 flex items-center justify-center p-2 rounded-md border transition-colors ${mediaType === 'video'
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-white dark:bg-[#121212] border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  title={t('videos')}
                >
                  <Image src="/file-video.svg" alt={t('videos')} width={20} height={20} className={`w-5 h-5`} />
                </button>
                <button
                  onClick={() => setMediaType(mediaType === 'pdf' ? null : 'pdf')}
                  className={`flex-1 flex items-center justify-center p-2 rounded-md border transition-colors ${mediaType === 'pdf'
                    ? 'bg-yellow-500 border-yellow-500 text-white'
                    : 'bg-white dark:bg-[#121212] border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  title={t("files")}
                >
                  <Image src="/file-document.svg" alt={t("files")} width={20} height={20} className={`w-5 h-5`} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('dateRange')}</label>
              <DateRangePicker
                dateFrom={dateFrom}
                setDateFrom={setDateFrom}
                dateTo={dateTo}
                setDateTo={setDateTo}
                t={t}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('person')}</label>
              <AsyncPaginate
                key={lang}
                isMulti
                value={selectedPerson}
                loadOptions={loadPersonOptions}
                onChange={(value) => setSelectedPerson(value as PersonOption[])}
                isClearable
                placeholder={t('searchForPerson')}
                additional={{
                  page: 1,
                }}
                styles={selectStyles}
              />
              {selectedPerson && selectedPerson.length > 1 && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('matchCondition')}</label>
                  <div className="flex rounded-md shadow-sm">
                    <button
                      type="button"
                      onClick={() => setPersonCondition('any')}
                      className={`px-4 py-1 text-sm font-medium rounded-l-md w-1/2 transition ${personCondition === 'any'
                        ? 'bg-red-600 text-white z-10 ring-1 ring-red-500'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                      Any (OR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonCondition('all')}
                      className={`-ml-px px-4 py-1 text-sm font-medium rounded-r-md w-1/2 transition ${personCondition === 'all'
                        ? 'bg-red-600 text-white z-10 ring-1 ring-red-500'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                      All (AND)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 text-right">
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-md hover:bg-red-700 transition"
            >
              {t('apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};