/**
 * OrderTotals' subtotal rows. `total.gross` already holds shipping and
 * transaction costs, so neither may be counted in the subtotal again. Cases
 * are real orders.
 */

import { describe, it, expect } from 'vitest';
import type { Order } from '@propeller-commerce/propeller-sdk-v2';
import { orderSubtotals } from '../orderSubtotals';

type Line = { class: string; priceTotal: number };

function order(
  total: { gross: number; discountType?: string; discountValue?: number },
  costs: { postage?: number; payment?: number } = {},
  items?: Line[],
): Order {
  return {
    total: { discountType: 'N', discountValue: 0, ...total },
    postageData: { gross: costs.postage ?? 0 },
    paymentData: { gross: costs.payment ?? 0 },
    items,
  } as unknown as Order;
}

describe('orderSubtotals', () => {
  it('leaves the shipping costs out of the subtotal', () => {
    expect(orderSubtotals(order({ gross: 800.58 }, { postage: 24.79 }))).toEqual({
      subtotal: 775.79,
      subtotalWithDiscount: 775.79,
      discountAmount: 0,
    });
  });

  it('leaves the transaction costs out of the subtotal', () => {
    expect(orderSubtotals(order({ gross: 220 }, { postage: 20, payment: 100 })).subtotal).toBe(100);
  });

  it('adds an amount discount back to the subtotal', () => {
    const r = orderSubtotals(order({ gross: 56.575, discountType: 'A', discountValue: 4 }, { postage: 10, payment: 25 }));
    expect(r.subtotal).toBeCloseTo(25.575, 6);
    expect(r.subtotalWithDiscount).toBeCloseTo(21.575, 6);
    expect(r.discountAmount).toBeCloseTo(4, 6);
  });

  it('takes the subtotal from the lines for a percentage discount', () => {
    const r = orderSubtotals(order({ gross: 64.0728, discountType: 'P', discountValue: 12 }, {}, [{ class: 'product', priceTotal: 72.81 }]));
    expect(r.subtotal).toBeCloseTo(72.81, 6);
    expect(r.subtotalWithDiscount).toBeCloseTo(64.0728, 6);
    expect(r.discountAmount).toBeCloseTo(8.7372, 6);
  });

  it('counts surcharges the percentage did not reduce at their own price', () => {
    const r = orderSubtotals(order({ gross: 82.4, discountType: 'P', discountValue: 10 }, { postage: 10 }, [
      { class: 'product', priceTotal: 80 },
      { class: 'surcharge', priceTotal: 0.15 },
      { class: 'surcharge', priceTotal: 0.25 },
    ]));
    expect(r.subtotal).toBeCloseTo(80.4, 6);
    expect(r.discountAmount).toBeCloseTo(8, 6);
  });

  it('leaves incentive lines out of a percentage subtotal', () => {
    const r = orderSubtotals(order({ gross: 90, discountType: 'P', discountValue: 10 }, {}, [
      { class: 'product', priceTotal: 100 },
      { class: 'incentive', priceTotal: -10 },
    ]));
    expect(r.subtotal).toBeCloseTo(100, 6);
  });

  it('works a percentage back from the total when the order has no lines', () => {
    const r = orderSubtotals(order({ gross: 100, discountType: 'P', discountValue: 10 }, { postage: 10 }));
    expect(r.subtotal).toBeCloseTo(100, 6);
    expect(r.discountAmount).toBeCloseTo(10, 6);
  });

  it('ignores the lines without an order discount, whatever incentives they hold', () => {
    const r = orderSubtotals(order({ gross: 106.2 }, {}, [
      { class: 'product', priceTotal: 106.2 },
      { class: 'product', priceTotal: 0 },
      { class: 'incentive', priceTotal: -10.62 },
    ]));
    expect(r.subtotal).toBe(106.2);
  });

  it('returns zeros without an order', () => {
    expect(orderSubtotals(undefined)).toEqual({ subtotal: 0, subtotalWithDiscount: 0, discountAmount: 0 });
  });
});
