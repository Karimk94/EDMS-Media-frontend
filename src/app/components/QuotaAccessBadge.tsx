import React, { useEffect, useRef, useState } from 'react';
import QuotaPieChart from './QuotaPieChart';

interface QuotaAccessBadgeProps {
  total: number;
  remaining: number;
  t: Function;
}

const formatSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const QuotaAccessBadge: React.FC<QuotaAccessBadgeProps> = ({
  total,
  remaining,
  t,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
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

  const safeTotal = total > 0 ? total : 0;
  const safeRemaining = Math.max(0, Number.isFinite(remaining) ? remaining : 0);
  const used = Math.max(0, safeTotal - safeRemaining);

  const usedLabel = t('quotaUsed');
  const remainingLabel = t('quotaRemaining');
  const totalLabel = t('quotaTotal');

  return (
    <div ref={wrapperRef} className="relative group">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <QuotaPieChart remaining={safeRemaining} total={safeTotal} compact={true} />
      </button>

      <div
        className={`absolute right-0 mt-2 w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg translate-y-1 transition-all duration-150 z-50 ${isOpen ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none'} group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0`}
      >
        <div className="p-3 text-sm">
          <div className="mt-2">
            <QuotaPieChart remaining={safeRemaining} total={safeTotal} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-2">
              <p className="text-gray-500 dark:text-gray-400">{usedLabel}</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatSize(used)}</p>
            </div>
            <div className="rounded-md bg-gray-50 dark:bg-gray-800 p-2">
              <p className="text-gray-500 dark:text-gray-400">{remainingLabel}</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatSize(safeRemaining)}</p>
            </div>
            <div className="col-span-2 rounded-md bg-gray-50 dark:bg-gray-800 p-2">
              <p className="text-gray-500 dark:text-gray-400">{totalLabel}</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{formatSize(safeTotal)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
