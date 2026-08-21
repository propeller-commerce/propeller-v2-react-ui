/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import type { OrderItem } from '@propeller-commerce/propeller-sdk-v2';
import { formatPrice, getLabel, getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import DefaultProductPriceImpl from './ProductPrice';
import DefaultItemStockImpl from './ItemStock';

export interface OrderItemCardProps {
  /** The order item to display */
  orderItem: OrderItem;

  /** Child order items (rendered as indented sub-rows beneath the parent) */
  childItems?: OrderItem[];

  /**
   * Language used to resolve localized product names and the slugs in the
   * item's PDP link. Defaults to the catalog's default language.
   *
   * This component is RSC-safe (no hooks, no context), so the host has to pass
   * it — there is nothing to read it from. Without it a non-default storefront
   * renders default-language names and, worse, default-language slugs in the
   * links.
   */
  language?: string;

  /** Should the item title be a link to the PDP */
  titleLinkable?: boolean;

  /** Display a small thumbnail of the order item */
  showImage?: boolean;

  /** Should stock info be displayed */
  showStockComponent?: boolean;

  /** Display the SKU of the order item beneath the item name */
  showSku?: boolean;

  /** Display the quantity of the order item */
  showQuantity?: boolean;

  /** Display the price of the order item */
  showPrice?: boolean;

  /** Display the discount column */
  showDiscount?: boolean;

  /** Should the order item notes field be displayed */
  showItemNotes?: boolean;

  /** Render as a child/sub-item (indented, no image) */
  isChildItem?: boolean;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Currency symbol used by the default formatter. Default: `'€'`. */
  currency?: string;

  /** Translated labels keyed by the slugs used inside the component (see
   * `getLabel` calls). Missing keys fall back to the English defaults. */
  labels?: Record<string, string>;

  // ───── Extension API (RSC-safe variant) ─────
  // Direct-prop slot fallback (no useResolvedProps — keeps the component
  // server-component-safe). Caller passes the desired component; if absent,
  // renders the Default* fallback.
  priceComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').PriceComponentProps>;
  stockComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').StockComponentProps>;
}

// ── Pure accessors (module scope — created once, not per render) ────────────────

// `[0]` is the catalog's default-language entry, so on any other storefront
// these printed the wrong-language name and — the part that actually breaks —
// emitted a default-language SLUG into the item's link.
function getProductName(orderItem: OrderItem, language?: string): string {
  return (
    getLocalizedValue(orderItem?.product?.names, language, '') ||
    orderItem?.name ||
    'Unknown Product'
  );
}

function getClusterUrl(orderItem: OrderItem, language?: string): string {
  const cluster = orderItem?.product?.cluster;
  if (!cluster) return '';
  const id = cluster.clusterId;
  const slug = getLocalizedValue(cluster.slugs, language, '');
  if (!id || !slug) return '';
  return `/cluster/${id}/${slug}`;
}

function getProductUrl(orderItem: OrderItem, language?: string): string {
  const cu = getClusterUrl(orderItem, language);
  if (cu) return cu;
  const id = orderItem?.product?.productId;
  const slug = getLocalizedValue(orderItem?.product?.slugs, language, '');
  if (id && slug) return `/product/${id}/${slug}`;
  return '';
}

/**
 * Renders a single order line item as a table row (with optional indented
 * child-item rows), showing image, SKU, quantity, discount and price.
 */
function OrderItemCard(props: OrderItemCardProps) {
  const item = props.orderItem;
  const isChildItem = props.isChildItem || false;

  // Display toggles — resolved once (child items never show image/sku).
  const titleLinkable = props.titleLinkable !== undefined ? props.titleLinkable : true;
  const showImage = isChildItem ? false : props.showImage !== undefined ? props.showImage : true;
  const showSku = isChildItem ? false : props.showSku !== undefined ? props.showSku : true;
  const showQuantity = props.showQuantity !== undefined ? props.showQuantity : true;
  const showPrice = props.showPrice !== undefined ? props.showPrice : true;
  const showDiscount = props.showDiscount !== undefined ? props.showDiscount : false;
  const showStockComponent =
    props.showStockComponent !== undefined ? props.showStockComponent : false;
  const showItemNotes = props.showItemNotes !== undefined ? props.showItemNotes : false;

  // Derived item values — computed once per render (previously each was a
  // function redefined every render and called multiple times across the JSX).
  const productName = getProductName(item, props.language);
  const productSku = item?.product?.sku || item?.sku || '';
  const productImage = item?.product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '';
  const productUrl = getProductUrl(item, props.language);
  const quantity = item?.quantity || 0;
  const priceTotal = item?.priceTotal || 0;
  const discount = item?.discount || 0;
  const originalPrice = item?.originalPrice || 0;
  const discountPercentage =
    originalPrice > 0 && discount > 0 ? (discount / originalPrice) * 100 : 0;
  const notes = item?.notes || '';
  const hasChildren = (props.childItems || []).length > 0;

  function formatItemPrice(price: number): string {
    if (props.formatPrice) {
      return props.formatPrice(price);
    }
    if (!price && price !== 0) return '-';
    return formatPrice(price, { symbol: props.currency ?? '€' });
  }

  const discountDisplay =
    discountPercentage > 0
      ? `${formatItemPrice(discount)} (${discountPercentage.toFixed(2).replace('.', ',')}%)`
      : formatItemPrice(discount);

  return (
    <tbody className="propeller-order-item-card">
      <tr
        className={`propeller-order-item-card__row ${isChildItem ? 'border-0' : 'hover:bg-surface-hover transition'}`}
        data-child={isChildItem ? 'true' : 'false'}
      >
        <td
          className={`propeller-order-item-card__cell propeller-order-item-card__cell--product ${isChildItem ? 'px-6 py-2 pl-28' : 'px-6 py-4'}`}
        >
          <div className="flex items-center gap-4">
            {showImage ? (
              productImage ? (
                <div className="propeller-order-item-card__media relative w-16 h-16 flex-shrink-0 rounded overflow-hidden">
                  <img
                    className="propeller-order-item-card__image object-cover w-full h-full"
                    src={productImage}
                    alt={productName}
                  />
                </div>
              ) : (
                <div className="propeller-order-item-card__image-placeholder w-16 h-16 bg-surface-hover rounded flex items-center justify-center text-foreground-subtle text-xs">
                  {getLabel(props.labels, 'noImage', 'No Img')}
                </div>
              )
            ) : null}
            <div>
              {titleLinkable && productUrl && !isChildItem ? (
                <a
                  className="propeller-order-item-card__title font-medium text-foreground hover:text-primary hover:underline"
                  href={productUrl}
                >
                  {productName}
                </a>
              ) : (
                <span
                  className={`propeller-order-item-card__title ${isChildItem ? 'text-sm text-muted-foreground' : 'font-medium'}`}
                >
                  {productName}
                </span>
              )}
              {showSku && productSku ? (
                <p className="propeller-order-item-card__sku text-sm text-muted-foreground mt-1">
                  SKU: {productSku}
                </p>
              ) : null}
              {showItemNotes && notes ? (
                <p className="propeller-order-item-card__notes text-sm text-foreground-subtle mt-1 italic">
                  {notes}
                </p>
              ) : null}
              {showStockComponent && item?.product?.inventory
                ? (() => {
                    // Delegate to the injected stock slot, or fall back to
                    // the default stock display. Replaces the prior literal
                    // "Stock info" placeholder text. The `inventory` guard
                    // above bridges the contract-vs-default mismatch: the
                    // shared StockComponentProps.inventory is optional while
                    // DefaultItemStock requires it, so we only render when
                    // the SDK actually returned inventory data.
                    const StockImpl = props.stockComponent ?? DefaultItemStockImpl;
                    return (
                      <StockImpl
                        inventory={item.product.inventory}
                        showStock={true}
                        showAvailability={true}
                        labels={props.labels}
                      />
                    );
                  })()
                : null}
            </div>
          </div>
        </td>
        {showQuantity ? (
          <td
            className={
              isChildItem
                ? 'propeller-order-item-card__cell propeller-order-item-card__cell--quantity px-6 py-2 text-center text-sm text-muted-foreground'
                : 'propeller-order-item-card__cell propeller-order-item-card__cell--quantity px-6 py-4 text-center'
            }
          >
            {quantity}
          </td>
        ) : null}
        {showDiscount ? (
          <td
            className={
              isChildItem
                ? 'propeller-order-item-card__cell propeller-order-item-card__cell--discount px-6 py-2 text-right text-sm text-muted-foreground'
                : 'propeller-order-item-card__cell propeller-order-item-card__cell--discount px-6 py-4 text-right whitespace-nowrap text-warning'
            }
          >
            {discount > 0 ? <>{discountDisplay}</> : null}
          </td>
        ) : null}
        {showPrice ? (
          <td
            className={
              isChildItem
                ? 'propeller-order-item-card__cell propeller-order-item-card__cell--price px-6 py-2 text-right whitespace-nowrap text-sm text-muted-foreground'
                : 'propeller-order-item-card__cell propeller-order-item-card__cell--price px-6 py-4 text-right whitespace-nowrap'
            }
          >
            {(() => {
              // When the consumer injects a priceComponent, delegate to it;
              // otherwise keep the existing inline line-total rendering.
              //
              // Contract-vs-data note (same as CartItem): the
              // PriceComponentProps.price contract expects an SDK ProductPrice
              // (catalog/unit price), while this cell historically renders the
              // line total `item.priceTotal`. We pass `item.product?.price`
              // (catalog price) to the injected component to honour the
              // contract; consumers who need the line total can read it off
              // the labels/className surface or compute their own from the
              // catalog price + their own quantity context. The default
              // (uninjected) path is unchanged.
              const PriceImpl = props.priceComponent;
              if (PriceImpl) {
                return (
                  <PriceImpl
                    price={item?.product?.price}
                    currency={props.currency}
                    labels={props.labels}
                  />
                );
              }
              return formatItemPrice(priceTotal);
            })()}
          </td>
        ) : null}
      </tr>
      {hasChildren ? (
        <>
          {(props.childItems || []).map((child) => (
            <tr
              className="propeller-order-item-card__child-row border-0"
              key={child.id || child.uuid}
              data-child="true"
            >
              <td className="propeller-order-item-card__cell propeller-order-item-card__cell--product px-6 py-2 pl-28">
                <span className="propeller-order-item-card__child-title text-sm text-muted-foreground">
                  {getLocalizedValue(child.product?.names, props.language, '') || child.name || 'Unknown'}
                </span>
              </td>
              {showQuantity ? (
                <td className="propeller-order-item-card__cell propeller-order-item-card__cell--quantity px-6 py-2 text-center text-sm text-muted-foreground">
                  {child.quantity || 0}
                </td>
              ) : null}
              {showDiscount ? (
                <td className="propeller-order-item-card__cell propeller-order-item-card__cell--discount px-6 py-2 text-right text-sm text-muted-foreground" />
              ) : null}
              {showPrice ? (
                <td className="propeller-order-item-card__cell propeller-order-item-card__cell--price px-6 py-2 text-right whitespace-nowrap text-sm text-muted-foreground">
                  {formatItemPrice(child.priceTotal || 0)}
                </td>
              ) : null}
            </tr>
          ))}
        </>
      ) : null}
    </tbody>
  );
}

export default OrderItemCard;
