import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE_OPTIONS = [12, 27, 54, 108];

export default function usePagination(
  items,
  {
    defaultPageSize = 12,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  } = {},
) {
  const safeItems = Array.isArray(items) ? items : [];
  const allowedPageSizes = pageSizeOptions.length > 0 ? pageSizeOptions : DEFAULT_PAGE_SIZE_OPTIONS;
  const safeDefaultPageSize = allowedPageSizes.includes(defaultPageSize)
    ? defaultPageSize
    : allowedPageSizes[0];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(safeDefaultPageSize);

  const totalItems = safeItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedPage = Math.min(Math.max(page, 1), totalPages);

  const pagedItems = useMemo(() => {
    const start = (normalizedPage - 1) * pageSize;
    return safeItems.slice(start, start + pageSize);
  }, [safeItems, normalizedPage, pageSize]);

  const handlePageChange = (nextPage) => {
    const numericValue = Number(nextPage);
    if (!Number.isInteger(numericValue)) {
      return;
    }
    const bounded = Math.min(Math.max(numericValue, 1), totalPages);
    setPage(bounded);
  };

  const handlePageSizeChange = (nextPageSize) => {
    const numericValue = Number(nextPageSize);
    if (!allowedPageSizes.includes(numericValue)) {
      return;
    }
    setPageSize(numericValue);
    setPage(1);
  };

  return {
    page: normalizedPage,
    pageSize,
    totalItems,
    totalPages,
    pageSizeOptions: allowedPageSizes,
    pagedItems,
    setPage: handlePageChange,
    setPageSize: handlePageSizeChange,
  };
}
