/**
 * ProductTabs — Downloads and Videos only when the product has them.
 *
 * Both tabs rendered unconditionally, so a product with no files showed a
 * Downloads tab whose panel said "No downloads" and a Videos tab saying
 * "No videos" (PWP-1061). They now follow Description: shown when there is
 * content to show.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import ProductTabs from '../ProductTabs';
import type { Product } from '@propeller-commerce/propeller-sdk-v2';

const DESC = [{ language: 'NL', value: 'Een beschrijving' }];

function product(media: unknown): Product {
  return { productId: 1, descriptions: DESC, media } as unknown as Product;
}

const render = (p: Product) =>
  renderToString(<ProductTabs product={p} language="NL" />);

describe('ProductTabs — downloads and videos visibility', () => {
  it('hides both tabs when the product has neither', () => {
    const html = render(product({ documents: { items: [] }, videos: { items: [] } }));
    expect(html).not.toContain('>Downloads<');
    expect(html).not.toContain('>Videos<');
  });

  it('hides both tabs when media is absent entirely', () => {
    const html = render(product(undefined));
    expect(html).not.toContain('>Downloads<');
    expect(html).not.toContain('>Videos<');
  });

  it('shows Downloads when the product has a document', () => {
    const html = render(
      product({ documents: { items: [{ documents: [] }] }, videos: { items: [] } }),
    );
    expect(html).toContain('>Downloads<');
    expect(html).not.toContain('>Videos<');
  });

  it('shows Videos when the product has a video', () => {
    const html = render(
      product({ documents: { items: [] }, videos: { items: [{ videos: [] }] } }),
    );
    expect(html).toContain('>Videos<');
    expect(html).not.toContain('>Downloads<');
  });

  // Description and Specifications are unaffected by this change.
  it('still shows description and specifications', () => {
    const html = render(product({ documents: { items: [] }, videos: { items: [] } }));
    expect(html).toContain('>Description<');
    expect(html).toContain('>Specifications<');
  });
});
