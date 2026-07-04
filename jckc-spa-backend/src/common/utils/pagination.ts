/**
 * Legacy pagination math (students.md §3-R4c / API-CONTRACT.md):
 * page size 10, totalPages never below 1, requested page clamped to
 * [1, totalPages], 1-based startIndex (0 when the result set is empty).
 */

export const PAGE_SIZE = 10;

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

/**
 * Legacy page-param parsing: `Math.max(1, parseInt(raw) || 1)` —
 * non-numeric/absent/zero/negative all resolve to 1.
 */
export function parsePage(raw?: string): number {
  return Math.max(1, parseInt(raw ?? '', 10) || 1);
}

export interface PaginationWindow {
  /** The clamped page actually served. */
  safePage: number;
  /** `.skip()` value for the Mongo query. */
  skip: number;
  /** `.limit()` value for the Mongo query. */
  limit: number;
  pagination: Pagination;
}

export function buildPagination(
  totalCount: number,
  requestedPage: number,
  pageSize: number = PAGE_SIZE,
): PaginationWindow {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, requestedPage), totalPages);
  return {
    safePage,
    skip: (safePage - 1) * pageSize,
    limit: pageSize,
    pagination: {
      currentPage: safePage,
      totalPages,
      totalCount,
      pageSize,
      startIndex: totalCount > 0 ? (safePage - 1) * pageSize + 1 : 0,
      endIndex: Math.min(safePage * pageSize, totalCount),
      hasPrevious: safePage > 1,
      hasNext: safePage < totalPages,
    },
  };
}
