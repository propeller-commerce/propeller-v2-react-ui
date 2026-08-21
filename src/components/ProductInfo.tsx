'use client';
/**
 * @rsc-blocked — Client-only component: side effects (useEffect).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useEffect } from 'react';
import {
  GraphQLClient,
  Product,
  ProductService,
  LocalizedString,
  Contact,
  Customer,
  OrderlistService,
  Orderlist,
} from '@propeller-commerce/propeller-sdk-v2';
import { useProductInfo } from '../composables/react/useProductInfo';
import { useInfraProps } from '../composables/react/useInfraProps';
import { isContentHidden } from '@propeller-commerce/propeller-v2-core-ui';
import LoginToOrderButton from './LoginToOrderButton';
import DefaultProductPriceImpl from './ProductPrice';
import DefaultItemStockImpl from './ItemStock';
import DefaultAddToCartImpl from './AddToCart';
import DefaultAddToFavoriteImpl from './AddToFavorite';
import DefaultProductBundlesImpl from './ProductBundles';
import DefaultProductBulkPricesImpl from './ProductBulkPrices';
import { DefaultProductImage as DefaultProductImageImpl } from './defaults/DefaultProductImage';
import { DefaultProductBadges as DefaultProductBadgesImpl } from './defaults/DefaultProductBadges';
import { DefaultProductSurcharges as DefaultProductSurchargesImpl } from './defaults/DefaultProductSurcharges';
import { ProductGridConfigProvider, type ProductGridConfig } from '../context/ProductGridContext';
import { cn } from '../composables/shared/utils/cn';

export interface ProductInfoProps {
  // ── Data source ──────────────────────────────────────────────────────────
  /** The authenticated user (Contact or Customer). Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer | null;

  /** Active company ID from the company switcher.
   * Overrides default company for price calculation.
   * Triggers a re-fetch when changed. */
  companyId?: number;

  /**
   * Scope the product fetch to specific orderlist IDs (e.g. a chosen B2B
   * contract). Overrides the default resolution of all the company's orderlists.
   */
  orderlistIds?: number[];

  /**
   * Apply the orderlist filter. Defaults to `true`; set `false` to browse
   * unscoped (full catalogue) for an authenticated user without a contract.
   */
  applyOrderlists?: boolean;

  /**
   * Pre-fetched product object to display.
   * When provided the component skips internal fetching.
   */
  product?: Product;

  /**
   * Product ID to fetch data for when no `product` prop is provided.
   * Requires `graphqlClient` to be set.
   */
  productId?: number;

  /**
   * Initialised Propeller SDK GraphQL client.
   * Required when `productId` is provided for internal data fetching.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Image search filter passed to ProductService.getProduct().
   * Controls how many image items are returned.
   * Example: { page: 1, offset: 20 }
   */
  imageSearchFilters?: any;

  /**
   * Image variant transformation filter passed to ProductService.getProduct().
   * Controls image size/format variants returned with the product.
   * Example: imageVariantFiltersLarge from @/data/defaults
   * Defaults to { transformations: [] } when omitted.
   */
  imageVariantFilters?: any;

  /**
   * Tax zone to use for price calculation.
   */
  taxZone?: string;

  /**
   * Called once the product data is loaded — either immediately (when
   * `product` prop is supplied) or after the internal fetch completes.
   * Use this to hydrate sibling components (gallery, price, descriptions, etc.).
   */
  onProductLoaded?: (product: Product) => void;

  // ── Display toggles ───────────────────────────────────────────────────────

  /** Show the product name. Defaults to true. */
  showTitle?: boolean;

  /** Show the product SKU. Defaults to true. */
  showSku?: boolean;

  // ── Locale ────────────────────────────────────────────────────────────────

  /** Language code used to resolve localised names. Defaults to 'NL'. */
  language?: string;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /**
   * Config object providing imageSearchFiltersGrid and imageVariantFiltersSmall.
   */
  configuration?: any;

  /**
   * Attribute codes/names to look up and display as badge overlays on the product image.
   * Each code is resolved against `product.attributes.items[].attributeDescription.code`
   * (or `.name`). Attributes with no matching value are silently omitted.
   * Example: ['new', 'sale']
   */
  imageLabels?: string[];

  /**
   * Attribute codes/names to look up and display as extra text rows below the product name.
   * Resolved the same way as `imageLabels`.
   * Example: ['brand', 'color']
   */
  textLabels?: string[];

  // ───── Extension API ─────
  // New PDP shell. Passing ANY new `show*` prop or any injection component
  // opts INTO the new shell layout. When none is passed, ProductInfo
  // preserves the legacy minimal title+SKU block (backward compat).
  showImage?: boolean;
  showBadges?: boolean;
  showFavorite?: boolean;
  showPrice?: boolean;
  showStock?: boolean;
  showAddToCart?: boolean;
  showBundles?: boolean;
  showBulkPrices?: boolean;
  showSurcharges?: boolean;

  imageComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').ImageComponentProps>;
  badgesComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').BadgesComponentProps>;
  favoriteComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').FavoriteComponentProps>;
  priceComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').PriceComponentProps>;
  stockComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').StockComponentProps>;
  addToCartComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').AddToCartComponentProps>;
  bundlesComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').ProductBundlesComponentProps>;
  bulkPricesComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').ProductBulkPricesComponentProps>;
  surchargesComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').ProductSurchargesComponentProps>;

  /**
   * Tax zone to use for ProductBundles pricing (required by ProductBundles).
   * Defaults to the `taxZone` prop or 'NL' when omitted.
   */
  bundlesTaxZone?: string;

  /** Optional localized label overrides forwarded to every section. */
  labels?: Record<string, string>;

  /** Tax-inclusive vs. tax-exclusive price toggle for price / bulk-prices / surcharges. */
  includeTax?: boolean;

  /** Currency symbol used by the price section. */
  currency?: string;

  /**
   * Portal visibility mode. In `'semi-closed'` the price, stock row and
   * add-to-cart are withheld from anonymous visitors, who get a log-in action
   * in place of add-to-cart instead.
   */
  portalMode?: string;

  /**
   * Invoked when an anonymous visitor clicks the log-in action that replaces
   * add-to-cart in a semi-closed portal. The host owns navigation.
   */
  onLoginClick?: () => void;

  beforeContent?: (product: Product) => React.ReactNode;
  afterContent?: (product: Product) => React.ReactNode;

  /** Compound mode opt-in. When provided, ProductInfo renders the compound
   *  subtree (using <ProductInfo.X> subcomponents) and also triggers the
   *  new-shell layout. Subcomponents read shared product data from context. */
  children?: React.ReactNode;
}

// ── Compound context ────────────────────────────────────────────────────────
// Shared product data exposed to <ProductInfo.X> subcomponents. Named
// useProductInfoContext (not useProductInfo) to avoid clashing with the
// existing useProductInfo composable already imported from
// '../composables/react/useProductInfo'.

interface ProductInfoContextValue {
  product: Product;
  resolved: ProductInfoProps;
  derived: {
    name: string;
    sku: string;
    language: string | undefined;
    useTax: boolean;
    currency: string | undefined;
    taxZone: string;
    bundlesTaxZone: string;
    portalMode: string | undefined;
    labels: Record<string, string> | undefined;
    user: Contact | Customer | null;
  };
}

const ProductInfoContext = React.createContext<ProductInfoContextValue | null>(null);

function useProductInfoContext(): ProductInfoContextValue {
  const ctx = React.useContext(ProductInfoContext);
  if (!ctx) {
    throw new Error(
      'ProductInfo compound subcomponents must be rendered inside <ProductInfo>.',
    );
  }
  return ctx;
}

/**
 * Renders a product's heading block (name and SKU), fetching the product by ID
 * when no pre-fetched `product` is supplied.
 *
 * @remarks Uses {@link useProductInfo} to fetch product data.
 */
function ProductInfo(rawProps: ProductInfoProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const { product: fetchedProduct, loading, fetchProduct } = useProductInfo({
    graphqlClient: props.graphqlClient ?? ({} as GraphQLClient),
    language: props.language,
    configuration: props.configuration,
    user: props.user,
    companyId: props.companyId,
    orderlistIds: props.orderlistIds,
    applyOrderlists: props.applyOrderlists,
  });

  const activeProduct: Product | null = props.product || fetchedProduct;

  function getProductName(): string {
    if (!activeProduct) return '';
    const lang = props.language || 'NL';
    const match = activeProduct.names?.find((n: LocalizedString) => n.language === lang);
    return match?.value || activeProduct.names?.[0]?.value || '';
  }

  function getProductSku(): string {
    return activeProduct?.sku || '';
  }

  useEffect(() => {
    if (props.product) {
      if (props.onProductLoaded) {
        props.onProductLoaded(props.product);
      }
      return;
    }
    if (!props.productId || !props.graphqlClient) return;
    fetchProduct(props.productId, props.imageSearchFilters, props.imageVariantFilters);
  }, [props.productId, props.product, props.language, props.user, props.companyId]);

  useEffect(() => {
    if (fetchedProduct && props.onProductLoaded) {
      props.onProductLoaded(fetchedProduct);
    }
  }, [fetchedProduct]);

  // ───── Backward-compat heuristic ─────
  // Opt INTO the new composable PDP shell only when the caller passes any of
  // the new show*/component/before/afterContent props. With none passed,
  // ProductInfo keeps emitting the legacy minimal title+SKU block below.
  const NEW_SHELL_KEYS: ReadonlyArray<keyof ProductInfoProps> = [
    'showImage', 'showBadges', 'showFavorite', 'showPrice', 'showStock',
    'showAddToCart', 'showBundles', 'showBulkPrices', 'showSurcharges',
    'imageComponent', 'badgesComponent', 'favoriteComponent', 'priceComponent',
    'stockComponent', 'addToCartComponent', 'bundlesComponent',
    'bulkPricesComponent', 'surchargesComponent',
    'beforeContent', 'afterContent',
  ] as const;

  const useNewShell =
    rawProps.children !== undefined ||
    NEW_SHELL_KEYS.some(
      (k) => (rawProps as Record<string, unknown>)[k] !== undefined,
    );

  if (useNewShell && activeProduct) {
    const product = activeProduct;

    // Task 19: cascade slot overrides into nested components (e.g. a related-
    // products ProductSlider inside before/afterContent) via the grid-config
    // context. PDP isn't really a "grid" — columns:1 is the conventional
    // pass-through value when a single product hosts the provider.
    const pdpConfig: ProductGridConfig = {
      columns: 1,
      priceComponent: props.priceComponent,
      stockComponent: props.stockComponent,
      addToCartComponent: props.addToCartComponent,
      imageComponent: props.imageComponent,
      badgesComponent: props.badgesComponent,
      favoriteComponent: props.favoriteComponent,
    };

    const includeTax = !!(props as { includeTax?: boolean }).includeTax;
    const taxZone = (props.taxZone as string | undefined) ?? 'NL';
    const bundlesTaxZone = props.bundlesTaxZone ?? taxZone;
    const currency = (props as { currency?: string }).currency;
    const portalMode = (props as { portalMode?: string }).portalMode;
    const labels = props.labels;
    const language = props.language;
    const user = (props as { user?: Contact | Customer | null }).user ?? null;

    const contextValue: ProductInfoContextValue = {
      product,
      resolved: props,
      derived: {
        name: getProductName(),
        sku: getProductSku(),
        language,
        useTax: includeTax,
        currency,
        taxZone,
        bundlesTaxZone,
        portalMode,
        labels,
        user,
      },
    };

    // Compound mode: consumer supplied children. Render them inside the
    // standard PDP wrapper so the consumer fully controls section order and
    // composition; the shared product data is read via useProductInfoContext().
    if (rawProps.children !== undefined) {
      return (
        <ProductInfoContext.Provider value={contextValue}>
          <ProductGridConfigProvider value={pdpConfig}>
            <div className={cn(`propeller-product-info ${(props.className as string) || ''}`)}>
              {props.beforeContent ? props.beforeContent(product) : null}
              {rawProps.children}
              {props.afterContent ? props.afterContent(product) : null}
            </div>
          </ProductGridConfigProvider>
        </ProductInfoContext.Provider>
      );
    }

    // Default new-shell layout. Uses the compound subcomponents internally so
    // there's a single rendering path; each subcomponent honors its own
    // show*/*Component resolution and returns null when its branch doesn't
    // apply.
    return (
      <ProductInfoContext.Provider value={contextValue}>
        <ProductGridConfigProvider value={pdpConfig}>
          <div className={cn(`propeller-product-info ${(props.className as string) || ''}`)}>
            {props.beforeContent ? props.beforeContent(product) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="propeller-product-info__media relative">
                {props.showImage !== false ? <ProductInfoImage /> : null}
                {props.showBadges !== false ? <ProductInfoBadges /> : null}
              </div>
              <div className="propeller-product-info__content space-y-4">
                {props.showTitle !== false ? <ProductInfoTitle /> : null}
                {props.showSku !== false ? <ProductInfoSku /> : null}
                {props.showFavorite !== false ? <ProductInfoFavorite /> : null}
                {props.showPrice !== false ? <ProductInfoPrice /> : null}
                {props.showStock !== false ? <ProductInfoStock /> : null}
                {props.showAddToCart !== false ? <ProductInfoAddToCart /> : null}
                {props.showBundles !== false ? <ProductInfoBundles /> : null}
                {props.showBulkPrices !== false ? <ProductInfoBulkPrices /> : null}
                {props.showSurcharges !== false ? <ProductInfoSurcharges /> : null}
              </div>
            </div>
            {props.afterContent ? props.afterContent(product) : null}
          </div>
        </ProductGridConfigProvider>
      </ProductInfoContext.Provider>
    );
  }

  return (
    <div className={cn(`propeller-product-info ${(props.className as string) || ''}`)} data-loading={loading ? 'true' : 'false'}>
      {loading && !props.product ? (
        <div className="propeller-product-info__skeleton animate-pulse space-y-3">
          <div className="propeller-product-info__skeleton-line h-4 bg-surface-hover rounded w-1/4" />
          <div className="propeller-product-info__skeleton-line h-8 bg-surface-hover rounded w-3/4" />
        </div>
      ) : null}
      {!loading || !!props.product ? (
        <>
          {props.showSku !== false && !!getProductSku() ? (
            <div className="text-sm font-mono text-muted-foreground mb-2">
              SKU: {getProductSku()}
            </div>
          ) : null}
          {props.showTitle !== false && !!getProductName() ? (
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
              {getProductName()}
            </h1>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

// ── Compound subcomponents ──────────────────────────────────────────────────
// Each subcomponent reads the shared product data via useProductInfoContext()
// and either delegates to its injected *Component slot or renders the default
// markup verbatim from the legacy new-shell layout. Section-level gating
// (e.g. BulkPrices only when product.bulkPrices is present) is preserved.

/** Product image area. When `imageComponent` is injected, the consumer takes
 *  over the entire image render. */
function ProductInfoImage(props: { className?: string } = {}) {
  const { product, resolved, derived } = useProductInfoContext();
  const Injected = resolved.imageComponent;
  if (Injected) {
    return (
      <Injected
        product={product}
        language={derived.language}
        imageSearchFilters={resolved.imageSearchFilters}
        imageVariantFilters={resolved.imageVariantFilters}
        className={props.className}
      />
    );
  }
  return (
    <DefaultProductImageImpl
      product={product}
      language={derived.language ?? 'NL'}
      imageSearchFilters={resolved.imageSearchFilters}
      imageVariantFilters={resolved.imageVariantFilters}
      className={props.className}
    />
  );
}

/** Image-overlay badges (e.g. "new", "sale" attributes). */
function ProductInfoBadges(props: { className?: string } = {}) {
  const { product, resolved, derived } = useProductInfoContext();
  const Injected = resolved.badgesComponent;
  if (Injected) {
    return <Injected product={product} labels={derived.labels} className={props.className} />;
  }
  return <DefaultProductBadgesImpl product={product} labels={derived.labels} className={props.className} />;
}

/** Product title (h1). Returns null when no name resolves. */
function ProductInfoTitle(props: { className?: string } = {}) {
  const { derived } = useProductInfoContext();
  if (!derived.name) return null;
  return (
    <h1 className={props.className ?? 'text-2xl font-bold tracking-tight text-foreground'}>
      {derived.name}
    </h1>
  );
}

/** Product SKU row. Returns null when no SKU resolves. */
function ProductInfoSku(props: { className?: string } = {}) {
  const { derived } = useProductInfoContext();
  if (!derived.sku) return null;
  return (
    <div className={props.className ?? 'text-sm font-mono text-muted-foreground'}>
      SKU: {derived.sku}
    </div>
  );
}

/** Add-to-favorites control. When `favoriteComponent` is injected, the
 *  consumer takes over the entire favorite render. */
function ProductInfoFavorite(props: { className?: string } = {}) {
  const { product, resolved, derived } = useProductInfoContext();
  const Injected = resolved.favoriteComponent;
  if (Injected) {
    return <Injected product={product} user={derived.user} labels={derived.labels} className={props.className} />;
  }
  return (
    <DefaultAddToFavoriteImpl
      graphqlClient={resolved.graphqlClient}
      user={derived.user}
      productId={product.productId}
      labels={derived.labels}
      className={props.className}
    />
  );
}

/** Product price display. Returns null when `product.price` is missing. */
function ProductInfoPrice(props: { className?: string } = {}) {
  const { product, resolved, derived } = useProductInfoContext();
  if (!product.price) return null;
  const Injected = resolved.priceComponent;
  if (Injected) {
    return (
      <Injected
        price={product.price}
        includeTax={derived.useTax}
        currency={derived.currency}
        taxZone={derived.taxZone}
        labels={derived.labels}
        className={props.className}
      />
    );
  }
  return (
    <DefaultProductPriceImpl
      price={product.price}
      includeTax={derived.useTax}
      currency={derived.currency}
      taxZone={derived.taxZone}
      portalMode={derived.portalMode}
      user={derived.user}
      labels={derived.labels}
      className={props.className}
    />
  );
}

/** Inventory/stock row. Returns null when `product.inventory` is missing. */
function ProductInfoStock(props: { className?: string } = {}) {
  const { product, resolved, derived } = useProductInfoContext();
  if (!product.inventory) return null;
  if (isContentHidden(derived.portalMode, resolved.user)) return null;
  const Injected = resolved.stockComponent;
  if (Injected) {
    return (
      <Injected
        inventory={product.inventory}
        showStock
        showAvailability
        labels={derived.labels}
        className={props.className}
      />
    );
  }
  return (
    <DefaultItemStockImpl
      inventory={product.inventory}
      showStock
      showAvailability
      labels={derived.labels}
      className={props.className}
    />
  );
}

/** Add-to-cart control. */
function ProductInfoAddToCart(props: { className?: string } = {}) {
  const { product, resolved, derived } = useProductInfoContext();
  // Checked before the injected component so a host-supplied control is gated too.
  if (isContentHidden(derived.portalMode, resolved.user)) {
    return (
      <LoginToOrderButton
        className={props.className}
        labels={derived.labels}
        onLoginClick={resolved.onLoginClick}
      />
    );
  }
  const Injected = resolved.addToCartComponent;
  if (Injected) {
    return <Injected product={product} labels={derived.labels} className={props.className} />;
  }
  return (
    <DefaultAddToCartImpl
      graphqlClient={resolved.graphqlClient}
      user={derived.user}
      currency={derived.currency}
      product={product}
      configuration={resolved.configuration}
      companyId={(resolved as { companyId?: number }).companyId}
      includeTax={derived.useTax}
      language={derived.language ?? 'NL'}
      labels={derived.labels}
      className={props.className}
    />
  );
}

/** Bundles section. */
function ProductInfoBundles(props: { className?: string } = {}) {
  const { product, resolved, derived } = useProductInfoContext();
  const Injected = resolved.bundlesComponent;
  if (Injected) {
    return <Injected product={product} labels={derived.labels} className={props.className} />;
  }
  return (
    <DefaultProductBundlesImpl
      graphqlClient={resolved.graphqlClient}
      productId={product.productId}
      taxZone={derived.bundlesTaxZone}
      includeTax={derived.useTax}
      portalMode={derived.portalMode}
      user={derived.user}
      companyId={(resolved as { companyId?: number }).companyId}
      language={derived.language ?? 'NL'}
      configuration={resolved.configuration}
      labels={derived.labels}
      className={props.className}
    />
  );
}

/** Bulk-price table. Returns null when `product.bulkPrices` is missing. */
function ProductInfoBulkPrices(props: { className?: string } = {}) {
  const { product, resolved, derived } = useProductInfoContext();
  if (!product.bulkPrices) return null;
  const Injected = resolved.bulkPricesComponent;
  if (Injected) {
    return (
      <Injected
        product={product}
        includeTax={derived.useTax}
        labels={derived.labels}
        className={props.className}
      />
    );
  }
  return (
    <DefaultProductBulkPricesImpl
      bulkPrices={product.bulkPrices}
      includeTax={derived.useTax}
      portalMode={derived.portalMode}
      user={derived.user}
      taxZone={derived.taxZone}
      currency={derived.currency}
      labels={derived.labels}
      className={props.className}
    />
  );
}

/** Surcharges section. */
function ProductInfoSurcharges(props: { className?: string } = {}) {
  const { product, resolved, derived } = useProductInfoContext();
  const Injected = resolved.surchargesComponent;
  if (Injected) {
    return (
      <Injected
        product={product}
        includeTax={derived.useTax}
        labels={derived.labels}
        className={props.className}
      />
    );
  }
  return (
    <DefaultProductSurchargesImpl
      product={product}
      includeTax={derived.useTax}
      labels={derived.labels}
      className={props.className}
    />
  );
}

// ── Static attachments (compound API surface) ───────────────────────────────

type ProductInfoComponent = typeof ProductInfo & {
  Image: typeof ProductInfoImage;
  Badges: typeof ProductInfoBadges;
  Favorite: typeof ProductInfoFavorite;
  Title: typeof ProductInfoTitle;
  Sku: typeof ProductInfoSku;
  Price: typeof ProductInfoPrice;
  Stock: typeof ProductInfoStock;
  AddToCart: typeof ProductInfoAddToCart;
  Bundles: typeof ProductInfoBundles;
  BulkPrices: typeof ProductInfoBulkPrices;
  Surcharges: typeof ProductInfoSurcharges;
};

const ProductInfoExport = ProductInfo as ProductInfoComponent;
ProductInfoExport.Image = ProductInfoImage;
ProductInfoExport.Badges = ProductInfoBadges;
ProductInfoExport.Favorite = ProductInfoFavorite;
ProductInfoExport.Title = ProductInfoTitle;
ProductInfoExport.Sku = ProductInfoSku;
ProductInfoExport.Price = ProductInfoPrice;
ProductInfoExport.Stock = ProductInfoStock;
ProductInfoExport.AddToCart = ProductInfoAddToCart;
ProductInfoExport.Bundles = ProductInfoBundles;
ProductInfoExport.BulkPrices = ProductInfoBulkPrices;
ProductInfoExport.Surcharges = ProductInfoSurcharges;

export default ProductInfoExport;
