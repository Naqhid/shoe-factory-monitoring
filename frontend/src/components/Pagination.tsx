import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
}) => {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage + 1;
  const indexOfLastItem = Math.min(currentPage * itemsPerPage, totalItems);

  const generateOptions = () => {
    const options = [5, 10, 15, 20, 25, 50, 100];
    const validOptions = options.filter(opt => opt <= totalItems);
    if (itemsPerPage > 0 && !validOptions.includes(itemsPerPage)) {
      validOptions.push(itemsPerPage);
    }
    if (totalItems > 0 && !validOptions.includes(totalItems)) {
      validOptions.push(totalItems);
    }
    return validOptions.length > 0 ? validOptions.sort((a, b) => a - b) : [5, 10];
  };

  // Build visible page numbers with ellipsis for mobile-friendliness
  const getVisiblePages = (): (number | '...')[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [];
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <div className="px-3 sm:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Info row */}
      <div className="flex items-center justify-between sm:justify-start gap-3">
        <p className="text-xs sm:text-sm text-gray-500">
          <span className="font-medium text-gray-700">{totalItems > 0 ? indexOfFirstItem : 0}–{totalItems > 0 ? indexOfLastItem : 0}</span> of {totalItems}
        </p>
        {onItemsPerPageChange && (
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30"
          >
            {generateOptions().map(option => (
              <option key={option} value={option}>
                {option === totalItems && totalItems > 0 ? 'All' : `${option} / page`}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Page buttons */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center sm:justify-end gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none transition text-gray-600"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {getVisiblePages().map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-gray-400 text-sm">…</span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={[
                  'inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-lg text-sm font-medium transition',
                  currentPage === page
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
                ].join(' ')}
              >
                {page}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:pointer-events-none transition text-gray-600"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
