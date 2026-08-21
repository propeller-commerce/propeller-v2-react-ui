'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect, useRef } from 'react';
import { Cart, CartMainItem, Cluster, Contact, CrossupsellType, Customer, GraphQLClient, Product } from '@propeller-commerce/propeller-sdk-v2';
import { useProductSlider } from '../composables/react/useProductSlider';
import ProductCard from './ProductCard';
import ClusterCard from './ClusterCard';
import { useInfraProps } from '../composables/react/useInfraProps';
import { ProductGridConfigProvider, ProductGridConfig } from '../context/ProductGridContext';
import { getLabel, isContentHidden } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface ProductSliderProps {
  // === Data source ===

  /** Propeller SDK GraphQL client. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** Pre-loaded products or clusters to display. When provided, skips internal fetching. */
  products?: (Product | Cluster)[];

  /** Product IDs to fetch internally when `products` is not provided */
  productIds?: number[];

  /** Cluster IDs to fetch internally when `products` is not provided */
  clusterIds?: number[];

  /**
   * Cross-upsell types to fetch. When provided, fetches cross-upsells for the given
   * productId/clusterId instead of fetching products by IDs.
   * Values: 'ACCESSORIES' | 'ALTERNATIVES' | 'RELATED' | 'OPTIONS' | 'PARTS'
   */
  crossUpsellTypes?: CrossupsellType[];

  /** Source product ID for cross-upsell lookup. Required when crossUpsellTypes is set. */
  productId?: number;

  /** Source cluster ID for cross-upsell lookup. Required when crossUpsellTypes is set. */
  clusterId?: number;

  // === Locale / pricing ===

  /** Language code for API requests and localized content. Resolved from PropellerProvider when omitted. */
  language?: string;

  /** Tax zone for price calculations */
  taxZone: string;

  /**
   * When true, net price (incl. tax) is the leading price.
   * Forwarded to each ProductCard / ClusterCard.
   */
  includeTax?: boolean;

  // === Portal / visibility ===

  /**
   * Controls portal visibility mode.
   * 'open' — AddToCart is shown on product cards.
   * 'semi-closed' — AddToCart is hidden (catalog-only view).
   * Defaults to 'open'.
   */
  portalMode?: string;

  /** Authenticated user for cart operations */
  user?: Contact | Customer | null;

  /**
   * Active company ID from the company switcher.
   * Overrides the user's default company for price calculation in cross-upsell fetches  * and is forwarded to each embedded ProductCard / AddToCart.  * Triggers a re-fetch when changed.  */ companyId?: number;
  /* === Layout === */ /** Items visible per breakpoint */ itemsPerView?: {
    /** Number of items visible on mobile viewports. */
    mobile?: number;
    /** Number of items visible on tablet viewports. */
    tablet?: number;
    /** Number of items visible on desktop viewports. Defaults to `4`. */
    desktop?: number;
  };
  /** Slider title displayed above the track */ title?: string;
  /** Additional CSS class for the outer container */ containerClassName?: string;
  /* === Card stock display === */ /**  * Show the stock / availability widget on each product card.  * Forwarded to `ProductCard.showStock`.  * Defaults to false.  */ showStock?: boolean;
  /**  * Show only the availability indicator (Available / Not available) inside the stock widget.  * Forwarded to `ProductCard.showAvailability`.  * Defaults to true.  */ showAvailability?: boolean;
  /**  * Label overrides forwarded to the embedded ItemStock component inside each card.  * Keys: inStock, outOfStock, lowStock, available, notAvailable, pieces  */ stockLabels?: Record<
    string,
    string
  >;
  /** Translated labels forwarded to the embedded `<ProductPrice>` display
   * inside each `<ProductCard>`. See `ProductPriceProps.labels` for slugs. */
  priceLabels?: Record<string, string>;
  /* === Card favourites === */ /** Show a heart-icon favourite toggle on each card. Defaults to false. */ enableAddFavorite?: boolean;
  /**  * Called when a favourite is toggled on any card.  * Receives the full Product or Cluster object and the new favourite state.  */ onToggleFavorite?: (
    item: Product | Cluster,
    isFavorite: boolean
  ) => void;
  /* === Card navigation === */ /** Called when a product card is clicked — use for SPA-style routing. */ onProductClick?: (
    product: Product
  ) => void;
  /** Called when a cluster card is clicked — use for SPA-style routing. */ onClusterClick?: (
    cluster: Cluster
  ) => void;
  /* === AddToCart pass-through === */ /** Validate stock before adding to cart. Defaults to false. */ stockValidation?: boolean;
  /** Show increment/decrement stepper buttons in AddToCart. Defaults to true. */ showIncrDecr?: boolean;
  /** ID of an existing cart to add items to. */ cartId?: string;
  /** Auto-create a cart when none is available. Pair with onCartCreated. */ createCart?: boolean;
  /** Called after AddToCart creates a new cart internally. */ onCartCreated?: (cart: Cart) => void;
  /** Called after every successful add-to-cart. Receives the updated cart and the added item. */ afterAddToCart?: (
    cart: Cart,
    item?: CartMainItem
  ) => void;
  /**  * When true, AddToCart shows a success modal instead of a toast.  * Defaults to false.  */ showModal?: boolean;
  /** Called when "Proceed to checkout" is clicked in the AddToCart modal. */ onProceedToCheckout?: () => void;
  /**
   * Called when an anonymous visitor clicks the log-in action that replaces
   * add-to-cart in a semi-closed portal. The host owns navigation.
   */
  onLoginClick?: () => void;
  /**
   * Show the add-to-cart control on each card. Defaults to true; a semi-closed
   * portal still withholds it from anonymous visitors regardless.
   */
  allowAddToCart?: boolean;
  /** Called when "Request a Quote" is clicked in the AddToCart modal. */ onRequestQuoteClick?: (
    cart: Cart
  ) => void;
  /**  * Label overrides forwarded to the embedded AddToCart component.  * Keys: add, adding, addedToCart, outOfStock, noCartId, errorAdding,  *       modalTitle, quantity, continueShopping, proceedToCheckout  */ addToCartLabels?: Record<
    string,
    string
  >;

  /** Translated labels forwarded to embedded `<ProductCard>` instances. */
  productCardLabels?: Record<string, string>;

  /** Translated labels forwarded to embedded `<ClusterCard>` instances. */
  clusterCardLabels?: Record<string, string>;

  /* === Misc === */ /** Configuration object providing imageSearchFiltersGrid, imageVariantFiltersMedium, urls */ configuration?: any;
  /**  * Label overrides for the slider UI.  * Available keys: scrollLeft, scrollRight, noProducts, viewCluster,  *                 ACCESSORIES, ALTERNATIVES, RELATED, OPTIONS, PARTS  */ labels?: Record<
    string,
    string
  >;

  // ───── Extension API ─────
  // Sub-component injection — cascades through ProductGridConfig context
  // to every nested ProductCard / ClusterCard rendered in the carousel.
  priceComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').PriceComponentProps>;
  stockComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').StockComponentProps>;
  addToCartComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').AddToCartComponentProps>;
  imageComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').ImageComponentProps>;
  badgesComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').BadgesComponentProps>;
  favoriteComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').FavoriteComponentProps>;

  // Iteration-level: replace the whole ProductCard / ClusterCard in the
  // carousel. Custom card receives the same props the default would.
  productCardComponent?: React.ComponentType<import('./ProductCard').ProductCardProps>;
  clusterCardComponent?: React.ComponentType<import('./ClusterCard').ClusterCardProps>;

  // Insertion slots — render before/after each carousel slide without
  // forking ProductSlider.
  beforeItem?: (item: Product | Cluster, index: number) => React.ReactNode;
  afterItem?: (item: Product | Cluster, index: number) => React.ReactNode;
}

/**
 * Renders a horizontally scrollable carousel of product/cluster cards, sourced
 * from explicit items, product/cluster IDs, or cross-upsell lookups.
 *
 * @remarks Uses {@link useProductSlider} for fetching and scroll handling.
 */
function ProductSlider(rawProps: ProductSliderProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const trackRef = useRef<HTMLDivElement>(null);
  const [sliderId] = useState(() => 'slider-' + Math.random().toString(36).substring(2, 9));

  const {
    products: fetchedItems,
    loading: isLoading,
    canScrollLeft,
    canScrollRight,
    fetchCrossupsells,
    fetchProducts,
    scrollLeft: sliderScrollLeft,
    scrollRight: sliderScrollRight,
    onScroll: sliderOnScroll,
  } = useProductSlider({
    graphqlClient: props.graphqlClient!,
    language: props.language,
    taxZone: props.taxZone,
    // Forwarded so crossupsell results are filtered to the signed-in user's
    // assortment (and priced per user/company) — same scoping the catalog and
    // search listings use. Without these, the slider can show products the
    // user can't order or open.
    user: props.user,
    companyId: props.companyId,
    configuration: props.configuration,
  });

  // Grid config provided to the card subtree, collapsing the cascade of
  // feature/callback props ProductSlider otherwise forwards to
  // ProductCard/ClusterCard. Inline (Compiler auto-memoizes — no manual memo).
  const gridConfig: ProductGridConfig = {
    columns: 3,
    showStock: props.showStock,
    showAvailability: props.showAvailability,
    enableAddFavorite: props.enableAddFavorite,
    createCart: props.createCart,
    showModal: props.showModal,
    allowIncrDecr: props.showIncrDecr !== false,
    enableStockValidation: props.stockValidation,
    cartId: props.cartId,
    stockLabels: props.stockLabels,
    priceLabels: props.priceLabels,
    addToCartLabels: props.addToCartLabels,
    onCartCreated: props.onCartCreated,
    afterAddToCart: props.afterAddToCart,
    onProceedToCheckout: props.onProceedToCheckout,
    onRequestQuoteClick: props.onRequestQuoteClick,
    onLoginClick: props.onLoginClick,
    onToggleFavorite: (item: Product | Cluster, isFav: boolean) =>
      props.onToggleFavorite?.(item, isFav),
    onProductClick: (p: Product) => handleProductClick(p),
    onClusterClick: (c: Cluster) => handleClusterClick(c),
    // Extension API — cascade to nested cards via context.
    priceComponent: props.priceComponent,
    stockComponent: props.stockComponent,
    addToCartComponent: props.addToCartComponent,
    imageComponent: props.imageComponent,
    badgesComponent: props.badgesComponent,
    favoriteComponent: props.favoriteComponent,
    productCardComponent: props.productCardComponent,
    clusterCardComponent: props.clusterCardComponent,
  };

  // Iteration-level card swap. Resolve once per render; default to
  // the built-in cards when no override is provided.
  const ProductCardImpl = props.productCardComponent ?? ProductCard;
  const ClusterCardImpl = props.clusterCardComponent ?? ClusterCard;

  function items(): (Product | Cluster)[] {
    if (props.products && props.products.length > 0) {
      return props.products;
    }
    return fetchedItems as (Product | Cluster)[];
  }

  function isCrossUpsellMode(): boolean {
    return !!(props.crossUpsellTypes && props.crossUpsellTypes.length > 0);
  }

  function crossUpsellTitle(): string {
    if (!props.crossUpsellTypes || props.crossUpsellTypes.length === 0) return '';
    const typeLabels: Record<string, string> = {
      ACCESSORIES: 'Accessories',
      ALTERNATIVES: 'Alternatives',
      RELATED: 'Related products',
      OPTIONS: 'Options',
      PARTS: 'Parts',
    };
    return props.crossUpsellTypes
      .map((t: string) => props.labels?.[t.toLowerCase()] || typeLabels[t] || t)
      .join(' & ');
  }

  function sliderTitle(): string | undefined {
    if (props.title !== undefined) return props.title;
    if (isCrossUpsellMode()) return crossUpsellTitle();
    return undefined;
  }

  function desktopCount(): number {
    return props.itemsPerView?.desktop || 4;
  }

  function showAddToCart(): boolean {
    const allow = (props.allowAddToCart as boolean) !== false;
    // Anonymous visitors only — a signed-in user keeps add-to-cart.
    return !isContentHidden(props.portalMode as string | undefined, props.user) && allow;
  }


  function isCluster(item: any): boolean {
    return 'clusterId' in item && !('productId' in item);
  }

  function getItemId(item: any): number {
    return isCluster(item) ? item.clusterId : item.productId;
  }

  function handleScrollLeft(): void {
    if (trackRef.current) {
      const scrollAmount = trackRef.current.clientWidth * 0.8;
      trackRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  }

  function handleScrollRight(): void {
    if (trackRef.current) {
      const scrollAmount = trackRef.current.clientWidth * 0.8;
      trackRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  function handleScroll(e: any): void {
    if (trackRef.current) {
      sliderOnScroll(trackRef.current);
    }
  }

  function handleProductClick(product: Product): void {
    if (props.onProductClick) {
      props.onProductClick(product);
    }
  }

  function handleClusterClick(cluster: Cluster): void {
    if (props.onClusterClick) {
      props.onClusterClick(cluster);
    }
  }

  useEffect(() => {
    if (props.products && props.products.length > 0) return;
    if (isCrossUpsellMode()) {
      // Cluster pages pass clusterId (not productId), so guard on having
      // either source — without this, sliders mounted on a cluster page
      // silently never fire and render empty.
      if (props.productId || props.clusterId) {
        fetchCrossupsells({
          productId: props.productId,
          clusterId: props.clusterId,
          types: props.crossUpsellTypes,
        });
      }
    } else if (props.productIds && props.productIds.length > 0) {
      fetchProducts(props.productIds);
    }
  }, [
    JSON.stringify(props.productIds),
    JSON.stringify(props.clusterIds),
    JSON.stringify(props.crossUpsellTypes),
    props.productId,
    props.clusterId,
    props.language,
    props.companyId,
  ]);

  useEffect(() => {
    /* Initialize scroll dimensions once sliderId is set and items are rendered */ if (
      sliderId &&
      items().length > 0
    ) {
      setTimeout(() => {
        if (trackRef.current) {
          sliderOnScroll(trackRef.current);
        }
      }, 50);
    }
  }, [sliderId, items().length]);

  return (
    <>
      {' '}
      {!(isCrossUpsellMode() && !isLoading && items().length === 0) ? (
        <>
          <div className={cn(`propeller-product-slider ${props.containerClassName || 'mb-12'}`)} data-loading={isLoading ? 'true' : 'false'}>
            {sliderTitle() || items().length > 0 ? (
              <div className="propeller-product-slider__header flex items-center justify-between mb-6">
                {sliderTitle() ? <h2 className="propeller-product-slider__title text-2xl font-bold">{sliderTitle()}</h2> : null}
                {items().length > desktopCount() ? (
                  <div className="propeller-product-slider__nav flex gap-2">
                    <button
                      className="propeller-product-slider__nav-btn propeller-product-slider__nav-btn--prev p-2 rounded-full bg-card shadow hover:bg-surface-hover transition disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={(event) => handleScrollLeft()}
                      disabled={!canScrollLeft}
                      aria-label={getLabel(props.labels, 'scrollLeft', 'Scroll left')}
                    >
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5"
                      >
                        <path d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      className="propeller-product-slider__nav-btn propeller-product-slider__nav-btn--next p-2 rounded-full bg-card shadow hover:bg-surface-hover transition disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={(event) => handleScrollRight()}
                      disabled={!canScrollRight}
                      aria-label={getLabel(props.labels, 'scrollRight', 'Scroll right')}
                    >
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-5 h-5"
                      >
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {isLoading ? (
              <div className="propeller-product-slider__skeleton flex gap-6 overflow-hidden">
                <div className="propeller-product-slider__skeleton-card flex-shrink-0 w-72 h-80 bg-surface-hover rounded-container animate-pulse" />
                <div className="propeller-product-slider__skeleton-card flex-shrink-0 w-72 h-80 bg-surface-hover rounded-container animate-pulse" />
                <div className="propeller-product-slider__skeleton-card flex-shrink-0 w-72 h-80 bg-surface-hover rounded-container animate-pulse" />
                <div className="propeller-product-slider__skeleton-card flex-shrink-0 w-72 h-80 bg-surface-hover rounded-container animate-pulse" />
              </div>
            ) : null}
            {!isLoading && items().length > 0 ? (
              <div
                ref={trackRef}
                className="propeller-product-slider__track flex gap-6 overflow-x-auto scroll-smooth pb-4"
                data-slider-id={sliderId}
                onScroll={(e) => handleScroll(e)}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <ProductGridConfigProvider value={gridConfig}>
                {items()?.map((item, index) => (
                  <div
                    className="propeller-product-slider__slide flex-shrink-0 w-[calc((100%_-_1.5rem)_/_1.5)] md:w-[calc((100%_-_3rem)_/_2.5)] lg:w-[calc((100%_-_4.5rem)_/_4)]"
                    key={getItemId(item) + '-' + index}
                  >
                    {props.beforeItem?.(item, index)}
                    {isCluster(item) ? (
                      <ClusterCardImpl
                        cluster={item as Cluster}
                        labels={props.clusterCardLabels}
                        stockLabels={props.stockLabels}
                      />
                    ) : (
                      <ProductCardImpl
                        product={item as Product}
                        allowAddToCart={showAddToCart()}
                        labels={props.productCardLabels}
                        stockLabels={props.stockLabels}
                        priceLabels={props.priceLabels}
                        addToCartLabels={props.addToCartLabels}
                      />
                    )}
                    {props.afterItem?.(item, index)}
                  </div>
                ))}
                </ProductGridConfigProvider>
              </div>
            ) : null}
            {!isLoading && items().length === 0 && !props.products && !isCrossUpsellMode() ? (
              <div className="propeller-product-slider__empty text-center text-muted-foreground py-8">
                {getLabel(props.labels, 'noProducts', 'No products found')}
              </div>
            ) : null}
          </div>
        </>
      ) : null}{' '}
    </>
  );
}
export default ProductSlider;
