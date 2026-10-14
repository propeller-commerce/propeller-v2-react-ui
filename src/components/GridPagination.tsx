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
import {
  shouldHandlePaginationClick,
  paginationRel,
} from '@propeller-commerce/propeller-v2-core-ui';

// Built-in label defaults (can be overridden via the labels prop).

export interface GridPaginationProps {
  /**
   * Pagination state: `page` (current page) and `pages` (total pages).
   * Structural, so a `ProductsResponse` fits as-is and callers holding the two
   * numbers on their own — `useSpareParts`, `FavoriteListDetails` — need no cast.
   */
  products: Pick<ProductsResponse, 'page' | 'pages'> | { page?: number; pages?: number };

  /**
   * Called when the user navigates to a different page.
   * Receives the newly selected page number (1-based).
   */
  onPageChange: (page: number) => void;

  /**
   * URL for a given page. Supply it and the entries render as anchors, so the
   * browser can preview the target, open it in a new tab and copy the link;
   * a plain click is still handled in the client. Without it they stay
   * buttons, which navigate on click only.
   */
  pageHref?: (page: number) => string;

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
  // Names the <nav> landmark, so it is distinguishable from the site navigation.
  paginationLabel: 'Pagination',
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

  const BTN_BASE =
    'inline-flex items-center rounded-control border border-input bg-card text-sm font-medium text-foreground shadow-sm hover:bg-surface-hover';
  const PAGE_BASE =
    'propeller-grid-pagination__page inline-flex items-center justify-center min-w-[2.25rem] rounded-control px-3 py-2 text-sm shadow-sm';

  /**
   * One pagination entry. An anchor when `pageHref` is supplied, a button
   * otherwise; either way a plain click is handled here, while a modified or
   * middle click is left to the browser.
   */
  function Entry(entry: {
    page: number;
    className: string;
    children: React.ReactNode;
    /** Only the Previous/Next controls carry rel — two elements claiming to be
     *  the previous document would be wrong, and a numbered link is just a page. */
    withRel?: boolean;
    extraProps?: Record<string, unknown>;
  }) {
    const rel = entry.withRel ? paginationRel(entry.page, currentPage) : undefined;
    const onClick = (event: React.MouseEvent) => {
      if (!shouldHandlePaginationClick(event)) return;
      event.preventDefault();
      handlePageChange(entry.page);
    };
    const href = props.pageHref?.(entry.page);
    if (href) {
      return (
        <a href={href} rel={rel} className={entry.className} onClick={onClick} {...entry.extraProps}>
          {entry.children}
        </a>
      );
    }
    return (
      <button type="button" className={entry.className} onClick={onClick} {...entry.extraProps}>
        {entry.children}
      </button>
    );
  }

  return (
    <nav
      aria-label={getLabel('paginationLabel')}
      className={cn(`propeller-grid-pagination ${props.className || ''}`)}
      data-variant={variant}
    >
      {showPagination ? (
        <>
          {variant === 'compact' ? (
            <ul className="propeller-grid-pagination__compact flex justify-center items-center gap-2 list-none m-0 p-0">
              {/* Omitted rather than disabled at the first page: a control
                  that cannot act should not take up focus. */}
              {currentPage > 1 ? (
                <li className="inline-flex">
                  <Entry
                    page={currentPage - 1}
                    withRel
                    className={`propeller-grid-pagination__btn propeller-grid-pagination__btn--prev ${BTN_BASE} px-4 py-2`}
                  >
                    {getLabel('previous')}
                  </Entry>
                </li>
              ) : null}
              <li className="inline-flex">
                <span className="propeller-grid-pagination__info px-2 text-sm font-medium text-muted-foreground">
                  {getLabel('page')}&nbsp;{currentPage}&nbsp;{getLabel('of')}&nbsp;{totalPages}
                </span>
              </li>
              {currentPage < totalPages ? (
                <li className="inline-flex">
                  <Entry
                    page={currentPage + 1}
                    withRel
                    className={`propeller-grid-pagination__btn propeller-grid-pagination__btn--next ${BTN_BASE} px-4 py-2`}
                  >
                    {getLabel('next')}
                  </Entry>
                </li>
              ) : null}
            </ul>
          ) : null}
          {variant === 'full' ? (
            <ul className="propeller-grid-pagination__full flex justify-center items-center gap-1 flex-wrap list-none m-0 p-0">
              {currentPage > 1 ? (
                <li className="inline-flex">
                  <Entry
                    page={currentPage - 1}
                    withRel
                    className={`propeller-grid-pagination__btn propeller-grid-pagination__btn--prev ${BTN_BASE} px-3 py-2`}
                  >
                    {getLabel('previous')}
                  </Entry>
                </li>
              ) : null}
              {getFullPages().map((item, idx) => (
                <li
                  className="propeller-grid-pagination__page-wrapper inline-flex"
                  key={item.type === 'dots' ? `dots-${idx}` : `page-${item.value}`}
                >
                  {item.type === 'dots' ? (
                    <span className="propeller-grid-pagination__dots inline-flex items-center justify-center min-w-[2rem] px-1 py-2 text-sm text-muted-foreground select-none">
                      ...
                    </span>
                  ) : (
                    // The current page stays a real link — it has a URL — and is
                    // marked with aria-current rather than being disabled.
                    <Entry
                      page={item.value}
                      className={
                        item.value === currentPage
                          ? `${PAGE_BASE} border border-primary bg-primary font-semibold text-primary-foreground`
                          : `${PAGE_BASE} border border-input bg-card font-medium text-foreground hover:bg-surface-hover`
                      }
                      extraProps={{
                        'data-active': item.value === currentPage ? 'true' : 'false',
                        ...(item.value === currentPage ? { 'aria-current': 'page' } : {}),
                      }}
                    >
                      {item.value}
                    </Entry>
                  )}
                </li>
              ))}
              {currentPage < totalPages ? (
                <li className="inline-flex">
                  <Entry
                    page={currentPage + 1}
                    withRel
                    className={`propeller-grid-pagination__btn propeller-grid-pagination__btn--next ${BTN_BASE} px-3 py-2`}
                  >
                    {getLabel('next')}
                  </Entry>
                </li>
              ) : null}
            </ul>
          ) : null}
        </>
      ) : null}
    </nav>
  );
}

export default GridPagination;
