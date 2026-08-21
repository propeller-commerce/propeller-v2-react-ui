/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import { Order, OrderDiscountType, OrderTotalTaxPercentage } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';

export interface OrderTotalsProps {
  /** The order/quote used to populate the summary data */
  order: Order;

  /** Order summary block title */
  title?: string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Display the subtotal of the order/quote */
  showSubtotal?: boolean;

  /** Display the total discount of the order/quote */
  showDiscount?: boolean;

  /** Display the shipping costs of the order/quote */
  showShippingCosts?: boolean;

  /** Display all VATs of the order/quote */
  showVATs?: boolean;

  /** Display the total of the order/quote excluding the VAT */
  showTotalExclVat?: boolean;

  /** Display the total VAT of the order/quote */
  showTotalVat?: boolean;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Currency symbol used by the default formatter. Default: `'€'`. */
  currency?: string;
}
/**
 * Renders the price breakdown for an order or quote: subtotal, discount,
 * transaction and shipping costs, per-rate VAT lines and the grand total.
 */
function OrderTotals(props: OrderTotalsProps) {
  // All visibility flags are derived directly from props at render — no need
  // for one-liner functions wrapping a `?? true`.
  const showSubtotal = props.showSubtotal !== false;
  const showDiscount = props.showDiscount !== false;
  const showShippingCosts = props.showShippingCosts !== false;
  const showVATs = props.showVATs !== false;
  const showTotalExclVat = props.showTotalExclVat !== false;
  const showTotalVat = props.showTotalVat !== false;
  const total = props.order?.total;
  const paymentData = props.order?.paymentData;
  const postageData = props.order?.postageData;

  function formatItemPrice(price: number): string {
    if (props.formatPrice) return props.formatPrice(price);
    return formatPrice(price || 0, { symbol: props.currency ?? '€' });
  }
  const subtotal = total?.gross || 0;
  const hasDiscount = !!total
    && total.discountType !== OrderDiscountType.N
    && total.discountValue > 0;
  function discountDisplay(): string {
    if (!total) return '';
    if (total.discountType === OrderDiscountType.A) {
      return '-' + formatItemPrice(total.discountValue);
    }
    if (total.discountType === OrderDiscountType.P) {
      return '- ' + total.discountValue + '%';
    }
    return '-' + formatItemPrice(total.discountValue);
  }
  const subtotalWithDiscount = (total?.gross || 0) - (total?.discountValue || 0);
  const hasTransactionCosts = (paymentData?.gross ?? 0) > 0;
  const transactionCosts = Number(paymentData?.gross || 0);
  const hasShippingCosts = (postageData?.gross ?? 0) > 0;
  const shippingCosts = Number(postageData?.gross || 0);
  const totalExclVat = total?.gross || 0;
  const taxPercentages: OrderTotalTaxPercentage[] = (total?.taxPercentages || [])
    .filter((tax) => tax.percentage > 0 && tax.total > 0);
  const totalInclVat = total?.net || 0;
  const totalVat = taxPercentages.reduce((sum, t) => sum + Number(t.total || 0), 0);
  return (
    <div className="propeller-order-totals w-full md:w-80 bg-card p-6 rounded-container shadow space-y-3">
      {showSubtotal ? (
        <div className="propeller-order-totals__row flex justify-between text-muted-foreground" data-row="subtotal">
          <span className="propeller-order-totals__label">{getLabel(props.labels, 'subtotal', 'Subtotal:')}</span>
          <span className="propeller-order-totals__value">{formatItemPrice(subtotal)}</span>
        </div>
      ) : null}
      {showDiscount && hasDiscount ? (
        <>
          <div className="propeller-order-totals__row flex justify-between text-secondary" data-row="discount">
            <span className="propeller-order-totals__label">{getLabel(props.labels, 'discount', 'Discount:')}</span>
            <span className="propeller-order-totals__value">{discountDisplay()}</span>
          </div>
          <div className="propeller-order-totals__row flex justify-between text-muted-foreground border-t pt-2 border-dashed" data-row="subtotal-with-discount">
            <span className="propeller-order-totals__label">{getLabel(props.labels, 'subtotalWithDiscount', 'Subtotal with discount:')}</span>
            <span className="propeller-order-totals__value">{formatItemPrice(subtotalWithDiscount)}</span>
          </div>
        </>
      ) : null}
      {hasTransactionCosts ? (
        <div className="propeller-order-totals__row flex justify-between text-muted-foreground" data-row="transaction-costs">
          <span className="propeller-order-totals__label">{getLabel(props.labels, 'transactionCosts', 'Transaction costs:')}</span>
          <span className="propeller-order-totals__value">{formatItemPrice(transactionCosts)}</span>
        </div>
      ) : null}
      {showShippingCosts && hasShippingCosts ? (
        <div className="propeller-order-totals__row flex justify-between text-muted-foreground" data-row="shipping-costs">
          <span className="propeller-order-totals__label">{getLabel(props.labels, 'shippingCosts', 'Shipping costs:')}</span>
          <span className="propeller-order-totals__value">{formatItemPrice(shippingCosts)}</span>
        </div>
      ) : null}
      {showTotalExclVat ? (
        <div className="propeller-order-totals__row flex justify-between text-muted-foreground pt-2 border-t" data-row="total-excl-vat">
          <span className="propeller-order-totals__label">{getLabel(props.labels, 'totalExclVat', 'Total excl. VAT:')}</span>
          <span className="propeller-order-totals__value">{formatItemPrice(totalExclVat)}</span>
        </div>
      ) : null}
      {showVATs && taxPercentages.length > 0 ? (
        <>
          {taxPercentages.map((tax, index) => (
            <div className="propeller-order-totals__row flex justify-between text-muted-foreground text-sm" key={index} data-row="vat-line">
              <span className="propeller-order-totals__label">
                {tax.percentage}% {getLabel(props.labels, 'vat', 'VAT')}:
              </span>
              <span className="propeller-order-totals__value">{formatItemPrice(Number(tax.total))}</span>
            </div>
          ))}
        </>
      ) : null}
      {showTotalVat ? (
        <div className="propeller-order-totals__row flex justify-between text-muted-foreground text-sm" data-row="total-vat">
          <span className="propeller-order-totals__label">{getLabel(props.labels, 'totalVat', 'Total VAT:')}</span>
          <span className="propeller-order-totals__value">{formatItemPrice(totalVat)}</span>
        </div>
      ) : null}
      <div className="propeller-order-totals__row propeller-order-totals__row--total flex justify-between text-xl font-bold pt-4 border-t text-foreground mt-2" data-row="total">
        <span className="propeller-order-totals__label">{getLabel(props.labels, 'total', 'Total:')}</span>
        <span className="propeller-order-totals__value">{formatItemPrice(totalInclVat)}</span>
      </div>
    </div>
  );
}

export default OrderTotals;
