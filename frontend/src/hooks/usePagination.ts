import { useState, useMemo, useEffect } from 'react';

export function usePagination<T>(items: T[], initialItemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage]);

  const paginatedData = useMemo(() => {
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    return items.slice(indexOfFirstItem, indexOfLastItem);
  }, [items, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(items.length / itemsPerPage) || 1;

  return {
    currentPage,
    setCurrentPage,
    paginatedData,
    totalPages,
    totalItems: items.length,
    itemsPerPage,
    setItemsPerPage,
  };
}
