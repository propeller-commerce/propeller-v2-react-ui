/**
 * ProductGrid — the column count holds even when a host's own Tailwind sheet
 * loads after the package and re-emits `.grid-cols-2`.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToString } from 'react-dom/server';
import ProductGrid from '../ProductGrid';

const css = readFileSync(resolve(__dirname, '../../styles.css'), 'utf8').replace(/\r\n/g, '\n');

function mediaBlock(minWidth: string): string {
  const start = css.indexOf(`@media (min-width: ${minWidth}) {\n  .propeller-product-grid__grid--cols`);
  expect(start, `no ${minWidth} product-grid block in styles.css`).toBeGreaterThan(-1);
  const end = css.indexOf('\n}\n', start);
  return css.slice(start, end);
}

describe('ProductGrid — column modifier class', () => {
  it.each([2, 3, 4, 5, 6])('marks a %i-column grid', (columns) => {
    const html = renderToString(<ProductGrid products={[]} isLoading={true} columns={columns} />);
    expect(html).toContain(`propeller-product-grid__grid--cols-${columns}`);
  });

  it('defaults to the 3-column modifier', () => {
    const html = renderToString(<ProductGrid products={[]} isLoading={true} />);
    expect(html).toContain('propeller-product-grid__grid--cols-3');
  });

  it('adds no grid modifier to the 1-column list', () => {
    const html = renderToString(<ProductGrid products={[]} isLoading={true} columns={1} />);
    expect(html).not.toContain('propeller-product-grid__grid--cols-');
  });
});

describe('ProductGrid — column rules outside the utilities layer', () => {
  it.each([
    [3, 'repeat(3, minmax(0, 1fr))'],
    [4, 'repeat(4, minmax(0, 1fr))'],
    [5, 'repeat(5, minmax(0, 1fr))'],
    [6, 'repeat(6, minmax(0, 1fr))'],
  ])('restates %i columns at lg', (columns, template) => {
    const block = mediaBlock('64rem');
    expect(block).toMatch(
      new RegExp(`\\.propeller-product-grid__grid--cols-${columns}[^{]*\\{[^}]*grid-template-columns: ${template.replace(/[()]/g, '\\$&')}`),
    );
  });

  it('restates 3 columns at sm for the 5- and 6-column grids', () => {
    const block = mediaBlock('40rem');
    expect(block).toContain('.propeller-product-grid__grid--cols-5');
    expect(block).toContain('.propeller-product-grid__grid--cols-6');
    expect(block).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });
});
