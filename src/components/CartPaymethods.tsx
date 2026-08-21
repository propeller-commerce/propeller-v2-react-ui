'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { Cart, CartPaymethod, Contact, Customer } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';

import { useInfraProps } from '../composables/react/useInfraProps';
import { pickPreselected } from '../composables/shared/utils/preselect';

export interface CartPaymethodsProps {
  /** Shopping cart object from which the payment methods will be displayed */
  cart: Cart;

  /** Authenticated user — used for cart creation / lookup. Resolved from `<PropellerProvider>` when not passed explicitly. */
  user?: Contact | Customer | null;

  /** The CSS class for the payment methods container */
  paymentsContainerClass?: string;

  /** Display the on account payment method for anonymous users */
  showOnAccountForGuests?: boolean;

  /** Display the payment method logo (default: true). Falls back to the name when no logo is set. */
  showPaymethodLogo?: boolean;

  /** Action when a payment method is selected */
  onPaymethodSelect?: (paymethod: CartPaymethod) => void;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Currency symbol for prices. Defaults to '€'. */
  currency?: string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /**
   * Localized display names for payment methods, keyed by the method **code**
   * (lower-cased, e.g. `{ pickup: 'Bij afhalen', on_account: 'Op rekening' }`).
   * The backend `method.name` is often an un-localized English string (e.g.
   * "On pickup"), so this map lets the host override it per locale. Lookup
   * order: `paymethodLabels[code]` → `method.name` → `method.code`.
   */
  paymethodLabels?: Record<string, string>;
}
function isOnAccountMethod(method: CartPaymethod): boolean {
  const code = (method.code || '').toLowerCase();
  return code === 'on_account' || code === 'onaccount' || code === 'on-account';
}
// `logo` is declared on CartPaymethod (SDK v0.11.3+); guard with `|| ''` so a
// blank logo just falls back to the method name.
function getLogoUrl(method: CartPaymethod): string {
  return method.logo || '';
}

/**
 * Renders the cart's available payment methods as a selectable grid. Hides the
 * "on account" method for guest users unless `showOnAccountForGuests` is set.
 */
function CartPaymethods(rawProps: CartPaymethodsProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const [selectedCode, setSelectedCode] = useState('');
  const containerClass = props.paymentsContainerClass || 'cart-paymethods';
  const showOnAccountForGuests = !!props.showOnAccountForGuests;
  const showLogo = props.showPaymethodLogo !== false;
  const isGuest = !props.user;
  const payMethods: CartPaymethod[] = (props.cart?.payMethods || []).filter((m: CartPaymethod) => {
    if (!m?.code) return false;
    if (!showOnAccountForGuests && isGuest && isOnAccountMethod(m)) return false;
    return true;
  });
  function formatMethodPrice(price: number): string {
    if (props.formatPrice) return props.formatPrice(price);
    return formatPrice(price || 0, { symbol: props.currency ?? '\u20AC' });
  }
  // Localized display name: host override by code \u2192 backend name \u2192 code.
  function methodName(method: CartPaymethod): string {
    const code = (method.code || '').toLowerCase();
    return props.paymethodLabels?.[code] || method.name || method.code || '';
  }
  function handleSelect(method: CartPaymethod): void {
    setSelectedCode(method.code);
    if (props.onPaymethodSelect) props.onPaymethodSelect(method);
  }
  // Something is always selected — the cart's stored method, else the first
  // one offered, so the user can hit Continue without a click.
  // Derived rather than effect state so the selection is there in the FIRST
  // render (including SSR) instead of flashing in after hydration; the cart
  // itself may be undefined on mount and arrive later.
  const preselected = pickPreselected(
    payMethods,
    props.cart?.paymentData?.method as string | undefined,
    (m: CartPaymethod) => m.code,
  );
  const activeCode = selectedCode || preselected?.code || '';
  // Report that preselection upwards once, so the host persists it and the
  // order summary shows THIS method's transaction costs. The host skips the
  // mutation when the cart already stores it. Depending only on the resolved
  // code keeps a host that passes an inline callback from re-firing this every
  // render; a user pick sets `selectedCode` and takes over from here.
  useEffect(() => {
    if (selectedCode || !preselected) return;
    if (props.onPaymethodSelect) props.onPaymethodSelect(preselected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected?.code]);
  return (
    <div className={`propeller-cart-paymethods ${containerClass}`}>
      {payMethods.length > 0 ? (
        <div className="propeller-cart-paymethods__grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {payMethods.map((method, index) => {
            const logoUrl = showLogo ? getLogoUrl(method) : '';
            return (
              <div
                key={method.code}
                onClick={() => handleSelect(method)}
                data-selected={activeCode === method.code ? 'true' : 'false'}
                className={`propeller-cart-paymethods__method relative cursor-pointer border rounded-container p-3 flex flex-col items-center justify-center gap-2 text-center aspect-square transition-all ${activeCode === method.code ? 'border-secondary bg-secondary/5 shadow-sm' : 'border-border hover:border-secondary/30'}`}
              >
                {method.price > 0 ? (
                  <span className="propeller-cart-paymethods__method-price absolute top-2 right-2 text-xs bg-surface-hover text-muted-foreground px-2 py-0.5 rounded-full">
                    {formatMethodPrice(method.price)}
                  </span>
                ) : null}
                {logoUrl ? (
                  <span className="propeller-cart-paymethods__method-logo-wrap flex items-center justify-center h-10 w-full">
                    <img
                      className="propeller-cart-paymethods__method-logo max-h-10 max-w-[80%] w-auto object-contain"
                      src={logoUrl}
                      alt={methodName(method)}
                    />
                  </span>
                ) : null}
                <span className="propeller-cart-paymethods__method-name font-medium text-sm">{methodName(method)}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      {payMethods.length === 0 ? (
        <p className="propeller-cart-paymethods__empty text-muted-foreground italic">
          {getLabel(props.labels, 'noMethods', 'No payment methods available.')}
        </p>
      ) : null}
    </div>
  );
}

export default CartPaymethods;
