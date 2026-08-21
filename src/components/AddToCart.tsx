'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import {
  GraphQLClient,
  Product,
  Cart,
  Contact,
  Customer,
  MediaImageProductSearchInput,
  TransformationsInput,
  CartMainItem,
  CartBaseItem,
  CartChildItemInput,
  Cluster,
} from '@propeller-commerce/propeller-sdk-v2';
import { useCart } from '../composables/react/useCart';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { getProductImageUrl, getProductSku, getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice, formatSurcharge } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface AddToCartProps {
  /** GraphQL client for the Propeller SDK. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** The authenticated user (Contact or Customer). Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer | null;

  /** Currency symbol used by the formatPrice helper for the success modal. Resolved from PropellerProvider when omitted; final fallback `'€'`. */
  currency?: string;

  /** The product to be added to cart */
  product: Product;

  /** Cart ID — required when onAddToCart is not provided */
  cartId?: string;

  /** The cluster to be added to cart */
  cluster?: Cluster;

  /** IDs of the cluster child items, e.g. cluster options */
  childItems?: number[];

  /** Called before adding to cart. Return false to abort (e.g. failed validation). */
  beforeAddToCart?: () => boolean;

  /** Notes for the cart item */
  notes?: string;

  /** Custom price for the product (overrides calculated price) */
  price?: number;

  /** Label overrides for UI strings
   *
   * available labels:
   * - outOfStock
   * - noCartId
   * - errorAdding
   * - addedToCart
   * - modalTitle
   * - quantity
   * - continueShopping
   * - proceedToCheckout
   * - requestQuoteButton
   * - add
   * - adding
   */
  labels?: Record<string, string>;

  /**
   * If true a new cart is created if no cart ID is provided.
   * Defaults to false.
   */
  createCart?: boolean;

  /**
   * Callback to handle a new cart being created.
   * WARNING: If not provided the component create new carts on every add-to-cart.
   */
  onCartCreated?: (cart: Cart) => void;

  /**
   * Callback to handle adding the product to cart.
   * If not provided the component calls CartService.addItemToCart internally.
   */
  onAddToCart?: (
    product: Product,
    clusterId?: number,
    quantity?: number,
    childItems?: CartChildItemInput[],
    notes?: string,
    price?: number,
    showModal?: boolean
  ) => Cart;

  /**
   * Callback triggered after adding the product to cart.
   */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;

  /**
   * When true a modal popup is shown after a successful add-to-cart
   * with buttons to continue shopping or proceed to checkout.
   * Defaults to false (only a brief inline success message is shown).
   */
  showModal?: boolean;

  /**
   * Renders − and + buttons beside the quantity input.
   * Defaults to true.
   */
  allowIncrDecr?: boolean;

  /**
   * Validates available stock via InventoryService before adding.
   * Defaults to false.
   */
  enableStockValidation?: boolean;

  /** Language code passed to CartService operations. Defaults to 'en'. */
  language?: string;

  /** Additional CSS class for the root element */
  className?: string;

  /** Callback fired when the "Proceed to checkout" modal button is clicked */
  onProceedToCheckout?: () => void;

  /** Callback fired when the "Request a Quote" modal button is clicked */
  onRequestQuoteClick?: (cart: Cart) => void;

  /** Configuration object passed to the component */
  configuration?: {
    language?: string;
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
    urls?: { getProductUrl: (product: Product, language?: string) => string };
  };

  /** Active company ID from the company switcher. Overrides user's default company for cart creation and lookup. */
  companyId?: number;

  /**
   * When true, tax-inclusive price (net) is shown.
   * When false, tax-exclusive price (gross) is shown.
   * Defaults to false.
   */
  includeTax?: boolean;

  // ───── Extension API ─────
  // Render branded price/stock in the success modal. AddToCart itself is
  // the component being injected upstream by other hosts, so it does NOT
  // accept an addToCartComponent prop here.
  priceComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').PriceComponentProps>;
  /**
   * Reserved slot. The success modal does not currently render stock —
   * out-of-stock paths surface via a brief toast instead. Declared so
   * consumers can pass it through uniformly; consumed if/when the modal
   * gains a stock block in the future.
   */
  stockComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').StockComponentProps>;

  // ── Grouped props (preferred — Phase C3) ───────────────────────────────
  // These reduce the 27-prop surface into three focused groups. When both a
  // grouped field and its flat-prop equivalent are supplied, the flat prop
  // wins (back-compat preserved). Consumers migrating to the new shape can
  // drop the equivalent flat props at their leisure.

  /**
   * Display toggles. Equivalent flat props: `allowIncrDecr`, `showModal`,
   * `enableStockValidation`.
   */
  display?: AddToCartDisplay;

  /**
   * Event callbacks. Equivalent flat props: `beforeAddToCart`, `onAddToCart`,
   * `afterAddToCart`, `onCartCreated`, `onProceedToCheckout`,
   * `onRequestQuoteClick`.
   */
  events?: AddToCartEvents;
}

/**
 * Display-toggle group for {@link AddToCartProps.display}.
 * @see AddToCartProps.display
 */
export interface AddToCartDisplay {
  /** Renders − and + buttons beside the quantity input. Defaults to `true`. */
  allowIncrDecr?: boolean;
  /** Shows a success modal after add-to-cart instead of a brief toast. Defaults to `false`. */
  showModal?: boolean;
  /** Validates available stock via InventoryService before adding. Defaults to `false`. */
  enableStockValidation?: boolean;
}

/**
 * Event-callback group for {@link AddToCartProps.events}.
 * @see AddToCartProps.events
 */
export interface AddToCartEvents {
  /** Called before adding to cart. Return `false` to abort (e.g. failed validation). */
  beforeAddToCart?: () => boolean;
  /** Override for the add-to-cart action; bypasses the internal CartService call. */
  onAddToCart?: AddToCartProps['onAddToCart'];
  /** Fires after the product is added to cart, with the updated cart and added item. */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;
  /** Fires when a new cart is created internally. */
  onCartCreated?: (cart: Cart) => void;
  /** Fires when the "Proceed to checkout" modal button is clicked. */
  onProceedToCheckout?: () => void;
  /** Fires when the "Request a Quote" modal button is clicked. */
  onRequestQuoteClick?: (cart: Cart) => void;
}

export interface CartQueryVariables {
  /** Cart ID to fetch */ cartId: string;
  /** Language for localized content */ language: string;
  /** Image search filters */ imageSearchFilters: MediaImageProductSearchInput;
  /** Image transformation filters */ imageVariantFilters: TransformationsInput;
}

/**
 * Merge grouped Phase-C3 props (`display`, `events`) into a flat props
 * object. Flat props win over grouped equivalents when both are supplied —
 * preserves back-compat for the 30+ existing call sites that pass the
 * monolithic shape. Returns a new object so the original `rawProps` is not
 * mutated; downstream code reads `props.x` as before, transparently
 * picking up grouped values when only those are supplied.
 */
function mergeGrouped(p: AddToCartProps): AddToCartProps {
  const d = p.display;
  const e = p.events;
  if (!d && !e) return p;
  return {
    ...p,
    allowIncrDecr: p.allowIncrDecr ?? d?.allowIncrDecr,
    showModal: p.showModal ?? d?.showModal,
    enableStockValidation: p.enableStockValidation ?? d?.enableStockValidation,
    beforeAddToCart: p.beforeAddToCart ?? e?.beforeAddToCart,
    onAddToCart: p.onAddToCart ?? e?.onAddToCart,
    afterAddToCart: p.afterAddToCart ?? e?.afterAddToCart,
    onCartCreated: p.onCartCreated ?? e?.onCartCreated,
    onProceedToCheckout: p.onProceedToCheckout ?? e?.onProceedToCheckout,
    onRequestQuoteClick: p.onRequestQuoteClick ?? e?.onRequestQuoteClick,
  };
}

/**
 * Add-to-cart control: a quantity stepper plus an "Add" button that adds a
 * product (optionally with cluster child items) to the cart, with optional
 * stock validation and a success toast or modal.
 *
 * @remarks Uses {@link useCart} for cart creation and add-item operations.
 */
function AddToCart(rawProps: AddToCartProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  // Then merge the Phase-C3 grouped props (display / events) on top so the
  // rest of the component reads `props.allowIncrDecr` etc. uniformly
  // regardless of whether the consumer passed the flat or grouped shape.
  const props = mergeGrouped(useInfraProps(rawProps));

  // --- composable ---
  const { cart, loading, checkoutAllowed, addItem, getMinQuantity, getStep } = useCart({
    graphqlClient: props.graphqlClient!,
    user: props.user ?? null,
    companyId: props.companyId,
    configuration: props.configuration,
    onCartCreated: props.onCartCreated,
  });

  // --- local UI state ---
  // Lazy-initialize from the product's min quantity (was previously seeded
  // to 1 then overwritten in useEffect — the set-state-in-effect anti-pattern
  // caused an extra render on every mount).
  const [quantity, setQuantity] = useState<number>(() => getMinQuantity(props.product));
  const [toastMessage, setToastMessage] = useState<string>(() => '');
  const [toastType, setToastType] = useState<string>(() => '');
  const [toastVisible, setToastVisible] = useState<boolean>(() => false);
  const [modalVisible, setModalVisible] = useState<boolean>(() => false);
  const [addedCartItem, setAddedCartItem] = useState<CartMainItem | null>(() => null);
  const [activeFullCart, setActiveFullCart] = useState<Cart | null>(() => null);
  const [includeTax] = useState<boolean>(() => false);

  // --- display helpers ---
  
  function getProductUrl(): string {
    return props.configuration?.urls?.getProductUrl(props.product, props.language) ?? '#';
  }
  function showToast(message: string, type: string): void {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 3000);
  }
  function dismissToast(): void {
    setToastVisible(false);
  }
  function increment(): void {
    setQuantity(quantity + getStep(props.product));
  }
  function decrement(): void {
    const min = getMinQuantity(props.product);
    const step = getStep(props.product);
    if (quantity - step >= min) {
      setQuantity(quantity - step);
    }
  }
  function getModalImageUrl(): string {
    if (addedCartItem) {
      const img = addedCartItem.product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url;
      if (img) return img;
    }
    return getProductImageUrl(props.product as Product);
  }
  function getModalName(): string {
    if (addedCartItem) {
      return getLocalizedValue(addedCartItem.product?.names, props.language as string, '')
        || getLocalizedValue((props.product as Product)?.names, props.language as string, 'Product');
    }
    return getLocalizedValue((props.product as Product)?.names, props.language as string, 'Product');
  }
  function getModalPrice(): string {
    if (addedCartItem) {
      const useTax: boolean = props.includeTax !== undefined ? !!props.includeTax : includeTax;
      const price = useTax ? addedCartItem.totalSumNet : addedCartItem.totalSum;
      return formatPrice(price, { symbol: props.currency ?? '€' });
    }
    return formatPrice(props.price !== undefined ? props.price : (props.product as Product)?.price?.gross, { symbol: props.currency ?? '€' });
  }
  function getModalSku(): string {
    if (addedCartItem) return addedCartItem.product?.sku || '';
    return getProductSku(props.product as Product);
  }
  function getModalSurcharges(): string[] {
    // Prefer the cart item's own surcharges (CartItemSurcharge: localized
    // `names`, may carry their own quantity); fall back to the product's
    // surcharges (Surcharge: `name`) for the pre-add state. Quantity is the
    // line quantity.
    type SurchargeLike = {
      name?: { value?: string; language?: string }[];
      names?: { value?: string; language?: string }[];
      type?: string;
      value?: number;
      quantity?: number;
      enabled?: boolean;
    };
    const cartSurcharges = (addedCartItem?.surcharges ?? []) as SurchargeLike[];
    const source: SurchargeLike[] = cartSurcharges.length > 0
      ? cartSurcharges
      : (((props.product as Product)?.surcharges ?? []) as SurchargeLike[]);
    return source
      .filter((s: SurchargeLike) => s.enabled !== false)
      .map((s: SurchargeLike) =>
        formatSurcharge(s, {
          quantity: s.quantity ?? quantity,
          language: props.language,
          currency: props.currency ?? '€',
        })
      )
      .filter((line: string) => line.length > 0);
  }
  function getChildItems(): CartBaseItem[] {
    const children = addedCartItem?.childItems;
    if (!children || !Array.isArray(children)) return [];
    return children;
  }
  /**
   * Resolve the cart line to show in the success modal for THIS add-to-cart.
   *
   * `useCart.addItem` returns the first cart item whose `productId` matches the
   * added product. That's wrong when the cart also holds a bundle whose leader
   * is the same product (same SKU/productId): the bundle's main item matches
   * first, so the modal would render the bundle's members as this product's
   * child items. Re-resolve to the standalone (non-bundle) line for the product
   * — preferring the most recent match — and ignore bundle items. Falls back to
   * `addItem`'s item when no standalone line is found.
   */
  function resolveAddedItem(resultCart: Cart | undefined, fallback: CartMainItem | null): CartMainItem | null {
    const items = resultCart?.items;
    if (!items || !Array.isArray(items)) return fallback;
    const productId = (props.product as Product)?.productId;
    const standalone = items.filter(
      (i: CartMainItem) => i.productId === productId && !i.bundle && !i.bundleId,
    );
    return standalone.length > 0 ? standalone[standalone.length - 1] : fallback;
  }
  function closeModal(): void {
    setModalVisible(false);
    setAddedCartItem(null);
  }

  // --- main action ---
  async function handleAddToCart(): Promise<void> {
    if (!props.graphqlClient) return;
    if (props.beforeAddToCart && !props.beforeAddToCart()) return;

    const result = await addItem({
      product: props.product,
      cluster: props.cluster,
      childItems: props.childItems,
      quantity,
      notes: props.notes,
      price: props.price,
      onAddToCart: props.onAddToCart
        ? (product, clusterId, qty, childItemInputs, notes, price) =>
            props.onAddToCart!(product, clusterId, qty, childItemInputs, notes, price, props.showModal)
        : undefined,
      afterAddToCart: (resultCart, addedItem) => {
        setActiveFullCart(resultCart);
        setAddedCartItem(resolveAddedItem(resultCart, addedItem || null));
        props.afterAddToCart?.(resultCart, addedItem || undefined);
      },
      enableStockValidation: props.enableStockValidation,
      cartId: props.cartId,
      createCart: props.createCart,
    });

    if (!result.ok) {
      showToast(
        result.error === 'Insufficient stock available'
          ? getLabel(props.labels, 'outOfStock', 'Insufficient stock available')
          : result.error === 'No cart ID provided'
          ? getLabel(props.labels, 'noCartId', 'No cart ID provided')
          : getLabel(props.labels, 'errorAdding', 'Failed to add item to cart'),
        'error'
      );
      return;
    }

    setActiveFullCart(result.data.cart);
    setAddedCartItem(resolveAddedItem(result.data.cart, result.data.item || null));

    if (props.showModal) {
      setModalVisible(true);
    } else {
      showToast(`${getLocalizedValue((props.product as Product)?.names, props.language as string, 'Product')} ${getLabel(props.labels, 'addedToCart', 'added to cart')}`, 'success');
    }
  }

  return (
    <div
      className={cn(`propeller-add-to-cart ${props.className || ''}`)}
      data-loading={loading ? 'true' : 'false'}
    >
      <div className="propeller-add-to-cart__controls flex flex-wrap items-center gap-2 w-full md:flex-nowrap">
        {props.allowIncrDecr !== false ? (
          <div className="propeller-add-to-cart__stepper flex items-center border border-input rounded-control bg-card h-10 w-full md:w-auto">
            <button
              type="button"
              className="propeller-add-to-cart__decrement px-3 h-full text-muted-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-l-control select-none"
              onClick={() => decrement()}
              disabled={quantity <= getMinQuantity(props.product) || loading}
            >
              {' '}
              -{' '}
            </button>
            <input
              type="number"
              className="propeller-add-to-cart__quantity flex-1 md:flex-none md:w-12 text-center text-sm bg-transparent border-none focus:ring-0 focus:outline-none h-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min={getMinQuantity(props.product)}
              step={getStep(props.product)}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                const min = getMinQuantity(props.product);
                const step = getStep(props.product);
                if (!isNaN(val) && val >= min) {
                  setQuantity(Math.round((val - min) / step) * step + min);
                }
              }}
            />
            <button
              type="button"
              className="propeller-add-to-cart__increment px-3 h-full text-muted-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-r-control select-none"
              onClick={() => increment()}
              disabled={loading}
            >
              {' '}
              +{' '}
            </button>
          </div>
        ) : null}
        {props.allowIncrDecr === false ? (
          <input
            type="number"
            className="propeller-add-to-cart__quantity w-full md:w-16 h-10 text-center text-sm border border-input rounded-control focus:ring-2 focus:ring-secondary focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            min={getMinQuantity(props.product)}
            step={getStep(props.product)}
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              const min = getMinQuantity(props.product);
              const step = getStep(props.product);
              if (!isNaN(val) && val >= min) {
                setQuantity(Math.round((val - min) / step) * step + min);
              }
            }}
          />
        ) : null}
        <button
          type="button"
          className="propeller-add-to-cart__submit flex-1 min-w-0 basis-full md:basis-auto inline-flex justify-center items-center gap-2 h-10 px-3 sm:px-6 border border-transparent text-sm font-medium rounded-control text-secondary-foreground bg-secondary hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          onClick={() => handleAddToCart()}
          disabled={loading}
        >
          <svg
            className="propeller-add-to-cart__icon w-[1.1em] h-[1.1em] flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="8" cy="21" r="1" />
            <circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
          </svg>
          <span className="propeller-add-to-cart__submit-label min-w-0 truncate">
            {loading
              ? getLabel(props.labels, 'adding', 'Adding...')
              : getLabel(props.labels, 'add', 'Add')}
          </span>
        </button>
      </div>
      {toastVisible ? (
        <div
          className={`propeller-add-to-cart__toast fixed top-4 right-4 z-50 flex items-start gap-3 w-80 rounded-container shadow-lg p-4 ${toastType === 'success' ? 'bg-success border border-success text-success-foreground' : 'bg-destructive border border-destructive text-destructive-foreground'}`}
          data-toast-type={toastType}
        >
          <div
            className={`propeller-add-to-cart__toast-icon flex-shrink-0 w-5 h-5 mt-0.5 ${toastType === 'success' ? 'text-success-foreground' : 'text-destructive-foreground'}`}
          >
            {toastType === 'success' ? (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
            {toastType === 'error' ? (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            ) : null}
          </div>
          <p
            className={`propeller-add-to-cart__toast-message flex-1 text-sm font-medium ${toastType === 'success' ? 'text-success-foreground' : 'text-destructive-foreground'}`}
          >
            {toastMessage}
          </p>
          <button
            type="button"
            onClick={() => dismissToast()}
            className={`propeller-add-to-cart__toast-close flex-shrink-0 rounded focus:outline-none ${toastType === 'success' ? 'text-success-foreground hover:text-success-foreground/80' : 'text-destructive-foreground hover:text-destructive-foreground/80'}`}
          >
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-4 w-4"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}
      {modalVisible ? (
        <div className="propeller-add-to-cart__modal fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="propeller-add-to-cart__modal-backdrop fixed inset-0 bg-foreground/20"
            onClick={() => closeModal()}
          />
          <div className="propeller-add-to-cart__modal-content relative w-full max-w-lg bg-card rounded-container shadow-2xl overflow-hidden">
            <div className="propeller-add-to-cart__modal-header flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
              <svg
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                className="propeller-add-to-cart__modal-success-icon h-5 w-5 flex-shrink-0 text-success"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <h3 className="propeller-add-to-cart__modal-title flex-1 text-base font-semibold text-foreground">
                {getLabel(props.labels, 'modalTitle', 'Added to cart')}
              </h3>
              <button
                type="button"
                className="propeller-add-to-cart__modal-close flex-shrink-0 text-foreground-subtle hover:text-foreground focus:outline-none"
                onClick={() => closeModal()}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  className="h-5 w-5"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="propeller-add-to-cart__modal-body px-6 py-5">
              <div className="propeller-add-to-cart__modal-product flex items-start gap-4">
                {!!getModalImageUrl() ? (
                  <img
                    className="propeller-add-to-cart__modal-image w-16 h-16 object-contain rounded border border-border-subtle flex-shrink-0"
                    src={getModalImageUrl()}
                    alt={getModalName()}
                  />
                ) : null}
                {!getModalImageUrl() ? (
                  <div className="propeller-add-to-cart__modal-image-placeholder w-16 h-16 flex items-center justify-center rounded border border-border-subtle flex-shrink-0 bg-surface-hover">
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      className="w-8 h-8 text-foreground-subtle"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                      />
                    </svg>
                  </div>
                ) : null}
                <div className="flex-1 min-w-0">
                  <a
                    className="propeller-add-to-cart__modal-product-title text-sm font-medium text-secondary leading-tight hover:underline line-clamp-2"
                    href={getProductUrl()}
                  >
                    {getModalName()}
                  </a>
                  {!!getModalSku() ? (
                    <p className="propeller-add-to-cart__modal-sku text-xs text-foreground-subtle mt-0.5">SKU: {getModalSku()}</p>
                  ) : null}
                  {getModalSurcharges().length > 0 ? (
                    <div className="propeller-add-to-cart__modal-surcharges mt-1 text-xs text-muted-foreground">
                      <span className="font-medium">{getLabel(props.labels, 'surcharges', 'Additional surcharges:')}</span>
                      <ul className="propeller-add-to-cart__modal-surcharges-list mt-0.5">
                        {getModalSurcharges().map((line, idx) => (
                          <li key={idx} className="propeller-add-to-cart__modal-surcharge">{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="propeller-add-to-cart__modal-quantity text-xs text-muted-foreground">
                    {getLabel(props.labels, 'quantity', 'Quantity')}: {quantity}
                  </p>
                  {/*
                   * Extension API — modal price slot.
                   * Direct prop access (no useResolvedProps/RESOLVE_SPEC
                   * cascade) because AddToCart does not otherwise wire the
                   * resolver; adding the full resolver indirection for two
                   * slots would be extra work outside the task. Without
                   * `priceComponent`, the rendering is byte-identical to the
                   * pre-change inline `getModalPrice()` text.
                   */}
                  {(() => {
                    const PriceImpl = props.priceComponent;
                    if (PriceImpl) {
                      return (
                        <PriceImpl
                          price={addedCartItem?.product?.price ?? props.product.price}
                          includeTax={props.includeTax}
                          currency={props.currency}
                          labels={props.labels}
                        />
                      );
                    }
                    return !!getModalPrice() ? (
                      <p className="propeller-add-to-cart__modal-price text-sm font-semibold text-foreground mt-0.5">{getModalPrice()}</p>
                    ) : null;
                  })()}
                </div>
              </div>
              {getChildItems().length > 0 ? (
                <div className="propeller-add-to-cart__modal-children mt-3 ml-20 space-y-1 border-l-2 border-border-subtle pl-2">
                  {getChildItems()?.map((child, idx) => (
                    <div
                      className="propeller-add-to-cart__modal-child flex justify-between items-center text-xs text-muted-foreground"
                      key={idx}
                    >
                      <span className="line-clamp-1">
                        {getLocalizedValue(child.product?.names, props.language as string, 'Option')}
                      </span>
                      <span className="text-foreground-subtle whitespace-nowrap ml-2">
                        {formatPrice(
                          ((props.includeTax !== undefined ? !!props.includeTax : includeTax)
                            ? child.totalSumNet
                            : child.totalSum) ?? 0,
                          { symbol: props.currency ?? '\u20AC' }
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="propeller-add-to-cart__modal-actions flex gap-3 px-6 py-4 border-t border-border-subtle">
              <button
                type="button"
                className="propeller-add-to-cart__modal-continue flex-1 inline-flex justify-center rounded-control border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
                onClick={() => closeModal()}
              >
                {getLabel(props.labels, 'continueShopping', 'Continue shopping')}
              </button>
              {checkoutAllowed && props.onRequestQuoteClick && props.user && 'contactId' in props.user ? (
                <button
                  type="button"
                  className="propeller-add-to-cart__modal-quote flex-1 inline-flex justify-center rounded-control border border-secondary bg-card px-4 py-2 text-sm font-medium text-secondary hover:bg-secondary/5 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
                  onClick={() => {
                    closeModal();
                    if (cart) props.onRequestQuoteClick!(cart);
                  }}
                >
                  {getLabel(props.labels, 'requestQuoteButton', 'Request a Quote')}
                </button>
              ) : null}
              {checkoutAllowed ? (
                <button
                  type="button"
                  className="propeller-add-to-cart__modal-checkout flex-1 inline-flex justify-center rounded-control border border-transparent bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
                  onClick={() => {
                    closeModal();
                    if (props.onProceedToCheckout) props.onProceedToCheckout();
                  }}
                >
                  {getLabel(props.labels, 'proceedToCheckout', 'Proceed to checkout')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
// Memoized: rendered inside the memoized ProductCard; ProductCard now passes
// stable (context-resolved) props so shallow-equal props skip re-render and
// avoid a redundant useCart pass (rbp §5.2).
export default React.memo(AddToCart);
