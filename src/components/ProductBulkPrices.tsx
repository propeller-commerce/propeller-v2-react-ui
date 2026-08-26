/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import { ProductPrice, Contact, Customer } from '@propeller-commerce/propeller-sdk-v2';
import type { IDiscount } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import { isContentHidden } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface ProductBulkPricesProps {
  /**
   * Storefront language ('EN', 'NL', …). Decides the number format prices are
   * rendered in — without it they fall back to Dutch separators regardless of
   * the language the shopper is reading.
   */
  language?: string;

  /**
   * Bulk price tiers from the product.
   * Obtain from `product.bulkPrices`.
   */
  bulkPrices: ProductPrice[];

  /**
   * When true, net price (incl. tax) is the leading price.
   * Defaults to false — gross (excl. VAT) is shown.
   * Note: in the Propeller SDK `price.gross` = excl. VAT, `price.net` = incl. VAT.
   */
  includeTax?: boolean;

  /**
   * Controls portal visibility mode.
   * 'semi-closed' — component is hidden for anonymous users.
   * Defaults to 'open'.
   */
  portalMode?: string;

  /** Authenticated user — used for semi-closed visibility. */
  user?: Contact | Customer | null;

  /** Tax zone code. Defaults to 'NL'. */
  taxZone?: string;

  /** Currency symbol for prices. Defaults to '€'. */
  currency?: string;

  /**
   * Override any UI string.
   * Available keys: title, quantityFrom, price, inclTax, exclTax
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
/**
 * Renders a product's volume/quantity-tier pricing as a table, filtering out
 * expired or list-price tiers and showing incl./excl. VAT prices.
 */
function ProductBulkPrices(props: ProductBulkPricesProps) {
  const includeTax = !!props.includeTax;
  const isHidden = isContentHidden(props.portalMode, props.user);
  function getTierQuantity(tier: ProductPrice): number | null {
    const discount = tier.discount as
      | (IDiscount & { quantityFrom?: number })
      | undefined;
    return discount?.quantityFrom ?? tier.quantity ?? null;
  }
  function getBulkPrices(): ProductPrice[] {
    const rawAll = props.bulkPrices || [];
    const all = rawAll.filter((tier) => {
      const t = tier as ProductPrice & {
        type?: string;
        discountType?: string;
      };
      const priceType =
        t.type ??
        (
          t.discount as
            | {
                type?: string;
              }
            | undefined
        )?.type;
      const discountType =
        t.discountType ??
        (
          t.discount as
            | {
                discountType?: string;
              }
            | undefined
        )?.discountType;
      return !(priceType === 'PRICESHEET' && discountType === 'LIST_PRICE_MIN');
    });
    if (all.length === 0) return [];
    const now = new Date();
    const groups = new Map<number, ProductPrice[]>();
    for (const tier of all) {
      const qty = getTierQuantity(tier);
      if (qty === null) continue;
      const list = groups.get(qty) || [];
      list.push(tier);
      groups.set(qty, list);
    }
    const filtered: ProductPrice[] = [];
    for (const [, prices] of groups) {
      const validDated: ProductPrice[] = [];
      const nullDated: ProductPrice[] = [];
      for (const tier of prices) {
        const discount = tier.discount as
          | (IDiscount & {
              validFrom?: string;
              validTo?: string;
            })
          | undefined;
        if (!discount) {
          filtered.push(tier);
          continue;
        }
        const validFrom = discount.validFrom ?? null;
        const validTo = discount.validTo ?? null;
        if (validFrom === null && validTo === null) {
          nullDated.push(tier);
          continue;
        }
        let isValid = true;
        if (validFrom !== null && now < new Date(validFrom)) isValid = false;
        if (isValid && validTo !== null && now > new Date(validTo)) isValid = false;
        if (isValid) validDated.push(tier);
      }
      if (validDated.length > 0) filtered.push(validDated[0]);
      else if (nullDated.length > 0) filtered.push(nullDated[0]);
    }
    filtered.sort((a, b) => (getTierQuantity(a) ?? 0) - (getTierQuantity(b) ?? 0));
    if (filtered.length === 1 && getTierQuantity(filtered[0]) === 1) return [];
    return filtered;
  }
  const bulkPrices = getBulkPrices();
  const hasItems = bulkPrices.length > 0;
  function getPrice(tier: ProductPrice): string {
    const value = includeTax ? tier.net : tier.gross;
    if (value === null || value === undefined) return '';
    return formatPrice(value, { symbol: props.currency ?? '\u20AC', locale: localeForLanguage(props.language) });
  }
  function getQuantityLabel(tier: ProductPrice, index: number): string {
    const discount = tier.discount as
      | (IDiscount & { quantityFrom?: number })
      | undefined;
    const qty = discount?.quantityFrom || tier.quantity || 1;
    const nextTier = bulkPrices[index + 1];
    const nextDiscount = nextTier?.discount as
      | (IDiscount & { quantityFrom?: number })
      | undefined;
    const nextQty = nextDiscount?.quantityFrom || nextTier?.quantity;
    if (nextQty) return `${qty}\u2013${nextQty - 1}`;
    return `${qty}+`;
  }
  // An explicit empty `title` label means "render no heading" — the check
  // below relies on it. getLabel() treats '' as missing and returns its English
  // fallback, so the heading came back as "Volume pricing" in every locale;
  // read the label directly here and only fall back when the key is absent.
  const title = props.labels?.title ?? 'Volume pricing';
  return (
    <>
      {!isHidden && hasItems ? (
        <>
          <div
            className={cn(`propeller-product-bulk-prices ${props.className || ''}`)}
            data-include-tax={includeTax ? 'true' : 'false'}
          >
            {title ? (
              <h3 className="propeller-product-bulk-prices__title text-base font-semibold text-foreground mb-3">
                {title}
              </h3>
            ) : null}
            <div className="propeller-product-bulk-prices__table-wrapper overflow-hidden rounded-container border border-border">
              <table className="propeller-product-bulk-prices__table w-full text-sm">
                <thead className="propeller-product-bulk-prices__thead bg-muted/50">
                  <tr>
                    <th className="propeller-product-bulk-prices__th propeller-product-bulk-prices__th--quantity px-4 py-2 text-left font-medium text-muted-foreground">
                      {getLabel(props.labels, 'quantityFrom', 'Qty from')}
                    </th>
                    <th className="propeller-product-bulk-prices__th propeller-product-bulk-prices__th--price px-4 py-2 text-right font-medium text-muted-foreground">
                      {getLabel(props.labels, 'price', 'Price')}
                      <span className="propeller-product-bulk-prices__tax-label font-normal text-xs">
                        (
                        {includeTax
                          ? getLabel(props.labels, 'inclTax', 'incl. VAT')
                          : getLabel(props.labels, 'exclTax', 'excl. VAT')}
                        )
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="propeller-product-bulk-prices__tbody divide-y divide-border">
                  {bulkPrices.map((tier, index) => (
                    <tr className="propeller-product-bulk-prices__row bg-card hover:bg-muted/20 transition-colors" key={index}>
                      <td className="propeller-product-bulk-prices__cell propeller-product-bulk-prices__cell--quantity px-4 py-2 text-foreground font-medium">
                        {getQuantityLabel(tier, index)}
                      </td>
                      <td className="propeller-product-bulk-prices__cell propeller-product-bulk-prices__cell--price px-4 py-2 text-right text-foreground font-semibold">
                        {getPrice(tier)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

export default ProductBulkPrices;
