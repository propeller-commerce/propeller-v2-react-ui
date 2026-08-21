/**
 * Checkout grids always render something selected.
 *
 * A fresh cart stores no payment method / carrier, so both grids used to paint
 * with nothing highlighted and step 3 refused to continue until the user
 * clicked. The selection is now derived, not effect state, which is what makes
 * it assertable from `renderToString` — and is the point: it is in the first
 * paint rather than flashing in after hydration.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import CartPaymethods from '../CartPaymethods';
import CartCarriers from '../CartCarriers';
import type { Cart } from '@propeller-commerce/propeller-sdk-v2';

const PAY_METHODS = [
  { code: 'on_account', name: 'On account', price: 0 },
  { code: 'ideal', name: 'iDEAL', price: 0 },
];
const CARRIERS = [
  { name: 'PostNL', price: 0 },
  { name: 'DHL', price: 0 },
];

const cart = (extra: Record<string, unknown> = {}) =>
  ({ cartId: 1, payMethods: PAY_METHODS, carriers: CARRIERS, ...extra }) as unknown as Cart;

/** The codes/names rendered with `data-selected="true"`, in document order. */
function selected(html: string): string[] {
  return [...html.matchAll(/data-selected="true"[\s\S]*?__(?:method|carrier)-name[^>]*>([^<]+)</g)].map(
    (m) => m[1],
  );
}

describe('payment method preselection', () => {
  it('selects the first method when the cart stores none', () => {
    const html = renderToString(<CartPaymethods cart={cart()} user={{} as never} />);
    expect(selected(html)).toEqual(['On account']);
  });

  it('selects the method the cart stores', () => {
    const html = renderToString(
      <CartPaymethods cart={cart({ paymentData: { method: 'ideal' } })} user={{} as never} />,
    );
    expect(selected(html)).toEqual(['iDEAL']);
  });

  it('never preselects a method the guest cannot see', () => {
    // "On account" is hidden from guests, so the preselection has to skip it
    // rather than select an option that is not on screen.
    const html = renderToString(<CartPaymethods cart={cart()} user={null} />);
    expect(html).not.toContain('On account');
    expect(selected(html)).toEqual(['iDEAL']);
  });

  it('renders no selection when there is nothing to select', () => {
    const html = renderToString(<CartPaymethods cart={cart({ payMethods: [] })} user={{} as never} />);
    expect(selected(html)).toEqual([]);
  });
});

describe('carrier preselection', () => {
  it('selects the first carrier when the cart stores none', () => {
    const html = renderToString(<CartCarriers cart={cart()} />);
    expect(selected(html)).toEqual(['PostNL']);
  });

  it('selects the carrier the cart stores', () => {
    const html = renderToString(<CartCarriers cart={cart({ postageData: { carrier: 'DHL' } })} />);
    expect(selected(html)).toEqual(['DHL']);
  });

  it('selects the only carrier when the cart offers exactly one', () => {
    // The reported shape: one carrier, rendered unselected, so Continue bounced
    // back with "Selecteer een vervoerder" over a list with nothing to choose.
    const html = renderToString(<CartCarriers cart={cart({ carriers: [{ name: 'DHL', price: 0 }] })} />);
    expect(selected(html)).toEqual(['DHL']);
  });
});
