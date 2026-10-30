/**
 * ProductGrid — loading is exposed to assistive tech via aria-busy.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import ProductGrid from '../ProductGrid';

describe('ProductGrid — aria-busy', () => {
  it('is busy while loading', () => {
    const html = renderToString(<ProductGrid products={[]} isLoading={true} />);
    expect(html).toMatch(/class="propeller-product-grid[^"]*"[^>]*aria-busy="true"|aria-busy="true"[^>]*class="propeller-product-grid/);
  });

  it('is not busy once loaded', () => {
    const html = renderToString(<ProductGrid products={[]} isLoading={false} />);
    expect(html).not.toContain('aria-busy="true"');
  });
});
