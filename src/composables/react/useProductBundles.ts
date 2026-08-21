/**
 * useProductBundles (React) — Bundle fetching and add-to-cart flow.
 */

import { useState, useCallback } from 'react';
import { createServices } from '@propeller-commerce/propeller-v2-core-ui';
import type { GraphQLClient, Cart, MediaImageProductSearchInput, TransformationsInput, Product } from '@propeller-commerce/propeller-sdk-v2';
import { initCart } from '../shared/utils/cartInit';
import type { AnyUser } from '@propeller-commerce/propeller-v2-core-ui';

/** A product bundle with its constituent products and pricing. */
export interface BundleItem {
  /** Bundle id. */
  id: number;
  /** Bundle display name. */
  name: string;
  /** Products that make up the bundle. */
  products: Product[];
  /** Discount applied to the bundle. */
  discount?: number;
  /** Sum of the products' individual prices. */
  originalTotal?: number;
  /** Discounted total price of the bundle. */
  bundleTotal?: number;
}

/** Options for {@link useProductBundles}. */
export interface UseProductBundlesOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** The signed-in user; scopes cart resolution and pricing. */
  user: AnyUser;
  /** Active company id for B2B cart resolution. */
  companyId?: number;
  /** Language for bundle queries. Falls back to `configuration.language`, then `'NL'`. */
  language?: string;
  /** Portal configuration: language plus required image search/variant filters. */
  configuration: {
    language?: string;
    imageSearchFiltersGrid: MediaImageProductSearchInput;
    imageVariantFiltersSmall: TransformationsInput;
  };
  /** Fires when a fresh cart is created — use it to persist the cart id. */
  onCartCreated?: (cart: Cart) => void;
}

/** State and bundle actions returned by {@link useProductBundles}. */
export interface UseProductBundlesReturn {
  /** The fetched bundles. */
  bundles: BundleItem[];
  /** `true` while a bundle fetch is in flight. */
  loading: boolean;
  /** `true` while a bundle is being added to the cart. */
  adding: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** Id of the cart bundles are added to. */
  cartId: string;
  /** Fetches bundles that contain the given product. */
  fetchBundles: (productId: number) => Promise<void>;
  /** Adds a bundle to a (new or existing) cart. */
  addBundleToCart: (bundleId: number, existingCartId?: string) => Promise<{ success: boolean; cart?: Cart; error?: string }>;
  /** Computes the rounded discount percentage between an original and discounted price. */
  calcDiscountPercent: (original: number, discounted: number) => number;
}

/**
 * useProductBundles — bundle fetching and add-to-cart flow.
 *
 * @param options - see {@link UseProductBundlesOptions}.
 * @returns bundle state plus async actions — see {@link UseProductBundlesReturn}.
 *
 * @remarks
 * GraphQL integration: services are built per-call via `createServices(graphqlClient)`.
 * `fetchBundles` calls `services.bundle.getBundles()` (`BundleService`) filtered by
 * product id. `addBundleToCart` resolves a cart via the shared `initCart` flow when
 * none exists, then calls `services.cart.addBundleToCart()` (`CartService`).
 * `calcDiscountPercent` is pure and makes no API call. Cart mutations require an
 * authenticated session.
 */
export function useProductBundles(options: UseProductBundlesOptions): UseProductBundlesReturn {
  const { graphqlClient, user, companyId, configuration, onCartCreated } = options;
  const language = options.language || configuration.language || 'NL';

  const [bundles, setBundles] = useState<BundleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartId, setCartId] = useState('');

  const fetchBundles = useCallback(async (productId: number): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const service = createServices(graphqlClient).bundle;
      const result = await service.getBundles({ input: { productIds: [productId], page: 1, offset: 100 }, language, imageSearchFilters: configuration.imageSearchFiltersGrid, imageVariantFilters: configuration.imageVariantFiltersSmall });
      setBundles(((result as any)?.items || []) as BundleItem[]);
    } catch (e: any) { setError(e?.message || 'Failed to fetch bundles'); }
    finally { setLoading(false); }
  }, [graphqlClient, language, configuration]);

  const addBundleToCart = useCallback(
    async (bundleId: number, existingCartId?: string): Promise<{ success: boolean; cart?: Cart; error?: string }> => {
      setAdding(true); setError(null);
      try {
        let resolvedCartId = existingCartId || cartId;
        if (!resolvedCartId) {
          const cart = await initCart({ services: createServices(graphqlClient), user, companyId, language, imageSearchFilters: configuration.imageSearchFiltersGrid, imageVariantFilters: configuration.imageVariantFiltersSmall, onCartCreated: (c) => { setCartId(c.cartId); onCartCreated?.(c); } });
          resolvedCartId = cart.cartId;
          setCartId(resolvedCartId);
        }
        const cartService = createServices(graphqlClient).cart;
        const cart = await cartService.addBundleToCart({ id: resolvedCartId, input: { bundleId: String(bundleId) }, language, imageSearchFilters: configuration.imageSearchFiltersGrid, imageVariantFilters: configuration.imageVariantFiltersSmall });
        return { success: true, cart };
      } catch (e: any) {
        const msg = e?.message || 'Failed to add bundle to cart';
        setError(msg); return { success: false, error: msg };
      } finally { setAdding(false); }
    },
    [graphqlClient, user, companyId, language, configuration, cartId, onCartCreated]
  );

  const calcDiscountPercent = useCallback((original: number, discounted: number): number => {
    if (!original || original === 0) return 0;
    return Math.round(((original - discounted) / original) * 100);
  }, []);

  return { bundles, loading, adding, error, cartId, fetchBundles, addBundleToCart, calcDiscountPercent };
}
