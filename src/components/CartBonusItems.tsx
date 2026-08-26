'use client';
/**
 * @rsc-blocked — Client-only component: imported by client cart surfaces. It
 * holds no state itself, but ships under the `"use client"` package boundary
 * alongside the other cart components. The 'use client' header marks it.
 */
import * as React from 'react';

import { Cart, CartBaseItem } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';
import { getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import { useInfraProps } from '../composables/react/useInfraProps';
import { cn } from '../composables/shared/utils/cn';

export interface CartBonusItemsProps {
  /** Cart whose `bonusItems` (free items added via incentives) are displayed. */
  cart?: Cart | null;

  /** Pre-resolved bonus items. When omitted, `cart.bonusItems` is used. */
  bonusItems?: CartBaseItem[];

  /** When true, the tax-inclusive total (`totalPriceNet`) is shown. Resolved from PropellerProvider when omitted; defaults to false. */
  includeTax?: boolean;

  /** Currency symbol for prices. Resolved from PropellerProvider when omitted; defaults to '€'. */
  currency?: string;

  /** Active language for localized product names. Resolved from PropellerProvider when omitted. */
  language?: string;

  /** Additional CSS class for the root element. */
  className?: string;

  /**
   * Label overrides. Keys: `title` ('Bonus items'), `sku` ('SKU').
   */
  labels?: Record<string, string>;
}

/**
 * Renders a cart's bonus items — free items added through incentives — as a
 * read-only list (image, name, SKU, quantity, total price). No quantity
 * stepper, delete or cross-sells: bonus items aren't directly editable.
 *
 * Renders nothing when there are no bonus items, so it's safe to drop into any
 * cart surface (cart page, sidebar) unconditionally.
 *
 * `currency` / `includeTax` / `language` resolve from `<PropellerProvider>` via
 * `useInfraProps` when not passed explicitly — host surfaces inside the
 * provider don't need to thread them through.
 */
function CartBonusItems(rawProps: CartBonusItemsProps) {
  const props = useInfraProps(rawProps);
  const items: CartBaseItem[] = props.bonusItems ?? props.cart?.bonusItems ?? [];
  if (items.length === 0) return null;

  const currency = props.currency ?? '€';
  const money = (value: number | null | undefined): string =>
    formatPrice(value, { symbol: currency, locale: localeForLanguage(props.language) });
  const productName = (item: CartBaseItem): string =>
    getLocalizedValue(item.product?.names, props.language as string, 'Product');
  const productImage = (item: CartBaseItem): string =>
    item.product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '';

  return (
    <div className={cn(`propeller-cart-bonus-items ${props.className || 'mt-2'}`)}>
      <h2 className="propeller-cart-bonus-items__title text-lg font-semibold mb-3">
        {getLabel(props.labels, 'title', 'Bonus items')}
      </h2>
      <div className="propeller-cart-bonus-items__list space-y-4">
        {items.map((item: CartBaseItem) => {
          const img = productImage(item);
          const name = productName(item);
          const total = props.includeTax ? item.totalPriceNet : item.totalPrice;
          return (
            <div
              key={item.itemId}
              className="propeller-cart-bonus-item flex items-center gap-4 bg-card p-4 rounded-container shadow-sm border border-border"
            >
              <div className="propeller-cart-bonus-item__media w-20 h-20 flex-shrink-0 bg-surface-hover rounded-control overflow-hidden flex items-center justify-center">
                {img ? (
                  <img className="propeller-cart-bonus-item__image w-full h-full object-contain p-1" src={img} alt={name} />
                ) : (
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    className="propeller-cart-bonus-item__image-placeholder w-8 h-8 text-foreground-subtle"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                    />
                  </svg>
                )}
              </div>
              <div className="propeller-cart-bonus-item__body flex-1 min-w-0">
                {item.product?.sku ? (
                  <p className="propeller-cart-bonus-item__sku font-mono text-xs text-foreground-subtle">
                    {getLabel(props.labels, 'sku', 'SKU')}: {item.product.sku}
                  </p>
                ) : null}
                <p className="propeller-cart-bonus-item__title font-semibold text-sm md:text-base text-foreground line-clamp-2">
                  {name}
                </p>
              </div>
              <div className="propeller-cart-bonus-item__qty text-sm text-muted-foreground whitespace-nowrap">
                {item.quantity} &times;
              </div>
              <div className="propeller-cart-bonus-item__price font-semibold text-foreground whitespace-nowrap">
                {money(total)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CartBonusItems;
