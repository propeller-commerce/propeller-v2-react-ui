'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { Contact, Customer, ProductSortField, SortOrder } from '@propeller-commerce/propeller-sdk-v2';
import { isContentHidden, type Availability, MIN_STOCK_THRESHOLD } from '@propeller-commerce/propeller-v2-core-ui';

import { useInfraProps } from '../composables/react/useInfraProps';
import { cn } from '../composables/shared/utils/cn';

// Default sort field keys shown in the dropdown when sortOptions is not provided.

export interface GridToolbarProps {
  /**
   * Sort field keys to show in the sort dropdown.
   * Accepts keys of the ProductSortField enum (e.g. 'NAME', 'PRICE').
   * Defaults to all available sort fields.
   */
  sortOptions?: string[];

  /**
   * Hide the price-ascending/descending sort options entirely. Default: false.
   * Useful for closed B2B portals where prices are "by quotation".
   */
  hidePriceSort?: boolean;

  /**
   * Active sort — first element is used.
   * Defaults to [{ field: 'CATEGORY_ORDER', order: 'DESC' }].
   */
  defaultSort?: {
    field: string;
    order: string;
  }[];

  /**
   * Layout mode: 'grid' or 'list'.
   * Controls which icon the view-toggle button shows.
   * Defaults to 'grid'.
   */
  viewMode?: string;

  /**
   * Available page-size options shown in the per-page dropdown.
   * Defaults to [12, 24, 48].
   */
  offset?: number[];

  /**
   * Initially selected page size.
   * Defaults to 12.
   */
  defaultOffset?: number;

  /**
   * Called when the sort field or sort direction changes.
   * Receives the new field key and direction ('ASC'|'DESC').
   */
  onSortChange?: (field: string, order: string) => void;

  /**
   * Called when the user selects a different per-page value.
   * Receives the new page size number.
   */
  onOffsetChange?: (offset: number) => void;

  /**
   * Called when the user clicks the view-mode toggle button.
   * Receives the new mode: 'grid' or 'list'.
   */
  onViewChange?: (mode: string) => void;

  /**
   * Total products found — displayed as a result count on the left side.
   * Pass 0 or undefined to hide the count.
   */
  itemsFound?: number;

  /**
   * Current page number. Used together with `pageSize` and `itemsFound`
   * to display a range indicator (e.g. "1–10 from 594 results").
   * When omitted the component falls back to a simple total count.
   */
  page?: number;

  /**
   * Items per page. Used together with `page` and `itemsFound`
   * to compute the result range. Defaults to 12.
   */
  pageSize?: number;

  /**
   * Actual number of items visible on the current page.
   * When provided, overrides `pageSize` for the range end calculation.
   */
  pageItemCount?: number;

  /**
   * Currently active attribute filter selections.
   * Key = attribute name, value = array of selected values.
   * Used to render removable filter badges.
   */
  activeTextFilters?: Record<string, string[]>;

  /**
   * Currently active price filter lower bound.
   * When defined (together with or without priceFilterMax), renders a price badge.
   */
  priceFilterMin?: number;

  /**
   * Currently active price filter upper bound.
   */
  priceFilterMax?: number;

  /**
   * Called when an attribute filter badge × is clicked.
   * Receives the attribute name and the specific value to remove.
   */
  onFilterRemove?: (filterName: string, value: string) => void;

  /**
   * Called when the price filter badge × is clicked.
   */
  onPriceFilterRemove?: () => void;

  /**
   * Currently active availability (stock) selection.
   * Renders a single removable chip when set to `'in-stock'`.
   */
  availability?: Availability;

  /** Currently active minimum stock quantity, shown on the chip above the default. */
  minStock?: number;

  /** Called when the availability filter badge × is clicked. */
  onAvailabilityFilterRemove?: () => void;

  /**
   * Called when "Clear All" is clicked.
   */
  onClearFilters?: () => void;

  /**
   * Label overrides. Supply any subset of DEFAULT_LABELS keys plus
   * any of the ProductSortField key strings to customise display text.
   */
  labels?: Record<string, string>;

  /**
   * Portal visibility mode.
   * 'open'        — price sorting is available for all users.
   * 'semi-closed' — price sorting is disabled for unauthenticated users.
   */
  portalMode?: string;

  /**
   * Authenticated user object.
   * When null/undefined in semi-closed mode the PRICE sort option is disabled.
   */
  user?: Contact | Customer | null;

  /** Extra CSS class applied to the root element. */
  className?: string;
}

/** Flat badge item used when rendering the active-filters bar. */
// Default sort field keys shown in the dropdown when sortOptions is not provided.

/** Flat badge item used when rendering the active-filters bar. */
interface FilterBadge {
  /** Attribute name the badge belongs to. */
  key: string;
  /** The selected attribute value displayed on the badge. */
  value: string;
}
// Default sort field keys shown in the dropdown when sortOptions is not provided.

/** Flat badge item used when rendering the active-filters bar. */

// Default sort field keys shown in the dropdown when sortOptions is not provided.
const ALL_SORT_FIELDS: string[] = [
  ProductSortField.CATEGORY_ORDER,
  ProductSortField.NAME,
  ProductSortField.PRICE,
  ProductSortField.SKU,
  ProductSortField.SUPPLIER_CODE,
  ProductSortField.CREATED_AT,
  ProductSortField.LAST_MODIFIED_AT,
  ProductSortField.RELEVANCE,
  ProductSortField.PRIORITY,
];

// Built-in label defaults (can be overridden via the labels prop).
// Built-in label defaults (can be overridden via the labels prop).
const DEFAULT_LABELS: Record<string, string> = {
  [ProductSortField.CATEGORY_ORDER]: 'Default Sorting',
  [ProductSortField.NAME]: 'Name',
  [ProductSortField.PRICE]: 'Price',
  [ProductSortField.SKU]: 'SKU',
  [ProductSortField.SUPPLIER_CODE]: 'Supplier Code',
  [ProductSortField.CREATED_AT]: 'Created Date',
  [ProductSortField.LAST_MODIFIED_AT]: 'Last Modified Date',
  [ProductSortField.RELEVANCE]: 'Relevance',
  [ProductSortField.PRIORITY]: 'Priority',
  [SortOrder.ASC]: 'Low to High',
  [SortOrder.DESC]: 'High to Low',
  clearAll: 'Clear All',
  products: ' Products',
  productSingular: 'Product',
  productPlural: 'Products',
  from: 'from',
  results: 'results',
  perPage: ' per page',
  price: 'Price',
  inStock: 'In stock',
  switchToList: 'Switch to list view',
  switchToGrid: 'Switch to grid view',
};

/**
 * Toolbar for a product grid: result count, sort field/order selectors,
 * page-size selector, grid/list view toggle and removable active-filter badges.
 */
function GridToolbar(rawProps: GridToolbarProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  // The active price-filter chip rendered its euro inline as text — no prop and
  // no class, so a non-euro shop had no way to reach it at all.
  const currencySymbol = ((props as { currency?: string }).currency) ?? '€';
  // The field/order useState seeds are enum values; widening to `string`
  // here lets the prop-sync effects below adopt arbitrary strings the parent
  // passes (URL state may carry either the enum value or its key form).
  const [currentSortField, setCurrentSortField] = useState<string>(
    ProductSortField.CATEGORY_ORDER,
  );
  const [currentSortOrder, setCurrentSortOrder] = useState<string>(SortOrder.DESC);
  const [currentOffset, setCurrentOffset] = useState(12);
  const [currentViewMode, setCurrentViewMode] = useState('grid');
  function getLabel(key: string) {
    const labels = (props.labels as Record<string, string>) || {};
    return labels[key] !== undefined ? labels[key] : DEFAULT_LABELS[key] || key;
  }
  function getSortOptions() {
    const opts = (props.sortOptions as string[]) || [];
    const base = opts.length > 0 ? opts : ALL_SORT_FIELDS;
    return props.hidePriceSort
      ? base.filter((f) => f !== ProductSortField.PRICE)
      : base;
  }
  function getOffsetOptions() {
    const opts = (props.offset as number[]) || [];
    return opts.length > 0 ? opts : [12, 24, 48];
  }
  function hasActiveFilters() {
    const text = (props.activeTextFilters as Record<string, string[]>) || {};
    const hasText = Object.keys(text).some((k) => (text[k] || []).length > 0);
    const hasPrice = props.priceFilterMin !== undefined || props.priceFilterMax !== undefined;
    const hasAvailability = props.availability === 'in-stock';
    return hasText || hasPrice || hasAvailability;
  }
  function getActiveFilterBadges() {
    const text = (props.activeTextFilters as Record<string, string[]>) || {};
    const badges: FilterBadge[] = [];
    Object.entries(text)
      .filter(([, values]) => (values || []).length > 0)
      .forEach(([key, values]) => {
        (values || []).forEach((value: string) => {
          badges.push({
            key,
            value,
          });
        });
      });
    return badges;
  }
  function isPriceSortDisabled() {
    return isContentHidden(props.portalMode as string | undefined, props.user);
  }
  function getAvailabilityLabel() {
    const qty = props.minStock as number | undefined;
    if (qty !== undefined && qty > MIN_STOCK_THRESHOLD) return `${getLabel('inStock')}: ${qty}+`;
    return getLabel('inStock');
  }
  function handleSortFieldChange(
    field: string
  ) {
    setCurrentSortField(field);
    if (props.onSortChange) props.onSortChange(field, currentSortOrder);
  }
  function handleSortOrderChange(
    order: string
  ) {
    setCurrentSortOrder(order);
    if (props.onSortChange) props.onSortChange(currentSortField, order);
  }
  function handleOffsetChange(offset: number) {
    setCurrentOffset(offset);
    if (props.onOffsetChange) props.onOffsetChange(offset);
  }
  function handleViewChange() {
    const next = currentViewMode === 'grid' ? 'list' : 'grid';
    setCurrentViewMode(next);
    if (props.onViewChange) props.onViewChange(next);
  }
  // Three external-state → local sync effects: ProductGrid (parent) drives
  // defaultSort / defaultOffset / viewMode; GridToolbar mirrors them so
  // local selectors track the canonical values. Same family of intentional
  // sync as the GridFilters effects.
  useEffect(() => {
    const sort =
      (props.defaultSort as {
        field: string;
        order: string;
      }[]) || [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentSortField(
      sort.length > 0
        ? sort[0].field || ProductSortField.CATEGORY_ORDER
        : ProductSortField.CATEGORY_ORDER
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentSortOrder(
      sort.length > 0 ? sort[0].order || SortOrder.DESC : SortOrder.DESC
    );
  }, [props.defaultSort]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentOffset((props.defaultOffset as number) || 12);
  }, [props.defaultOffset]);
  useEffect(() => {
    if (props.viewMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentViewMode(props.viewMode as string);
    }
  }, [props.viewMode]);
  return (
    <div
      className={cn(`propeller-grid-toolbar ${(props.className as string) || ''}`)}
      data-view-mode={currentViewMode}
    >
      <div className="propeller-grid-toolbar__bar flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div className="propeller-grid-toolbar__count text-sm text-muted-foreground font-medium">
          {(props.itemsFound as number) > 0 ? (
            <span>
              {props.itemsFound as number}
              {' '}
              {(props.itemsFound as number) === 1 ? getLabel('productSingular') : getLabel('productPlural')}
            </span>
          ) : null}
        </div>
        <div className="propeller-grid-toolbar__controls flex flex-wrap items-center gap-3">
          <select
            className="propeller-grid-toolbar__select propeller-grid-toolbar__select--offset h-9 rounded-control border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={currentOffset}
            onChange={(e) => handleOffsetChange(parseInt((e.target as HTMLSelectElement).value))}
          >
            {getOffsetOptions()?.map((n) => (
              <option key={n} value={n}>
                {n}
                {getLabel('perPage')}
              </option>
            ))}
          </select>
          <div className="propeller-grid-toolbar__divider h-4 w-px bg-border hidden sm:block" />
          <select
            className="propeller-grid-toolbar__select propeller-grid-toolbar__select--sort-field h-9 rounded-control border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={currentSortField}
            onChange={(e) => handleSortFieldChange((e.target as HTMLSelectElement).value)}
          >
            {getSortOptions()?.map((field) => (
              <option
                key={field}
                value={field}
                disabled={field === 'PRICE' && isPriceSortDisabled()}
              >
                {getLabel(field)}
              </option>
            ))}
          </select>
          <select
            className="propeller-grid-toolbar__select propeller-grid-toolbar__select--sort-order h-9 rounded-control border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={currentSortOrder}
            onChange={(e) => handleSortOrderChange((e.target as HTMLSelectElement).value)}
          >
            <option value={SortOrder.ASC}>{getLabel('ASC')}</option>
            <option value={SortOrder.DESC}>{getLabel('DESC')}</option>
          </select>
          <button
            type="button"
            className="propeller-grid-toolbar__view-toggle h-9 w-9 flex items-center justify-center rounded-control border border-input bg-transparent hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={(event) => handleViewChange()}
            title={currentViewMode === 'grid' ? getLabel('switchToList') : getLabel('switchToGrid')}
          >
            {currentViewMode === 'grid' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            ) : null}
            {currentViewMode === 'list' ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            ) : null}
          </button>
        </div>
      </div>
      {hasActiveFilters() ? (
        <div className="propeller-grid-toolbar__active-filters flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            className="propeller-grid-toolbar__clear-all h-7 px-2 text-xs rounded-control hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={(event) => {
              if (props.onClearFilters) props.onClearFilters();
            }}
          >
            {getLabel('clearAll')}
          </button>
          {props.priceFilterMin !== undefined || props.priceFilterMax !== undefined ? (
            <span
              className="propeller-grid-toolbar__filter-badge propeller-grid-toolbar__filter-badge--price inline-flex items-center gap-1 cursor-pointer px-2.5 py-0.5 rounded-full text-xs font-semibold border border-input bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              onClick={(event) => {
                if (props.onPriceFilterRemove) props.onPriceFilterRemove();
              }}
            >
              {getLabel('price')}: {currencySymbol}
              {(props.priceFilterMin as number) ?? 0} – {currencySymbol}
              {(props.priceFilterMax as number) ?? '∞'}
              <span className="propeller-grid-toolbar__filter-badge-remove">×</span>
            </span>
          ) : null}
          {props.availability === 'in-stock' ? (
            <span
              className="propeller-grid-toolbar__filter-badge propeller-grid-toolbar__filter-badge--availability inline-flex items-center gap-1 cursor-pointer px-2.5 py-0.5 rounded-full text-xs font-semibold border border-input bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              onClick={(event) => {
                if (props.onAvailabilityFilterRemove) props.onAvailabilityFilterRemove();
              }}
            >
              {getAvailabilityLabel()}
              <span className="propeller-grid-toolbar__filter-badge-remove">×</span>
            </span>
          ) : null}
          {getActiveFilterBadges()?.map((badge) => (
            <span
              className="propeller-grid-toolbar__filter-badge inline-flex items-center gap-1 cursor-pointer px-2.5 py-0.5 rounded-full text-xs font-semibold border border-input bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              key={`${badge.key}-${badge.value}`}
              data-filter-key={badge.key}
              onClick={(event) => {
                if (props.onFilterRemove) props.onFilterRemove(badge.key, badge.value);
              }}
            >
              {badge.value}
              <span className="propeller-grid-toolbar__filter-badge-remove">×</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default GridToolbar;
