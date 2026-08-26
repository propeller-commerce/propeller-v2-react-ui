'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { Cart, CartMainItem, Contact, Customer, GraphQLClient, PurchaseAuthorizationConfig, PurchaseRole } from '@propeller-commerce/propeller-sdk-v2';
import { useCart } from '../composables/react/useCart';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';
import DefaultCartBonusItemsImpl from './CartBonusItems';
import CartItem from './CartItem';
import { cn } from '../composables/shared/utils/cn';

export interface CartIconAndSidebarProps {
  /**
   * Shopping cart that this component will operate with.
   * Should be passed from a cart state.
   */
  cart: Cart;

  /**
   * Icon for the cart icon in header.
   * @default 'default-cart-icon'
   */
  icon?: string;

  /**
   * Shows item count badge on the cart icon.
   * @default true
   */
  showBadge?: boolean;

  /**
   * Shows the totals of the shopping cart beneath the icon when hovered.
   * @default false
   */
  showTotals?: boolean;

  /**
   * Show cart sidebar at the right side of the screen when cart icon is clicked.
   * If false it will fire onCartIconClick() instead.
   * @default true
   */
  showCartSidebarOnClick?: boolean;

  /**
   * Fires a click event when showCartSidebarOnClick is set to false.
   */
  onCartIconClick?: (cart: Cart) => void;

  /**
   * Title for the shopping cart sidebar.
   * @default 'Shopping cart'
   */
  cartSidebarTitle?: string;

  /**
   * Show checkout button in cart sidebar for immediate checkout.
   * @default true
   */
  cartCheckoutButton?: boolean;

  /**
   * Fires a click event when the checkout button in the sidebar is clicked.
   */
  onCheckoutButtonClick?: (cart: Cart) => void;

  /**
   * Show shopping cart page button in cart sidebar.
   * @default true
   */
  cartPageButton?: boolean;

  /**
   * Fires a click event when the shopping cart button in the sidebar is clicked.
   */
  onCartPageButtonClick?: (cart: Cart) => void;

  /**
   * Labels for the component.
   * Available keys: cartIconLabel, totalLabel, itemsLabel, emptyCart,
   * continueShopping, qty, total, totalExclVat, checkoutButton, cartPageButton,
   * closeLabel
   */
  labels?: Record<string, string>;

  /**
   * Labels forwarded to the inner CartItem rows (e.g. `qtyPrefix`). Without
   * this the sidebar's line items fell back to English ("Qty:") even on a
   * localized page. Keys match CartItem's label map.
   */
  cartItemLabels?: Record<string, string>;

  /** Labels for the bonus-items block. Keys: `title`, `sku`. */
  cartBonusItemsLabels?: Record<string, string>;

  /** Logged-in user — used to determine purchaser role and authorization limit */
  user?: Contact | Customer;

  /** Configuration object passed to the component */
  configuration?: any;

  /** Language code passed to CartService operations. Defaults to 'en'. */
  language?: string;

  /** Active company ID — used to look up the user's PAC for this company */
  companyId?: number;

  /** Callback fired when "Request a Quote" is clicked in the sidebar. Only shown for contacts when prop is provided. */
  onRequestQuoteClick?: (cart: Cart) => void;

  /** GraphQL client — used for internal CartService calls (e.g. purchase authorization) */
  graphqlClient?: GraphQLClient;

  /** Override the internal request purchase authorization call */
  onRequestAuthorization?: (cart: Cart) => void;

  /** Fires after a successful purchase authorization request with the updated cart */
  afterRequestAuthorization?: (cart: Cart) => void;

  /** Error handler for authorization request failures */
  onError?: (error: Error) => void;

  /**  * Additional class name for the shopping cart icon.  */
  iconClassName?: string;

  /**  * Additional class name for the shopping cart sidebar.  */
  sidebarClassName?: string;

  // ───── Extension API ─────
  /**
   * Replaces each cart row rendered inside the drawer with a custom CartItem.
   * The drawer composes CartItem with cardFrame=false, showDelete=false,
   * readOnlyQuantity, and onTitleClick wired to close the sidebar — any
   * consumer-supplied replacement receives these variant props plus the
   * cart data.
   */
  cartItemComponent?: React.ComponentType<import('./CartItem').CartItemProps>;
  // Replaces the embedded <CartBonusItems> bonus-line block. Active.
  cartBonusItemsComponent?: React.ComponentType<import('./CartBonusItems').CartBonusItemsProps>;
}

// ── Pure helpers (module scope — created once, not per render) ──────────────────

/** Finds the user's PURCHASER PAC for the active company (shared by both
 *  checkout / request-authorization button decisions). */
function findPurchaserPAC(
  user: Contact | Customer | undefined,
  companyId: number | undefined
): PurchaseAuthorizationConfig | undefined {
  if (!user || !('contactId' in user) || !companyId) return undefined;
  const items: PurchaseAuthorizationConfig[] =
    (user as Contact).purchaseAuthorizationConfigs?.items ?? [];
  return items.find(
    (pac) => pac.purchaseRole === PurchaseRole.PURCHASER && pac.company?.companyId === companyId
  );
}

/**
 * Header cart control: a cart icon with an item-count badge and optional
 * hover totals, plus a slide-in sidebar listing cart items with checkout,
 * view-cart, request-quote and purchase-authorization actions.
 *
 * @remarks Uses {@link useCart} for the purchase-authorization request.
 */
function CartIconAndSidebar(rawProps: CartIconAndSidebarProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  // Slot resolution: explicit prop > default.
  const CartBonusItemsImpl = props.cartBonusItemsComponent ?? DefaultCartBonusItemsImpl;
  const CartItemImpl = props.cartItemComponent ?? CartItem;
  const currencySymbol = props.currency ?? '€';
  const money = (value: number | null | undefined): string =>
    value === undefined || value === null ? '' : formatPrice(value, { symbol: currencySymbol, locale: localeForLanguage(props.language) });
  // --- composable ---
  const { requestAuthorization } = useCart({
    graphqlClient: props.graphqlClient!,
    user: props.user ?? null,
    cartId: props.cart?.cartId,
    companyId: props.companyId,
  });

  const [isMounted, setIsMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);

  // Cart-derived values — computed once per render (previously getItems() /
  // getTotalItems() were redefined every render and each called ~6× in the JSX,
  // re-filtering / re-summing the cart on every read).
  const items = (props.cart?.items ?? []).filter(
    (item: CartMainItem) => item && item.product
  );
  const totalItems = (props.cart?.items ?? []).reduce(
    (sum: number, item: CartMainItem) => sum + item.quantity,
    0
  );
  // Single source of truth for the tax basis so the line items, the grand
  // total, and the bonus items all agree AND follow the Incl./Excl. BTW toggle.
  // Previously the lines were pinned excl. (includeTax={false}) while the total
  // read totalNet (incl.) — they never reconciled, and neither responded to the
  // toggle. SDK mapping: net = incl. VAT, gross = excl. VAT. Resolved from
  // <PropellerProvider> via useInfraProps; defaults to excl. (false).
  const useTax = !!props.includeTax;
  const totalRaw = useTax ? props.cart?.total?.totalNet : props.cart?.total?.totalGross;
  const totalPrice = totalRaw === undefined || totalRaw === null ? money(0) : money(totalRaw);
  // The figure follows the toggle, so the label has to as well. In excl. mode
  // this is the cart page's "Total excl. VAT", not its "Total" — an unqualified
  // "Total" here named a number that was one VAT amount below what the shopper
  // is charged, and the mini-cart is the figure they see first.
  function totalLabel(key: string): string {
    return useTax
      ? getLabel(props.labels, key, 'Total')
      : getLabel(props.labels, 'totalExclVat', 'Total excl. VAT');
  }
  const sidebarTitle =
    props.cartSidebarTitle || props.labels?.['cartSidebarTitle'] || 'Shopping cart';

  // Purchase-authorization gate (shared PAC lookup, divergent only on the
  // limit comparison).
  const purchaserPAC = findPurchaserPAC(props.user, props.companyId);
  const totalGross = props.cart?.total?.totalGross ?? 0;
  const overLimit = !!purchaserPAC && totalGross > (purchaserPAC.authorizationLimit ?? 0);

  const showCheckoutButton =
    props.cartCheckoutButton === false
      ? false
      : !props.user || !('contactId' in props.user) || !props.companyId || !purchaserPAC
        ? true
        : !overLimit;
  const showRequestAuthorizationButton = !!purchaserPAC && overLimit;

  function handleIconClick(): void {
    if (props.showCartSidebarOnClick !== false) {
      setSidebarOpen(true);
    } else {
      if (props.onCartIconClick) props.onCartIconClick(props.cart);
    }
  }

  function closeSidebar(): void {
    setSidebarOpen(false);
  }

  function handleCheckoutClick(): void {
    setSidebarOpen(false);
    if (props.onCheckoutButtonClick) props.onCheckoutButtonClick(props.cart);
  }

  function handleCartPageClick(): void {
    setSidebarOpen(false);
    if (props.onCartPageButtonClick) props.onCartPageButtonClick(props.cart);
  }

  async function handleRequestAuthorizationClick(): Promise<void> {
    setRequestLoading(true);
    try {
      let updatedCart: Cart = props.cart;
      if (props.onRequestAuthorization) {
        props.onRequestAuthorization(props.cart);
      } else {
        const result = await requestAuthorization();
        if (!result.ok) throw new Error(result.error || 'Failed to request authorization');
        updatedCart = props.cart;
      }
      if (props.afterRequestAuthorization) {
        props.afterRequestAuthorization(updatedCart);
      }
    } catch (err: unknown) {
      if (props.onError) {
        props.onError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setRequestLoading(false);
    }
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="propeller-cart-icon relative" data-sidebar-open={sidebarOpen ? 'true' : 'false'}>
      <div
        className="propeller-cart-icon__trigger-wrapper relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          type="button"
          onClick={() => handleIconClick()}
          aria-label={getLabel(props.labels, 'cartIconLabel', 'Shopping cart')}
          className={cn(`propeller-cart-icon__trigger relative inline-flex items-center justify-center p-2 rounded-control transition-colors text-foreground${props.iconClassName ? ' ' + props.iconClassName : ''}`)}
        >
          <svg
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            className="propeller-cart-icon__icon w-6 h-6"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
            />
          </svg>
          {isMounted && props.showBadge !== false && totalItems > 0 ? (
            <span className="propeller-cart-icon__badge absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold pointer-events-none">
              {totalItems}
            </span>
          ) : null}
        </button>
        {props.showTotals && isHovered && totalItems > 0 ? (
          <div className="propeller-cart-icon__popover absolute top-full right-0 mt-1 z-40 bg-popover border border-border rounded-container shadow-lg px-3 py-2 min-w-[140px] text-sm whitespace-nowrap">
            <div className="flex justify-between gap-4">
              <span className="propeller-cart-icon__popover-label text-muted-foreground">
                {totalLabel('totalLabel')}
              </span>
              <span className="propeller-cart-icon__popover-total font-semibold text-foreground">
                {totalPrice}
              </span>
            </div>
            <div className="propeller-cart-icon__popover-count text-xs text-foreground-subtle mt-0.5">
              {totalItems}
              {getLabel(props.labels, 'itemsLabel', 'item(s)')}
            </div>
          </div>
        ) : null}
      </div>
      {sidebarOpen ? (
        <div
          aria-hidden="true"
          className="propeller-cart-icon__backdrop fixed inset-0 bg-foreground/80 backdrop-blur-sm z-[70]"
          onClick={() => closeSidebar()}
        />
      ) : null}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={sidebarTitle}
        data-open={sidebarOpen ? 'true' : 'false'}
        className={cn(`propeller-cart-icon__sidebar fixed inset-y-0 right-0 z-[70] w-full max-w-md bg-card shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-border${sidebarOpen ? ' translate-x-0' : ' translate-x-full'}${props.sidebarClassName ? ' ' + props.sidebarClassName : ''}`)}
      >
        <div className="flex flex-col h-full">
          {isMounted ? (
            <>
              <div className="propeller-cart-icon__sidebar-header flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-muted-foreground"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
                    />
                  </svg>
                  <h2 className="propeller-cart-icon__sidebar-title text-base font-semibold text-foreground">
                    {sidebarTitle}
                  </h2>
                  <span className="propeller-cart-icon__sidebar-count inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-secondary/10 text-secondary text-xs font-bold">
                    {totalItems}
                  </span>
                </div>
                <button
                  type="button"
                  className="propeller-cart-icon__sidebar-close p-1 rounded-control text-foreground-subtle hover:text-foreground hover:bg-surface-hover transition-colors"
                  onClick={() => closeSidebar()}
                  aria-label={getLabel(props.labels, 'closeLabel', 'Close')}
                >
                  <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>{' '}
              <div className="propeller-cart-icon__sidebar-body flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {items.length === 0 ? (
                  <div className="propeller-cart-icon__empty flex flex-col items-center justify-center h-full text-center space-y-4 py-16">
                    <svg
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      className="propeller-cart-icon__empty-icon w-12 h-12 text-foreground-subtle"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
                      />
                    </svg>
                    <p className="propeller-cart-icon__empty-message text-sm text-muted-foreground">
                      {getLabel(props.labels, 'emptyCart', 'Your cart is empty.')}
                    </p>
                    <button
                      type="button"
                      className="propeller-cart-icon__empty-action text-sm text-secondary hover:underline"
                      onClick={() => closeSidebar()}
                    >
                      {getLabel(props.labels, 'continueShopping', 'Continue Shopping')}
                    </button>
                  </div>
                ) : (
                  <>
                    {items.map((item) => (
                      <CartItemImpl
                        key={item.itemId}
                        cartItem={item}
                        cartId={props.cart?.cartId ?? ''}
                        graphqlClient={props.graphqlClient}
                        user={props.user}
                        language={props.language}
                        configuration={props.configuration}
                        companyId={props.companyId}
                        labels={props.cartItemLabels}
                        cardFrame={false}
                        showDelete={false}
                        readOnlyQuantity
                        onTitleClick={() => closeSidebar()}
                        showCartItemNotesField={false}
                        showCrossupsells={false}
                        showStockComponent={false}
                        includeTax={useTax}
                        className="propeller-cart-icon__item"
                      >
                        <CartItem.Image className="w-20 h-20 flex-shrink-0 bg-surface-hover rounded-control overflow-hidden border border-border-subtle" />
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                          <div>
                            <CartItem.Title className="propeller-cart-icon__item-name text-sm font-medium hover:text-primary line-clamp-2" />
                            <CartItem.Sku className="text-xs text-foreground-subtle mt-0.5" />
                            <CartItem.BundleItems className="mt-1 border-l-2 border-secondary/10 pl-2 space-y-1" />
                            <CartItem.ChildItems className="mt-1 border-l-2 border-border-subtle pl-2 space-y-1" />
                            <CartItem.Surcharges className="mt-1 text-xs text-foreground-subtle" />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <CartItem.Quantity />
                            <CartItem.Price className="font-semibold" />
                          </div>
                        </div>
                      </CartItemImpl>
                    ))}
                  </>
                )}
                {/* Bonus items — free items added via incentives. Read-only.
                    `includeTax` follows the toggle (via useTax) so bonus lines
                    share the same basis as the item lines and the total;
                    currency/language resolve from the PropellerProvider. */}
                <CartBonusItemsImpl
                  cart={props.cart}
                  includeTax={useTax}
                  className="mt-4"
                  labels={props.cartBonusItemsLabels}
                />
              </div>{' '}
              {items.length > 0 ? (
                <div className="propeller-cart-icon__sidebar-footer px-5 py-4 border-t border-border space-y-3 bg-surface-hover">
                  <div className="propeller-cart-icon__total-row flex justify-between items-center">
                    <span className="propeller-cart-icon__total-label text-sm font-medium text-muted-foreground">
                      {totalLabel('total')}
                    </span>
                    <span className="propeller-cart-icon__total-value text-base font-bold text-foreground">
                      {totalPrice}
                    </span>
                  </div>
                  {showCheckoutButton && !showRequestAuthorizationButton ? (
                    <button
                      type="button"
                      className="propeller-cart-icon__checkout-btn w-full inline-flex justify-center items-center px-4 py-2.5 rounded-control bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/90 transition-colors"
                      onClick={() => handleCheckoutClick()}
                    >
                      {getLabel(props.labels, 'checkoutButton', 'Checkout')}
                    </button>
                  ) : null}
                  {showRequestAuthorizationButton ? (
                    <button
                      type="button"
                      className="propeller-cart-icon__authorization-btn w-full inline-flex justify-center items-center px-4 py-2.5 rounded-control bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleRequestAuthorizationClick()}
                      disabled={requestLoading}
                    >
                      {requestLoading
                        ? getLabel(props.labels, 'requestingAuthorization', 'Requesting...')
                        : getLabel(
                            props.labels,
                            'requestAuthorizationButton',
                            'Request Authorization'
                          )}
                    </button>
                  ) : null}
                  {!showRequestAuthorizationButton &&
                  !!props.onRequestQuoteClick &&
                  !!props.user &&
                  'contactId' in props.user ? (
                    <button
                      type="button"
                      className="propeller-cart-icon__quote-btn w-full inline-flex justify-center items-center px-4 py-2.5 rounded-control border border-secondary bg-card text-secondary text-sm font-medium hover:bg-secondary/5 transition-colors"
                      onClick={() => {
                        closeSidebar();
                        if (props.onRequestQuoteClick) props.onRequestQuoteClick(props.cart);
                      }}
                    >
                      {getLabel(props.labels, 'requestQuoteButton', 'Request a Quote')}
                    </button>
                  ) : null}
                  {props.cartPageButton !== false ? (
                    <button
                      type="button"
                      className="propeller-cart-icon__view-cart-btn w-full inline-flex justify-center items-center px-4 py-2.5 rounded-control border border-input bg-card text-foreground text-sm font-medium hover:bg-surface-hover transition-colors"
                      onClick={() => handleCartPageClick()}
                    >
                      {getLabel(props.labels, 'cartPageButton', 'View Cart Details')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
export default CartIconAndSidebar;
