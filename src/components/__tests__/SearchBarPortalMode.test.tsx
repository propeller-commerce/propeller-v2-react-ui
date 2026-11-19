// @vitest-environment happy-dom
/**
 * SearchBar — autosuggest prices follow the shared `isContentHidden` rule.
 *
 * The dropdown only opens after results arrive (a client effect), so this file
 * mounts with `react-dom/client` in happy-dom instead of the server render the
 * other component tests use. `useProductSearch` is replaced by a fixed result
 * list; everything else is the real component.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import SearchBar from '../SearchBar';
import ProductBulkPrices from '../ProductBulkPrices';

const { RESULTS } = vi.hoisted(() => ({
  RESULTS: [
    {
      productId: 41,
      sku: 'DRILL-41',
      names: [{ language: 'NL', value: 'Boormachine' }],
      slugs: [{ language: 'NL', value: 'boormachine' }],
      price: { gross: 123.45, net: 149.37 },
    },
  ],
}));

vi.mock('../../composables/react/useProductSearch', () => ({
  useProductSearch: () => ({
    search: () => {},
    searchResults: RESULTS,
    searchItemsFound: RESULTS.length,
    searchLoading: false,
    searchError: null,
  }),
}));

// ponytail: core-ui <= 0.13.1 applies the guest rule to `semi-closed` only; the
// `closed` rule ships with core-ui's security-review-fixes (2450f32). Until the
// pin includes it, map closed onto the same rule so these tests pin this
// package's wiring. A no-op once core-ui ships it; delete it then.
vi.mock('@propeller-commerce/propeller-v2-core-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@propeller-commerce/propeller-v2-core-ui')>();
  return {
    ...actual,
    isContentHidden: (...[mode, user, isAuthenticated]: Parameters<typeof actual.isContentHidden>) =>
      actual.isContentHidden(mode === 'closed' ? 'semi-closed' : mode, user, isAuthenticated),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

function mount(element: React.ReactElement): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(element));
  return host;
}

const CONTACT = { contactId: 1 } as never;

function mountSearchBar(props: Record<string, unknown>): HTMLElement {
  return mount(<SearchBar language="NL" {...props} />);
}

describe('SearchBar autosuggest prices', () => {
  it('renders the result and its price in an open portal (fixture sanity)', () => {
    const el = mountSearchBar({ portalMode: 'open', user: null });
    expect(el.textContent).toContain('Boormachine');
    expect(el.querySelector('.propeller-search-bar__result-price')).not.toBeNull();
    expect(el.textContent).toContain('123,45');
  });

  it.each(['semi-closed', 'closed'])('hides the price from a guest in a %s portal', (portalMode) => {
    const el = mountSearchBar({ portalMode, user: null });
    expect(el.textContent).toContain('Boormachine');
    expect(el.querySelector('.propeller-search-bar__result-price')).toBeNull();
    expect(el.textContent).not.toContain('123,45');
    expect(el.textContent).not.toContain('149,37');
  });

  it.each(['semi-closed', 'closed'])('hides "Price on request" from a guest in a %s portal', (portalMode) => {
    const original = RESULTS[0] as Record<string, unknown>;
    original.priceData = { display: 'ON_REQUEST' };
    try {
      const el = mountSearchBar({ portalMode, user: null });
      expect(el.querySelector('.propeller-search-bar__result-price')).toBeNull();
    } finally {
      delete original.priceData;
    }
  });

  it('skips a custom renderPrice for a guest in a semi-closed portal', () => {
    const renderPrice = vi.fn(() => <span className="custom-price">custom</span>);
    const el = mountSearchBar({ portalMode: 'semi-closed', user: null, renderPrice });
    expect(el.querySelector('.custom-price')).toBeNull();
    expect(renderPrice).not.toHaveBeenCalled();
  });

  it.each(['semi-closed', 'closed'])('shows the price to a logged-in user in a %s portal', (portalMode) => {
    const el = mountSearchBar({ portalMode, user: CONTACT });
    expect(el.querySelector('.propeller-search-bar__result-price')).not.toBeNull();
    expect(el.textContent).toContain('123,45');
  });

  it('shows the price while the user is still loading but a session exists (isAuthenticated)', () => {
    const el = mountSearchBar({ portalMode: 'closed', user: null, isAuthenticated: true });
    expect(el.textContent).toContain('123,45');
  });
});

describe('ProductBulkPrices in a closed portal', () => {
  const TIERS = [
    { quantity: 10, gross: 9.5, net: 11.5 },
    { quantity: 50, gross: 8.75, net: 10.59 },
  ] as never[];

  it('hides the tier table from a guest', () => {
    const el = mount(<ProductBulkPrices bulkPrices={TIERS} portalMode="closed" user={null} />);
    expect(el.querySelector('table')).toBeNull();
    expect(el.textContent).not.toContain('8,75');
  });

  it('shows the tier table to a logged-in user', () => {
    const el = mount(<ProductBulkPrices bulkPrices={TIERS} portalMode="closed" user={CONTACT} />);
    expect(el.querySelector('table')).not.toBeNull();
    expect(el.textContent).toContain('8,75');
  });
});
