'use client';
/**
 * @rsc-blocked — Client-only component: browser-only APIs (window/document/storage).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect, useRef } from 'react';
import { GraphQLClient, Product, Cluster, Contact, Customer } from '@propeller-commerce/propeller-sdk-v2';
import { useProductSearch } from '../composables/react/useProductSearch';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface SearchBarResult {
  /** Unique identifier */
  id: number | string;
  /** Display name */
  name: string;
  /** SKU code */
  sku?: string;
  /**
   * Leading price value (kept for back-compat / consumer callbacks). Populated
   * with the tax-inclusive (net) or exclusive (gross) amount per the active
   * toggle — see `priceNet`/`priceGross` for both raw values.
   */
  price?: number;
  /** Tax-inclusive price (SDK `price.net`). */
  priceNet?: number;
  /** Tax-exclusive price (SDK `price.gross`). */
  priceGross?: number;
  /** Image URL */
  imageUrl?: string;
  /** URL path to navigate to */
  url?: string;
  /** Whether this is a cluster (vs product) */
  isCluster?: boolean;
}

export interface SearchBarProps {
  /** Propeller SDK GraphQL client. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** The currently logged in user (Contact or Customer) */
  user?: Contact | Customer | null;

  /** Language code for search requests */
  language?: string;

  /** Placeholder text for the search input */
  placeholder?: string;

  /** Minimum characters before search triggers */
  minSearchLength?: number;

  /** Debounce delay in milliseconds */
  debounceMs?: number;

  /** Maximum number of results to show in dropdown */
  maxResults?: number;

  /** Fallback image URL when product has no image */
  noImageUrl?: string;

  /** Fires when the search form is submitted (Enter key). Receives the search term. */
  onSubmit?: (term: string) => void;

  /** Fires when a result item is clicked. Receives the result object. */
  onResultClick?: (result: SearchBarResult) => void;

  /** Fires when "View all results" is clicked. Receives the search term. */
  onViewAllClick?: (term: string) => void;

  /**
   * Build the destination URL for a result item. When provided, each result
   * renders as a real `<a href>` (middle-clickable, new-tab, crawlable) while
   * `onResultClick` still fires for SPA navigation. Omit to keep the
   * div-based fallback.
   */
  getResultHref?: (result: SearchBarResult) => string;

  /**
   * Build the destination URL for the "View all results" CTA. When provided,
   * the CTA renders as a real `<a href>` (middle-clickable, new-tab, crawlable,
   * keyboard-focusable) while `onViewAllClick` still fires for SPA navigation.
   * Omit to keep the div-based fallback.
   */
  getViewAllHref?: (term: string) => string;

  /**
   * Show the price column on each autosuggest result. Defaults to `true`.
   * Set `false` to hide prices entirely in the dropdown — e.g. a B2B
   * contract-catalogue context where prices are quote-only and shouldn't
   * appear in the live preview. Ignored when {@link renderPrice} is provided.
   */
  showPrice?: boolean;

  /**
   * Replace the price cell of each result with custom content. When provided,
   * this fully overrides the default price rendering (and `showPrice`) — return
   * any node (e.g. a "Price by quotation" label for a contract catalogue), or
   * `null` to render nothing for that result. Keeps price/quotation wording
   * app-specific rather than baked into the package.
   */
  renderPrice?: (result: SearchBarResult) => React.ReactNode;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Currency symbol for prices. Resolved from PropellerProvider when omitted; defaults to '€'. */
  currency?: string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /**
   * When true, the tax-inclusive (net) price leads; false shows tax-exclusive
   * (gross). Note the SDK mapping: `price.net` = incl. VAT, `price.gross` =
   * excl. VAT. Resolved from `<PropellerProvider>` when omitted; defaults to
   * `false` (excl.). Mirrors ProductCard/ProductPrice so the dropdown agrees
   * with every other price surface.
   */
  includeTax?: boolean;

  /**
   * Labels for the incl./excl. price suffix. Keys: `inclTax`, `exclTax`.
   * Falls back to English 'incl. VAT' / 'excl. VAT'.
   */
  priceLabels?: Record<string, string>;

  /** Additional class name for the container */
  containerClassName?: string;

  /** Tax zone used for price calculation. Defaults to 'NL'. */
  taxZone?: string;

  /**
   * Configuration object providing:
   *   imageSearchFiltersGrid, imageVariantFiltersMedium — passed to CategoryService
   *   baseCategoryId — used when querying by term or brand
   *   urls.getProductUrl / urls.getClusterUrl — for card URL generation
   */
  configuration?: any;

  /**
   * Active company ID from the company switcher.
   */
  companyId?: number;

  /** Scope the autosuggest fetch to specific orderlist IDs (e.g. a chosen B2B contract). */
  orderlistIds?: number[];

  /**
   * Apply the orderlist filter. Defaults to `true` when `orderlistIds` is
   * non-empty, `false` otherwise — so an authenticated user without a contract
   * still sees the full catalogue.
   */
  applyOrderlists?: boolean;

  /** Attribute names to request per product, e.g. `['MPN']`. See ProductGrid. */
  productTrackAttributes?: string[];

  /**
   * Bump this counter to clear the search input from outside (e.g. on route
   * change). Each unique value triggers a one-time reset of the local term.
   */
  clearSignal?: number;
}

function mapToSearchBarResult(item: Product | Cluster, language?: string): SearchBarResult {
  const isCluster = 'clusterId' in item;
  const displayItem = isCluster ? (item as Cluster).defaultProduct : item;
  const id = isCluster ? (item as Cluster).clusterId : (item as Product).productId;
  // The slug goes into the result URL, so a default-language slug here emits a
  // wrong-language link on every other storefront — the name four
  // lines below was already resolved by language.
  const slug = getLocalizedValue(item.slugs, language, '');
  const url = isCluster ? '/cluster/' + id + '/' + slug : '/product/' + id + '/' + slug;
  const priceNet = displayItem?.price?.net || 0;
  const priceGross = displayItem?.price?.gross || 0;
  // Prefer the name in the active language; fall back to the first available.
  // The backend search doesn't language-filter, so a product may carry names in
  // several languages — without this the row could show the wrong-language name
  // (e.g. FR while EN is selected).
  const localizedName =
    (language && item.names?.find((n) => n.language === language)?.value) ||
    item.names?.[0]?.value ||
    'Product';
  return {
    id,
    name: localizedName,
    sku: item.sku || displayItem?.sku || '',
    // `price` stays the gross value for back-compat; the row picks net/gross
    // from the two explicit fields below per the toggle.
    price: priceGross,
    priceNet,
    priceGross,
    imageUrl: displayItem?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '',
    url,
    isCluster,
  };
}

/**
 * Renders a product search input with a debounced live-results dropdown and a
 * "View all results" link.
 *
 * @remarks Uses {@link useProductSearch} for the live search query.
 */
function SearchBar(rawProps: SearchBarProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const [showDropdown, setShowDropdown] = useState(false);
  const [localTerm, setLocalTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const minLength = props.minSearchLength !== undefined ? props.minSearchLength : 3;
  const maxResults = props.maxResults !== undefined ? props.maxResults : 8;

  const { search, searchResults, searchItemsFound, searchLoading } = useProductSearch({
    graphqlClient: props.graphqlClient,
    language: props.language,
    configuration: props.configuration || {},
    // `user` supplies userId/contactId/customerId to the autosuggest query.
    // Without it the dropdown's results diverge from the grid's: orderlist
    // scoping is driven by userId, so `orderlistIds` alone is ignored by the
    // backend and the dropdown shows the whole catalogue while the grid below
    // shows only the contract's products.
    user: props.user,
    companyId: props.companyId,
    orderlistIds: props.orderlistIds,
    applyOrderlists: props.applyOrderlists,
    productTrackAttributes: props.productTrackAttributes,
  });

  const results: SearchBarResult[] = searchResults
    .slice(0, maxResults)
    .map((item) => mapToSearchBarResult(item as Product | Cluster, props.language));

  const itemsFound = searchItemsFound;

  

  function formatItemPrice(price: number): string {
    if (props.formatPrice) {
      return props.formatPrice(price);
    }
    return formatPrice(price || 0, { symbol: props.currency ?? '\u20AC' });
  }

  // Match ProductPrice: the toggle picks which value leads. SDK mapping \u2014
  // net = incl. VAT, gross = excl. VAT. Default (includeTax undefined) is excl.
  const useTax = !!props.includeTax;
  function leadingPrice(result: SearchBarResult): number {
    return useTax ? (result.priceNet ?? result.price ?? 0) : (result.priceGross ?? result.price ?? 0);
  }
  function priceTaxLabel(): string {
    return useTax
      ? getLabel(props.priceLabels, 'inclTax', 'incl. VAT')
      : getLabel(props.priceLabels, 'exclTax', 'excl. VAT');
  }

  function noImageUrl(): string {
    return props.noImageUrl || '';
  }

  function handleInputChange(value: string) {
    setLocalTerm(value);
    if (value.length < minLength) {
      setShowDropdown(false);
      return;
    }
    search(value);
    setShowDropdown(true);
  }

  // Keep dropdown open when results arrive
  useEffect(() => {
    if (searchResults.length > 0) {
      setShowDropdown(true);
    }
  }, [searchResults]);

  // Parents bump `clearSignal` (e.g. on route change) to reset the input. We
  // also stop any in-flight search and close the dropdown.
  useEffect(() => {
    if (props.clearSignal === undefined) return;
    setLocalTerm('');
    setShowDropdown(false);
    search('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.clearSignal]);

  function handleSubmit(e: any) {
    e.preventDefault();
    const term = localTerm.trim();
    if (props.onSubmit) {
      props.onSubmit(term);
      setShowDropdown(false);
    }
  }

  function handleResultClick(result: SearchBarResult) {
    if (props.onResultClick) {
      props.onResultClick(result);
    }
    setShowDropdown(false);
    setLocalTerm('');
  }

  function handleViewAllClick() {
    if (props.onViewAllClick) {
      props.onViewAllClick(localTerm);
    }
    setShowDropdown(false);
  }

  // True when a click should be left to the browser (open in new tab/window)
  // instead of intercepted for SPA navigation.
  function isModifiedClick(event: React.MouseEvent): boolean {
    return (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    );
  }

  // Click-outside to close dropdown
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, []);

  return (
    <div
      ref={containerRef}
      data-search-bar
      className={cn(`propeller-search-bar ${props.containerClassName || 'relative flex-1 max-w-2xl mx-8'}`)}
      data-open={showDropdown ? 'true' : 'false'}
    >
      <form className="propeller-search-bar__form" onSubmit={(e) => handleSubmit(e)}>
        <div className="propeller-search-bar__input-wrapper relative">
          <button
            type="submit"
            className="propeller-search-bar__submit absolute left-3 top-1/2 transform -translate-y-1/2 p-0 bg-transparent border-none cursor-pointer"
          >
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className="propeller-search-bar__submit-icon w-5 h-5 text-foreground-subtle hover:text-foreground"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
          <input
            type="search"
            autoComplete="off"
            className="propeller-search-bar__input w-full pl-10 pr-10 py-2 bg-white/95 border border-white/20 rounded-container focus:outline-none focus:ring-2 focus:ring-secondary placeholder:text-muted-foreground"
            placeholder={props.placeholder || 'Search products...'}
            value={localTerm}
            onChange={(e) => handleInputChange((e.target as HTMLInputElement).value)}
          />
          {searchLoading ? (
            <div className="propeller-search-bar__spinner-wrapper absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="propeller-search-bar__spinner animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
            </div>
          ) : null}
        </div>
      </form>
      {showDropdown ? (
        <div className="propeller-search-bar__dropdown absolute top-full left-0 right-0 mt-2 bg-card rounded-container shadow-xl border border-border z-50 flex flex-col max-h-96">
          {results.length > 0 ? (
            <>
              <div className="propeller-search-bar__results flex-1 overflow-y-auto">
                {results?.map((result, index) => {
                  const ResultTag = props.getResultHref ? 'a' : 'div';
                  const resultProps = props.getResultHref
                    ? {
                        href: props.getResultHref(result),
                        onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                          if (isModifiedClick(event)) return;
                          event.preventDefault();
                          handleResultClick(result);
                        },
                      }
                    : { onClick: (_event: React.MouseEvent) => handleResultClick(result) };
                  return (
                  <ResultTag
                    className="propeller-search-bar__result flex items-center gap-4 p-3 hover:bg-surface-hover cursor-pointer border-b border-border-subtle last:border-b-0"
                    key={result.id + '-' + index}
                    {...(resultProps as any)}
                  >
                    {result.imageUrl || noImageUrl() ? (
                      <div className="propeller-search-bar__result-media relative w-16 h-16 flex-shrink-0">
                        <img
                          className="propeller-search-bar__result-image w-full h-full object-contain"
                          src={result.imageUrl || noImageUrl()}
                          alt={result.name}
                        />
                      </div>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <div className="propeller-search-bar__result-name font-semibold truncate">{result.name}</div>
                      {result.sku ? (
                        <div className="propeller-search-bar__result-sku text-sm text-muted-foreground">SKU: {result.sku}</div>
                      ) : null}
                    </div>
                    {props.renderPrice ? (
                      props.renderPrice(result)
                    ) : props.showPrice !== false && result.price !== undefined && result.price !== null ? (
                      <div className="propeller-search-bar__result-price text-sm font-semibold text-foreground flex-shrink-0 text-right">
                        <span className="propeller-search-bar__result-price-value">{formatItemPrice(leadingPrice(result))}</span>
                        <span className="propeller-search-bar__result-price-label block text-xs font-normal text-muted-foreground">{priceTaxLabel()}</span>
                      </div>
                    ) : null}
                  </ResultTag>
                  );
                })}
              </div>
              {itemsFound > results.length ? (
                props.getViewAllHref ? (
                  <a
                    href={props.getViewAllHref(localTerm)}
                    className="propeller-search-bar__view-all block flex-shrink-0 p-3 text-center text-primary hover:bg-primary/5 cursor-pointer font-semibold border-t border-border bg-card rounded-b-container"
                    onClick={(event) => {
                      if (isModifiedClick(event)) return;
                      event.preventDefault();
                      handleViewAllClick();
                    }}
                  >
                    {getLabel(props.labels, 'viewAll', 'View all results')} ({itemsFound})
                  </a>
                ) : (
                  <button
                    type="button"
                    className="propeller-search-bar__view-all block w-full flex-shrink-0 p-3 text-center text-primary hover:bg-primary/5 cursor-pointer font-semibold border-t border-border bg-card rounded-b-container"
                    onClick={(event) => handleViewAllClick()}
                  >
                    {getLabel(props.labels, 'viewAll', 'View all results')} ({itemsFound})
                  </button>
                )
              ) : null}
            </>
          ) : null}
          {results.length === 0 && localTerm.length >= minLength && !searchLoading ? (
            <div className="propeller-search-bar__empty p-4 text-center text-muted-foreground">
              {getLabel(props.labels, 'noResults', 'No products found for')} &quot;{localTerm}&quot;
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default SearchBar;
