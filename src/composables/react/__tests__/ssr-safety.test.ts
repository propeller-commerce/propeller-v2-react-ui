/**
 * SSR-safety tests for React hooks.
 *
 * Ensures every hook module is importable in a Node environment without
 * touching browser globals (window, document, localStorage) at module
 * evaluation time. This catches the class of bugs where a top-level
 * `const X = localStorage.getItem(...)` or similar slips in and crashes the
 * SSR render for the consumer (Next.js App Router server components).
 *
 * Why import-only (not factory-call) for React: hooks can only be called
 * from inside a renderer, so invoking them at module scope throws "Invalid
 * hook call" — which masks the real SSR question. The module-evaluation
 * boundary is the meaningful gate here. Anything reachable from the import
 * graph must be Node-safe; anything gated to render time can use browser
 * globals freely.
 *
 * Runs in vitest's Node env (per vitest.config.ts) — no jsdom, no window.
 */

import { describe, it, expect } from 'vitest';

// Sanity: we really are in Node, not jsdom.
describe('test environment', () => {
  it('is Node — window is undefined', () => {
    expect(typeof window).toBe('undefined');
  });

  it('Node — localStorage is undefined', () => {
    expect(typeof localStorage).toBe('undefined');
  });

  it('Node — document is undefined', () => {
    expect(typeof document).toBe('undefined');
  });
});

describe('React hooks — module-evaluation SSR safety', () => {
  // Every hook module must be importable without throwing in Node. If any
  // hook starts pulling in a DOM-only module via a transitive import, this
  // catches it before it reaches the consumer's RSC tree.
  const modules: Array<[string, () => Promise<unknown>]> = [
    ['useAddress', () => import('../useAddress')],
    ['useAuth', () => import('../useAuth')],
    ['useCart', () => import('../useCart')],
    ['useCheckout', () => import('../useCheckout')],
    ['useClusterConfigurator', () => import('../useClusterConfigurator')],
    ['useCompany', () => import('../useCompany')],
    ['useFavorites', () => import('../useFavorites')],
    ['useInfraProps', () => import('../useInfraProps')],
    ['useMenu', () => import('../useMenu')],
    ['useOrders', () => import('../useOrders')],
    ['useProductBundles', () => import('../useProductBundles')],
    ['useProductInfo', () => import('../useProductInfo')],
    ['useMachines', () => import('../useMachines')],
    ['useProductSearch', () => import('../useProductSearch')],
    ['useProductSlider', () => import('../useProductSlider')],
    ['useProductSpecs', () => import('../useProductSpecs')],
    ['usePurchaseAuthorization', () => import('../usePurchaseAuthorization')],
    ['useResolvedProps', () => import('../useResolvedProps')],
    ['useServices', () => import('../useServices')],
    ['useSpareParts', () => import('../useSpareParts')],
  ];

  for (const [name, mod] of modules) {
    it(`${name} imports without throwing`, async () => {
      await expect(mod()).resolves.toBeDefined();
    });
  }
});
