'use client';
/**
 * @rsc-blocked — Client-only component: interactive open/close state.
 * Owns BOTH the desktop filter sidebar and the mobile slide-in drawer around a
 * single {@link GridFilters} instance. At `lg` (1024px) and up the filters
 * render inline as a static sidebar; below `lg` they collapse behind a
 * "Filters" trigger button and slide in from the left as an off-canvas drawer.
 * One `GridFilters` is mounted regardless of viewport — no duplicate state.
 */
import * as React from 'react';

import { useEffect, useState } from 'react';
import GridFilters, { GridFiltersProps } from './GridFilters';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';

export interface GridFiltersPanelProps extends GridFiltersProps {
  /**
   * Number of active filters, shown as a badge on the mobile trigger button.
   * The host computes this from its active filter state. Omit or 0 to hide
   * the badge.
   */
  activeFilterCount?: number;

  /** Extra CSS class on the outer panel root. */
  wrapperClassName?: string;
}

/**
 * Responsive filters panel. Replaces the host's `<aside>` + `<GridFilters>`
 * with a single component that is the inline sidebar at `lg`+ and the
 * off-canvas drawer below `lg`. Filters apply live on every change (same as
 * the inline sidebar), so the drawer's "Show results" button just closes it.
 */
export default function GridFiltersPanel(props: GridFiltersPanelProps) {
  const { activeFilterCount, wrapperClassName, labels, ...gridFiltersProps } = props;
  const [open, setOpen] = useState(false);

  // Lock body scroll + close on Escape while the mobile drawer is open. (No
  // effect at lg+, where `open` is irrelevant — the panel is always visible.)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <div className={`propeller-grid-filters-panel w-full lg:w-64 lg:flex-shrink-0 ${wrapperClassName || ''}`}>
      {/* Mobile trigger — hidden at lg+. */}
      <button
        type="button"
        className="propeller-grid-filters-panel__trigger lg:hidden inline-flex items-center justify-center gap-2 h-10 px-4 rounded-control border border-border bg-card text-sm font-medium text-foreground shadow-sm hover:bg-surface-hover transition-colors"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg
          className="propeller-grid-filters-panel__trigger-icon w-[1.1em] h-[1.1em] flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
        </svg>
        {getLabel(labels, 'filtersButton', 'Filters')}
        {activeFilterCount && activeFilterCount > 0 ? (
          <span className="propeller-grid-filters-panel__count inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      {/* Backdrop — only below lg, only while open. */}
      <div
        className={`propeller-grid-filters-panel__backdrop lg:hidden fixed inset-0 z-40 bg-foreground/40 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/*
        The ONE GridFilters instance. The wrapper is the off-canvas drawer
        below lg (fixed, slides in via translate-x) and a plain static sidebar
        at lg+ (the fixed/translate/width utilities are all reset by lg:).
      */}
      <div
        className={`propeller-grid-filters-panel__panel fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-card shadow-xl flex flex-col transition-transform duration-300 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:bg-transparent lg:shadow-none lg:block ${open ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer header — hidden at lg+. */}
        <div className="propeller-grid-filters-panel__header lg:hidden flex items-center justify-between gap-3 px-4 h-14 border-b border-border-subtle flex-shrink-0">
          <span className="propeller-grid-filters-panel__title text-base font-semibold text-foreground">
            {getLabel(labels, 'filtersButton', 'Filters')}
          </span>
          <button
            type="button"
            className="propeller-grid-filters-panel__close inline-flex items-center justify-center h-8 w-8 rounded-control text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors"
            onClick={() => setOpen(false)}
            aria-label={getLabel(labels, 'closeFilters', 'Close')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="propeller-grid-filters-panel__body flex-1 overflow-y-auto px-4 py-4 lg:flex-none lg:overflow-visible lg:p-0">
          <GridFilters {...gridFiltersProps} labels={labels} />
        </div>

        {/* Drawer footer / apply — hidden at lg+. */}
        <div className="propeller-grid-filters-panel__footer lg:hidden px-4 py-3 border-t border-border-subtle flex-shrink-0">
          <button
            type="button"
            className="propeller-grid-filters-panel__apply w-full inline-flex justify-center items-center h-10 px-6 rounded-control text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/90 transition-colors"
            onClick={() => setOpen(false)}
          >
            {getLabel(labels, 'applyFilters', 'Show results')}
          </button>
        </div>
      </div>
    </div>
  );
}
