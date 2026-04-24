import React from 'react';

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
    // Keep currently selected page size visible even when it is greater than totalItems
    // (e.g. itemsPerPage=10 with totalItems=8), otherwise the browser shows the first
    // available option and the dropdown looks incorrect.
    if (itemsPerPage > 0 && !validOptions.includes(itemsPerPage)) {
      validOptions.push(itemsPerPage);
    }
    if (totalItems > 0 && !validOptions.includes(totalItems)) {
      validOptions.push(totalItems);
    }
    return validOptions.length > 0 ? validOptions.sort((a, b) => a - b) : [5, 10];
  };

  return (
    <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="text-sm text-gray-700">
        Showing {totalItems > 0 ? indexOfFirstItem : 0} to {totalItems > 0 ? indexOfLastItem : 0} of {totalItems} entries
      </div>
      <div className="flex items-center gap-3">
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Show:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              {generateOptions().map(option => (
                <option key={option} value={option}>
                  {option === totalItems && totalItems > 0 ? 'All' : option}
                </option>
              ))}
            </select>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={`px-3 py-1 border rounded-md text-sm ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
