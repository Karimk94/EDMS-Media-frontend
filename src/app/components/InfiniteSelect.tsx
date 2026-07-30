import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Spinner } from './Spinner';

interface InfiniteSelectProps {
  options: { label: string; value: string; sublabel?: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  onLoadMore?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  onSearch?: (val: string) => void;
  searchValue?: string;
  t: Function;
}

export const InfiniteSelect: React.FC<InfiniteSelectProps> = ({
  options,
  value,
  onChange,
  placeholder,
  onLoadMore,
  isLoading,
  disabled,
  onSearch,
  searchValue,
  t
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [dropdownMaxHeight, setDropdownMaxHeight] = useState(240);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 20 && !isLoading && onLoadMore) {
      onLoadMore();
    }
  };

  const updateDropdownPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const viewportPadding = 12;
    const headerHeight = onSearch ? 52 : 0;
    const listMaxHeight = 240;
    const estimatedHeight = headerHeight + listMaxHeight + 10;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const shouldOpenUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const availableSpace = shouldOpenUp ? spaceAbove : spaceBelow;
    const nextMaxHeight = Math.min(
      listMaxHeight,
      Math.max(120, availableSpace - headerHeight - 12)
    );

    setOpenUpward(shouldOpenUp);
    setDropdownMaxHeight(nextMaxHeight);

    setDropdownStyle({
      position: 'fixed',
      width: rect.width,
      left: rect.left,
      top: shouldOpenUp ? 'auto' : rect.bottom + 6,
      bottom: shouldOpenUp ? window.innerHeight - rect.top + 6 : 'auto',
      zIndex: 99999,
    });
  }, [onSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = containerRef.current?.contains(target);
      const clickedInsideDropdown = dropdownRef.current?.contains(target);
      if (!clickedInsideTrigger && !clickedInsideDropdown) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, options.length, isLoading, updateDropdownPosition]);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`group relative w-full rounded-xl border px-3 py-2.5 text-left shadow-sm transition-all duration-200 sm:text-sm ${disabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500 opacity-80'
          : 'cursor-pointer border-gray-300 bg-white text-gray-800 hover:border-blue-400 hover:shadow-md focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:border-blue-500'
          }`}
      >
        <span className={`block truncate pr-7 ${selectedOption ? 'font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
          {selectedOption ? (
            <span className="flex flex-col leading-tight">
              <span>{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-xs text-gray-400 dark:text-gray-500 font-normal truncate">{selectedOption.sublabel}</span>
              )}
            </span>
          ) : placeholder}
        </span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <Image src="/icons/chevron-down.svg" alt="" width={20} height={20} className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} dark:invert`} />
        </span>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="w-full rounded-xl border border-gray-200 bg-white py-1 text-base shadow-2xl ring-1 ring-black/5 focus:outline-none sm:text-sm dark:border-gray-600 dark:bg-gray-700"
          style={{
            ...dropdownStyle,
            transformOrigin: openUpward ? 'bottom left' : 'top left',
          }}
        >
          {onSearch && (
            <div className="relative z-30 bg-white dark:bg-gray-700 p-2 border-b border-gray-100 dark:border-gray-600 shadow-sm rounded-t-xl">
              <input
                type="text"
                value={searchValue || ''}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={t('search')}
                className="w-full rounded-lg px-3 py-2 text-sm border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          )}
          <div
            className="overflow-auto custom-scrollbar"
            onScroll={handleScroll}
            style={{ maxHeight: dropdownMaxHeight }}
          >
            {options.length === 0 && !isLoading ? (
              <div className="relative cursor-default select-none py-3 px-4 text-gray-500 dark:text-gray-400 italic text-center">
                No options found
              </div>
            ) : (
              <div className={onSearch ? 'pt-1' : ''}>
                {options.map((option, index) => (
                  <div
                    key={index}
                    className={`relative cursor-pointer select-none py-2.5 pl-3 pr-9 transition-colors ${option.value === value
                      ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                      : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600/80'
                      }`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                  >
                    <span className="flex flex-col">
                      <span className={`block truncate ${option.value === value ? 'font-semibold' : 'font-medium'}`}>
                        {option.label}
                      </span>
                      {option.sublabel && (
                        <span className="block truncate text-xs text-gray-400 dark:text-gray-400 font-normal">
                          {option.sublabel}
                        </span>
                      )}
                    </span>
                    {option.value === value ? (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600 dark:text-blue-400">
                        <Image src="/icons/check.svg" alt="" width={20} height={20} className="dark:invert" />
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            {isLoading && (
              <div className="relative cursor-default select-none py-3 px-4 text-gray-700 dark:text-gray-400 text-center">
                <div className="flex justify-center">
                  <Spinner size="xs" />
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
