/**
 * usePagination (React) — Shared pagination logic.
 */

import { useState, useCallback } from 'react';

/** Pagination state and navigation actions returned by {@link usePagination}. */
export interface PaginationState {
  /** Current page number (1-based). */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** Total number of items across all pages. */
  totalItems: number;
  /** Items shown per page. */
  itemsPerPage: number;
  /** `true` when a next page exists. */
  hasNextPage: boolean;
  /** `true` when a previous page exists. */
  hasPreviousPage: boolean;
  /** Navigates to a page; ignored when out of the `1..totalPages` range. */
  goToPage: (page: number) => void;
  /** Advances to the next page if one exists. */
  nextPage: () => void;
  /** Goes back to the previous page if one exists. */
  previousPage: () => void;
  /** Updates totals/page count from a paged API response. */
  setFromResponse: (response: { itemsFound?: number; pages?: number; offset?: number }) => void;
  /** Resets to page 1 with cleared totals. */
  reset: () => void;
}

/**
 * usePagination — shared pagination state and navigation logic.
 *
 * @param initialItemsPerPage - starting page size. Defaults to 10.
 * @returns pagination state plus navigation actions — see {@link PaginationState}.
 */
export function usePagination(initialItemsPerPage = 10): PaginationState {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  const goToPage = useCallback((page: number) => {
    setCurrentPage((prev) => {
      // `totalPages <= 1` means the count isn't known yet — the grid hasn't
      // fetched (e.g. it's still rendering an SSR-seeded first page, so
      // `setFromResponse` hasn't run). Don't reject navigation in that state,
      // or the FIRST pagination click is silently dropped and never triggers a
      // fetch. Once a real `totalPages` (> 1) is known we enforce the upper
      // bound; an out-of-range page otherwise just yields an empty fetch,
      // which self-corrects on the next `setFromResponse`.
      if (page >= 1 && (totalPages <= 1 || page <= totalPages)) return page;
      return prev;
    });
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => (prev < totalPages ? prev + 1 : prev));
  }, [totalPages]);

  const previousPage = useCallback(() => {
    setCurrentPage((prev) => (prev > 1 ? prev - 1 : prev));
  }, []);

  const setFromResponse = useCallback(
    (response: { itemsFound?: number; pages?: number; offset?: number }) => {
      const items = response.itemsFound ?? 0;
      const perPage = response.offset ?? itemsPerPage;
      setTotalItems(items);
      setTotalPages(response.pages ?? Math.ceil(items / perPage));
      if (response.offset) setItemsPerPage(response.offset);
    },
    [itemsPerPage]
  );

  const reset = useCallback(() => {
    setCurrentPage(1);
    setTotalPages(1);
    setTotalItems(0);
  }, []);

  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    hasNextPage,
    hasPreviousPage,
    goToPage,
    nextPage,
    previousPage,
    setFromResponse,
    reset,
  };
}
