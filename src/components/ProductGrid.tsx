'use client';
/**
 * @rsc-blocked — Client-only component: side effects (useEffect).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */

import * as React from 'react';
import { createContext, useContext, useEffect } from 'react';
import {
  GraphQLClient,
  Product,
  Cluster,
  Contact,
  Customer,
  Cart,
  CartMainItem,
  AttributeFilter,
  ProductTextFilterInput,
  ProductsResponse,
  Category,
  MediaImageProductSearchInput,
  TransformationsInput,
} from '@propeller-commerce/propeller-sdk-v2';
import { useProductSearch } from '../composables/react/useProductSearch';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel, type Availability } from '@propeller-commerce/propeller-v2-core-ui';
import { isContentHidden } from '@propeller-commerce/propeller-v2-core-ui';
import { ProductGridConfigProvider, ProductGridConfig } from '../context/ProductGridContext';
import ProductCard from './ProductCard';
import ClusterCard from './ClusterCard';
import { cn } from '../composables/shared/utils/cn';

export interface ProductGridProps {
  // ── Data source ──────────────────────────────────────────────────────────

  /**
   * Initialised Propeller SDK GraphQL client.
   * Required when `products` is not provided — used for internal data fetching.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Pre-fetched products/clusters to display.
   * When provided the component skips internal API calls entirely.
   * Pass an empty array (not undefined) to show the empty state while the
   * parent controls loading.
   */
  products?: (Product | Cluster)[];

  // ── Locale / pricing ─────────────────────────────────────────────────────

  /** Language code for product data. Defaults to 'NL'. */
  language?: string;

  /** Tax zone used for price calculation. Defaults to 'NL'. */
  taxZone?: string;

  // ── Query mode (only used when graphqlClient is provided) ─────────────────

  /**
   * Category ID to list products for (category-page mode).
   * When omitted alongside `term` and `brand`, `config.baseCategoryId` is used.
   */
  categoryId?: number;

  /**
   * Search term — passes `term` into categoryProductSearchInput and uses
   * `config.baseCategoryId` so the whole catalog is searched.
   */
  term?: string;

  /**
   * Manufacturer/brand name — passes `manufacturers: [brand]` into
   * categoryProductSearchInput and uses `config.baseCategoryId`.
   */
  brand?: string;

  /** Scope the product fetch to specific orderlist IDs (e.g. a chosen B2B contract). */
  orderlistIds?: number[];

  /**
   * Apply the orderlist filter. Defaults to `true` when `orderlistIds` is
   * non-empty, `false` otherwise — so an authenticated user without a contract
   * still sees the full catalogue.
   */
  applyOrderlists?: boolean;

  /**
   * Attribute names to request per product, e.g. `['MPN']` — makes
   * `product.attributes` usable in card slots like `belowName`. Unset returns
   * the first page of ALL attributes (12 per product), so products with more
   * than 12 silently lose the rest.
   */
  productTrackAttributes?: string[];

  //── Layout ────────────────────────────────────────────────────────────────

  /** Number of columns in the grid. Accepts 2, 3, 4, 5, or 6. Defaults to 3. */
  columns?: number;

  // ── Loading ───────────────────────────────────────────────────────────────

  /**
   * Show a skeleton loader.
   * Useful when the parent controls loading state and passes `products` down.
   * The grid automatically shows a skeleton during internal fetches regardless
   * of this prop. Defaults to false.
   */
  isLoading?: boolean;

  // ── Custom card renderers (render-prop / slot) ────────────────────────────

  /**
   * Provide a custom product card renderer.
   * Falls back to the built-in `<ProductCard>` when not set.
   */
  renderProductCard?: (product: Product) => any;

  /**
   * Provide a custom cluster card renderer.
   * Falls back to the built-in `<ClusterCard>` when not set.
   */
  renderClusterCard?: (cluster: Cluster) => any;

  // ── Portal / visibility ───────────────────────────────────────────────────

  /**
   * Controls portal visibility mode.
   * 'open'        — full e-commerce; AddToCart is visible in product cards.
   * 'semi-closed' — catalog-only; AddToCart is hidden.
   * Defaults to 'open'.
   */
  portalMode?: string;

  /** Authenticated user passed through to ProductCard / AddToCart. */
  user?: Contact | Customer | null;

  /** Active company ID from the company switcher. Overrides user's default company for price calculation. Triggers a re-fetch when changed. */ companyId?: number;
  /**  * When true, tax-inclusive (gross) price is the leading price.  * Defaults to false.  */ includeTax?: boolean;
  /**  * Enables stock validation inside AddToCart.  * Blocks add when requested quantity exceeds available stock.  * Defaults to false.  */ stockValidation?: boolean;
  /**  * When false, hides the AddToCart control in product cards.  * ClusterCards always show their "View cluster" navigation button.  * Defaults to true.  */ allowAddToCart?: boolean;
  /* ── External hooks ───────────────────────────────────────────────────────── */ /**  * Called after each internal data fetch with the filterable attributes  * returned by the API (for driving a sibling FiltersSidebar).  */ onFiltersChange?: (
    filters: AttributeFilter[]
  ) => void;
  /**  * Active text filters to apply — built by the parent from FiltersSidebar  * `onFilterChange` callbacks.  Each entry maps to a `textFilters` input  * row in the CategoryService query.  * When this prop changes the grid automatically re-fetches (page resets to 1).  */ textFilters?: ProductTextFilterInput[];
  /**  * Active price range lower bound from the FiltersSidebar `onPriceChange`.  * Triggers a re-fetch when changed.  */ priceFilterMin?: number;
  /**  * Active price range upper bound from the FiltersSidebar `onPriceChange`.  * Triggers a re-fetch when changed.  */ priceFilterMax?: number;
  /**
   * Active stock selection from the filters sidebar. Triggers a re-fetch when
   * changed. `'all'` or undefined means no stock filter.
   */
  availability?: Availability;

  /** Minimum stock quantity for the `'in-stock'` selection. Defaults to the minimum threshold. */
  minStock?: number;
  /**  * Called when sort state changes internally (for syncing a sibling toolbar).  */ onSortChange?: (
    field: string,
    order: string
  ) => void;
  /**  * Called after each internal data fetch with the min/max price of the  * current product set — use to populate a price range slider in the parent.  */ onPriceBoundsChange?: (
    min: number,
    max: number
  ) => void;
  /**  * Called after each fetch with the total number of products found —  * use to display a result count in the parent toolbar.  */ onItemsFoundChange?: (
    count: number
  ) => void;
  /**  * Called after each fetch with the number of items visible on the current page  * (after client-side language filtering).  */ onPageItemCountChange?: (
    count: number
  ) => void;
  /**  * Called when the user clicks Previous / Next in the built-in pagination —  * use to keep the parent URL / page state in sync.  */ onPageChange?: (
    page: number
  ) => void;
  /**  * Called after each successful internal data fetch with the full  * ProductsResponse object — use to drive an external GridPagination  * component by passing the result as its `products` prop.  */ onProductsResponse?: (
    products: ProductsResponse
  ) => void;
  /**  * Called after each successful internal data fetch with the full  * Category object — use to populate sibling components like GridTitle,  * CategoryDescription, and CategoryShortDescription.  */ onCategoryChange?: (
    category: Category
  ) => void;
  /**  * Called whenever the internal loading state changes.  * Use to disable sibling components (e.g. GridFilters) while a fetch is in flight.  */ onLoadingChange?: (
    isLoading: boolean
  ) => void;
  /**  * Externally controlled current page.  * When provided, the grid uses this value instead of its internal page  * counter. Wire this to the `onPageChange` callback from a sibling  * GridPagination so the two components stay in sync.  * When changed the grid automatically re-fetches.  */ page?: number;
  /**  * Number of products per page. Defaults to 12.  * When changed the grid automatically re-fetches (page resets to 1).  */ pageSize?: number;
  /**  * Sort field to use (e.g. 'NAME', 'PRICE').  * When provided overrides internal sort state.  * When changed the grid automatically re-fetches (page resets to 1).  */ sortField?: string;
  /**  * Sort direction: 'ASC' or 'DESC'.  * Only used when sortField is also provided.  * When changed the grid automatically re-fetches (page resets to 1).  */ sortOrder?: string;
  /* ── Configuration ──────────────────────────────────────────────────────── */
  /**
   * Configuration object providing:
   *   imageSearchFiltersGrid, imageVariantFiltersMedium — passed to CategoryService
   *   baseCategoryId — used when querying by term or brand
   *   urls.getProductUrl / urls.getClusterUrl — for card URL generation
   */
  configuration?: {
    baseCategoryId?: number;
    /** The channel's anonymous user, seeded by the host. Scopes logged-out
     *  listings exactly like the SSR seed does. */
    anonymousUserId?: number;
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersMedium?: TransformationsInput;
    urls?: {
      getProductUrl?: (p: Product) => string;
      getClusterUrl?: (c: Cluster) => string;
    };
  };
  /* ── ProductCard / AddToCart pass-through props ─────────────────────────── */ /** ID of an existing cart to add items into. */ cartId?: string;
  /**  * Auto-create a cart when none is available.  * Always pair with `onCartCreated` to persist the new cart ID.  */ createCart?: boolean;
  /** Called after AddToCart creates a new cart internally. */ onCartCreated?: (cart: Cart) => void;
  /** Called after every successful add-to-cart operation. */ afterAddToCart?: (
    cart: Cart,
    item?: CartMainItem
  ) => void;
  /**  * When true, AddToCart shows a success modal instead of a toast.  * Defaults to false.  */ showModal?: boolean;
  /**  * Render − / + stepper buttons in AddToCart.  * Defaults to true.  */ allowIncrDecr?: boolean;
  /** Called when "Proceed to checkout" is clicked in the AddToCart modal. */ onProceedToCheckout?: () => void;
  /**
   * Called when an anonymous visitor clicks the log-in action that replaces
   * add-to-cart in a semi-closed portal. The host owns navigation.
   */
  onLoginClick?: () => void;
  /** Called when "Request a Quote" is clicked in the AddToCart modal. */ onRequestQuoteClick?: (
    cart: Cart
  ) => void;
  /**  * Label overrides forwarded directly to the embedded AddToCart component.  * Keys: add, adding, addedToCart, outOfStock, noCartId, errorAdding,  *       modalTitle, quantity, continueShopping, proceedToCheckout  */ addToCartLabels?: Record<
    string,
    string
  >;
  /* ── Stock display ───────────────────────────────────────────────────────── */ /**  * Show the stock / availability widget on each product card.  * Forwarded directly to `ProductCard.showStock`.  * Defaults to false.  */ showStock?: boolean;
  /**  * Show only the availability indicator inside the stock widget.  * Forwarded to `ProductCard.showAvailability`.  * Defaults to true.  */ showAvailability?: boolean;
  /**  * Show the price below the product name.  * Defaults to true.  */ showPrice?: boolean;
  /**  * Label overrides forwarded to the embedded ItemStock component inside each card.  * Keys: inStock, outOfStock, lowStock, available, notAvailable, pieces  */ stockLabels?: Record<
    string,
    string
  >;

  /** Translated labels forwarded to the embedded `<ProductPrice>` display
   * inside each `<ProductCard>`. See `ProductPriceProps.labels` for slugs. */
  priceLabels?: Record<string, string>;

  /** Translated labels forwarded to embedded `<ProductCard>` instances.
   * See `ProductCardProps.labels` for slugs. */
  productCardLabels?: Record<string, string>;

  /** Translated labels forwarded to embedded `<ClusterCard>` instances.
   * See `ClusterCardProps.labels` for slugs. */
  clusterCardLabels?: Record<string, string>;

  /* ── Card interaction ────────────────────────────────────────────────────── */ /** Show a heart-icon favourite toggle on each card. */ enableAddFavorite?: boolean;
  /**  * Called when a favourite is toggled on any card.  * Receives the full Product or Cluster object and the new favourite state.  */ onToggleFavorite?: (
    item: Product | Cluster,
    isFavorite: boolean
  ) => void;
  /**  * Called when a cluster card name, image, or "View cluster" button is  * clicked — use for SPA-style routing instead of full-page navigation.  */ onClusterClick?: (
    cluster: Cluster
  ) => void;
  /**  * Called when a product card name or image is clicked — use for SPA  * routing instead of full-page navigation.  */ onProductClick?: (
    product: Product
  ) => void;
  /** Extra CSS class applied to the root element. */ className?: string;

  /**
   * Compound API: when provided, the grid renders these children inside a
   * `<ProductGridContext>` instead of its built-in grid+pagination layout.
   * Subcomponents (`<ProductGrid.Items>`, `<ProductGrid.Pagination>`) read
   * the search state via the context; consumers control the layout.
   *
   * @example
   * <ProductGrid categoryId={17}>
   *   <ProductGrid.Items renderItem={(item) => <ProductCard product={item as Product} />} />
   *   <ProductGrid.Pagination />
   * </ProductGrid>
   */
  children?: React.ReactNode;

  /** Translated labels keyed by the slugs used inside the component (see
   * `getLabel` calls). Missing keys fall back to the English defaults. */
  labels?: Record<string, string>;

  // ───── Extension API ─────
  // Sub-component injection — cascades through ProductGridConfig context
  // to every nested ProductCard / ClusterCard.
  priceComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').PriceComponentProps>;
  stockComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').StockComponentProps>;
  addToCartComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').AddToCartComponentProps>;
  imageComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').ImageComponentProps>;
  badgesComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').BadgesComponentProps>;
  favoriteComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').FavoriteComponentProps>;

  // Iteration-level: replace the whole ProductCard / ClusterCard. The custom
  // component receives the same props the default would. If a consumer wants
  // to honor cascaded sub-component slots inside their custom card, they
  // read ProductGridConfig via `useProductGridConfig()`.
  productCardComponent?: React.ComponentType<import('./ProductCard').ProductCardProps>;
  clusterCardComponent?: React.ComponentType<import('./ClusterCard').ClusterCardProps>;

  /**
   * Render arbitrary content directly below each card's product name (and above
   * the short description / price). Receives the product; return `null` to
   * render nothing. Cascades to every ProductCard via ProductGridConfig — lets
   * hosts surface extra per-product info (e.g. package descriptions) without
   * swapping the whole card.
   */
  belowName?: (product: Product) => React.ReactNode;

  // Insertion slots — render before/after each iterated item without
  // forking ProductGrid. Common use cases: promo banners between cards,
  // bulk-select checkboxes, admin metadata rows.
  beforeItem?: (item: Product | Cluster, index: number) => React.ReactNode;
  afterItem?: (item: Product | Cluster, index: number) => React.ReactNode;
}

// ── Compound context ────────────────────────────────────────────────────────

/**
 * Shared state the compound subcomponents read. Populated by `<ProductGrid>`
 * around its children. Not exported — consumers compose subcomponents under
 * `<ProductGrid>` rather than reading the context directly.
 */
interface ProductGridContextValue {
  items: (Product | Cluster)[];
  itemsFound: number;
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  gridConfig: ProductGridConfig;
  // Iteration-level insertion slots from parent <ProductGrid> props.
  beforeItem?: (item: Product | Cluster, index: number) => React.ReactNode;
  afterItem?: (item: Product | Cluster, index: number) => React.ReactNode;
}

const ProductGridSearchContext = createContext<ProductGridContextValue | null>(null);

function useProductGrid(): ProductGridContextValue {
  const ctx = useContext(ProductGridSearchContext);
  if (!ctx) {
    throw new Error(
      '<ProductGrid.X> must be rendered inside <ProductGrid>. ' +
        'Got null context — wrap the subcomponents in <ProductGrid categoryId={...}>...</ProductGrid>.'
    );
  }
  return ctx;
}

/**
 * Renders a responsive grid of product and cluster cards with skeleton
 * loading, empty state and pagination. Supports a built-in layout or a
 * compound API (`<ProductGrid.Items>`, `<ProductGrid.Pagination>`).
 *
 * @remarks Uses {@link useProductSearch} for fetching, filtering and paging.
 */
function ProductGrid(rawProps: ProductGridProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const {
    displayProducts,
    itemsFound,
    isLoading,
    currentPage,
    totalPages,
    fetchProducts,
    goToPage,
  } = useProductSearch({
    graphqlClient: props.graphqlClient,
    products: props.products,
    categoryId: props.categoryId,
    term: props.term,
    brand: props.brand,
    orderlistIds: props.orderlistIds,
    applyOrderlists: props.applyOrderlists,
    productTrackAttributes: props.productTrackAttributes,
    language: props.language,
    taxZone: props.taxZone,
    user: props.user,
    companyId: props.companyId,
    textFilters: props.textFilters,
    priceFilterMin: props.priceFilterMin,
    priceFilterMax: props.priceFilterMax,
    availability: props.availability,
    minStock: props.minStock,
    sortField: props.sortField,
    sortOrder: props.sortOrder,
    pageSize: props.pageSize,
    configuration: props.configuration || {},
    onFiltersChange: props.onFiltersChange,
    onPriceBoundsChange: props.onPriceBoundsChange,
    onItemsFoundChange: props.onItemsFoundChange,
    onPageChange: props.onPageChange,
    onProductsResponse: props.onProductsResponse,
    onCategoryChange: props.onCategoryChange,
  });

  function isClusterItem(item: Product | Cluster): item is Cluster {
    return 'clusterId' in item && !!item.clusterId;
  }

  function getGridColsClass(): string {
    const cols = (props.columns as number) || 3;
    if (cols === 1) return 'flex flex-col gap-4';
    if (cols === 2) return 'grid grid-cols-2 gap-3 sm:gap-6 auto-rows-fr';
    if (cols === 4) return 'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 auto-rows-fr';
    if (cols === 5) return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 auto-rows-fr';
    if (cols === 6) return 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6 auto-rows-fr';
    return 'grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 auto-rows-fr';
  }

  useEffect(() => {
    if (props.onLoadingChange) props.onLoadingChange(isLoading);
  }, [isLoading]);

  useEffect(() => {
    if (props.page !== undefined) goToPage(props.page);
  }, [props.page]);

  function handlePageChange(page: number) {
    goToPage(page);
    if (props.onPageChange) props.onPageChange(page);
  }

  function getIsLoading(): boolean {
    return !!(props.isLoading as boolean) || isLoading;
  }

  function showAddToCart(): boolean {
    const allow = (props.allowAddToCart as boolean) !== false;
    // Anonymous visitors only — a signed-in user keeps add-to-cart.
    return !isContentHidden(props.portalMode as string | undefined, props.user) && allow;
  }

  function getSkeletonItems(): number[] {
    const cols = (props.columns as number) || 3;
    const count = cols === 2 ? 4 : cols === 4 ? 8 : cols === 5 ? 10 : cols === 6 ? 12 : 6;
    const items: number[] = [];
    for (let i = 0; i < count; i++) items.push(i);
    return items;
  }

  // Single config object provided to the card subtree, replacing the ~20 props
  // ProductGrid otherwise cascades to ProductCard/ClusterCard. Resolves the
  // stockValidation -> enableStockValidation alias. Inline handlers + this
  // object are auto-memoized by the React Compiler (this project's eslint
  // config enforces react-hooks/preserve-manual-memoization — manual
  // useCallback/useMemo here would defeat the Compiler), so the React.memo'd
  // cards still skip re-render when nothing relevant changed (rbp Â§5.2/Â§5.4).
  const gridConfig: ProductGridConfig = {
    columns: (props.columns as number) || 3,
    showPrice: props.showPrice as boolean,
    showStock: props.showStock as boolean,
    showAvailability: props.showAvailability as boolean,
    enableAddFavorite: props.enableAddFavorite as boolean,
    allowAddToCart: props.allowAddToCart as boolean,
    createCart: props.createCart as boolean,
    showModal: props.showModal as boolean,
    allowIncrDecr: props.allowIncrDecr,
    enableStockValidation: props.stockValidation as boolean,
    cartId: props.cartId as string,
    stockLabels: props.stockLabels,
    priceLabels: props.priceLabels,
    addToCartLabels: props.addToCartLabels,
    onCartCreated: props.onCartCreated,
    afterAddToCart: props.afterAddToCart,
    onProceedToCheckout: props.onProceedToCheckout,
    onLoginClick: props.onLoginClick,
    onRequestQuoteClick: props.onRequestQuoteClick,
    onToggleFavorite: (item: Product | Cluster, isFav: boolean) =>
      props.onToggleFavorite?.(item, isFav),
    onProductClick: (p: Product) => props.onProductClick?.(p),
    onClusterClick: (c: Cluster) => props.onClusterClick?.(c),
    // Extension API — cascade to nested cards via context.
    priceComponent: props.priceComponent,
    stockComponent: props.stockComponent,
    addToCartComponent: props.addToCartComponent,
    imageComponent: props.imageComponent,
    badgesComponent: props.badgesComponent,
    favoriteComponent: props.favoriteComponent,
    productCardComponent: props.productCardComponent,
    clusterCardComponent: props.clusterCardComponent,
    belowName: props.belowName,
  };

  // ── Compound mode ────────────────────────────────────────────────────────
  // When the consumer supplies children, render them inside the search
  // context instead of the built-in grid+pagination layout. Subcomponents
  // (<ProductGrid.Items>, <ProductGrid.Pagination>) read state from context.
  if (rawProps.children !== undefined) {
    const compoundCtx: ProductGridContextValue = {
      items: displayProducts,
      itemsFound,
      isLoading: getIsLoading(),
      currentPage,
      totalPages,
      goToPage: handlePageChange,
      gridConfig,
      beforeItem: props.beforeItem,
      afterItem: props.afterItem,
    };
    return (
      <ProductGridConfigProvider value={gridConfig}>
        <ProductGridSearchContext.Provider value={compoundCtx}>
          <div
            className={cn(`propeller-product-grid w-full ${(props.className as string) || ''}`)}
            data-loading={getIsLoading() ? 'true' : 'false'}
            data-mode="compound"
          >
            {rawProps.children}
          </div>
        </ProductGridSearchContext.Provider>
      </ProductGridConfigProvider>
    );
  }

  return (
    <ProductGridConfigProvider value={gridConfig}>
    <div
      className={cn(`propeller-product-grid w-full ${(props.className as string) || ''}`)}
      data-loading={getIsLoading() ? 'true' : 'false'}
    >
      {getIsLoading() ? (
        <div className={`propeller-product-grid__skeleton-grid ${getGridColsClass()}`}>
          {getSkeletonItems()?.map((_, idx) => (
            <div
              className="propeller-product-grid__skeleton-card flex flex-col overflow-hidden rounded-container border border-border bg-card shadow-sm"
              key={idx}
            >
              <div className="propeller-product-grid__skeleton-image aspect-square bg-surface-hover animate-pulse" />
              <div className="p-4 flex flex-col gap-2 flex-1">
                <div className="propeller-product-grid__skeleton-line h-3 bg-surface-hover animate-pulse rounded w-1/4" />
                <div className="propeller-product-grid__skeleton-line h-4 bg-surface-hover animate-pulse rounded w-3/4" />
                <div className="propeller-product-grid__skeleton-line h-4 bg-surface-hover animate-pulse rounded w-1/2" />
                <div className="mt-auto pt-2">
                  <div className="propeller-product-grid__skeleton-line h-5 bg-surface-hover animate-pulse rounded w-1/3" />
                </div>
              </div>
              {showAddToCart() ? (
                <div className="p-4 pt-0">
                  <div className="flex items-center gap-2">
                    <div className="propeller-product-grid__skeleton-line h-9 flex-1 bg-surface-hover animate-pulse rounded" />
                    <div className="propeller-product-grid__skeleton-line h-9 flex-1 bg-surface-hover animate-pulse rounded" />
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {!getIsLoading() ? (
        <>
          {displayProducts.length === 0 ? (
            <div className="propeller-product-grid__empty text-center py-24 bg-surface-hover rounded-container border border-dashed border-border">
              <svg
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                className="propeller-product-grid__empty-icon mx-auto h-12 w-12 text-foreground-subtle"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  strokeWidth={1}
                />
              </svg>
              <h3 className="propeller-product-grid__empty-title mt-4 text-lg font-semibold text-foreground"> {getLabel(props.labels, 'noProductsFound', 'No products found')} </h3>
              <p className="propeller-product-grid__empty-message mt-1 text-sm text-muted-foreground">
                {' '}
                {getLabel(props.labels, 'noProductsHelp', 'Try adjusting your filters or search term.')}{' '}
              </p>
            </div>
          ) : null}{' '}
          {displayProducts.length > 0 ? (
            <div className={`propeller-product-grid__grid ${getGridColsClass()}`}>
              {displayProducts?.map((item, idx) => {
                // Whole-card swap — injected override wins over default.
                const ProductCardImpl = props.productCardComponent ?? ProductCard;
                const ClusterCardImpl = props.clusterCardComponent ?? ClusterCard;
                return (
                  <React.Fragment
                    key={(item as Product).productId || (item as Cluster).clusterId || idx}
                  >
                    {props.beforeItem?.(item, idx)}
                    <div>
                      {isClusterItem(item) ? (
                        <>
                          {!props.renderClusterCard ? (
                            <ClusterCardImpl
                              cluster={item as Cluster}
                              labels={props.clusterCardLabels}
                              stockLabels={props.stockLabels}
                            />
                          ) : null}
                        </>
                      ) : null}
                      {!isClusterItem(item) ? (
                        <>
                          {!props.renderProductCard ? (
                            <ProductCardImpl
                              product={item as Product}
                              allowAddToCart={showAddToCart()}
                              labels={props.productCardLabels}
                              stockLabels={props.stockLabels}
                              priceLabels={props.priceLabels}
                              addToCartLabels={props.addToCartLabels}
                            />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {props.afterItem?.(item, idx)}
                  </React.Fragment>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
    </ProductGridConfigProvider>
  );
}
// ── Compound subcomponents ──────────────────────────────────────────────────

/**
 * The items grid. By default renders `<ProductCard>` / `<ClusterCard>` for
 * each item — but `renderItem` is the proper extension point: pass a
 * function that returns whatever shape you want (compound `<ProductCard>`
 * with custom subcomponents, a fully custom card, a list row, etc.).
 *
 * Reads `items`, `isLoading`, and `gridConfig.columns` from the parent
 * `<ProductGrid>` context. Also handles the loading skeleton and empty state.
 */
function ProductGridItems(props: {
  /** Custom per-item renderer. Falls back to built-in `<ProductCard>`/`<ClusterCard>`. */
  renderItem?: (item: Product | Cluster, index: number) => React.ReactNode;
  /** Custom empty-state node. Defaults to the built-in "No products found" panel. */
  empty?: React.ReactNode;
  /** Extra class on the grid container. */
  className?: string;
  /** Translated labels for the default empty-state texts; ignored when `empty` is set. */
  labels?: Record<string, string>;
}) {
  const { items, isLoading, gridConfig, beforeItem, afterItem } = useProductGrid();
  const cols = gridConfig.columns || 3;
  // Whole-card swap honored inside compound <ProductGrid.Items> too.
  const ProductCardImpl = (gridConfig.productCardComponent ?? ProductCard) as React.ComponentType<
    { product: Product } & Record<string, unknown>
  >;
  const ClusterCardImpl = (gridConfig.clusterCardComponent ?? ClusterCard) as React.ComponentType<
    { cluster: Cluster } & Record<string, unknown>
  >;
  const gridClass =
    cols === 1
      ? 'flex flex-col gap-4'
      : cols === 2
        ? 'grid grid-cols-2 gap-3 sm:gap-6 auto-rows-fr'
        : cols === 4
          ? 'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 auto-rows-fr'
          : cols === 5
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 auto-rows-fr'
            : cols === 6
              ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6 auto-rows-fr'
              : 'grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 auto-rows-fr';

  if (isLoading) {
    const skeletonCount = cols === 2 ? 4 : cols === 4 ? 8 : cols === 5 ? 10 : cols === 6 ? 12 : 6;
    return (
      <div className={cn(`propeller-product-grid__skeleton-grid ${gridClass} ${props.className ?? ''}`)}>
        {Array.from({ length: skeletonCount }).map((_, idx) => (
          <div
            key={idx}
            className="propeller-product-grid__skeleton-card flex flex-col overflow-hidden rounded-container border border-border bg-card shadow-sm"
          >
            <div className="propeller-product-grid__skeleton-image aspect-square bg-surface-hover animate-pulse" />
            <div className="p-4 flex flex-col gap-2 flex-1">
              <div className="propeller-product-grid__skeleton-line h-3 bg-surface-hover animate-pulse rounded w-1/4" />
              <div className="propeller-product-grid__skeleton-line h-4 bg-surface-hover animate-pulse rounded w-3/4" />
              <div className="propeller-product-grid__skeleton-line h-4 bg-surface-hover animate-pulse rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <>
        {props.empty ?? (
          <div className="propeller-product-grid__empty text-center py-24 bg-surface-hover rounded-container border border-dashed border-border">
            <h3 className="propeller-product-grid__empty-title mt-4 text-lg font-semibold text-foreground">
              {getLabel(props.labels, 'noProductsFound', 'No products found')}
            </h3>
            <p className="propeller-product-grid__empty-message mt-1 text-sm text-muted-foreground">
              {getLabel(props.labels, 'noProductsHelp', 'Try adjusting your filters or search term.')}
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={cn(`propeller-product-grid__grid ${gridClass} ${props.className ?? ''}`)}>
      {items.map((item, idx) => {
        const isCluster = 'clusterId' in item && !!(item as Cluster).clusterId;
        const key = (item as Product).productId || (item as Cluster).clusterId || idx;
        return (
          <React.Fragment key={key}>
            {beforeItem?.(item, idx)}
            <div>
              {props.renderItem
                ? props.renderItem(item, idx)
                : isCluster
                  ? <ClusterCardImpl cluster={item as Cluster} />
                  : <ProductCardImpl product={item as Product} />}
            </div>
            {afterItem?.(item, idx)}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/**
 * Pagination control wired to the parent ProductGrid context. Compact "Prev /
 * Page X of Y / Next" style by default — a future enhancement could expose
 * `style="full"` matching GridPagination. For complex pagination, render
 * GridPagination directly (it accepts the same context fields as props).
 */
function ProductGridPagination(props: {
  /** Extra class on the pagination nav element. */
  className?: string;
  /** Translated labels for Previous / Next / Page-of texts. */
  labels?: Record<string, string>;
}) {
  const { currentPage, totalPages, goToPage, isLoading } = useProductGrid();
  if (totalPages <= 1) return null;
  return (
    <nav
      className={props.className ?? 'propeller-product-grid__pagination flex items-center justify-center gap-3 mt-6'}
      aria-label={getLabel(props.labels, 'paginationAriaLabel', 'Pagination')}
    >
      <button
        type="button"
        className="px-3 py-1.5 rounded-control border border-border text-sm disabled:opacity-50"
        disabled={currentPage <= 1 || isLoading}
        onClick={() => goToPage(currentPage - 1)}
      >
        {getLabel(props.labels, 'previous', 'Previous')}
      </button>
      <span className="text-sm text-muted-foreground">
        {getLabel(props.labels, 'page', 'Page')} {currentPage} {getLabel(props.labels, 'of', 'of')} {totalPages}
      </span>
      <button
        type="button"
        className="px-3 py-1.5 rounded-control border border-border text-sm disabled:opacity-50"
        disabled={currentPage >= totalPages || isLoading}
        onClick={() => goToPage(currentPage + 1)}
      >
        {getLabel(props.labels, 'next', 'Next')}
      </button>
    </nav>
  );
}

// ── Compound default export ─────────────────────────────────────────────────

type ProductGridComponent = typeof ProductGrid & {
  Items: typeof ProductGridItems;
  Pagination: typeof ProductGridPagination;
};

const ProductGridCompound = ProductGrid as ProductGridComponent;
ProductGridCompound.Items = ProductGridItems;
ProductGridCompound.Pagination = ProductGridPagination;

export default ProductGridCompound;
