/**
 * A mock `Services` bundle for Storybook.
 *
 * The real `Services` bundle is 15 SDK service objects, each with many async
 * methods. Interactive-component stories (AddToCart, ProductGrid, …) call
 * only a few of those, and enumerating every method would be unmaintainable.
 *
 * So this is a `Proxy`: any `services.<service>.<method>(...)` call resolves
 * to a Promise of fixture data. A few well-known methods return purpose-built
 * fixtures (a product search returns a products page, a cart mutation returns
 * a cart); everything else returns an empty-ish object so a story never
 * crashes on an unmocked call.
 *
 * Stories are for *visual* development — they are not behaviour tests. The
 * consumer's e2e suite covers real SDK behaviour.
 */
import type { Services } from '@propeller-commerce/propeller-v2-core-ui';
import { makeProduct, makeCart, makeCluster } from './fixtures';

// Method-name → fixture-result map for the calls stories actually exercise.
// Matched on the method name regardless of which service it sits on.
const RESULT_BY_METHOD: Record<string, () => unknown> = {
  // Product search / fetch
  getProducts: () => ({
    page: 1,
    offset: 12,
    count: 3,
    items: [
      makeProduct({ productId: 1001 }),
      makeProduct({ productId: 1002, names: [{ language: 'EN', value: 'Impact Driver 18V' }] }),
      makeProduct({ productId: 1003, names: [{ language: 'EN', value: 'Circular Saw 18V' }] }),
    ],
  }),
  getProduct: () => makeProduct(),
  getClusters: () => ({ page: 1, offset: 12, count: 1, items: [makeCluster()] }),
  getCluster: () => makeCluster(),

  // Cart mutations — all return a cart so the UI can re-render.
  getCart: () => makeCart(),
  getCarts: () => ({ items: [makeCart()] }),
  startCart: () => makeCart(),
  addItemToCart: () => makeCart(),
  updateCartItem: () => makeCart(),
  deleteCartItem: () => makeCart(),
  addActionCodeToCart: () => makeCart(),
  removeActionCodeFromCart: () => makeCart(),
  updateCartAddress: () => makeCart(),

  // Crossupsells / bundles
  getCrossupsells: () => ({ items: [] }),
};

/**
 * Build the mock Services bundle. Every `services.x.y(...)` call returns a
 * resolved Promise — fixture data for known methods, `{}` otherwise.
 */
export function createMockServices(): Services {
  const serviceHandler: ProxyHandler<object> = {
    get() {
      // Each service is itself a proxy: property access yields an async
      // method whose result is chosen by the method name.
      return new Proxy(
        {},
        {
          get(_t, methodName: string) {
            return async (..._args: unknown[]) => {
              const factory = RESULT_BY_METHOD[methodName];
              return factory ? factory() : {};
            };
          },
        }
      );
    },
  };
  return new Proxy({}, serviceHandler) as unknown as Services;
}

// A single shared instance is enough for stories.
export const mockServices: Services = createMockServices();
