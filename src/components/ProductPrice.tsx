/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import { ClusterOption, Contact, Customer, Product, ProductPrice, YesNo } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import { isContentHidden } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice as formatPriceHelper } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface ProductPriceProps {
  /**
   * Storefront language ('EN', 'NL', …). Decides the number format prices are
   * rendered in — without it they fall back to Dutch separators regardless of
   * the language the shopper is reading.
   */
  language?: string;

  /**
   * ProductPrice object from the product.
   * Obtain from `product.price`.
   */
  price: ProductPrice;

  /** Currency symbol to display. Defaults to '€'. */
  currency?: string;

  /**
   * Controls portal visibility mode.
   * 'open'        — full e-commerce; price is always visible.
   * 'semi-closed' — catalog-only; price is hidden for anonymous users.
   * Defaults to 'open'.
   */
  portalMode?: string;

  /** Authenticated user — used for semi-closed visibility. */
  user?: Contact | Customer | null;

  /**
   * When true, net price (incl. tax) is the leading price.
   * When false (default), gross price (excl. tax) is the leading price.
   * Note: in the Propeller SDK `price.gross` = excl. VAT, `price.net` = incl. VAT.
   */
  includeTax?: boolean;

  /** Tax zone code. Defaults to 'NL'. */
  taxZone?: string;

  /** Cluster options (cluster.options). Required option default prices are added even without an active selection. */
  options?: ClusterOption[];

  /** Active option product selections — pass Object.values(selectedOptionProducts). Price updates on every change. */
  selectedOptionProducts?: Product[];

  /**
   * Override any UI string.
   * Available keys: inclTax, exclTax, loginToSeePrices
   */
  labels?: Record<string, string>;

  /**
   * Show the "log in to see prices" prompt when the price is hidden.
   * Defaults to true; pass false to render nothing in its place.
   */
  showLoginPrompt?: boolean;

  /** Tailwind text-size class for the leading price. Defaults to 'text-3xl'. */
  priceSize?: string;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
/**
 * Renders a product's price with a leading incl./excl.-VAT amount and a
 * secondary line for the other tax mode, adding selected cluster-option prices.
 */
function ProductPriceDisplay(props: ProductPriceProps) {
  function isHidden(): boolean {
    return isContentHidden(props.portalMode, props.user);
  }
  function formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return formatPriceHelper(value, { symbol: props.currency ?? '\u20AC', locale: localeForLanguage(props.language) });
  }
  function getOptionsTotal(useNet: boolean): number {
    const options = props.options || [];
    const selected = props.selectedOptionProducts || [];
    let total = 0;
    options.forEach((option: ClusterOption) => {
      if (option.hidden === YesNo.Y) return;

      // Find whether the user has selected a product in this option
      const selectedProduct = selected.find((p: Product) =>
        (option.products || []).some((op: Product) => op.productId === p.productId)
      );
      if (selectedProduct) {
        total += useNet ? selectedProduct.price?.net || 0 : selectedProduct.price?.gross || 0;
      } else if (option.isRequired === YesNo.Y && option.defaultProduct) {
        // option.defaultProduct may lack price data; look up the full
        // product record from option.products (which always has prices).
        const defaultId = (option.defaultProduct as Product).productId;
        const fullDefault =
          (option.products || []).find((p: Product) => p.productId === defaultId) ||
          option.defaultProduct;
        total += useNet
          ? (fullDefault as Product).price?.net || 0
          : (fullDefault as Product).price?.gross || 0;
      }
    });
    return total;
  }
  function getLeadingPrice(): string {
    const price = props.price;
    if (!price) return '';
    const useNet = !!props.includeTax;
    const base = useNet ? price.net : price.gross;
    if (base === null || base === undefined) return '';
    return formatPrice(base + getOptionsTotal(useNet));
  }
  function getSecondaryPrice(): string {
    const price = props.price;
    if (!price) return '';
    const useNet = !props.includeTax; // opposite of leading
    const base = useNet ? price.net : price.gross;
    if (base === null || base === undefined) return '';
    return formatPrice(base + getOptionsTotal(useNet));
  }
  function getTaxLabel(): string {
    return props.includeTax ? getLabel(props.labels, 'inclTax', 'incl. VAT') : getLabel(props.labels, 'exclTax', 'excl. VAT');
  }
  function getSecondaryTaxLabel(): string {
    return props.includeTax ? getLabel(props.labels, 'exclTax', 'excl. VAT') : getLabel(props.labels, 'inclTax', 'incl. VAT');
  }
  return (
    <div className={cn(`propeller-product-price ${props.className || ''}`)} data-hidden={isHidden() ? 'true' : 'false'}>
      {isHidden() && props.showLoginPrompt !== false ? (
        <p className="propeller-product-price__login-prompt text-sm text-muted-foreground italic">
          {getLabel(props.labels, 'loginToSeePrices', 'Log in to see prices')}
        </p>
      ) : null}
      {!isHidden() && !!getLeadingPrice() ? (
        <div className="propeller-product-price__content flex flex-col gap-0.5">
          <div className="propeller-product-price__primary flex items-baseline gap-2">
            <span
              className={`propeller-product-price__amount ${props.priceSize || 'text-3xl'} font-bold text-foreground`}
            >
              {getLeadingPrice()}
            </span>
            <span className="propeller-product-price__tax-label text-sm text-muted-foreground">{getTaxLabel()}</span>
          </div>
          {!!getSecondaryPrice() ? (
            <div className="propeller-product-price__secondary text-sm text-muted-foreground flex items-baseline gap-1">
              <span className="propeller-product-price-secondary__amount">{getSecondaryPrice()}</span>
              <span className="propeller-product-price-secondary__tax-label">{getSecondaryTaxLabel()}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ProductPriceDisplay;
