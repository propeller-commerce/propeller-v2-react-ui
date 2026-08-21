/**
 * useCart reports the caller's cart id.
 *
 * The hook used to seed its id once — `useState(options.cartId || '')` — and
 * only ever reassign it from its own cart-creation path. A component that
 * mounts before the cart resolves therefore held '' permanently.
 * `CartIconAndSidebar` lives in the header and renders on the first paint of
 * every page, so its "Request authorization" button rendered enabled, fired,
 * and returned `err('No cart')` with nothing sent. The id is now derived from
 * the prop on every render instead of captured at mount.
 *
 * NOTE ON COVERAGE: these assertions do NOT catch the original regression.
 * This package tests in `node` with `renderToString`, where every render is a
 * fresh mount — and on a fresh mount the old mount-time capture produced the
 * right answer too. Distinguishing the two needs a re-render, which needs a DOM
 * renderer this package deliberately does not carry. What is locked here is the
 * contract itself (prop present → reported, absent → empty); the regression is
 * covered by the shape of the code, which no longer has mount-time state to go
 * stale.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { useCart } from '../useCart';
import type { GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';

/** Renders whatever id the hook currently reports. No network is touched. */
function Probe({ cartId }: { cartId?: string }) {
  const cart = useCart({
    graphqlClient: {} as GraphQLClient,
    user: null,
    cartId,
  });
  return <span>{cart.cartId || 'EMPTY'}</span>;
}

describe('useCart cart id', () => {
  it('reports the id the caller passes', () => {
    expect(renderToString(<Probe cartId="cart-123" />)).toContain('cart-123');
  });

  it('reports empty while the caller has no cart yet', () => {
    expect(renderToString(<Probe />)).toContain('EMPTY');
  });
});
