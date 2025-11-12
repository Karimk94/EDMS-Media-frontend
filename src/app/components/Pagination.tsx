import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  t: Function;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange, t }) => {
  if (totalPages <= 1) return null;

  const PageButton: React.FC<{ page: number; isDisabled: boolean; children: React.ReactNode }> = ({ page, isDisabled, children }) => (
    <button
      onClick={() => onPageChange(page)}
      disabled={isDisabled}
      className={`px-4 py-2 border rounded-md text-sm font-medium transition dark:border-gray-600 ${
        isDisabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600'
          : 'bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex justify-center items-center gap-2 mt-6 flex-wrap">
      <PageButton page={1} isDisabled={currentPage <= 1}>&laquo; {t('first')}</PageButton>
      <PageButton page={currentPage - 1} isDisabled={currentPage <= 1}>‹ {t('prev')}</PageButton>
      <span className="text-gray-700 dark:text-gray-300 text-sm">{t('page')} {currentPage} {t('of')} {totalPages}</span>
      <PageButton page={currentPage + 1} isDisabled={currentPage >= totalPages}>{t('next')} ›</PageButton>
      <PageButton page={totalPages} isDisabled={currentPage >= totalPages}>{t('last')} &raquo;</PageButton>
    </div>
  );
};