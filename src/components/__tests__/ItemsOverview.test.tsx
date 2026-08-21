/**
 * ItemsOverview — line prices follow the Incl./Excl. BTW toggle.
 *
 * The component never resolved infra, so it ignored the toggle and printed
 * `item.price * quantity` (always excl. VAT) while `<CartItem>` on /cart
 * printed `totalSumNet` (incl.). The same two lines therefore appeared on two
 * different tax bases in consecutive checkout steps.
 *
 * Fixture numbers are the ones reported on the Next.js accelerator.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import ItemsOverview from '../ItemsOverview';
import type { Cart } from '@propeller-commerce/propeller-sdk-v2';

const CART = {
  cartId: 'c1',
  items: [
    { itemId: '1', quantity: 1, price: 15.63, totalSum: 15.63, totalSumNet: 18.91, product: { sku: '160223875' } },
    { itemId: '2', quantity: 1, price: 89, totalSum: 89, totalSumNet: 107.69, product: { sku: '91003189' } },
  ],
} as unknown as Cart;

/** The rendered line prices, in order. */
const prices = (html: string) =>
  [...html.replace(/<!-- -->/g, '').matchAll(/__item-price[^>]*>([^<]+)</g)].map((m) => m[1]);

describe('ItemsOverview tax basis', () => {
  it('prints prices incl. VAT when the toggle is on', () => {
    const html = renderToString(<ItemsOverview cart={CART} includeTax />);

    expect(prices(html)).toEqual(['€ 18,91', '€ 107,69']);
  });

  it('prints prices excl. VAT when the toggle is off', () => {
    const html = renderToString(<ItemsOverview cart={CART} includeTax={false} />);

    expect(prices(html)).toEqual(['€ 15,63', '€ 89,00']);
  });
});
