/**
 * Three defects that all came from the same place: a value the host supplied
 * never reaching the element that renders it.
 *
 * 1. ProductBulkPrices resolved its heading through `getLabel`, which treats an
 *    empty string as "missing" and substitutes the English default. The PDP
 *    passes `title: ''` to hide the heading, so it rendered "Volume pricing" on
 *    a Dutch page — the reported symptom.
 * 2. ProductCard never received a currency: the grid resolved one and dropped
 *    it, so a GBP shop's cards printed euros.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import ProductBulkPrices from '../ProductBulkPrices';
import ProductCard from '../ProductCard';
import type { Product } from '@propeller-commerce/propeller-sdk-v2';

const BULK_PRICES = [
  { quantity: 100, price: { gross: 3.45, net: 4.17 }, discount: { quantityFrom: 100 } },
] as unknown as Parameters<typeof ProductBulkPrices>[0]['bulkPrices'];

const PRODUCT = {
  productId: 1,
  sku: 'SKU-1',
  names: [{ language: 'EN', value: 'Widget' }],
  slugs: [{ language: 'EN', value: 'widget' }],
  price: { gross: 30.77, net: 37.23 },
} as unknown as Product;

const clean = (html: string) => html.replace(/<!-- -->/g, '');

describe('ProductBulkPrices heading', () => {
  it('renders the label the host supplies', () => {
    const html = clean(
      renderToString(<ProductBulkPrices bulkPrices={BULK_PRICES} labels={{ title: 'Volumeprijzen' }} />)
    );
    expect(html).toContain('Volumeprijzen');
    expect(html).not.toContain('Volume pricing');
  });

  it('renders no heading at all when the host passes an empty title', () => {
    const html = clean(renderToString(<ProductBulkPrices bulkPrices={BULK_PRICES} labels={{ title: '' }} />));
    expect(html).not.toContain('__title');
    expect(html).not.toContain('Volume pricing');
  });

  it('still falls back to English when the key is absent', () => {
    const html = clean(renderToString(<ProductBulkPrices bulkPrices={BULK_PRICES} labels={{}} />));
    expect(html).toContain('Volume pricing');
  });
});

describe('ProductCard currency', () => {
  it('formats the price with the currency it is given', () => {
    const html = clean(
      renderToString(<ProductCard product={PRODUCT} currency="£" language="EN" allowAddToCart={false} />)
    );
    expect(html).toContain('£');
    expect(html).not.toContain('€');
  });

  it('formats the number in the storefront language', () => {
    const en = clean(
      renderToString(<ProductCard product={PRODUCT} currency="£" language="EN" allowAddToCart={false} />)
    );
    // en-GB: symbol tight against the amount, period decimal.
    expect(en).toContain('£30.77');
    const nl = clean(
      renderToString(<ProductCard product={PRODUCT} currency="€" language="NL" allowAddToCart={false} />)
    );
    expect(nl).toContain('€ 30,77');
  });
});

// The mini-cart's own total row is not asserted here: its sidebar renders
// empty on the server (it gates on a mounted flag), and this package tests with
// `renderToString` only. The label now follows the same excl./incl. switch the
// figure does — see `totalLabel()` in CartIconAndSidebar.
