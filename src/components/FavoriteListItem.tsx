'use client';
/**
 * @rsc-blocked — Client-only component: browser-only APIs (window/document/storage).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';
import {
  Product,
  Cluster,
  GraphQLClient,
  Contact,
  Customer,
  Cart,
  CartMainItem,
  CartChildItemInput,
  ProductPrice,
  ProductInventory,
} from '@propeller-commerce/propeller-sdk-v2';
import AddToCart from './AddToCart';
import ItemStock from './ItemStock';
import { getLabel, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import { getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import { useInfraProps } from '../composables/react/useInfraProps';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface FavoriteListItemProps {
  /** Product or Cluster to be listed as a favorite list item */
  item: Product | Cluster;

  /** Should the item title be a link to the PDP (default: true) */
  titleLinkable?: boolean;

  /** Should the stock be displayed in the favorite list item (default: false) */
  showStockComponent?: boolean;

  /** Show availability status (e.g. "In stock") inside ItemStock (default: true) */
  showAvailability?: boolean;

  /** Show numeric stock quantity inside ItemStock (default: true) */
  showStock?: boolean;

  /** Display the SKU of the item beneath the item name (default: true) */
  showSku?: boolean;

  /** Enables the add to cart functionality for products. Clusters show a "View cluster" button instead (default: true) */
  allowAddToCart?: boolean;

  /** Display a delete button that removes the favorite list item from the list (default: true) */
  showDelete?: boolean;

  /** Action callback fired when a favorite list item is deleted from the list */
  onDelete?: (itemId: string) => void;

  /** Callback when the item title or image is clicked. Prevents default <a> navigation when provided */
  onItemClick?: (item: Product | Cluster) => void;

  /** Extra CSS class applied to the root element */
  className?: string;

  /** Configuration object for URL generation */
  configuration?: any;

  /** UI string overrides */
  labels?: Record<string, string>;

  /** Include tax in the price display. When provided, overrides the internal PriceToggle state */
  includeTax?: boolean;

  /** Currency symbol for prices. Resolved from PropellerProvider when omitted; defaults to '€'. */
  currency?: string;

  // === AddToCart pass-through props (only used for products) ===

  /** Initialised Propeller SDK GraphQL client (required by embedded AddToCart) */
  graphqlClient?: GraphQLClient;

  /** Authenticated user — used for cart creation / lookup */
  user?: Contact | Customer | null;

  /** ID of an existing cart to add items to */
  cartId?: string;

  /** When true and no cartId is available, AddToCart automatically creates a cart */
  createCart?: boolean;

  /** Called after a new cart is created internally by AddToCart */
  onCartCreated?: (cart: Cart) => void;

  /** Fully replaces the internal CartService.addItemToCart call */
  onAddToCart?: (
    product: Product,
    clusterId?: number,
    quantity?: number,
    childItems?: CartChildItemInput[],
    notes?: string,
    price?: number,
    showModal?: boolean
  ) => Cart;

  /** Called after every successful add-to-cart */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;

  /** Show modal after successful add (default: false) */
  showModal?: boolean;

  /** Renders increment/decrement buttons beside quantity input (default: true) */
  allowIncrDecr?: boolean;

  /** Validate stock before adding to cart (default: false) */
  enableStockValidation?: boolean;

  /** Language code forwarded to CartService (default: 'NL') */
  language?: string;

  /** Called when "Proceed to checkout" is clicked in AddToCart modal */
  onProceedToCheckout?: () => void;

  /** Called when "Request a Quote" is clicked in AddToCart modal */
  onRequestQuoteClick?: (cart: Cart) => void;

  /** Label overrides for AddToCart UI strings */
  addToCartLabels?: Record<string, string>;

  /** Label overrides for ItemStock UI strings */
  stockLabels?: Record<string, string>;

  /** Compound mode opt-in. */
  children?: React.ReactNode;
}

// ── Context (shared by compound subcomponents) ──────────────────────────────

/**
 * Internal context populated by the root `<FavoriteListItem>`. Subcomponents
 * read `useFavoriteListItemContext()` to get the item + resolved props +
 * derived display values (name, sku, imageUrl, productUrl, formatted price)
 * computed once. Not exported — consumers compose subcomponents under
 * `<FavoriteListItem>` rather than reading the context directly.
 */
interface FavoriteListItemContextValue {
  item: Product | Cluster;
  /** Fully resolved props (infra + explicit) — read instead of `props`. */
  resolved: FavoriteListItemProps;
  /** Derived display values, computed once at the root and read by leaves. */
  derived: {
    isProduct: boolean;
    name: string;
    sku: string;
    imageUrl: string;
    productUrl: string;
    itemId: string;
    formattedPrice: string;
    priceObj: ProductPrice | undefined;
    inventory: ProductInventory | undefined;
    useTax: boolean;
    language: string;
    currency: string;
  };
  /** Click handler shared by Image + Name. */
  handleItemClick: (e: React.MouseEvent) => void;
  /** Delete handler used by Actions. */
  handleDelete: () => void;
}

const FavoriteListItemContext = React.createContext<FavoriteListItemContextValue | null>(null);

/**
 * Internal hook used by compound subcomponents. Throws if called outside
 * `<FavoriteListItem>` — the error is intentional, that's a developer mistake.
 */
function useFavoriteListItemContext(): FavoriteListItemContextValue {
  const ctx = React.useContext(FavoriteListItemContext);
  if (!ctx) {
    throw new Error(
      'FavoriteListItem compound subcomponents must be rendered inside <FavoriteListItem>.',
    );
  }
  return ctx;
}

/**
 * Single row within a favorite list: shows a product or cluster with image,
 * SKU, price and stock, plus an embedded {@link AddToCart} (products) or
 * "View cluster" link, and an optional delete button.
 */
function FavoriteListItem(rawProps: FavoriteListItemProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const isProduct = 'productId' in props.item;
  const product = props.item as Product;
  const cluster = props.item as Cluster;
  // `names[0]` is the catalog default language, not the storefront's.
  const nameLanguage = props.language as string | undefined;
  const name = isProduct
    ? getLocalizedValue(product?.names, nameLanguage, 'Product')
    : getLocalizedValue(cluster?.names, nameLanguage, '') ||
      getLocalizedValue(cluster?.defaultProduct?.names, nameLanguage, 'Cluster');
  const sku = isProduct
    ? product?.sku || ''
    : cluster?.sku || cluster?.defaultProduct?.sku || '';
  const imageUrl = isProduct
    ? product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || ''
    : cluster?.defaultProduct?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '';
  const itemUrl = isProduct
    ? props.configuration?.urls?.getProductUrl?.(props.item) || ''
    : props.configuration?.urls?.getClusterUrl?.(props.item) || '';
  const itemId = isProduct
    ? String(product?.productId || '')
    : String(cluster?.clusterId || '');
  const priceObj = isProduct ? product?.price : cluster?.defaultProduct?.price;
  const inventory = isProduct ? product?.inventory : cluster?.defaultProduct?.inventory;
  const useTax = !!props.includeTax;
  const currency = props.currency ?? '€';
  const itemPrice = (() => {
    if (!priceObj) return '';
    const value = useTax ? priceObj.net : priceObj.gross;
    if (!value && value !== 0) return '';
    return formatPrice(value, { symbol: currency, locale: localeForLanguage(props.language) });
  })();
  function handleItemClick(e: React.MouseEvent): void {
    if (props.onItemClick) {
      e.preventDefault();
      props.onItemClick(props.item);
    } else if (itemUrl) {
      e.preventDefault();
      window.location.href = itemUrl;
    }
  }
  function handleDelete(): void {
    if (props.onDelete) props.onDelete(itemId);
  }

  const contextValue: FavoriteListItemContextValue = {
    item: props.item,
    resolved: props,
    derived: {
      isProduct,
      name,
      sku,
      imageUrl,
      productUrl: itemUrl,
      itemId,
      formattedPrice: itemPrice,
      priceObj,
      inventory,
      useTax,
      language: props.language ?? 'NL',
      currency,
    },
    handleItemClick,
    handleDelete,
  };

  // Compound mode: consumer supplied children. Render them inside the default
  // root shell so styling stays identical; consumer controls order/contents.
  if (rawProps.children !== undefined) {
    return (
      <FavoriteListItemContext.Provider value={contextValue}>
        <div
          onClick={(e) => handleItemClick(e)}
          data-type={isProduct ? 'product' : 'cluster'}
          className={cn(`propeller-favorite-list-item flex flex-row items-center gap-4 rounded-container border border-border bg-card p-4 transition-colors hover:border-secondary/20 hover:shadow-sm cursor-pointer ${props.className || ''}`)}
        >
          {rawProps.children}
        </div>
      </FavoriteListItemContext.Provider>
    );
  }

  // Default / monolithic mode: render the canonical layout using the
  // compound subcomponents internally so there's a single rendering path.
  return (
    <FavoriteListItemContext.Provider value={contextValue}>
      <div
        onClick={(e) => handleItemClick(e)}
        data-type={isProduct ? 'product' : 'cluster'}
        className={cn(`propeller-favorite-list-item flex flex-row items-center gap-4 rounded-container border border-border bg-card p-4 transition-colors hover:border-secondary/20 hover:shadow-sm cursor-pointer ${props.className || ''}`)}
      >
        <FavoriteListItemImage />
        <div className="propeller-favorite-list-item__body flex flex-col gap-0.5 min-w-0 flex-1">
          <FavoriteListItemSku />
          <FavoriteListItemName />
        </div>
        <FavoriteListItemStock />
        <FavoriteListItemPrice />
        <FavoriteListItemActions />
      </div>
    </FavoriteListItemContext.Provider>
  );
}

// ── Compound subcomponents ──────────────────────────────────────────────────

/**
 * Item image (or placeholder). Linkable when `titleLinkable !== false`.
 */
function FavoriteListItemImage(props: { className?: string }) {
  const { derived, handleItemClick, resolved } = useFavoriteListItemContext();
  const { imageUrl, name, productUrl } = derived;
  const linkable = resolved.titleLinkable !== false;
  const wrapperClass =
    props.className ??
    'propeller-favorite-list-item__media relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-control bg-surface-hover p-1';
  const inner = (
    <>
      {!!imageUrl ? (
        <img
          className="propeller-favorite-list-item__image h-full w-full object-contain"
          src={imageUrl}
          alt={name}
        />
      ) : null}
      {!imageUrl ? (
        <div className="propeller-favorite-list-item__image-placeholder flex h-full w-full items-center justify-center text-foreground-subtle">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-8 w-8">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              strokeWidth={1}
            />
          </svg>
        </div>
      ) : null}
    </>
  );
  if (linkable) {
    return (
      <div className={wrapperClass}>
        <a
          className="block h-full w-full"
          href={productUrl}
          onClick={(e) => handleItemClick(e)}
        >
          {inner}
        </a>
      </div>
    );
  }
  return (
    <div className={wrapperClass}>
      <div className="block h-full w-full">{inner}</div>
    </div>
  );
}

/**
 * Item SKU. Hidden when `showSku === false` or when the item has no SKU.
 */
function FavoriteListItemSku(props: { className?: string }) {
  const { derived, resolved } = useFavoriteListItemContext();
  if (resolved.showSku === false || !derived.sku) return null;
  return (
    <span
      className={
        props.className ??
        'propeller-favorite-list-item__sku font-mono text-xs text-foreground-subtle'
      }
    >
      {derived.sku}
    </span>
  );
}

/**
 * Item title. Linkable by default; pass `linkable={false}` to render as plain
 * text, or rely on the root `titleLinkable` prop.
 */
function FavoriteListItemName(props: { className?: string; linkable?: boolean }) {
  const { derived, handleItemClick, resolved } = useFavoriteListItemContext();
  const linkable = props.linkable ?? (resolved.titleLinkable !== false);
  if (linkable) {
    return (
      <a
        className={
          props.className ??
          'propeller-favorite-list-item__title text-sm font-medium leading-tight text-foreground transition-colors hover:text-secondary line-clamp-1'
        }
        href={derived.productUrl}
        onClick={(e) => handleItemClick(e)}
      >
        {derived.name}
      </a>
    );
  }
  return (
    <span
      className={
        props.className ??
        'propeller-favorite-list-item__title text-sm font-medium leading-tight text-foreground line-clamp-1'
      }
    >
      {derived.name}
    </span>
  );
}

/**
 * Stock display. Renders {@link ItemStock} for products and an inline
 * availability badge for clusters. Hidden when `showStockComponent !== true`
 * or when there's no inventory to show.
 */
function FavoriteListItemStock(props: { className?: string }) {
  const { derived, resolved, item } = useFavoriteListItemContext();
  const { isProduct, inventory } = derived;
  if (!resolved.showStockComponent) return null;
  if (isProduct) {
    if (!inventory) return null;
    return (
      <div className={props.className ?? 'flex-shrink-0'}>
        <ItemStock
          inventory={inventory}
          showAvailability={resolved.showAvailability !== false}
          showStock={resolved.showStock !== false}
          labels={resolved.stockLabels}
        />
      </div>
    );
  }
  // Cluster stock badge
  const cluster = item as Cluster;
  const totalQty = cluster?.defaultProduct?.inventory?.totalQuantity;
  if (totalQty === undefined) return null;
  return (
    <div
      className={
        props.className ?? 'propeller-favorite-list-item__stock flex-shrink-0'
      }
    >
      {(totalQty || 0) > 5 ? (
        <span
          className="propeller-favorite-list-item__stock-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-success bg-success/10"
          data-stock="in"
        >
          {getLabel(resolved.labels, 'inStock', 'In stock')}
        </span>
      ) : null}
      {(totalQty || 0) > 0 && (totalQty || 0) <= 5 ? (
        <span
          className="propeller-favorite-list-item__stock-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-warning bg-warning/10"
          data-stock="low"
        >
          {getLabel(resolved.labels, 'lowStock', 'Low stock')}
        </span>
      ) : null}
      {(totalQty || 0) === 0 ? (
        <span
          className="propeller-favorite-list-item__stock-badge inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-destructive bg-destructive/10"
          data-stock="out"
        >
          {getLabel(resolved.labels, 'outOfStock', 'Out of stock')}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Formatted price. Hidden when the item has no resolvable price.
 */
function FavoriteListItemPrice(props: { className?: string }) {
  const { derived } = useFavoriteListItemContext();
  if (!derived.formattedPrice) return null;
  return (
    <span
      className={
        props.className ??
        'propeller-favorite-list-item__price text-base font-bold text-foreground whitespace-nowrap flex-shrink-0'
      }
    >
      {derived.formattedPrice}
    </span>
  );
}

/**
 * Row-level actions: embedded {@link AddToCart} for products, "View cluster"
 * link for clusters, and an optional delete button.
 */
function FavoriteListItemActions(props: { className?: string }) {
  const { derived, resolved, handleItemClick, handleDelete, item } = useFavoriteListItemContext();
  const { isProduct, productUrl } = derived;
  const product = item as Product;
  return (
    <div
      className={
        props.className ??
        'propeller-favorite-list-item__actions flex items-center gap-2 flex-shrink-0'
      }
      onClick={(e) => e.stopPropagation()}
    >
      {resolved.allowAddToCart !== false && isProduct && !!resolved.graphqlClient ? (
        <AddToCart
          className="flex items-center gap-2"
          product={product}
          cartId={resolved.cartId}
          createCart={resolved.createCart}
          onCartCreated={resolved.onCartCreated}
          onAddToCart={resolved.onAddToCart}
          afterAddToCart={resolved.afterAddToCart}
          showModal={resolved.showModal}
          allowIncrDecr={resolved.allowIncrDecr}
          enableStockValidation={resolved.enableStockValidation}
          onProceedToCheckout={resolved.onProceedToCheckout}
          onRequestQuoteClick={resolved.onRequestQuoteClick}
          labels={resolved.addToCartLabels}
        />
      ) : null}
      {!isProduct ? (
        <a
          className="propeller-favorite-list-item__view-cluster inline-flex items-center justify-center rounded-control bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90 whitespace-nowrap"
          href={productUrl}
          onClick={(e) => handleItemClick(e)}
        >
          {getLabel(resolved.labels, 'viewCluster', 'View cluster')}
        </a>
      ) : null}
      {resolved.showDelete !== false ? (
        <button
          type="button"
          className="propeller-favorite-list-item__delete-btn h-8 w-8 p-0 inline-flex items-center justify-center rounded-control text-foreground-subtle hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={handleDelete}
          title={getLabel(resolved.labels, 'delete', 'Remove from list')}
        >
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
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

type FavoriteListItemComponent = typeof FavoriteListItem & {
  Image: typeof FavoriteListItemImage;
  Sku: typeof FavoriteListItemSku;
  Name: typeof FavoriteListItemName;
  Stock: typeof FavoriteListItemStock;
  Price: typeof FavoriteListItemPrice;
  Actions: typeof FavoriteListItemActions;
};

const FavoriteListItemExport = FavoriteListItem as FavoriteListItemComponent;
FavoriteListItemExport.Image = FavoriteListItemImage;
FavoriteListItemExport.Sku = FavoriteListItemSku;
FavoriteListItemExport.Name = FavoriteListItemName;
FavoriteListItemExport.Stock = FavoriteListItemStock;
FavoriteListItemExport.Price = FavoriteListItemPrice;
FavoriteListItemExport.Actions = FavoriteListItemActions;

export default FavoriteListItemExport;
