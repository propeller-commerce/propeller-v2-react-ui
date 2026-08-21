'use client';
/**
 * @rsc-blocked — Client-only component: JSX event handlers (onClick/onChange/etc.).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';
import { ProductsResponse } from '@propeller-commerce/propeller-sdk-v2';
import { cn } from '../composables/shared/utils/cn';

// Built-in label defaults (can be overridden via the labels prop).

export interface GridPaginationProps {
  /**
   * A ProductsResponse object for populating the pagination component.
   * Reads `page` (current page), `pages` (total pages) from the response.
   */
  products: ProductsResponse;

  /**
   * Called when the user navigates to a different page.
   * Receives the newly selected page number (1-based).
   */
  onPageChange: (page: number) => void;

  /**
   * Pagination display variant.
   * 'compact' — Previous / "Page X of Y" / Next.
   * 'full'    — numbered page buttons with ellipsis collapsing + Previous / Next.
   * Defaults to 'compact'.
   */
  variant?: string;

  /**
   * Number of visible page buttons rendered around the current page in 'full' style.
   * Defaults to 5.
   */
  siblingCount?: number;

  /**
   * Label overrides for the text inside the component.
   * Supported keys: previous, next, page, of
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;
}

/** Single item in the computed full-style page list. */
// Built-in label defaults (can be overridden via the labels prop).

/** Single item in the computed full-style page list. */
interface PageItem {
  /** 'page' renders a numbered button; 'dots' renders an ellipsis spacer. */
  type: string;
  /** Page number for 'page' items; negative unique sentinel for 'dots' items. */
  value: number;
}
// Built-in label defaults (can be overridden via the labels prop).

/** Single item in the computed full-style page list. */

// Built-in label defaults (can be overridden via the labels prop).
const DEFAULT_LABELS: Record<string, string> = {
  previous: 'Previous',
  next: 'Next',
  page: 'Page',
  of: 'of',
};

/**
 * Pagination control for a product grid, in a compact ("Page X of Y") or full
 * (numbered buttons with ellipsis) variant.
 */
function GridPagination(props: GridPaginationProps) {
  function getLabel(key: string): string {
    const labels = props.labels || {};
    return labels[key] !== undefined ? labels[key] : DEFAULT_LABELS[key] || key;
  }
  const totalPages: number = props.products?.pages || 1;
  const currentPage: number = props.products?.page || 1;
  const showPagination = totalPages > 1;
  const variant = props.variant || 'compact';
  function getFullPages(): PageItem[] {
    const total = totalPages;
    const current = currentPage;
    const sibling = props.siblingCount || 5;

    // All pages fit without collapsing — show them all.
    if (total <= sibling + 4) {
      const items: PageItem[] = [];
      for (let i = 1; i <= total; i++)
        items.push({
          type: 'page',
          value: i,
        });
      return items;
    }

    // Compute sibling window, always staying inside [2, total-1].
    const halfSib = Math.floor(sibling / 2);
    let rangeStart = Math.max(2, current - halfSib);
    let rangeEnd = Math.min(total - 1, current + halfSib);

    // Stretch the range to ensure exactly siblingCount slots when near an edge.
    if (rangeEnd - rangeStart + 1 < sibling) {
      if (rangeStart === 2) {
        rangeEnd = Math.min(total - 1, rangeStart + sibling - 1);
      } else {
        rangeStart = Math.max(2, rangeEnd - sibling + 1);
      }
    }
    const items: PageItem[] = [];

    // First page
    items.push({
      type: 'page',
      value: 1,
    });

    // Left ellipsis (value -1 is a unique sentinel)
    if (rangeStart > 2)
      items.push({
        type: 'dots',
        value: -1,
      });

    // Sibling window
    for (let i = rangeStart; i <= rangeEnd; i++) {
      items.push({
        type: 'page',
        value: i,
      });
    }

    // Right ellipsis (value -2 is a unique sentinel)
    if (rangeEnd < total - 1)
      items.push({
        type: 'dots',
        value: -2,
      });

    // Last page
    items.push({
      type: 'page',
      value: total,
    });
    return items;
  }
  const handlePageChange = (page: number) => props.onPageChange?.(page);
  return (
    <div
      className={cn(`propeller-grid-pagination ${props.className || ''}`)}
      data-variant={variant}
    >
      {showPagination ? (
        <>
          {variant === 'compact' ? (
            <div className="propeller-grid-pagination__compact flex justify-center items-center gap-2">
              <button
                type="button"
                className="propeller-grid-pagination__btn propeller-grid-pagination__btn--prev inline-flex items-center rounded-control border border-input bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                {getLabel('previous')}
              </button>
              <span className="propeller-grid-pagination__info px-2 text-sm font-medium text-muted-foreground">
                {getLabel('page')}&nbsp;{currentPage}&nbsp;{getLabel('of')}&nbsp;{totalPages}
              </span>
              <button
                type="button"
                className="propeller-grid-pagination__btn propeller-grid-pagination__btn--next inline-flex items-center rounded-control border border-input bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                {getLabel('next')}
              </button>
            </div>
          ) : null}
          {variant === 'full' ? (
            <div className="propeller-grid-pagination__full flex justify-center items-center gap-1 flex-wrap">
              <button
                type="button"
                className="propeller-grid-pagination__btn propeller-grid-pagination__btn--prev inline-flex items-center rounded-control border border-input bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                {getLabel('previous')}
              </button>
              {getFullPages().map((item, idx) => (
                <div
                  className="propeller-grid-pagination__page-wrapper inline-flex"
                  key={item.type === 'dots' ? `dots-${idx}` : `page-${item.value}`}
                >
                  {item.type === 'dots' ? (
                    <span className="propeller-grid-pagination__dots inline-flex items-center justify-center min-w-[2rem] px-1 py-2 text-sm text-muted-foreground select-none">
                      ...
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePageChange(item.value)}
                      data-active={item.value === currentPage ? 'true' : 'false'}
                      className={
                        item.value === currentPage
                          ? 'propeller-grid-pagination__page inline-flex items-center justify-center min-w-[2.25rem] rounded-control border border-primary bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm'
                          : 'propeller-grid-pagination__page inline-flex items-center justify-center min-w-[2.25rem] rounded-control border border-input bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface-hover'
                      }
                    >
                      {item.value}
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="propeller-grid-pagination__btn propeller-grid-pagination__btn--next inline-flex items-center rounded-control border border-input bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                {getLabel('next')}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default GridPagination;
