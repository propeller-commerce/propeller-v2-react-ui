/**
 * GridPagination — pagination entries as links.
 *
 * Page numbers navigate to a different URL, so they are anchors with a real
 * `href` once `pageHref` is supplied: that is what gives the browser the
 * status-bar preview, open-in-new-tab and copy-link-address. They stayed
 * buttons with no href, so none of that worked (PWP-1060).
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import GridPagination from '../GridPagination';

const PRODUCTS = { page: 2, pages: 5 };
const href = (page: number) => `/category/1329/inkt-en-toner?page=${page}`;

function render(props: Record<string, unknown> = {}) {
  return renderToString(
    <GridPagination products={PRODUCTS} onPageChange={() => {}} variant="full" {...props} />,
  );
}

describe('GridPagination markup', () => {
  it('renders anchors with hrefs when pageHref is given', () => {
    const html = render({ pageHref: href });
    expect(html).toContain('href="/category/1329/inkt-en-toner?page=3"');
    expect(html).toContain('href="/category/1329/inkt-en-toner?page=1"');
    expect(html).not.toContain('<button');
  });

  it('keeps buttons when pageHref is omitted, so existing callers are unchanged', () => {
    const html = render();
    expect(html).toContain('<button');
    expect(html).not.toContain('href=');
  });

  it('marks the current page with aria-current instead of disabling it', () => {
    const html = render({ pageHref: href });
    expect(html).toContain('aria-current="page"');
    // The current page keeps its own URL — it is reachable, not inert.
    expect(html).toContain('href="/category/1329/inkt-en-toner?page=2"');
  });

  it('puts rel=prev/next only on the adjacent entries', () => {
    const html = render({ pageHref: href });
    expect(html.match(/rel="prev"/g)).toHaveLength(1);
    expect(html.match(/rel="next"/g)).toHaveLength(1);
  });

  it('is a labelled navigation landmark containing a list', () => {
    const html = render({ pageHref: href });
    expect(html).toContain('<nav');
    expect(html).toContain('aria-label="Pagination"');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
  });

  // A control that cannot act should not hold a place in the tab order.
  it('omits Previous on the first page and Next on the last', () => {
    const first = renderToString(
      <GridPagination
        products={{ page: 1, pages: 5 }}
        onPageChange={() => {}}
        variant="full"
        pageHref={href}
      />,
    );
    expect(first).not.toContain('--prev');
    expect(first).toContain('--next');

    const last = renderToString(
      <GridPagination
        products={{ page: 5, pages: 5 }}
        onPageChange={() => {}}
        variant="full"
        pageHref={href}
      />,
    );
    expect(last).toContain('--prev');
    expect(last).not.toContain('--next');
  });

  it('applies the same treatment to the compact variant', () => {
    const html = render({ variant: 'compact', pageHref: href });
    expect(html).toContain('<nav');
    expect(html).toContain('href="/category/1329/inkt-en-toner?page=3"');
    expect(html).toContain('rel="next"');
  });

  it('renders nothing when there is only one page', () => {
    const html = render({ products: { page: 1, pages: 1 }, pageHref: href });
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('<button');
  });

  it('overrides the landmark name from labels', () => {
    const html = render({ pageHref: href, labels: { paginationLabel: 'Paginering' } });
    expect(html).toContain('aria-label="Paginering"');
  });
});
