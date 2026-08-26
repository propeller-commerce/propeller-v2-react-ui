/**
 * Order and quote lines whose product came back null.
 *
 * A product that is hidden, withdrawn or deleted from the catalog still appears
 * on every order and quote it was sold on, but the API returns no product
 * record for it — `orderItem.product` is simply absent. The order item carries
 * its own snapshot of the line (name, sku, quantity, prices) taken when the
 * order was placed, so the row has to render from that alone: no image, no
 * localized name, no PDP link.
 *
 * Fixture shape matches a quote line for a hidden product: everything the
 * catalog would have supplied is missing, everything the order stored is there.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import OrderItemCard from '../OrderItemCard';
import type { OrderItem, ProductPrice } from '@propeller-commerce/propeller-sdk-v2';

const render = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

/** A quote line whose product is gone from the catalog. */
const HIDDEN_ITEM = {
  id: 9,
  name: 'Verborgen product',
  sku: 'HID-1',
  quantity: 3,
  price: 10,
  originalPrice: 12,
  discount: 2,
  priceTotal: 30.77,
} as unknown as OrderItem;

/** The same line, but the catalog still has the product. */
const VISIBLE_ITEM = {
  ...HIDDEN_ITEM,
  product: {
    productId: 42,
    sku: 'CAT-42',
    names: [{ language: 'NL', value: 'Zichtbaar product' }],
    slugs: [{ language: 'NL', value: 'zichtbaar-product' }],
    price: { gross: 10, net: 12.1 } as ProductPrice,
  },
} as unknown as OrderItem;

describe('OrderItemCard with no product', () => {
  it('falls back to the order item for the name and the sku', () => {
    const html = render(
      <table>
        <OrderItemCard orderItem={HIDDEN_ITEM} language="NL" />
      </table>
    );
    expect(html).toContain('Verborgen product');
    expect(html).toContain('SKU: HID-1');
  });

  it('renders the title as plain text — there is no slug to link to', () => {
    const html = render(
      <table>
        <OrderItemCard orderItem={HIDDEN_ITEM} language="NL" titleLinkable />
      </table>
    );
    expect(html).not.toContain('<a');
  });

  it('shows the image placeholder instead of a broken thumbnail', () => {
    const html = render(
      <table>
        <OrderItemCard orderItem={HIDDEN_ITEM} language="NL" />
      </table>
    );
    expect(html).toContain('propeller-order-item-card__image-placeholder');
    expect(html).not.toContain('<img');
  });

  it('still prices the line from the order item', () => {
    const html = render(
      <table>
        <OrderItemCard orderItem={HIDDEN_ITEM} language="NL" showDiscount />
      </table>
    );
    expect(html).toContain('30,77');
    expect(html).toContain('2,00');
    expect(html).toContain('3');
  });

  // The regression: an injected price slot is handed `product.price`, which a
  // product-less line does not have. Passing `undefined` rendered an empty
  // price cell and the line total vanished from the row.
  it('bypasses an injected price component and keeps the line total', () => {
    const Injected = () => <span>injected</span>;
    const html = render(
      <table>
        <OrderItemCard orderItem={HIDDEN_ITEM} language="NL" priceComponent={Injected} />
      </table>
    );
    expect(html).not.toContain('injected');
    expect(html).toContain('30,77');
  });

  it('still delegates to the injected price component when the product is there', () => {
    const Injected = () => <span>injected</span>;
    const html = render(
      <table>
        <OrderItemCard orderItem={VISIBLE_ITEM} language="NL" priceComponent={Injected} />
      </table>
    );
    expect(html).toContain('injected');
  });

  it('links and localizes normally when the product is there', () => {
    const html = render(
      <table>
        <OrderItemCard orderItem={VISIBLE_ITEM} language="NL" />
      </table>
    );
    expect(html).toContain('Zichtbaar product');
    expect(html).toContain('/product/42/zichtbaar-product');
    expect(html).toContain('SKU: CAT-42');
  });

  it('falls back per child item, not per row', () => {
    const html = render(
      <table>
        <OrderItemCard
          orderItem={VISIBLE_ITEM}
          language="NL"
          childItems={[HIDDEN_ITEM]}
        />
      </table>
    );
    expect(html).toContain('Zichtbaar product');
    expect(html).toContain('Verborgen product');
  });
});
