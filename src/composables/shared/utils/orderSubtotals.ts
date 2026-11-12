import { OrderDiscountType, OrderItemClass, type Order } from '@propeller-commerce/propeller-sdk-v2';

export interface OrderSubtotals {
  /** Lines excl. VAT, before the order discount. */
  subtotal: number;
  /** Lines excl. VAT, after the order discount. */
  subtotalWithDiscount: number;
  /** The order discount as an amount excl. VAT. */
  discountAmount: number;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Subtotals for OrderTotals; `total.gross` includes shipping and transaction costs, so both come off. */
export function orderSubtotals(order: Order | undefined | null): OrderSubtotals {
  const total = order?.total;
  if (!total) return { subtotal: 0, subtotalWithDiscount: 0, discountAmount: 0 };

  const afterDiscount = Number(total.gross || 0)
    - Number(order?.postageData?.gross || 0)
    - Number(order?.paymentData?.gross || 0);
  const value = Number(total.discountValue || 0);

  let subtotal = afterDiscount;
  if (value > 0 && total.discountType === OrderDiscountType.A) {
    subtotal = afterDiscount + value;
  } else if (value > 0 && total.discountType === OrderDiscountType.P) {
    // A percentage skips surcharges, so it can't be worked back exactly: use the lines.
    const lines = (order?.items || []).filter((item) => item.class !== OrderItemClass.incentive);
    subtotal = lines.length
      ? lines.reduce((sum, item) => sum + Number(item.priceTotal || 0), 0)
      : (afterDiscount * 100) / (100 - value);
  }

  return {
    subtotal: round(subtotal),
    subtotalWithDiscount: round(afterDiscount),
    discountAmount: round(subtotal - afterDiscount),
  };
}
