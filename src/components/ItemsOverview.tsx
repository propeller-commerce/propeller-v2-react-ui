'use client';
/**
 * @rsc-blocked — Client-only component: JSX event handlers (onClick/onChange/etc.).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';
import { BundleItem, Cart, CartMainItem, YesNo } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice, formatSurcharge } from '@propeller-commerce/propeller-v2-core-ui';
import { useInfraProps } from '../composables/react/useInfraProps';

export interface ItemsOverviewProps {
  /** Shopping cart object from which the cart items overview will be displayed */
  cart: Cart;

  /** The CSS class for the cart items overview container */
  itemsOverviewContainerClass?: string;

  /** Title of the cart items overview */
  title?: string;

  /** The cart items names are clickable links */
  itemNameClickable?: boolean;

  /** Action when a cart item's name is clicked */
  onCartItemNameClick?: (item: CartMainItem) => void;
  /** Show the quantity of the cart item */ showQuantity?: boolean;
  /** Show the availability of the cart item */ showAvailability?: boolean;
  /** Show the SKU of the cart item */ showSku?: boolean;
  /** Show a small image of the cart item */ showImage?: boolean;
  /** Show the price of the cart item */ showPrice?: boolean;
  /** Custom price formatting function */ formatPrice?: (price: number) => string;
  /** Labels for the component */ labels?: Record<string, string>;
  /** Currency symbol used by the default formatter. Default: `'€'`. */ currency?: string;
  /** Active language for localized surcharge names. */ language?: string;
  /** Include tax in the line prices. Resolved from `<PropellerProvider>` when omitted; defaults to `false`. */ includeTax?: boolean;
}

// ── Pure helpers (module scope — created once, not per render) ──────────────────

// `names[0]` is the catalog's default-language entry, so every localized
// storefront rendered these rows in the default language.
function getItemName(item: CartMainItem, language?: string): string {
  return getLocalizedValue(item.product?.names, language, 'Product');
}

function getItemImageUrl(item: CartMainItem): string {
  const url = item.product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url;
  return url && typeof url === 'string' && url.startsWith('http') ? url : '';
}

function getItemChildItems(item: CartMainItem): CartMainItem[] {
  const children = (item as CartMainItem & { childItems?: CartMainItem[] }).childItems;
  if (!children || !Array.isArray(children)) return [];
  return children;
}

function getBundleLeader(item: CartMainItem): BundleItem | undefined {
  return item.bundle?.items?.find((bi: BundleItem) => bi.isLeader === YesNo.Y);
}

function getBundleNonLeaders(item: CartMainItem): BundleItem[] {
  const items = item.bundle?.items;
  if (!items) return [];
  return items.filter((bi: BundleItem) => bi.isLeader !== YesNo.Y);
}

/**
 * Renders a compact read-only list of cart line items, including bundles and
 * configurable child options, with optional image, SKU, availability and price.
 */
function ItemsOverview(rawProps: ItemsOverviewProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  // Without this the component ignored the Incl./Excl. BTW toggle entirely and
  // printed line prices on a different tax basis than <CartItem> on /cart
  // — and silently fell back to '€' and no language for surcharges.
  const props = useInfraProps(rawProps);
  // SDK mapping: net = incl. VAT, gross = excl. VAT. Single source of truth for
  // every price below, so the checkout list and the cart page always agree.
  const language = props.language as string | undefined;
  const useTax = !!props.includeTax;
  const containerClass = props.itemsOverviewContainerClass || 'cart-items-overview';
  const itemNameClickable =
    props.itemNameClickable !== undefined ? props.itemNameClickable : true;
  // Note: `showQuantity` prop exists in the public API but quantity is always
  // rendered (it was never gated in the original component either).
  const showAvailability =
    props.showAvailability !== undefined ? props.showAvailability : true;
  const showSku = props.showSku !== undefined ? props.showSku : true;
  const showImage = props.showImage !== undefined ? props.showImage : true;
  const showPrice = props.showPrice !== undefined ? props.showPrice : true;

  // Computed once per render (previously items() was redefined every render and
  // called 3× — once for the map, twice for length checks).
  const items: CartMainItem[] = props.cart?.items ?? [];

  const currencySymbol = props.currency ?? '€';
  const money = (value: number | null | undefined): string =>
    value === undefined || value === null ? '' : formatPrice(value, { symbol: currencySymbol });

  function formatItemPrice(price: number): string {
    if (props.formatPrice) {
      return props.formatPrice(price);
    }
    return formatPrice(price || 0, { symbol: currencySymbol });
  }

  /** Line total on the active tax basis — the same fields `<CartItem>` reads. */
  function lineTotal(item: CartMainItem): number {
    return (useTax ? item.totalSumNet : item.totalSum) || 0;
  }

  /** Bundle / bundle-item price on the active tax basis. */
  function bundlePrice(price: BundleItem['price'] | undefined): number | undefined {
    if (!price) return undefined;
    return useTax ? price.net : price.gross;
  }

  function getItemSurcharges(item: CartMainItem): string[] {
    // Cart-line surcharges (CartItemSurcharge: localized `names`, own quantity).
    // Each shown as `{qty} x € {value} (name)` / `{qty} x {value}% (name)`.
    type SurchargeLike = {
      name?: { value?: string; language?: string }[];
      names?: { value?: string; language?: string }[];
      type?: string;
      value?: number;
      quantity?: number;
      enabled?: boolean;
    };
    const list = (((item as CartMainItem & { surcharges?: SurchargeLike[] }).surcharges ?? []) as SurchargeLike[]).filter(
      (s: SurchargeLike) => s.enabled !== false
    );
    return list
      .map((s: SurchargeLike) =>
        formatSurcharge(s, {
          quantity: s.quantity ?? item.quantity ?? 1,
          language: props.language,
          currency: currencySymbol,
        })
      )
      .filter((line: string) => line.length > 0);
  }

  function handleItemNameClick(item: CartMainItem): void {
    if (itemNameClickable && props.onCartItemNameClick) {
      props.onCartItemNameClick(item);
    }
  }

  return (
    <div className={`propeller-items-overview ${containerClass}`}>
      {props.title ? (
        <h2 className="propeller-items-overview__title text-lg font-bold mb-4">{props.title}</h2>
      ) : null}
      <div className="propeller-items-overview__list space-y-4">
        {items.map((item, index) => {
          const isBundle = !!item.bundle;
          const stock = item.product?.inventory?.totalQuantity;
          const inStock = stock !== undefined && stock !== null && stock > 0;
          const availability =
            stock === undefined || stock === null
              ? ''
              : inStock
                ? props.labels?.['inStock'] || 'In stock'
                : props.labels?.['outOfStock'] || 'Out of stock';
          const itemSku = item.product?.sku || '';
          const childItems = getItemChildItems(item);
          const leader = getBundleLeader(item);
          return (
            <div
              className="propeller-items-overview__item flex gap-3 pb-3 border-b border-border last:border-b-0 last:pb-0"
              key={item.itemId || index}
              data-bundle={isBundle ? 'true' : 'false'}
            >
              {showImage ? (
                <div className="propeller-items-overview__item-media w-16 h-16 flex-shrink-0 bg-surface-hover rounded-control overflow-hidden border border-border-subtle flex items-center justify-center">
                  {getItemImageUrl(item) ? (
                    <img
                      className="propeller-items-overview__item-image w-full h-full object-contain p-1.5"
                      src={getItemImageUrl(item)}
                      alt={getItemName(item, language)}
                    />
                  ) : (
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="propeller-items-overview__item-image-placeholder w-6 h-6 text-foreground-subtle"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                      />
                    </svg>
                  )}
                </div>
              ) : null}
              <div className="propeller-items-overview__item-body flex-1 min-w-0">
                {isBundle ? (
                  <>
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="propeller-items-overview__item-title text-sm font-medium leading-tight text-foreground line-clamp-2">
                          {item.bundle?.name || 'Bundle'}
                        </span>
                        {showPrice && money(bundlePrice(item.bundle?.price)) ? (
                          <span className="propeller-items-overview__item-price font-semibold text-sm text-foreground whitespace-nowrap">
                            {money(bundlePrice(item.bundle?.price))}
                          </span>
                        ) : null}
                      </div>
                      <div className="propeller-items-overview__item-bundle mt-1.5 space-y-1 border-l-2 border-secondary/10 pl-2">
                        {leader ? (
                          <div className="propeller-items-overview__item-bundle-leader flex justify-between items-center text-xs">
                            <span className="font-medium text-foreground">
                              {getLocalizedValue(leader.product.names, language, 'Product')}
                            </span>
                            {money(bundlePrice(leader.price)) ? (
                              <span className="text-muted-foreground whitespace-nowrap ml-2">
                                {money(bundlePrice(leader.price))}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {getBundleNonLeaders(item).map((bundleItem, idx) => (
                          <div
                            className="propeller-items-overview__item-bundle-item flex justify-between items-center text-xs text-muted-foreground"
                            key={idx}
                          >
                            <span className="line-clamp-1">
                              {getLocalizedValue(bundleItem.product?.names, language, 'Product')}
                            </span>
                            {money(bundlePrice(bundleItem.price)) ? (
                              <span className="text-foreground-subtle whitespace-nowrap ml-2">
                                {money(bundlePrice(bundleItem.price))}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>{' '}
                    <div className="propeller-items-overview__item-qty flex items-center text-xs text-foreground-subtle mt-1">
                      <span>
                        {getLabel(props.labels, 'quantity', 'Qty:')}
                        {item.quantity}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        {itemNameClickable ? (
                          <p
                            className="propeller-items-overview__item-title font-medium text-sm leading-tight cursor-pointer hover:text-secondary transition-colors line-clamp-2"
                            onClick={() => handleItemNameClick(item)}
                          >
                            {getItemName(item, language)}
                          </p>
                        ) : (
                          <p className="propeller-items-overview__item-title font-medium text-sm leading-tight line-clamp-2">
                            {getItemName(item, language)}
                          </p>
                        )}
                        {showPrice ? (
                          <span className="propeller-items-overview__item-price font-semibold text-sm text-foreground whitespace-nowrap">
                            {formatItemPrice(lineTotal(item))}
                          </span>
                        ) : null}
                      </div>
                      {showSku && itemSku ? (
                        <p className="propeller-items-overview__item-sku text-xs text-muted-foreground mt-0.5">
                          SKU: {itemSku}
                        </p>
                      ) : null}
                      {getItemSurcharges(item).length > 0 ? (
                        <div className="propeller-items-overview__item-surcharges mt-1 text-xs text-muted-foreground">
                          <span className="font-medium">{getLabel(props.labels, 'surcharges', 'Additional surcharges:')}</span>
                          <ul className="propeller-items-overview__item-surcharges-list mt-0.5">
                            {getItemSurcharges(item).map((line, idx) => (
                              <li key={idx} className="propeller-items-overview__item-surcharge">{line}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {childItems.length > 0 ? (
                        <div className="propeller-items-overview__item-options mt-1.5 space-y-1 border-l-2 border-border-subtle pl-2">
                          {childItems.map((child, idx) => (
                            <div
                              className="propeller-items-overview__item-option flex justify-between items-center text-xs text-muted-foreground"
                              key={idx}
                            >
                              <span className="line-clamp-1">
                                {getLocalizedValue(child.product?.names, language, 'Option')}
                              </span>
                              <span className="text-foreground-subtle whitespace-nowrap ml-2">
                                {formatItemPrice(lineTotal(child))}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>{' '}
                    <div className="propeller-items-overview__item-qty flex items-center text-xs text-foreground-subtle mt-1">
                      <span>
                        {getLabel(props.labels, 'quantity', 'Qty:')}
                        {item.quantity}
                      </span>
                      {showAvailability && availability ? (
                        <span
                          className={`propeller-items-overview__item-availability ml-2 ${inStock ? 'text-success' : 'text-destructive'}`}
                          data-in-stock={inStock ? 'true' : 'false'}
                        >
                          {availability}
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {items.length === 0 ? (
        <p className="propeller-items-overview__empty text-muted-foreground italic text-sm">
          {getLabel(props.labels, 'noItems', 'No items in cart.')}
        </p>
      ) : null}
    </div>
  );
}
export default ItemsOverview;
