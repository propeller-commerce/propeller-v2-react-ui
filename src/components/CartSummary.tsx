'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import { Cart, Contact, Customer, GraphQLClient, PurchaseRole } from '@propeller-commerce/propeller-sdk-v2';
import { useCart } from '../composables/react/useCart';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface CartSummaryProps {
  /**
   * Storefront language ('EN', 'NL', …). Decides the number format prices are
   * rendered in — without it they fall back to Dutch separators regardless of
   * the language the shopper is reading. Resolved from `<PropellerProvider>` when omitted.
   */
  language?: string;

  /** The shopping cart used to populate the cart summary data */
  cart: Cart;

  /** Cart summary block title */
  title?: string;

  /** Extra classes for the panel root, merged over the defaults via tailwind-merge. */
  className?: string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Display the subtotal of the shopping cart. Defaults to `true`. */
  showSubtotal?: boolean;

  /** Display the total discount of the shopping cart. Defaults to `true`. */
  showDiscount?: boolean;

  /** Display the shipping costs of the shopping cart. Defaults to `true`. */
  showShippingCosts?: boolean;

  /** Display all VAT lines of the shopping cart. Defaults to `true`. */
  showVATs?: boolean;

  /** Display the total of the shopping cart excluding VAT. Defaults to `true`. */
  showTotalExclVat?: boolean;

  /** Display the total VAT of the shopping cart. Defaults to `true`. */
  showTotalVat?: boolean;

  /** Display the checkout button. Defaults to `true`. */
  showCheckoutButton?: boolean;

  /** Action handler when the checkout button is clicked */
  onCheckoutButtonClick?: (cart: Cart) => void;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Currency symbol for prices. Resolved from PropellerProvider when omitted; defaults to '€'. */
  currency?: string;

  /** GraphQL client — required for the default requestPurchaseAuthorization handler */
  graphqlClient?: GraphQLClient;

  /** Logged-in user — used to determine purchaser role and authorization limit */
  user?: Contact | Customer;

  /** Active company ID — used to look up the user's PAC for this company */ companyId?: number;
  /**  * Override the default CartService.requestPurchaseAuthorization() call.  * Note: when this override is used, afterRequestAuthorization receives the original cart.  */ onRequestAuthorization?: (
    cart: Cart
  ) => void;
  /** Fires after authorization request is sent; receives the updated cart */ afterRequestAuthorization?: (
    cart: Cart
  ) => void;
  /** Called when requestPurchaseAuthorization fails; receives the error */ onError?: (
    err: Error
  ) => void;
  /** Callback fired when "Request a Quote" is clicked. Only shown for contacts when prop is provided. */
  onRequestQuoteClick?: (cart: Cart) => void;
}

/**
 * Order totals panel: lists subtotal, discount, shipping, VAT lines and grand
 * total, with a checkout button (or a request-authorization button when the
 * cart exceeds the user's purchase-authorization limit).
 *
 * @remarks Uses {@link useCart} for the purchase-authorization request.
 */
function CartSummary(rawProps: CartSummaryProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  // --- composable ---
  // Note: useCart's `checkoutAllowed` is intentionally NOT used here. That
  // composable has its own internal cart ref that stays null when the consumer
  // (this component) doesn't call addItem/resolveCart, which would falsely
  // report "checkout allowed" for users over their authorization limit.
  // showRequestAuthorizationButton below computes against props.cart directly,
  // matching CartIconAndSidebar's pattern so the cart page and the header
  // sidebar always agree.
  const { requestAuthorization } = useCart({
    graphqlClient: props.graphqlClient!,
    user: props.user ?? null,
    cartId: props.cart?.cartId,
    companyId: props.companyId,
  });

  // --- local UI state ---
  const [requestLoading, setRequestLoading] = useState<boolean>(() => false);

  // --- display helpers ---
  function title(): string {
    return props.title || getLabel(props.labels, 'title', 'Order summary');
  }
  function showSubtotal(): boolean {
    return props.showSubtotal !== undefined ? props.showSubtotal : true;
  }
  function showDiscount(): boolean {
    return props.showDiscount !== undefined ? props.showDiscount : true;
  }
  function showShippingCosts(): boolean {
    return props.showShippingCosts !== undefined ? props.showShippingCosts : true;
  }
  function showVATs(): boolean {
    return props.showVATs !== undefined ? props.showVATs : true;
  }
  function showTotalExclVat(): boolean {
    return props.showTotalExclVat !== undefined ? props.showTotalExclVat : true;
  }
  function showTotalVat(): boolean {
    return props.showTotalVat !== undefined ? props.showTotalVat : true;
  }
  function showCheckoutButton(): boolean {
    return props.showCheckoutButton !== undefined ? props.showCheckoutButton : true;
  }
  
  function formatItemPrice(price: number): string {
    if (props.formatPrice) {
      return props.formatPrice(price);
    }
    return formatPrice(price || 0, { symbol: props.currency ?? '\u20AC', locale: localeForLanguage(props.language) });
  }
  function subtotal(): number {
    return props.cart?.total?.subTotal || 0;
  }
  function hasDiscount(): boolean {
    const total = props.cart?.total;
    return (total?.discount || 0) > 0;
  }
  function discountAmount(): number {
    return props.cart?.total?.discount || 0;
  }
  // Transaction costs are already inside total.totalGross, so without this line
  // the panel's own rows never add up to "Total excl. VAT". Mirrors
  // the transaction-costs row OrderTotals has always rendered.
  function hasTransactionCosts(): boolean {
    return (props.cart?.paymentData?.price || 0) > 0;
  }
  function transactionCosts(): number {
    return Number(props.cart?.paymentData?.price || 0);
  }
  function hasShippingCosts(): boolean {
    return (props.cart?.postageData?.price || 0) > 0;
  }
  function shippingCosts(): number {
    return Number(props.cart?.postageData?.price || 0);
  }
  function totalExclVat(): number {
    return props.cart?.total?.totalGross || 0;
  }
  function taxLevels(): NonNullable<Cart['taxLevels']> {
    const levels = props.cart?.taxLevels || [];
    return levels.filter((t) => t.taxPercentage > 0 && t.price > 0);
  }
  function totalVat(): number {
    const net = props.cart?.total?.totalNet || 0;
    const gross = props.cart?.total?.totalGross || 0;
    return net - gross;
  }
  function totalInclVat(): number {
    return props.cart?.total?.totalNet || 0;
  }
  function handleCheckoutClick(): void {
    if (props.onCheckoutButtonClick) {
      props.onCheckoutButtonClick(props.cart);
    }
  }
  function showRequestAuthorizationButton(): boolean {
    if (!props.user || !('contactId' in props.user)) return false;
    if (!props.companyId) return false;
    if (!props.cart) return false;
    // user has been through toPlain() in AuthContext, so SDK field names are canonical.
    const items = props.user.purchaseAuthorizationConfigs?.items ?? [];
    const purchaserPAC = items.find(
      (pac) => pac.purchaseRole === PurchaseRole.PURCHASER
        && Number(pac.company?.companyId) === Number(props.companyId)
    );
    if (!purchaserPAC) return false;
    const limit = purchaserPAC.authorizationLimit ?? 0;
    const totalGross = props.cart.total?.totalGross ?? 0;
    return totalGross > limit;
  }

  function showRequestQuoteButton(): boolean {
    return !!props.onRequestQuoteClick && !!props.user && 'contactId' in props.user;
  }

  async function handleRequestAuthorizationClick(): Promise<void> {
    setRequestLoading(true);
    try {
      if (props.onRequestAuthorization) {
        props.onRequestAuthorization(props.cart);
        props.afterRequestAuthorization?.(props.cart);
      } else {
        const result = await requestAuthorization();
        if (!result.ok) throw new Error(result.error || 'Failed to request authorization');
        props.afterRequestAuthorization?.(props.cart);
      }
    } catch (err: any) {
      if (props.onError) {
        props.onError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setRequestLoading(false);
    }
  }

  return (
    <div
      className={cn(
        // Padding, radius and shadow to match ActionCode, which sits directly
        // under this panel on the cart page. Without them the summary painted
        // a card background with its text against the edges and a full-bleed
        // checkout button — the same column, two different card treatments.
        'propeller-cart-summary w-full bg-card p-6 rounded-container shadow space-y-3',
        props.className
      )}
    >
      <h2 className="propeller-cart-summary__title text-xl font-bold mb-4">{title()}</h2>
      {showSubtotal() ? (
        <div className="propeller-cart-summary__row flex justify-between text-muted-foreground" data-row="subtotal">
          <span className="propeller-cart-summary__label">{getLabel(props.labels, 'subtotal', 'Subtotal:')}</span>
          <span className="propeller-cart-summary__value">{formatItemPrice(subtotal())}</span>
        </div>
      ) : null}
      {showDiscount() && hasDiscount() ? (
        <div className="propeller-cart-summary__row flex justify-between text-success" data-row="discount">
          <span className="propeller-cart-summary__label">{getLabel(props.labels, 'discount', 'Discount:')}</span>
          <span className="propeller-cart-summary__value">-{formatItemPrice(discountAmount())}</span>
        </div>
      ) : null}
      {hasTransactionCosts() ? (
        <div className="propeller-cart-summary__row flex justify-between text-muted-foreground" data-row="transaction-costs">
          <span className="propeller-cart-summary__label">{getLabel(props.labels, 'transactionCosts', 'Transaction costs:')}</span>
          <span className="propeller-cart-summary__value">{formatItemPrice(transactionCosts())}</span>
        </div>
      ) : null}
      {showShippingCosts() && hasShippingCosts() ? (
        <div className="propeller-cart-summary__row flex justify-between text-muted-foreground" data-row="shipping-costs">
          <span className="propeller-cart-summary__label">{getLabel(props.labels, 'shippingCosts', 'Shipping costs:')}</span>
          <span className="propeller-cart-summary__value">{formatItemPrice(shippingCosts())}</span>
        </div>
      ) : null}
      {showTotalExclVat() ? (
        <div className="propeller-cart-summary__row flex justify-between text-muted-foreground pt-2 border-t" data-row="total-excl-vat">
          <span className="propeller-cart-summary__label">{getLabel(props.labels, 'totalExclVat', 'Total excl. VAT:')}</span>
          <span className="propeller-cart-summary__value">{formatItemPrice(totalExclVat())}</span>
        </div>
      ) : null}
      {showVATs() && taxLevels().length > 0 ? (
        <>
          {taxLevels()?.map((tax, index) => (
            <div className="propeller-cart-summary__row flex justify-between text-muted-foreground text-sm" key={index} data-row="vat-line">
              <span className="propeller-cart-summary__label">
                {tax.taxPercentage}% {getLabel(props.labels, 'vat', 'VAT')}:
              </span>
              <span className="propeller-cart-summary__value">{formatItemPrice(Number(tax.price))}</span>
            </div>
          ))}
        </>
      ) : null}
      {showTotalVat() && totalVat() > 0 ? (
        <div className="propeller-cart-summary__row flex justify-between text-muted-foreground text-sm" data-row="total-vat">
          <span className="propeller-cart-summary__label">{getLabel(props.labels, 'totalVat', 'Total VAT:')}</span>
          <span className="propeller-cart-summary__value">{formatItemPrice(totalVat())}</span>
        </div>
      ) : null}
      <div className="propeller-cart-summary__row propeller-cart-summary__row--total flex justify-between text-xl font-bold pt-4 border-t text-foreground mt-2" data-row="total">
        <span className="propeller-cart-summary__label">{getLabel(props.labels, 'total', 'Total:')}</span>
        <span className="propeller-cart-summary__value">{formatItemPrice(totalInclVat())}</span>
      </div>
      {showCheckoutButton() && !showRequestAuthorizationButton() ? (
        <>
          <button
            type="button"
            className="propeller-cart-summary__checkout-btn block w-full bg-secondary text-secondary-foreground text-center py-3 rounded-container hover:bg-secondary/90 transition font-semibold mt-4"
            onClick={(event) => handleCheckoutClick()}
          >
            {getLabel(props.labels, 'checkoutButton', 'Continue to Checkout')}
          </button>{' '}
          {!!props.onRequestQuoteClick && showRequestQuoteButton() ? (
            <button
              type="button"
              className="propeller-cart-summary__quote-btn block w-full bg-card border border-secondary text-secondary text-center py-3 rounded-container hover:bg-secondary/5 transition font-semibold mt-2"
              onClick={(event) =>
                props.onRequestQuoteClick && props.onRequestQuoteClick(props.cart)
              }
            >
              {getLabel(props.labels, 'requestQuoteButton', 'Request a Quote')}
            </button>
          ) : null}
        </>
      ) : null}
      {showRequestAuthorizationButton() ? (
        <button
          type="button"
          className="propeller-cart-summary__authorization-btn block w-full bg-secondary text-secondary-foreground text-center py-3 rounded-container hover:bg-secondary/90 transition font-semibold mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={(event) => handleRequestAuthorizationClick()}
          disabled={requestLoading}
        >
          {requestLoading ? <>{getLabel(props.labels, 'requestingAuthorization', 'Requesting...')}</> : null}
          {!requestLoading ? (
            <>{getLabel(props.labels, 'requestAuthorizationButton', 'Request Authorization')}</>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
export default CartSummary;
