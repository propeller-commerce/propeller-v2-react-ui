/**
 * CartSummary — the transaction-costs line.
 *
 * `total.totalGross` already contains the payment method's transaction costs,
 * but the panel rendered no line for them, so "Total excl. VAT" read €0.35
 * higher than subtotal + shipping. OrderTotals has always shown this row.
 *
 * Fixture numbers are the ones reported on sandbox-2: a €7.25 line, €49.00
 * shipping, €0.35 transaction costs → €56.60 excl. VAT.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import CartSummary from '../CartSummary';
import type { Cart } from '@propeller-commerce/propeller-sdk-v2';

const CART_WITH_TRANSACTION_COSTS = {
  cartId: 'c1',
  paymentData: { method: 'IDEAL', price: 0.35 },
  postageData: { price: 49 },
  total: { subTotal: 7.25, discount: 0, totalGross: 56.6, totalNet: 68.49 },
  taxLevels: [],
} as unknown as Cart;

/** Same cart paid on account — no transaction costs, so no row. */
const CART_ON_ACCOUNT = {
  ...CART_WITH_TRANSACTION_COSTS,
  paymentData: { method: 'ON_ACCOUNT', price: 0 },
  total: { subTotal: 7.25, discount: 0, totalGross: 56.25, totalNet: 68.06 },
} as unknown as Cart;

const render = (cart: Cart) =>
  renderToString(<CartSummary cart={cart} showCheckoutButton={false} />).replace(/<!-- -->/g, '');

/** The money value of every rendered row, keyed by its `data-row`. */
const rows = (html: string) =>
  Object.fromEntries(
    [...html.matchAll(/data-row="([^"]+)"[\s\S]*?__value[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]])
  );

describe('CartSummary transaction costs', () => {
  it('renders the line that makes the rows add up to the total excl. VAT', () => {
    const r = rows(render(CART_WITH_TRANSACTION_COSTS));

    expect(r['transaction-costs']).toBe('€ 0,35');
    // 7,25 + 0,35 + 49,00 = 56,60 — the figure the panel prints.
    expect(r['total-excl-vat']).toBe('€ 56,60');
  });

  it('omits the line when the method is free', () => {
    const r = rows(render(CART_ON_ACCOUNT));

    expect(r['transaction-costs']).toBeUndefined();
    expect(r['total-excl-vat']).toBe('€ 56,25');
  });
});
