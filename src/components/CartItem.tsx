'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { BundleItem, Cart, CartBaseItem, CartMainItem, Cluster, Contact, Crossupsell, Customer, GraphQLClient, MediaImageProductSearchInput, Product, ProductInventory, TransformationsInput, YesNo } from '@propeller-commerce/propeller-sdk-v2';
import { useCart } from '../composables/react/useCart';
import { useResolvedProps, type ResolveSpec } from '../composables/react/useResolvedProps';
import { getLabel, getLocalizedValue, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice, formatSurcharge } from '@propeller-commerce/propeller-v2-core-ui';
import DefaultItemStockImpl from './ItemStock';
import { cn } from '../composables/shared/utils/cn';

export interface CartItemProps {
  /** GraphQL client for the Propeller SDK. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** The shopping cart unique identifier */
  cartId: string;

  /** Tax zone for price calculations */
  taxZone?: string;

  /** Authenticated user for cart operations */
  user?: Contact | Customer | null;

  /** A shopping cart item */
  cartItem: CartMainItem;

  /** Should the item title be a link to the PDP. Defaults to true. */
  titleLinkable?: boolean;

  /** Should the stock be displayed in the cart item. Defaults to false. */
  showStockComponent?: boolean;

  /** Display the SKU of the cart item beneath the item name. Defaults to true. */
  showSku?: boolean;

  /** +/- buttons on left and right of quantity input. Defaults to true. */
  enableIncrementDecrement?: boolean;

  /** Should the cart item notes field be displayed. Defaults to false. */
  showCartItemNotesField?: boolean;

  /** Action callback when a cart item quantity is changed */
  onQuantityChange?: (item: CartMainItem, quantity: number) => void;

  /** Action callback when a cart item note is changed */
  onNoteChange?: (item: CartMainItem, note: string) => void;

  /** Action callback when a cart item is deleted */
  onDelete?: (item: CartMainItem) => void;

  /** Callback with the updated cart after any cart mutation */
  afterCartUpdate?: (cart: Cart) => void;

  /** Label overrides for UI strings
   *
   * Available keys: remove, notes, notesPlaceholder, includedOptions, updating, deleting
   */
  labels?: Record<string, string>;

  /** Language code for CartService operations. Defaults to 'NL'. */
  language?: string;

  /** Configuration object for image filters and URL generation */
  configuration?: {
    language?: string;
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
    imageVariantFiltersMedium?: TransformationsInput;
    urls?: { getProductUrl: (product: Product, language?: string) => string };
  };

  /** Show cross-sell/upsell product suggestions below the item. Defaults to false. */
  showCrossupsells?: boolean;

  /** Which cross-sell types to fetch. Defaults to ['ACCESSORIES']. Values: 'ACCESSORIES', 'ALTERNATIVES', 'OPTIONS', 'PARTS', 'RELATED' */
  crossupsellTypes?: string[];

  /** Maximum number of cross-sell products to display. Defaults to 3. */
  crossupsellLimit?: number;

  /** Callback when a cross-sell product is clicked */
  onCrossupsellClick?: (product: Product | Cluster) => void;

  /** Additional CSS class for the root element */
  className?: string;

  /** Include tax in price. Defaults to false. */
  includeTax?: boolean;

  /** Active company ID — used to look up the user's PAC for this company */
  companyId?: number;

  /** Currency symbol for prices. Resolved from PropellerProvider when omitted; defaults to '€'. */
  currency?: string;

  // ───── Extension API ─────
  // Per-row overrides for sub-components. Precedence:
  // explicit prop > ProductGridConfig context > infra > default.
  priceComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').PriceComponentProps>;
  stockComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').StockComponentProps>;
  surchargesComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').ProductSurchargesComponentProps>;

  /** When false, root element drops the card frame
   *  ('bg-card p-4 rounded-container shadow-sm border border-border'),
   *  leaving only the flex layout. Default: true. Used by drawer / summary
   *  widgets. */
  cardFrame?: boolean;

  /** When false, the delete button (and <CartItem.Delete /> in compound
   *  mode) returns null. Default: true. */
  showDelete?: boolean;

  /** When true, quantity renders as 'Qty: {n}' text — no stepper, no
   *  input. Default: false. Independent from enableIncrementDecrement
   *  (which only swaps stepper buttons for a bare number input — both
   *  modes are still interactive). */
  readOnlyQuantity?: boolean;

  /** Optional title click callback. Fires BEFORE default navigation; the
   *  consumer may call event.preventDefault() to suppress nav. Used by
   *  the cart drawer to close the sidebar on title click. */
  onTitleClick?: (event: React.MouseEvent, item: CartMainItem) => void;

  /** Compound mode opt-in. When provided, CartItem renders the compound
   *  subtree (using <CartItem.X> subcomponents) instead of the legacy
   *  monolithic layout. */
  children?: React.ReactNode;
}

/**
 * Renders a single cart line item with image, title, price, quantity stepper,
 * notes field and optional cross-sell/upsell suggestions. Supports bundles and
 * cluster option child items.
 *
 * @remarks Uses {@link useCart} for quantity/notes updates, deletion and
 * cross-sell fetching.
 */
const CART_ITEM_RESOLVE_SPEC: ResolveSpec<CartItemProps> = {
  graphqlClient: { infra: 'graphqlClient' },
  user: { infra: 'user' },
  companyId: { infra: 'companyId' },
  configuration: { infra: 'configuration' },
  language: { infra: 'language', default: 'NL' },
  currency: { infra: 'currency', default: '€' },
  includeTax: { infra: 'includeTax' },
  priceComponent: { grid: 'priceComponent' },
  stockComponent: { grid: 'stockComponent' },
  surchargesComponent: { grid: 'surchargesComponent' },
};

// ── Compound API context ────────────────────────────────────────────────────
// useCartItemContext (not useCartItem) to avoid clashing with any future
// useCartItem composable. Matches the pattern set by ProductInfo.

interface CartItemContextValue {
  cartItem: CartMainItem;
  resolved: CartItemProps;
  derived: {
    name: string;
    sku: string;
    imageUrl: string;
    productUrl: string;
    isBundle: boolean;
    bundleName: string;
    bundleLeaderName: string;
    bundleLeaderPrice: string;
    bundleNonLeaders: BundleItem[];
    surcharges: string[];
    inventory: ProductInventory | null;
    formattedPrice: string;
    bundlePrice: string;
    useTax: boolean;
    language: string;
    currency: string;
    quantity: number;
    minQuantity: number;
    step: number;
  };
  state: {
    notes: string;
    loading: boolean;
    deleting: boolean;
    crossupsells: Crossupsell[];
    visibleCrossupsells: Crossupsell[];
    addingCrossupsellId: number | null;
  };
  helpers: {
    getBundleItemName: (bundleItem: BundleItem) => string;
    getBundleItemPrice: (bundleItem: BundleItem) => string;
    getCrossupsellName: (item: Crossupsell) => string;
    getCrossupsellImageUrl: (item: Crossupsell) => string;
    getCrossupsellUrl: (item: Crossupsell) => string;
    getCrossupsellPrice: (item: Crossupsell) => string;
    getCrossupsellProductId: (item: Crossupsell) => number | undefined;
  };
  handlers: {
    onQuantityChange: (newQuantity: number) => void;
    onNoteChange: (newNote: string) => void;
    onDelete: () => void;
    onTitleClick: (event: React.MouseEvent) => void;
    onCrossupsellClick: (item: Crossupsell, event: React.MouseEvent) => void;
    onAddCrossupsellToCart: (item: Crossupsell) => void;
  };
}

const CartItemContext = React.createContext<CartItemContextValue | null>(null);

function useCartItemContext(): CartItemContextValue {
  const ctx = React.useContext(CartItemContext);
  if (!ctx) {
    throw new Error(
      'CartItem compound subcomponents must be rendered inside <CartItem>.',
    );
  }
  return ctx;
}

function CartItem(rawProps: CartItemProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>,
  // and injected sub-component slots cascade from the ProductGrid config (Tier 2).
  const props = useResolvedProps(rawProps, CART_ITEM_RESOLVE_SPEC);
  // --- composable ---
  const { updateItemQuantity, updateItemNotes, deleteItem, getCrossupsells, addItem, getMinQuantity, getStep } = useCart({
    graphqlClient: props.graphqlClient!,
    user: props.user ?? null,
    cartId: props.cartId,
    configuration: props.configuration,
    companyId: props.companyId,
  });

  // --- local UI state ---
  // Lazy-initialize from props.cartItem; the previous code seeded to 1/''
  // and then setX in a mount effect, an unnecessary extra render.
  const [quantity, setQuantity] = useState<number>(() => props.cartItem.quantity || 1);
  const [notes, setNotes] = useState<string>(() => props.cartItem.notes || '');
  const [loading, setLoading] = useState<boolean>(() => false);
  const [deleting, setDeleting] = useState<boolean>(() => false);
  const [crossupsells, setCrossupsells] = useState<Crossupsell[]>(() => []);
  const [crossupsellsLoading, setCrossupsellsLoading] = useState<boolean>(() => false);
  const [addingCrossupsellId, setAddingCrossupsellId] = useState<number | null>(() => null);

  // Order quantity rules from the product: `minimumQuantity` (floor) and `unit`
  // (step) — the cart stepper must honour the product's order rules, not
  // hardcode 1 (e.g. a product sold per 6 should step 6/12/18, min 6).
  const minQuantity = getMinQuantity(props.cartItem.product);
  const step = getStep(props.cartItem.product);

  // --- display helpers ---
  
  function getProductName(): string {
    return getLocalizedValue(props.cartItem.product?.names, props.language, 'Product');
  }
  function getProductUrl(): string {
    if (props.configuration?.urls && props.cartItem.product) {
      return props.configuration.urls.getProductUrl(props.cartItem.product as Product, props.language);
    }
    return '#';
  }
  function getProductImageUrl(): string {
    return props.cartItem.product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '';
  }
  function getProductSku(): string {
    return props.cartItem.product?.sku || '';
  }
  function getSurcharges(): string[] {
    // Cart-line surcharges (CartItemSurcharge: localized `names`, own quantity)
    // — each shown as `{qty} x {currency} {value} (name)`
    // for flat fees, `{qty} x {value}% (name)` for percentages.
    type SurchargeLike = {
      name?: { value?: string; language?: string }[];
      names?: { value?: string; language?: string }[];
      type?: string;
      value?: number;
      quantity?: number;
      enabled?: boolean;
    };
    const list = ((props.cartItem.surcharges ?? []) as SurchargeLike[]).filter(
      (s: SurchargeLike) => s.enabled !== false
    );
    return list
      .map((s: SurchargeLike) =>
        formatSurcharge(s, {
          quantity: s.quantity ?? props.cartItem.quantity ?? 1,
          language: props.language,
          currency: props.currency ?? '€',
        })
      )
      .filter((line: string) => line.length > 0);
  }
  function getInventory(): ProductInventory | null {
    const inv = props.cartItem.product?.inventory;
    return inv || null;
  }
  function getFormattedPrice(): string {
    const item = props.cartItem;
    const price = props.includeTax ? item?.totalSumNet || 0 : item?.totalSum || 0;
    return formatPrice(price, { symbol: props.currency ?? '\u20AC', locale: localeForLanguage(props.language) });
  }
  function isBundleItem(): boolean {
    return !!props.cartItem.bundle;
  }
  function getBundleName(): string {
    return props.cartItem.bundle?.name || 'Bundle';
  }
  function getBundlePrice(): string {
    const price = props.cartItem.bundle?.price?.net;
    if (price === undefined || price === null) return '';
    return formatPrice(price, { symbol: props.currency ?? '\u20AC', locale: localeForLanguage(props.language) });
  }
  function getBundleLeaderName(): string {
    const items = props.cartItem.bundle?.items;
    if (!items) return '';
    const leader = items.find((bi: BundleItem) => bi.isLeader === YesNo.Y);
    if (!leader) return '';
    return getLocalizedValue(leader.product.names, props.language, 'Product');
  }
  function getBundleLeaderPrice(): string {
    const items = props.cartItem.bundle?.items;
    if (!items) return '';
    const leader = items.find((bi: BundleItem) => bi.isLeader === YesNo.Y);
    if (!leader) return '';
    const price = leader.price?.net;
    if (price === undefined || price === null) return '';
    return formatPrice(price, { symbol: props.currency ?? '\u20AC', locale: localeForLanguage(props.language) });
  }
  function getBundleNonLeaders(): BundleItem[] {
    const items = props.cartItem.bundle?.items;
    if (!items) return [];
    return items.filter((bi: BundleItem) => bi.isLeader !== YesNo.Y);
  }
  function getBundleItemName(bundleItem: BundleItem): string {
    return getLocalizedValue(bundleItem.product.names, props.language, 'Product');
  }
  function getBundleItemPrice(bundleItem: BundleItem): string {
    const price = bundleItem.price?.net;
    if (price === undefined || price === null) return '';
    return formatPrice(price, { symbol: props.currency ?? '\u20AC', locale: localeForLanguage(props.language) });
  }
  function getCrossupsellName(item: Crossupsell): string {
    const product = item?.productTo || item?.clusterTo;
    return getLocalizedValue(product?.names, props.language, 'Product');
  }
  function getCrossupsellImageUrl(item: Crossupsell): string {
    const product = (item?.productTo || item?.clusterTo) as Product | undefined;
    return product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '';
  }
  function getCrossupsellUrl(item: Crossupsell): string {
    const product = item?.productTo || item?.clusterTo;
    if (props.configuration?.urls && product) {
      return props.configuration.urls.getProductUrl(product as Product, props.language);
    }
    return '#';
  }
  function getVisibleCrossupsells(): Crossupsell[] {
    const items = crossupsells || [];
    const limit = props.crossupsellLimit || 3;
    return items.slice(0, limit);
  }

  // --- actions via composable ---
  async function handleQuantityChange(newQuantity: number): Promise<void> {
    if (newQuantity < 1 || loading) return;
    setQuantity(newQuantity);
    setLoading(true);
    if (props.onQuantityChange) {
      props.onQuantityChange(props.cartItem, newQuantity);
      setLoading(false);
      return;
    }
    try {
      const updatedCart = await updateItemQuantity(props.cartItem.itemId.toString(), newQuantity);
      if (updatedCart && props.afterCartUpdate) props.afterCartUpdate(updatedCart);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to update cart item quantity:', error);
      setQuantity(props.cartItem.quantity);
      setLoading(false);
    }
  }

  function handleNoteChange(note: string): void {
    setNotes(note);
    if (props.onNoteChange) {
      props.onNoteChange(props.cartItem, note);
      return;
    }
    updateItemNotes(props.cartItem.itemId, note, 500);
  }

  async function handleDelete(): Promise<void> {
    if (deleting) return;
    setDeleting(true);
    if (props.onDelete) {
      props.onDelete(props.cartItem);
      setDeleting(false);
      return;
    }
    try {
      const updatedCart = await deleteItem(props.cartItem.itemId);
      if (updatedCart && props.afterCartUpdate) props.afterCartUpdate(updatedCart);
      setDeleting(false);
    } catch (error: any) {
      console.error('Failed to delete cart item:', error);
      setDeleting(false);
    }
  }

  function fetchCrossupsells(): void {
    if (!props.showCrossupsells) return;
    setCrossupsellsLoading(true);
    getCrossupsells({
      productId: props.cartItem?.productId,
      clusterId: props.cartItem?.clusterId,
      types: props.crossupsellTypes,
      taxZone: props.taxZone,
      imageVariantFilters: props.configuration?.imageVariantFiltersMedium,
    }).then((items) => {
      setCrossupsells(items);
      setCrossupsellsLoading(false);
    }).catch(() => {
      setCrossupsells([]);
      setCrossupsellsLoading(false);
    });
  }

  function getCrossupsellProductId(item: Crossupsell): number | undefined {
    const product = (item?.productTo || item?.clusterTo) as Product | undefined;
    return (product as Product)?.productId || product?.id;
  }

  function getCrossupsellPrice(item: Crossupsell): string {
    const product = (item?.productTo || item?.clusterTo) as Product | undefined;
    const price = product?.price;
    if (!price) return '';
    const value = props.includeTax ? price.net : price.gross;
    if (value === undefined || value === null) return '';
    return formatPrice(value, { symbol: props.currency ?? '\u20AC', locale: localeForLanguage(props.language) });
  }

  async function handleAddCrossupsellToCart(item: Crossupsell): Promise<void> {
    if (!props.cartId || addingCrossupsellId) return;
    const productId = getCrossupsellProductId(item);
    if (!productId) return;
    setAddingCrossupsellId(productId);
    const result = await addItem({ product: { productId } as Product, quantity: 1, cartId: props.cartId });
    setAddingCrossupsellId(null);
    if (result.ok && props.afterCartUpdate) {
      props.afterCartUpdate(result.data.cart);
    }
  }

  // Mount-only: fetch related crossupsells once we know the cart context.
  useEffect(() => {
    fetchCrossupsells();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync local quantity/notes when the cart item changes externally —
  // e.g. server-side reconciliation after an optimistic update, or a
  // different item being swapped into the same component instance via
  // parent re-render. Intentional external-state sync.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuantity(props.cartItem.quantity || 1);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(props.cartItem.notes || '');
  }, [props.cartItem]);

  // ── Build the compound-API context value ──────────────────────────────────
  const contextValue: CartItemContextValue = {
    cartItem: props.cartItem,
    resolved: props,
    derived: {
      name: getProductName(),
      sku: getProductSku(),
      imageUrl: getProductImageUrl(),
      productUrl: getProductUrl(),
      isBundle: isBundleItem(),
      bundleName: getBundleName(),
      bundleLeaderName: getBundleLeaderName(),
      bundleLeaderPrice: getBundleLeaderPrice(),
      bundleNonLeaders: getBundleNonLeaders(),
      surcharges: getSurcharges(),
      inventory: getInventory(),
      formattedPrice: getFormattedPrice(),
      bundlePrice: getBundlePrice(),
      useTax: props.includeTax ?? false,
      language: props.language ?? 'NL',
      currency: props.currency ?? '€',
      quantity,
      minQuantity,
      step,
    },
    state: {
      notes,
      loading,
      deleting,
      crossupsells,
      visibleCrossupsells: getVisibleCrossupsells(),
      addingCrossupsellId,
    },
    helpers: {
      getBundleItemName,
      getBundleItemPrice,
      getCrossupsellName,
      getCrossupsellImageUrl,
      getCrossupsellUrl,
      getCrossupsellPrice,
      getCrossupsellProductId,
    },
    handlers: {
      onQuantityChange: handleQuantityChange,
      onNoteChange: handleNoteChange,
      onDelete: handleDelete,
      onTitleClick: (e) => props.onTitleClick?.(e, props.cartItem),
      onCrossupsellClick: (item, e) => {
        if (props.onCrossupsellClick) {
          e.preventDefault();
          props.onCrossupsellClick(
            (item.productTo || item.clusterTo) as Product | Cluster
          );
        }
      },
      onAddCrossupsellToCart: (item) => {
        handleAddCrossupsellToCart(item);
      },
    },
  };

  // Compound mode: caller passes children → render their tree wrapped in the
  // root container + provider, skipping the legacy monolithic layout.
  if (rawProps.children !== undefined) {
    return (
      <CartItemContext.Provider value={contextValue}>
        <div
          className={cn(`propeller-cart-item flex flex-wrap md:flex-nowrap items-start gap-4 ${props.cardFrame === false ? '' : 'bg-card p-4 rounded-container shadow-sm border border-border'} ${props.className || ''}`)}
          data-bundle={isBundleItem() ? 'true' : 'false'}
          data-loading={loading ? 'true' : 'false'}
        >
          {rawProps.children}
        </div>
      </CartItemContext.Provider>
    );
  }

  // Legacy monolithic mode: composes the same subcomponents internally so the
  // DOM (when no children are passed) is byte-identical to today. Single
  // rendering path — both modes flow through the subcomponents below.
  return (
    <CartItemContext.Provider value={contextValue}>
      <div
        className={cn(`propeller-cart-item flex flex-wrap md:flex-nowrap items-start gap-4 ${props.cardFrame === false ? '' : 'bg-card p-4 rounded-container shadow-sm border border-border'} ${props.className || ''}`)}
        data-bundle={isBundleItem() ? 'true' : 'false'}
        data-loading={loading ? 'true' : 'false'}
      >
        {/* `items-start` on the root anchors the image / body / footer to the
            top of the row. With `items-center` (previous default), the image
            and footer drifted to the vertical middle of a tall body — which
            looks broken when cross-sells push the body to 200px+ while the
            image stays at 96px. The footer (price + qty + delete) gets a
            small md:mt-1 below to optically align with the title baseline
            rather than the very edge of the card. */}
        <CartItemImage />
        <div className="propeller-cart-item__body flex-1 min-w-0">
          <CartItemSku />
          <CartItemTitle />
          <CartItemSurcharges />
          <CartItemStock />
          <CartItemBundleItems />
          <CartItemChildItems />
          <CartItemNotes />
          <CartItemCrossupsells />
        </div>
        <div className="propeller-cart-item__footer w-full md:w-auto md:mt-1 flex items-center gap-3 md:gap-4 border-t md:border-t-0 border-border-subtle pt-2 md:pt-0 flex-shrink-0">
          <CartItemPrice />
          <CartItemQuantity />
          {loading ? (
            <span className="propeller-cart-item__updating text-xs text-foreground-subtle">{getLabel(props.labels, 'updating', 'Updating...')}</span>
          ) : null}
          <CartItemDelete />
        </div>
      </div>
    </CartItemContext.Provider>
  );
}

// ── Compound subcomponents (the partner-facing surface) ────────────────────
// Each subcomponent reads shared data via useCartItemContext(). Defaults
// match the legacy monolithic markup verbatim so the rendered DOM is
// byte-identical when no children are passed to <CartItem>.

/** Product / placeholder image. */
function CartItemImage(props: { className?: string } = {}) {
  const { derived } = useCartItemContext();
  return (
    <div className={props.className ?? 'propeller-cart-item__media w-20 h-20 md:w-24 md:h-24 flex-shrink-0 bg-surface-hover flex items-center justify-center overflow-hidden relative rounded-control'}>
      {!!derived.imageUrl ? (
        <img
          className="propeller-cart-item__image w-full h-full object-contain p-1"
          src={derived.imageUrl}
          alt={derived.name}
        />
      ) : null}
      {!derived.imageUrl ? (
        <svg
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          className="propeller-cart-item__image-placeholder w-8 h-8 text-foreground-subtle"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
      ) : null}
    </div>
  );
}

/** SKU line. Null for bundle items, when showSku is false, or when the
 *  product has no SKU. */
function CartItemSku(props: { className?: string } = {}) {
  const { derived, resolved } = useCartItemContext();
  if (derived.isBundle) return null;
  if (resolved.showSku === false) return null;
  if (!derived.sku) return null;
  return (
    <p className={props.className ?? 'propeller-cart-item__sku font-mono text-xs text-foreground-subtle'}>
      {derived.sku}
    </p>
  );
}

/** Title line — bundle name (plain span) or product name (link / span by
 *  titleLinkable). */
function CartItemTitle(props: { className?: string } = {}) {
  const { derived, resolved, handlers } = useCartItemContext();
  if (derived.isBundle) {
    return (
      <span className={props.className ?? 'propeller-cart-item__title font-semibold text-sm md:text-base text-foreground line-clamp-2'}>
        {derived.bundleName}
      </span>
    );
  }
  if (resolved.titleLinkable !== false) {
    return (
      <a
        className={props.className ?? 'propeller-cart-item__title font-semibold text-sm md:text-base text-foreground hover:text-primary transition-colors line-clamp-2'}
        href={derived.productUrl}
        onClick={handlers.onTitleClick}
      >
        {derived.name}
      </a>
    );
  }
  return (
    <span className={props.className ?? 'propeller-cart-item__title font-semibold text-sm md:text-base text-foreground line-clamp-2'}>
      {derived.name}
    </span>
  );
}

/** Surcharges list (with injectable surchargesComponent override). Null for
 *  bundles or when no surcharges. */
function CartItemSurcharges(props: { className?: string } = {}) {
  const { cartItem, derived, resolved } = useCartItemContext();
  if (derived.isBundle) return null;
  const SurchargesImpl = resolved.surchargesComponent;
  if (SurchargesImpl) {
    return (
      <SurchargesImpl
        cartItem={cartItem}
        includeTax={resolved.includeTax}
        labels={resolved.labels}
      />
    );
  }
  if (derived.surcharges.length === 0) return null;
  return (
    <div className={props.className ?? 'propeller-cart-item__surcharges mt-1 text-xs text-muted-foreground'}>
      <span className="font-medium">{getLabel(resolved.labels, 'surcharges', 'Additional surcharges:')}</span>
      <ul className="propeller-cart-item__surcharges-list mt-0.5">
        {derived.surcharges.map((line, idx) => (
          <li key={idx} className="propeller-cart-item__surcharge">{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** Stock indicator (with injectable stockComponent override). Null unless
 *  showStockComponent is true and the product has an inventory. */
function CartItemStock(props: { className?: string } = {}) {
  const { derived, resolved } = useCartItemContext();
  if (resolved.showStockComponent !== true) return null;
  if (!derived.inventory) return null;
  const StockImpl = resolved.stockComponent ?? DefaultItemStockImpl;
  return (
    <div className={props.className ?? 'mt-1'}>
      <StockImpl
        inventory={derived.inventory}
        showStock
        showAvailability
        labels={resolved.labels}
      />
    </div>
  );
}

/** Bundle leader + non-leader items list. Null when the cart item is not a
 *  bundle. */
function CartItemBundleItems(props: { className?: string } = {}) {
  const { derived, helpers } = useCartItemContext();
  if (!derived.isBundle) return null;
  return (
    <div className={props.className ?? 'propeller-cart-item__bundle mt-3 space-y-1.5 border-l-2 border-border pl-3'}>
      {!!derived.bundleLeaderName ? (
        <div className="propeller-cart-item__bundle-leader flex flex-wrap gap-x-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{derived.bundleLeaderName}</span>
          {!!derived.bundleLeaderPrice ? (
            <>
              <div className="flex-1 border-b border-dotted border-border mx-1 mb-1" />
              <span className="font-semibold text-foreground">{derived.bundleLeaderPrice}</span>
            </>
          ) : null}
        </div>
      ) : null}
      {derived.bundleNonLeaders?.map((bundleItem, idx) => (
        <div className="propeller-cart-item__bundle-item flex flex-wrap gap-x-2 text-sm text-muted-foreground" key={idx}>
          <span className="font-medium">{helpers.getBundleItemName(bundleItem)}</span>
          {!!helpers.getBundleItemPrice(bundleItem) ? (
            <>
              <div className="flex-1 border-b border-dotted border-border mx-1 mb-1" />
              <span className="font-semibold text-foreground">
                {helpers.getBundleItemPrice(bundleItem)}
              </span>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Cluster child items (options) list. Null unless the cart item is a
 *  cluster line with children. */
function CartItemChildItems(props: { className?: string } = {}) {
  const { cartItem, resolved } = useCartItemContext();
  if (!cartItem.clusterId) return null;
  if (!cartItem.childItems || cartItem.childItems.length === 0) return null;
  return (
    <div className={props.className ?? 'propeller-cart-item__options mt-3 space-y-1.5 border-l-2 border-border pl-3'}>
      <p className="propeller-cart-item__options-label text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        {getLabel(resolved.labels, 'includedOptions', 'Included Options:')}
      </p>
      {(cartItem.childItems || []).map((child, idx) => (
        <div className="propeller-cart-item__option flex flex-wrap gap-x-2 text-sm text-muted-foreground" key={idx}>
          <span className="font-medium">{getLocalizedValue(child.product.names, resolved.language, 'Option')}</span>
          <span className="text-foreground-subtle hidden sm:inline">-</span>
          <span className="text-foreground-subtle text-xs self-center">{child.product.sku}</span>
          <div className="flex-1 border-b border-dotted border-border mx-1 mb-1" />
          <span className="font-semibold text-foreground">{formatPrice(child.totalSum, { symbol: resolved.currency ?? '€', locale: localeForLanguage(resolved.language) })}</span>
        </div>
      ))}
    </div>
  );
}

/** Notes textarea. Null unless showCartItemNotesField is true. */
function CartItemNotes(props: { className?: string } = {}) {
  const { resolved, state, handlers } = useCartItemContext();
  if (resolved.showCartItemNotesField !== true) return null;
  return (
    <div className={props.className ?? 'propeller-cart-item__notes mt-3'}>
      <label className="propeller-cart-item__notes-label text-xs font-medium text-muted-foreground block mb-1">
        {getLabel(resolved.labels, 'notes', 'Notes')}
      </label>
      <textarea
        className="propeller-cart-item__notes-input w-full text-sm border border-input rounded-control px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-transparent resize-none"
        value={state.notes}
        onChange={(e) => handlers.onNoteChange(e.target.value)}
        placeholder={getLabel(resolved.labels, 'notesPlaceholder', 'Add a note for this item...')}
        rows={2}
      />
    </div>
  );
}

/** Cross-sell / upsell list. Null when there are no visible crossupsells
 *  (also gated by showCrossupsells on the parent, since that's what
 *  populates the state). */
function CartItemCrossupsells(props: { className?: string } = {}) {
  const { resolved, state, helpers, handlers } = useCartItemContext();
  if (state.visibleCrossupsells.length === 0) return null;
  return (
    <div className={props.className ?? 'propeller-cart-item__crossupsells mt-3 pt-3 border-t border-border'}>
      <p className="propeller-cart-item__crossupsells-label text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {getLabel(resolved.labels, 'crossupsellTitle', 'You might also like')}
      </p>
      <div className="flex flex-col gap-2">
        {state.visibleCrossupsells?.map((item, idx) => (
          <div
            className="propeller-cart-item__crossupsell flex items-center gap-2 p-2 rounded-control border border-border hover:border-primary/30 hover:bg-surface-hover transition-colors"
            key={idx}
          >
            <a
              className="propeller-cart-item__crossupsell-link flex items-center gap-2 flex-1 min-w-0"
              href={helpers.getCrossupsellUrl(item)}
              onClick={(e) => handlers.onCrossupsellClick(item, e)}
            >
              {!!helpers.getCrossupsellImageUrl(item) ? (
                <img
                  className="propeller-cart-item__crossupsell-image w-10 h-10 object-contain rounded flex-shrink-0"
                  src={helpers.getCrossupsellImageUrl(item)}
                  alt={helpers.getCrossupsellName(item)}
                />
              ) : null}
              <div className="min-w-0">
                <span className="propeller-cart-item__crossupsell-title text-xs font-medium text-muted-foreground line-clamp-2">
                  {helpers.getCrossupsellName(item)}
                </span>
                {!!helpers.getCrossupsellPrice(item) ? (
                  <span className="propeller-cart-item__crossupsell-price text-xs font-bold text-foreground block">
                    {helpers.getCrossupsellPrice(item)}
                  </span>
                ) : null}
              </div>
            </a>
            <button
              type="button"
              className="propeller-cart-item__crossupsell-btn flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-control bg-primary text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-50"
              title={getLabel(resolved.labels, 'addToCart', 'Add to cart')}
              disabled={state.addingCrossupsellId === helpers.getCrossupsellProductId(item)}
              onClick={(e) => {
                e.stopPropagation();
                handlers.onAddCrossupsellToCart(item);
              }}
            >
              {state.addingCrossupsellId === helpers.getCrossupsellProductId(item) ? (
                <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              ) : null}
              {state.addingCrossupsellId !== helpers.getCrossupsellProductId(item) ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="8" cy="21" r="1" />
                  <circle cx="19" cy="21" r="1" />
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
              ) : null}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Price line — bundle price (plain) or product price (with injectable
 *  priceComponent override). Null for bundles without a bundle price. */
function CartItemPrice(props: { className?: string } = {}) {
  const { cartItem, derived, resolved } = useCartItemContext();
  if (derived.isBundle) {
    if (!derived.bundlePrice) return null;
    return (
      <p className={props.className ?? 'propeller-cart-item__price text-sm md:text-base font-bold text-foreground whitespace-nowrap'}>
        {derived.bundlePrice}
      </p>
    );
  }
  const PriceImpl = resolved.priceComponent;
  if (PriceImpl) {
    // Contract-vs-data note: the default path shows the line-item total
    // (`cartItem.totalSum`/`totalSumNet`). The injected component receives
    // the closest contract match — the product's catalog price
    // (`cartItem.product.price`). The injected price will not include
    // line-level surcharges or totals.
    return (
      <p className={props.className ?? 'propeller-cart-item__price text-sm md:text-base font-bold text-foreground whitespace-nowrap'}>
        <PriceImpl
          price={cartItem?.product?.price}
          includeTax={resolved.includeTax}
          currency={resolved.currency}
          labels={resolved.labels}
        />
      </p>
    );
  }
  return (
    <p className={props.className ?? 'propeller-cart-item__price text-sm md:text-base font-bold text-foreground whitespace-nowrap'}>
      {derived.formattedPrice}
    </p>
  );
}

/** Quantity control — read-only text, stepper (default), or bare input. */
function CartItemQuantity(props: { className?: string } = {}) {
  const { derived, resolved, state, handlers } = useCartItemContext();
  if (resolved.readOnlyQuantity) {
    return (
      <div className={props.className ?? 'propeller-cart-item__quantity-readonly text-sm text-foreground-subtle'}>
        {getLabel(resolved.labels, 'qtyPrefix', 'Qty:')} {derived.quantity}
      </div>
    );
  }
  if (resolved.enableIncrementDecrement !== false) {
    return (
      <div className={props.className ?? 'propeller-cart-item__stepper flex items-center border border-input rounded-control bg-card h-9'}>
        <button
          type="button"
          className="propeller-cart-item__decrement px-2.5 h-full text-muted-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-control select-none"
          onClick={() => handlers.onQuantityChange(derived.quantity - derived.step)}
          disabled={derived.quantity <= derived.minQuantity || state.loading}
        >
          -
        </button>
        <input
          type="number"
          className="propeller-cart-item__quantity w-10 text-center text-sm bg-transparent border-x border-input h-full focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={derived.minQuantity}
          step={derived.step}
          value={derived.quantity}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= derived.minQuantity) {
              // Snap to the nearest valid min + step multiple.
              handlers.onQuantityChange(Math.round((val - derived.minQuantity) / derived.step) * derived.step + derived.minQuantity);
            }
          }}
        />
        <button
          type="button"
          className="propeller-cart-item__increment px-2.5 h-full text-muted-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-r-control select-none"
          onClick={() => handlers.onQuantityChange(derived.quantity + derived.step)}
          disabled={state.loading}
        >
          +
        </button>
      </div>
    );
  }
  return (
    <input
      type="number"
      className={props.className ?? 'propeller-cart-item__quantity w-14 h-9 text-center text-sm border border-input rounded-control focus:ring-2 focus:ring-primary focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'}
      min={derived.minQuantity}
      step={derived.step}
      value={derived.quantity}
      onChange={(e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val) && val >= derived.minQuantity) {
          handlers.onQuantityChange(Math.round((val - derived.minQuantity) / derived.step) * derived.step + derived.minQuantity);
        }
      }}
    />
  );
}

/** Delete button. Null when showDelete is false. */
function CartItemDelete(props: { className?: string } = {}) {
  const { resolved, state, handlers } = useCartItemContext();
  if (resolved.showDelete === false) return null;
  return (
    <button
      type="button"
      className={props.className ?? 'propeller-cart-item__delete h-8 w-8 p-0 ml-auto inline-flex items-center justify-center rounded-control text-foreground-subtle hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50'}
      onClick={() => handlers.onDelete()}
      disabled={state.deleting}
    >
      {state.deleting ? (
        <div className="w-4 h-4 border-2 border-foreground-subtle border-t-transparent rounded-full animate-spin" />
      ) : null}
      {!state.deleting ? (
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
      ) : null}
    </button>
  );
}

// ── Static attachments (compound API surface) ───────────────────────────────

type CartItemComponent = typeof CartItem & {
  Image: typeof CartItemImage;
  Title: typeof CartItemTitle;
  Sku: typeof CartItemSku;
  Surcharges: typeof CartItemSurcharges;
  Stock: typeof CartItemStock;
  BundleItems: typeof CartItemBundleItems;
  ChildItems: typeof CartItemChildItems;
  Notes: typeof CartItemNotes;
  Crossupsells: typeof CartItemCrossupsells;
  Price: typeof CartItemPrice;
  Quantity: typeof CartItemQuantity;
  Delete: typeof CartItemDelete;
};

const CartItemExport = CartItem as CartItemComponent;
CartItemExport.Image = CartItemImage;
CartItemExport.Title = CartItemTitle;
CartItemExport.Sku = CartItemSku;
CartItemExport.Surcharges = CartItemSurcharges;
CartItemExport.Stock = CartItemStock;
CartItemExport.BundleItems = CartItemBundleItems;
CartItemExport.ChildItems = CartItemChildItems;
CartItemExport.Notes = CartItemNotes;
CartItemExport.Crossupsells = CartItemCrossupsells;
CartItemExport.Price = CartItemPrice;
CartItemExport.Quantity = CartItemQuantity;
CartItemExport.Delete = CartItemDelete;

export default CartItemExport;
