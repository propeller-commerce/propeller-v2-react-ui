'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { Contact, Customer, AttributeFilter, AttributeTextFilter } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, isContentHidden, type Availability, MIN_STOCK_THRESHOLD } from '@propeller-commerce/propeller-v2-core-ui';

import { useInfraProps } from '../composables/react/useInfraProps';
import { cn } from '../composables/shared/utils/cn';

export interface GridFiltersProps {
  /**
   * Attribute filter definitions from the ProductGrid API response.
   * Each entry describes one filterable attribute (e.g. colour, brand, size).
   */
  filters: AttributeFilter[];

  /**
   * Lower price bound from the current product set.
   * When both `priceMin` and `priceMax` are absent the price section is hidden.
   */
  priceMin?: number;

  /** Upper price bound from the current product set. */
  priceMax?: number;

  /** Language code. Defaults to 'NL'. */
  language?: string;

  /** Notification called after every filter change. */
  getSelectedFilters?: () => void;

  /**
   * Called on every checkbox toggle.
   * `filter` is the AttributeFilter; `value` is the toggled option string.
   */
  onFilterChange: (filter: AttributeFilter, value: string | number) => void;

  /**
   * Called when the price range changes (on blur / slider release).
   */
  onPriceChange?: (minPrice: number, maxPrice: number) => void;

  /** Called when "Clear all" is clicked. */
  onClearFilters?: () => void;

  /** Enable mobile-specific behaviour (drops sticky positioning). */
  isMobile?: boolean;

  /**
   * 'open' — show price filter for all users.
   * 'semi-closed' — hide price filter for unauthenticated users.
   */
  portalMode?: string;

  /** Authenticated user — price filter visibility depends on this in semi-closed mode. */
  user?: Contact | Customer | null;

  /**
   * Whether filter accordions start collapsed.
   * Defaults to true.
   */
  collapsed?: boolean;

  /** Increment this counter to reset all selected filters and price inputs externally. */
  clearSignal?: number;

  /** Currently active text filters (URL-driven). Syncs internal checkbox state when filters are removed externally. */
  activeTextFilters?: Record<string, string[]>;

  /**
   * Currently active price filter min from URL state.
   * When both activePriceMin and activePriceMax become undefined the price inputs reset to the priceMin/priceMax bounds.
   */
  activePriceMin?: number;

  /** Currently active price filter max from URL state. */
  activePriceMax?: number;

  /**
   * Show the availability (stock) section. Defaults to false so hosts opt in
   * rather than gaining a new filter section on upgrade.
   *
   * The host should pass its own "show stock" setting here — a stock filter
   * is meaningless when no stock is displayed anywhere in the grid. When
   * truthy the section is still subject to the same semi-closed-portal
   * visibility rule as the price filter (hidden for anonymous users).
   */
  showAvailabilityFilter?: boolean;

  /**
   * Currently active availability selection (URL-driven). Seeds the toggle
   * on the first render so a restored filtered URL renders it correctly.
   */
  activeAvailability?: Availability;

  /** Currently active minimum stock quantity (URL-driven). Undefined means the minimum. */
  activeMinStock?: number;

  /** Called on every toggle or stepper change with both values. */
  onAvailabilityChange?: (sel: Availability, minStock: number) => void;

  /**
   * When true, all checkboxes and price inputs are disabled.
   * Wire to ProductGrid's `onLoadingChange` to block rapid re-clicks while a fetch is in flight.
   */
  isLoading?: boolean;

  /** Extra CSS class on the root element. */
  className?: string;

  /** Translated labels keyed by the slugs used inside the component (see
   * `getLabel` calls). Missing keys fall back to the English defaults. */
  labels?: Record<string, string>;

  /** Currency symbol shown in the price-range inputs. Falls back to PropellerInfra.currency, then `'€'`. */
  currency?: string;
}
/**
 * Faceted filter sidebar for a product grid: collapsible attribute checkbox
 * groups plus a price range slider, with parent-driven clear and active-state
 * synchronisation.
 */
function GridFilters(rawProps: GridFiltersProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  // The glyph in the price inputs was a literal euro, so a non-euro shop had no
  // handle on it beyond the BEM class.
  const currencySymbol = (props.currency as string) ?? '€';
  // Seed directly from `activeTextFilters` (not `{}` + a sync effect) so the
  // ticked checkboxes are correct on the very first render — including SSR,
  // where the sync effect below has not run. A restored filtered URL must
  // server-render its checkboxes checked.
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>(
    () => ({ ...((props.activeTextFilters as Record<string, string[]>) || {}) })
  );
  const [currentMin, setCurrentMin] = useState(() => 0);
  const [currentMax, setCurrentMax] = useState(() => 9999);
  // Raw text-input buffers for the price fields, kept as strings so the user
  // can clear a field and type a fresh value. The numeric `currentMin`/
  // `currentMax` (which the sliders share) are only committed on blur/Enter —
  // binding the inputs directly to the numbers forced an empty field back to 0
  // on every keystroke, making them impossible to edit.
  const [minInput, setMinInput] = useState(() => '0');
  const [maxInput, setMaxInput] = useState(() => '9999');
  const [expandedFilters, setExpandedFilters] = useState(
    () => ({})
  );
  const [isPending, setIsPending] = useState(() => false);
  // Last range actually pushed to the parent — guards `applyPrice` against
  // no-op re-applies that would leave `isPending` (panel blur/disable) stuck on.
  const [appliedMin, setAppliedMin] = useState<number | undefined>(() => undefined);
  const [appliedMax, setAppliedMax] = useState<number | undefined>(() => undefined);
  // Seeded directly from `activeAvailability`/`activeMinStock` (not defaults +
  // a sync effect) so the toggle/stepper are correct on the very first render, including SSR.
  const [availability, setAvailability] = useState<Availability>(
    () => props.activeAvailability || 'all'
  );
  const [minStock, setMinStock] = useState<number>(
    () => (props.activeMinStock as number) ?? MIN_STOCK_THRESHOLD
  );
  // Raw buffer so the field can be cleared while typing; committed on blur/Enter.
  const [minStockInput, setMinStockInput] = useState<string>(
    () => String((props.activeMinStock as number) ?? MIN_STOCK_THRESHOLD)
  );
  function showPriceFilter() {
    const mode = (props.portalMode as string) || 'open';
    if (mode === 'open') return true;
    return !!props.user;
  }
  function showAvailability() {
    if (!props.showAvailabilityFilter) return false;
    return !isContentHidden(props.portalMode as string | undefined, props.user);
  }
  function getFilterName(filter: AttributeFilter) {
    return (filter as AttributeFilter)?.attributeDescription?.name || '';
  }
  // Resolve the label in the active language; falls back to the first
  // description, then the raw attribute name.
  function getFilterTitle(filter: AttributeFilter) {
    const descriptions = (filter as AttributeFilter)?.attributeDescription?.descriptions;
    const lang = props.language?.toUpperCase();
    const match = lang
      ? descriptions?.find((d) => d?.language?.toUpperCase() === lang)
      : undefined;
    return (
      match?.value ||
      descriptions?.[0]?.value ||
      (filter as AttributeFilter)?.attributeDescription?.name ||
      ''
    );
  }
  function getFilteredFilters(): AttributeFilter[] {
    const list = props.filters ?? [];
    return list.filter((f) => {
      const opts: AttributeTextFilter[] = f?.textFilters ?? [];
      return opts.some((o) => (o?.count || 0) > 0 || (o?.countActive || 0) > 0);
    });
  }
  function getValidOptions(filter: AttributeFilter): AttributeTextFilter[] {
    return (filter?.textFilters ?? []).filter(
      (o) => (o?.count || 0) > 0 || (o?.countActive || 0) > 0
    );
  }
  function getSelectedCount() {
    let n = 0;
    const sel = selectedFilters as Record<string, string[]>;
    Object.keys(sel).forEach((k: string) => {
      n += (sel[k] || []).length;
    });
    return n;
  }
  function hasActiveFilters() {
    const sel = selectedFilters as Record<string, string[]>;
    const hasText = Object.keys(sel).some((k: string) => (sel[k] || []).length > 0);
    return hasText || availability === 'in-stock';
  }
  function isSelected(
    filterName: string,
    value: string
  ) {
    return ((selectedFilters as Record<string, string[]>)[filterName] || []).includes(value);
  }
  function isExpanded(filterName: string) {
    const stored = (expandedFilters as Record<string, boolean>)[filterName];
    // A group the user has explicitly toggled wins.
    if (stored !== undefined) return !!stored;
    // No stored state yet (first render — including SSR, where the
    // expand-init effect has not run). Default to open when `collapsed` is
    // false, OR when the group already carries an active filter — otherwise
    // a restored filtered URL would render the ticked checkboxes hidden.
    const active = (props.activeTextFilters as Record<string, string[]>) || {};
    if ((active[filterName]?.length ?? 0) > 0) return true;
    return props.collapsed === false;
  }
  function toggleAccordion(filterName: string) {
    const cur = !!(expandedFilters as Record<string, boolean>)[filterName];
    setExpandedFilters({ ...expandedFilters, [filterName]: !cur });
  }
  function handleCheckbox(
    filter: AttributeFilter,
    value: string,
    checked: boolean
  ) {
    const name = (filter as AttributeFilter)?.attributeDescription?.name || '';
    const cur = (selectedFilters as Record<string, string[]>)[name] || [];
    const next = checked ? [...cur, value] : cur.filter((v: string) => v !== value);
    setSelectedFilters({ ...selectedFilters, [name]: next });
    if (next.length === 0) {
      setExpandedFilters({ ...expandedFilters, [name]: false });
    }
    setIsPending(true);
    props.onFilterChange(filter, value);
    if (props.getSelectedFilters) props.getSelectedFilters();
  }
  function handleAvailabilityChange(value: Availability) {
    const nextMinStock = value === 'all' ? MIN_STOCK_THRESHOLD : minStock;
    setAvailability(value);
    setMinStock(nextMinStock);
    setMinStockInput(String(nextMinStock));
    setIsPending(true);
    if (props.onAvailabilityChange) props.onAvailabilityChange(value, nextMinStock);
    if (props.getSelectedFilters) props.getSelectedFilters();
  }
  function handleMinStockChange(value: number) {
    const n = Math.max(Math.floor(value) || MIN_STOCK_THRESHOLD, MIN_STOCK_THRESHOLD);
    setMinStock(n);
    setMinStockInput(String(n));
    if (n === minStock) return;
    setIsPending(true);
    if (props.onAvailabilityChange) props.onAvailabilityChange(availability, n);
    if (props.getSelectedFilters) props.getSelectedFilters();
  }
  // Commit the raw buffer on blur/Enter; empty or non-numeric falls back to the minimum.
  function commitMinStockInput() {
    const parsed = parseInt(minStockInput, 10);
    handleMinStockChange(isNaN(parsed) ? MIN_STOCK_THRESHOLD : parsed);
  }
  function handleMinChange(value: number) {
    const n = value > currentMax ? currentMax : value;
    setCurrentMin(n);
    setMinInput(String(n));
  }
  function handleMaxChange(value: number) {
    const n = value < currentMin ? currentMin : value;
    setCurrentMax(n);
    setMaxInput(String(n));
  }
  // Commit the raw min text buffer on blur/Enter. Empty / non-numeric falls
  // back to the lower bound; the value is clamped into [bound, currentMax].
  function commitMinInput() {
    const parsed = parseFloat(minInput);
    const value = isNaN(parsed) ? getMinBound() : parsed;
    const n = Math.min(Math.max(value, getMinBound()), currentMax);
    setCurrentMin(n);
    setMinInput(String(n));
    applyPrice(n, currentMax);
  }
  function commitMaxInput() {
    const parsed = parseFloat(maxInput);
    const value = isNaN(parsed) ? getMaxBound() : parsed;
    const n = Math.min(Math.max(value, currentMin), getMaxBound());
    setCurrentMax(n);
    setMaxInput(String(n));
    applyPrice(currentMin, n);
  }
  // Apply only when the committed range differs from what's already applied —
  // re-applying an unchanged range produced no parent loading cycle, so the
  // `isPending` flag (which blurs/disables the whole panel) never cleared.
  function applyPrice(min: number = currentMin, max: number = currentMax) {
    if (min === appliedMin && max === appliedMax) return;
    setAppliedMin(min);
    setAppliedMax(max);
    setIsPending(true);
    if (props.onPriceChange) props.onPriceChange(min, max);
    if (props.getSelectedFilters) props.getSelectedFilters();
  }
  function clearAll() {
    setSelectedFilters({});
    setCurrentMin((props.priceMin as number) || 0);
    setCurrentMax((props.priceMax as number) || 9999);
    setAvailability('all');
    setMinStock(MIN_STOCK_THRESHOLD);
    setMinStockInput(String(MIN_STOCK_THRESHOLD));
    if (props.onClearFilters) props.onClearFilters();
    if (props.getSelectedFilters) props.getSelectedFilters();
  }
  // Prefer `countActive`. Once a group has a selection, `count` is the
  // INTERSECTION with that selection — for an unticked sibling in a
  // multi-select (OR) group that is "products carrying both values", which is
  // near-meaningless and reads as a wildly low total: a season facet showing
  // "(1)" that adds 2 products when ticked. `countActive` is the same option
  // counted with its own group's filters lifted (other groups still applied),
  // which is what the option actually contributes. With no selection in the
  // group the backend returns count === countActive, so this is a no-op there.
  function getCount(option: AttributeTextFilter): number {
    const c = option?.count || 0;
    const ca = option?.countActive || 0;
    return ca > 0 ? ca : c;
  }
  function getMinBound() {
    return (props.priceMin as number) || 0;
  }
  function getMaxBound() {
    return (props.priceMax as number) || 9999;
  }
  // All five of the effects below are intentional external-state → local
  // sync. ProductGrid (the parent) drives filter+price state via props;
  // GridFilters mirrors it locally so the user can interact (drag the
  // slider, tick a checkbox) before the parent commits. Replacing with
  // derived-on-render would require lifting the entire local-edit buffer
  // up to ProductGrid — a real refactor planned for Phase C (compound
  // primitives). Disables are scoped to the specific setState calls.

  // Initialize the open/closed state of any filter group that hasn't been
  // seen yet (i.e. new entries in props.filters). Only ever *adds* keys —
  // never revisits a key the user has already toggled — so it cannot fight
  // user clicks. expandedFilters is read via the functional updater rather
  // than the dependency array to keep this from re-running on every toggle.
  useEffect(() => {
    const open = props.collapsed === false;
    // A group that already has a selected value starts EXPANDED even when
    // `collapsed` is true — otherwise restoring a filtered URL would hide
    // the very checkboxes the user has ticked. `activeTextFilters` is keyed
    // by attribute name, value = selected values.
    //
    // This only ever *sets* the initial state of a not-yet-seen group
    // (`next[n] === undefined`); it never revisits a key, so a user who
    // later collapses a group with an active filter is not fought.
    const active = (props.activeTextFilters as Record<string, string[]>) || {};
    const incoming = ((props.filters as AttributeFilter[]) || [])
      .map((f) => f?.attributeDescription?.name)
      .filter((n): n is string => !!n);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedFilters((prev) => {
      const cur = prev as Record<string, boolean>;
      let changed = false;
      const next: Record<string, boolean> = { ...cur };
      incoming.forEach((n) => {
        if (next[n] === undefined) {
          const hasActive = (active[n]?.length ?? 0) > 0;
          next[n] = open || hasActive;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [props.filters, props.collapsed, props.activeTextFilters]);

  // Re-bound the slider when the catalog's price range changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentMin((props.priceMin as number) || 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentMax((props.priceMax as number) || 9999);
  }, [props.priceMin, props.priceMax]);

  // Parent-triggered "clear all" pulse.
  useEffect(() => {
    if (props.clearSignal === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedFilters({});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentMin((props.priceMin as number) || 0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentMax((props.priceMax as number) || 9999);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedFilters({});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailability('all');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinStock(MIN_STOCK_THRESHOLD);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinStockInput(String(MIN_STOCK_THRESHOLD));
  }, [props.clearSignal, props.priceMin, props.priceMax]);

  // Adopt parent-supplied active filter set (URL state rehydration).
  useEffect(() => {
    if (!props.activeTextFilters) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedFilters(props.activeTextFilters as Record<string, string[]>);
  }, [props.activeTextFilters]);

  // Adopt parent-supplied availability (URL state rehydration).
  useEffect(() => {
    if (!props.activeAvailability) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvailability(props.activeAvailability);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinStock((props.activeMinStock as number) ?? MIN_STOCK_THRESHOLD);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinStockInput(String((props.activeMinStock as number) ?? MIN_STOCK_THRESHOLD));
  }, [props.activeAvailability, props.activeMinStock]);

  // Reset slider to bounds when parent has no active price filter.
  useEffect(() => {
    if (props.activePriceMin === undefined && props.activePriceMax === undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentMin((props.priceMin as number) || 0);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentMax((props.priceMax as number) || 9999);
    }
  }, [props.activePriceMin, props.activePriceMax, props.priceMin, props.priceMax]);

  // Keep the price text-input buffers in step with the numeric source of truth
  // (slider drags, prop-driven resets). User keystrokes only touch the buffers,
  // so this never fights typing — it only re-seeds them when the number moves.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMinInput(String(currentMin));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMaxInput(String(currentMax));
  }, [currentMin, currentMax]);

  // Clear the "rapid click" pending flag when the parent reports loading done.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!props.isLoading) setIsPending(false);
  }, [props.isLoading]);
  return (
    <div
      className={cn(`propeller-grid-filters space-y-4 ${(props.isMobile as boolean) ? 'pb-8' : 'sticky top-24'} ${isPending ? 'opacity-50 pointer-events-none' : ''} ${(props.className as string) || ''}`)}
      data-mobile={props.isMobile ? 'true' : 'false'}
      data-pending={isPending ? 'true' : 'false'}
    >
      {showPriceFilter() && (props.priceMin !== undefined || props.priceMax !== undefined) ? (
        <>
          <div className="propeller-grid-filters__price space-y-3">
            <h3 className="propeller-grid-filters__price-title text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {' '}
              {getLabel(props.labels, 'priceRange', 'Price Range')}{' '}
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="propeller-grid-filters__price-currency absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-foreground-subtle pointer-events-none">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  className="propeller-grid-filters__price-input w-full pl-6 pr-2 h-8 rounded-control border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  value={minInput}
                  min={getMinBound()}
                  max={getMaxBound()}
                  onChange={(e) => setMinInput(e.target.value)}
                  onBlur={() => commitMinInput()}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
              </div>
              <span className="propeller-grid-filters__price-separator text-foreground-subtle text-sm select-none">–</span>
              <div className="relative flex-1">
                <span className="propeller-grid-filters__price-currency absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-foreground-subtle pointer-events-none">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  className="propeller-grid-filters__price-input w-full pl-6 pr-2 h-8 rounded-control border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                  value={maxInput}
                  min={getMinBound()}
                  max={getMaxBound()}
                  onChange={(e) => setMaxInput(e.target.value)}
                  onBlur={() => commitMaxInput()}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
              </div>
            </div>
            <div className="propeller-grid-filters__price-slider relative h-4 pt-1">
              <input
                type="range"
                className="propeller-grid-filters__price-slider-thumb absolute w-full h-1.5 bg-transparent appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-secondary [&::-webkit-slider-thumb]:cursor-pointer z-20"
                min={getMinBound()}
                max={getMaxBound()}
                value={currentMin}
                onChange={(e) => handleMinChange(parseFloat(e.target.value))}
                onPointerUp={() => applyPrice()}
                onTouchEnd={() => applyPrice()}
              />
              <input
                type="range"
                className="propeller-grid-filters__price-slider-thumb absolute w-full h-1.5 bg-transparent appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-secondary [&::-webkit-slider-thumb]:cursor-pointer z-20"
                min={getMinBound()}
                max={getMaxBound()}
                value={currentMax}
                onChange={(e) => handleMaxChange(parseFloat(e.target.value))}
                onPointerUp={() => applyPrice()}
                onTouchEnd={() => applyPrice()}
              />
              <div className="propeller-grid-filters__price-slider-track absolute top-1.5 left-0 right-0 h-1.5 bg-border rounded z-10" />
            </div>
          </div>{' '}
          <div className="propeller-grid-filters__divider h-px bg-border-subtle" />
        </>
      ) : null}
      {showAvailability() ? (
        <>
          <div className="propeller-grid-filters__availability space-y-3">
            <h3 className="propeller-grid-filters__availability-title text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {getLabel(props.labels, 'availability', 'Availability')}
            </h3>
            <div className="propeller-grid-filters__availability-toggle inline-flex h-8 w-full rounded-control border border-input overflow-hidden">
              <button
                type="button"
                className={`propeller-grid-filters__availability-option flex-1 text-xs font-medium transition-colors ${availability === 'all' ? 'bg-secondary text-secondary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}
                aria-pressed={availability === 'all'}
                disabled={!!props.isLoading}
                onClick={() => handleAvailabilityChange('all')}
              >
                {getLabel(props.labels, 'allProducts', 'All products')}
              </button>
              <button
                type="button"
                className={`propeller-grid-filters__availability-option flex-1 text-xs font-medium transition-colors ${availability === 'in-stock' ? 'bg-secondary text-secondary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}
                aria-pressed={availability === 'in-stock'}
                disabled={!!props.isLoading}
                onClick={() => handleAvailabilityChange('in-stock')}
              >
                {getLabel(props.labels, 'inStock', 'In stock')}
              </button>
            </div>
            {availability === 'in-stock' ? (
              <div className="propeller-grid-filters__availability-quantity flex items-center gap-2 text-sm text-muted-foreground">
                <span>{getLabel(props.labels, 'atLeast', 'at least')}</span>
                <div className="propeller-grid-filters__availability-stepper inline-flex items-center h-8 rounded-control border border-input bg-card overflow-hidden focus-within:ring-1 focus-within:ring-secondary">
                  <button
                    type="button"
                    className="propeller-grid-filters__quantity-decrease h-full w-8 flex items-center justify-center text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent hover:text-foreground transition-colors"
                    aria-label={getLabel(props.labels, 'quantityDecrease', 'Decrease quantity')}
                    disabled={!!props.isLoading || minStock <= MIN_STOCK_THRESHOLD}
                    onClick={() => handleMinStockChange(minStock - 1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="propeller-grid-filters__availability-quantity-input w-10 h-full px-0 text-center font-medium text-foreground bg-transparent border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label={getLabel(props.labels, 'atLeast', 'at least')}
                    min={MIN_STOCK_THRESHOLD}
                    step={1}
                    value={minStockInput}
                    disabled={!!props.isLoading}
                    onChange={(e) => setMinStockInput(e.target.value)}
                    onBlur={() => commitMinStockInput()}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                  <button
                    type="button"
                    className="propeller-grid-filters__quantity-increase h-full w-8 flex items-center justify-center text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent hover:text-foreground transition-colors"
                    aria-label={getLabel(props.labels, 'quantityIncrease', 'Increase quantity')}
                    disabled={!!props.isLoading}
                    onClick={() => handleMinStockChange(minStock + 1)}
                  >
                    +
                  </button>
                </div>
                <span>{getLabel(props.labels, 'pcs', 'pcs')}</span>
              </div>
            ) : null}
          </div>
          <div className="propeller-grid-filters__divider h-px bg-border-subtle" />
        </>
      ) : null}
      {(props.filters as AttributeFilter[]).length === 0 ? (
        <p className="propeller-grid-filters__empty text-sm text-foreground-subtle italic">{getLabel(props.labels, 'noFiltersAvailable', 'No filters available')}</p>
      ) : null}
      {getFilteredFilters()?.map((filter) => (
        <div className="propeller-grid-filters__group border-b border-border-subtle pb-3 last:border-b-0" key={getFilterName(filter)} data-expanded={isExpanded(getFilterName(filter)) ? 'true' : 'false'}>
          <button
            type="button"
            className="propeller-grid-filters__group-toggle w-full flex items-center justify-between gap-2 text-left py-1 hover:text-secondary transition-colors"
            onClick={(event) => toggleAccordion(getFilterName(filter))}
          >
            <span className="propeller-grid-filters__group-title text-sm font-semibold text-muted-foreground truncate">
              {getFilterTitle(filter)}
            </span>
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className={`propeller-grid-filters__chevron h-4 w-4 flex-shrink-0 text-foreground-subtle transition-transform duration-200 ${isExpanded(getFilterName(filter)) ? 'rotate-180' : ''}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
                strokeWidth={2}
              />
            </svg>
          </button>
          {isExpanded(getFilterName(filter)) ? (
            <div className="propeller-grid-filters__options pt-2 space-y-1.5">
              {getValidOptions(filter)?.map((option) => (
                <label className="propeller-grid-filters__option flex items-center gap-2 cursor-pointer group" key={option.value}>
                  <input
                    type="checkbox"
                    className="propeller-grid-filters__checkbox h-4 w-4 rounded border-input text-secondary focus:ring-secondary cursor-pointer flex-shrink-0"
                    checked={isSelected(getFilterName(filter), option.value)}
                    onChange={(e) => handleCheckbox(filter, option.value, e.target.checked)}
                  />
                  <span className="propeller-grid-filters__option-label flex-1 text-sm text-muted-foreground leading-none select-none group-hover:text-foreground">
                    {option.value}
                    <span className="propeller-grid-filters__option-count ml-1 text-xs text-foreground-subtle"> ({getCount(option)}) </span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
export default GridFilters;
