interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  const PageButton: React.FC<{ page: number; isDisabled: boolean; children: React.ReactNode }> = ({ page, isDisabled, children }) => (
    <button
      onClick={() => onPageChange(page)}
      disabled={isDisabled}
      className={`px-4 py-2 border rounded-md text-sm font-medium transition ${
        isDisabled ? 'bg-white hover:bg-gray-50 cursor-not-allowed' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex justify-center items-center gap-2 mt-6 flex-wrap">
      <PageButton page={1} isDisabled={currentPage <= 1}>&laquo; First</PageButton>
      <PageButton page={currentPage - 1} isDisabled={currentPage <= 1}>‹ Prev</PageButton>
      <span className="text-gray-700 text-sm">Page {currentPage} of {totalPages}</span>
      <PageButton page={currentPage + 1} isDisabled={currentPage >= totalPages}>Next ›</PageButton>
      <PageButton page={totalPages} isDisabled={currentPage >= totalPages}>Last &raquo;</PageButton>
    </div>
  );
};
