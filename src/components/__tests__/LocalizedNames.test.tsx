/**
 * Localized names and slugs follow the storefront language.
 *
 * A localized array carries one entry per authored language in catalog order,
 * so `names[0]` is the catalog's DEFAULT language — not the storefront's.
 * Reading index 0 therefore printed Dutch on an English shop, and (worse) put
 * Dutch slugs into product/cluster links on every non-default locale.
 *
 * Fixture shapes match the Quantore/Heuver payloads: NL first, EN second.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import OrderItemCard from '../OrderItemCard';
import ClusterOptions from '../ClusterOptions';
import type { OrderItem, ClusterOption } from '@propeller-commerce/propeller-sdk-v2';

const render = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

const ORDER_ITEM = {
  id: '1',
  name: 'fallback name',
  quantity: 1,
  product: {
    productId: 42,
    sku: 'SKU-42',
    names: [
      { language: 'NL', value: 'Montage grondverzetband' },
      { language: 'EN', value: 'Earthmover tyre fitting' },
    ],
    slugs: [
      { language: 'NL', value: 'montage-grondverzetband' },
      { language: 'EN', value: 'earthmover-tyre-fitting' },
    ],
  },
} as unknown as OrderItem;

describe('OrderItemCard localization', () => {
  it('renders the name in the active language', () => {
    const html = render(<OrderItemCard orderItem={ORDER_ITEM} language="EN" />);
    expect(html).toContain('Earthmover tyre fitting');
    expect(html).not.toContain('Montage grondverzetband');
  });

  it('builds the product link from the active language slug', () => {
    // The regression with teeth: a Dutch slug in the href on an English shop.
    const html = render(<OrderItemCard orderItem={ORDER_ITEM} language="EN" titleLinkable />);
    expect(html).toContain('/product/42/earthmover-tyre-fitting');
    expect(html).not.toContain('montage-grondverzetband');
  });

  it('still renders Dutch unchanged', () => {
    const html = render(<OrderItemCard orderItem={ORDER_ITEM} language="NL" titleLinkable />);
    expect(html).toContain('Montage grondverzetband');
    expect(html).toContain('/product/42/montage-grondverzetband');
  });

  it('falls back to a translation that exists rather than blanking', () => {
    const dutchOnly = {
      ...ORDER_ITEM,
      product: {
        ...(ORDER_ITEM.product as object),
        names: [{ language: 'NL', value: 'Alleen Nederlands' }],
      },
    } as unknown as OrderItem;
    const html = render(<OrderItemCard orderItem={dutchOnly} language="EN" />);
    expect(html).toContain('Alleen Nederlands');
  });
});

const OPTIONS = [
  {
    id: 7,
    names: [
      { language: 'NL', value: 'Montage grondverzetband' },
      { language: 'EN', value: 'Earthmover tyre fitting' },
    ],
    products: [
      {
        productId: 99,
        names: [
          { language: 'NL', value: 'Inname oude band' },
          { language: 'EN', value: 'Old tyre take-back' },
        ],
        price: { gross: 10 },
      },
    ],
  },
] as unknown as ClusterOption[];

describe('ClusterOptions localization', () => {
  it('renders option group and option product names in the active language', () => {
    const html = render(<ClusterOptions clusterId={44} options={OPTIONS} language="EN" />);
    expect(html).toContain('Earthmover tyre fitting');
    expect(html).toContain('Old tyre take-back');
    expect(html).not.toContain('Montage grondverzetband');
  });

  it('still renders Dutch unchanged', () => {
    const html = render(<ClusterOptions clusterId={44} options={OPTIONS} language="NL" />);
    expect(html).toContain('Montage grondverzetband');
    expect(html).toContain('Inname oude band');
  });
});
