'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { Cart, CartCarrier } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';

import { pickPreselected } from '../composables/shared/utils/preselect';

export interface CartCarriersProps {
  /** Shopping cart object from which the carriers will be displayed */
  cart: Cart;

  /** The CSS class for the carriers container */
  carriersContainerClass?: string;

  /** Display the carrier logo */
  showCarrierLogo?: boolean;

  /** Action when a carrier is selected */
  onCarrierSelect?: (carrier: CartCarrier) => void;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Show carrier price (default: true) */
  showPrice?: boolean;

  /** Currency symbol for prices. Defaults to '€'. */
  currency?: string;

  /** Labels for the component */
  labels?: Record<string, string>;
}
/**
 * Renders the cart's available delivery carriers as a selectable grid,
 * showing each carrier's logo, price and delivery deadline.
 */
function CartCarriers(props: CartCarriersProps) {
  const [selectedName, setSelectedName] = useState('');
  const containerClass = props.carriersContainerClass || 'cart-carriers';
  const showLogo = props.showCarrierLogo !== false;
  const carriers: CartCarrier[] = props.cart?.carriers || [];
  function formatCarrierPrice(price: number): string {
    if (props.formatPrice) return props.formatPrice(price);
    return formatPrice(price || 0, { symbol: props.currency ?? '\u20AC' });
  }
  function handleSelect(carrier: CartCarrier): void {
    setSelectedName(carrier.name);
    if (props.onCarrierSelect) props.onCarrierSelect(carrier);
  }
  // Something is always selected — the cart's stored carrier, else the first
  // one offered, so the user can hit Continue without a click.
  // Derived rather than effect state so the selection is there in the FIRST
  // render (including SSR) instead of flashing in after hydration; the cart
  // itself may be undefined on mount and arrive later.
  const preselected = pickPreselected(
    carriers,
    props.cart?.postageData?.carrier as string | undefined,
    (c: CartCarrier) => c.name,
  );
  const activeName = selectedName || preselected?.name || '';
  // Report that preselection upwards once. Depending only on the resolved name
  // keeps a host that passes an inline callback from re-firing this every
  // render; a user pick sets `selectedName` and takes over from here.
  useEffect(() => {
    if (selectedName || !preselected) return;
    if (props.onCarrierSelect) props.onCarrierSelect(preselected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected?.name]);
  return (
    <div className={`propeller-cart-carriers ${containerClass}`}>
      {carriers.length > 0 ? (
        <div className="propeller-cart-carriers__grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {carriers.map((carrier, index) => {
            const logoUrl = showLogo ? (carrier.logo || '') : '';
            return (
              <div
                key={`${carrier.name}-${index}`}
                onClick={() => handleSelect(carrier)}
                data-selected={activeName === carrier.name ? 'true' : 'false'}
                className={`propeller-cart-carriers__carrier relative cursor-pointer border rounded-container p-3 flex flex-col items-center justify-center gap-2 text-center aspect-square transition-all ${activeName === carrier.name ? 'border-secondary bg-secondary/5 shadow-sm' : 'border-border hover:border-secondary/30'}`}
              >
                {props.showPrice !== false ? (
                  <span className="propeller-cart-carriers__carrier-price absolute top-2 right-2 text-xs bg-surface-hover text-muted-foreground px-2 py-0.5 rounded-full">
                    {formatCarrierPrice(carrier.price)}
                  </span>
                ) : null}
                {logoUrl ? (
                  <span className="propeller-cart-carriers__carrier-logo-wrap flex items-center justify-center h-10 w-full">
                    <img className="propeller-cart-carriers__carrier-logo max-h-10 max-w-[80%] w-auto object-contain" src={logoUrl} alt={carrier.name} />
                  </span>
                ) : null}
                <span className="propeller-cart-carriers__carrier-name font-medium text-sm">{carrier.name}</span>
                {carrier.deliveryDeadline ? (
                  <p className="propeller-cart-carriers__carrier-deadline text-xs text-muted-foreground">
                    {getLabel(props.labels, 'deliveryDeadline', 'Delivery deadline:')}
                    {carrier.deliveryDeadline}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {carriers.length === 0 ? (
        <p className="propeller-cart-carriers__empty text-muted-foreground italic">{getLabel(props.labels, 'noCarriers', 'No carriers available.')}</p>
      ) : null}
    </div>
  );
}

export default CartCarriers;
