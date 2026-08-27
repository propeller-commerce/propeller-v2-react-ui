/**
 * Money formatted at the `nl-NL` default because `language` never reached the
 * component.
 *
 * `localeForLanguage(undefined)` is `nl-NL`, so any money-rendering component
 * that reads `props.language` straight off its props prints Dutch separators
 * unless every single host remembers to pass the language. Cards resolved it
 * from `<PropellerProvider>`; the PDP price block, the order totals and the
 * checkout carriers did not — so one page could show `€ 1,42` in its hero
 * price and `€1.70` on the cards beneath it.
 *
 * The fix is per-entry, which is what these tests pin:
 *   - `/pure` exports the unwrapped components. They read no context by
 *     design (RSC-safe) and still format at the default. A Server Component
 *     host must pass `language` itself.
 *   - the main entry exports provider-resolving wrappers, so a client host
 *     gets the right locale without threading the prop.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { PropellerProvider, PropellerDepsProvider } from '../../context/PropellerContext';
import PureProductPrice from '../ProductPrice';
import ProductPrice from '../ProductPriceWithProvider';
import OrderTotals from '../OrderTotalsWithProvider';
import OrderSummary from '../OrderSummaryWithProvider';
import CartCarriers from '../CartCarriers';
import type { ProductPrice as SDKProductPrice, Order, Cart } from '@propeller-commerce/propeller-sdk-v2';

const clean = (html: string) => html.replace(/<!-- -->/g, '');

const PRICE = { gross: 30.77, net: 37.23 } as unknown as SDKProductPrice;

/** An English storefront priced in pounds. */
function EnShop({ children }: { children: React.ReactNode }) {
  return (
    <PropellerDepsProvider value={{ currency: '\u00A3' } as never}>
      <PropellerProvider value={{ language: 'EN' } as never}>{children}</PropellerProvider>
    </PropellerDepsProvider>
  );
}

describe('money follows the provider language', () => {
  it('resolves the locale for the PDP price block', () => {
    const html = clean(renderToString(<EnShop><ProductPrice price={PRICE} /></EnShop>));
    expect(html).toContain('\u00A330.77');
    expect(html).not.toContain('30,77');
  });

  it('resolves the locale for order totals', () => {
    const order = { total: { gross: 30.77, net: 37.23 } } as unknown as Order;
    const html = clean(renderToString(<EnShop><OrderTotals order={order} /></EnShop>));
    expect(html).toContain('\u00A330.77');
    expect(html).not.toContain('30,77');
  });

  it('resolves the locale for the order summary', () => {
    const order = { orderId: 1, total: { gross: 30.77, net: 37.23 } } as unknown as Order;
    const html = clean(renderToString(<EnShop><OrderSummary order={order} /></EnShop>));
    expect(html).not.toContain('30,77');
  });

  it('resolves the locale for checkout carriers', () => {
    const cart = {
      carriers: [{ name: 'DHL', price: 30.77 }],
    } as unknown as Cart;
    const html = clean(renderToString(<EnShop><CartCarriers cart={cart} /></EnShop>));
    expect(html).toContain('\u00A330.77');
    expect(html).not.toContain('30,77');
  });

  // The other half of the contract: `/pure` stays context-free so it can render
  // inside a Server Component. A client host importing from there is the bug —
  // it silently gets the Dutch default.
  it('leaves the pure variant unresolved — that entry is for Server Components', () => {
    const html = clean(renderToString(<EnShop><PureProductPrice price={PRICE} /></EnShop>));
    expect(html).toContain('30,77');
  });

  it('still lets an explicit prop win over the provider', () => {
    const html = clean(
      renderToString(<EnShop><ProductPrice price={PRICE} language="NL" currency="\u20AC" /></EnShop>)
    );
    expect(html).toContain('30,77');
  });
});
