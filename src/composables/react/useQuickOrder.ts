/**
 * useQuickOrder (React) — bulk "quick order" pad: resolve SKUs/codes to products
 * and add them all to the cart in a single bulk mutation.
 *
 * Backs the <QuickOrder> component. Two responsibilities:
 *  - `searchProducts(term)` — a product typeahead (debounced by the caller /
 *    component) so a row can resolve a typed SKU/code to a concrete product.
 *  - `submit(rows)` — resolve (or create) the user's cart, then bulk-add every
 *    row that carries a productId via `CartService.bulkUpdateCartItems`
 *    (the `CartItemBulk` mutation). Mirrors the WP plugin's "replenish" flow.
 *
 * All product/price data comes from the API — a row's typed code is only ever a
 * *search term*, never trusted for the product identity or price.
 */

import { useState, useCallback } from 'react';
import { createServices, getProductImageUrl, getClusterImageUrl } from '@propeller-commerce/propeller-v2-core-ui';
import {
  ProductSearchableField,
  ProductSortField,
  ProductStatus,
  SortOrder,
} from '@propeller-commerce/propeller-sdk-v2';
import type {
  GraphQLClient,
  Product,
  Cluster,
  Cart,
  CategoryProductSearchInput,
  CategoryQueryVariables,
  MediaImageProductSearchInput,
  TransformationsInput,
  CartItemBulkInput,
} from '@propeller-commerce/propeller-sdk-v2';
import type { AnyUser } from '@propeller-commerce/propeller-v2-core-ui';
import { initCart } from '../shared/utils/cartInit';
import { resolveListingUserId } from '../shared/utils/listingUserId';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A product resolved from a typed code — the shape a row fills in on select. */
export interface QuickOrderMatch {
  /** Product id (or cluster's default product id) — the cart line identity. */
  productId: number;
  /** Cluster id when the match is a cluster, else undefined. */
  clusterId?: number;
  /** Localized product name. */
  name: string;
  /** The product SKU/code (canonical, from the API). */
  sku: string;
  /** Net (excl. VAT) unit price. */
  netPrice: number;
  /** Gross (incl. VAT) unit price. */
  grossPrice: number;
  /** Minimum order quantity (defaults to 1). */
  minQuantity: number;
  /** Thumbnail URL, if any. */
  imageUrl: string;
}

/** One line a caller submits to be added to the cart. */
export interface QuickOrderLine {
  /** Resolved product id. */
  productId: number;
  /** Quantity to add. */
  quantity: number;
  /** Cluster id, when the line is a cluster. */
  clusterId?: number;
  /** The typed code — carried through only for missing-code reporting. */
  code?: string;
}

/** Options for {@link useQuickOrder}. */
export interface UseQuickOrderOptions {
  /** GraphQL client the hook derives its Services bundle from. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;
  /** The signed-in user (quick order is an authenticated feature). */
  user?: AnyUser;
  /** Active company id — scopes cart + pricing for B2B users. */
  companyId?: number;
  /** Language for search + cart queries. Defaults to `'NL'`. */
  language?: string;
  /** Max typeahead results per row. Defaults to 8. */
  searchLimit?: number;
  /** Tax zone for price calculation. Defaults to `'NL'`. */
  taxZone?: string;
  /** Orderlist (contract) ids to scope the catalogue by. */
  orderlistIds?: number[];
  /** Set `false` to ignore `orderlistIds`. Defaults to true when ids are given. */
  applyOrderlists?: boolean;
  /** Image filters + the base category the search is scoped to. */
  configuration?: {
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
    /** Catalog root. Without it the search returns nothing — see `searchProducts`. */
    baseCategoryId?: number;
    /** The channel's anonymous user, seeded by the host. Scopes logged-out
     *  listings exactly like the SSR seed does. */
    anonymousUserId?: number;
  };
  /** Fires when `submit` creates a fresh cart — persist the cart id. */
  onCartCreated?: (cart: Cart) => void;
  /** Fires after a successful bulk add — receives the resulting cart. */
  afterAddToCart?: (cart: Cart) => void;
}

/** Result of a {@link useQuickOrder.submit} call. */
export interface QuickOrderSubmitResult {
  success: boolean;
  /** The cart the items were added to. */
  cart?: Cart;
  /** How many lines were created/updated (from the bulk response). */
  added?: number;
  error?: string;
}

/** State + actions returned by {@link useQuickOrder}. */
export interface UseQuickOrderReturn {
  /** `true` while a bulk add is in flight. */
  submitting: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /**
   * Resolve a typed code/term to candidate products for the row typeahead.
   * Returns [] on empty term or error (never throws — a typeahead must not break typing).
   */
  searchProducts: (term: string) => Promise<QuickOrderMatch[]>;
  /**
   * Resolve (or create) the cart and bulk-add every line. Lines without a
   * productId are ignored. Returns the resulting cart + counts.
   */
  submit: (lines: QuickOrderLine[]) => Promise<QuickOrderSubmitResult>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Normalize a search result (product or cluster) into a {@link QuickOrderMatch}. */
function toMatch(item: Product | Cluster, language?: string): QuickOrderMatch {
  const isCluster = 'clusterId' in item;
  const displayItem = isCluster ? (item as Cluster).defaultProduct : (item as Product);
  const productId = (displayItem as Product)?.productId ?? (item as Product).productId;
  const clusterId = isCluster ? (item as Cluster).clusterId : undefined;
  const name =
    (language && item.names?.find((n) => n.language === language)?.value) ||
    item.names?.[0]?.value ||
    'Product';
  const netPrice = displayItem?.price?.net ?? 0;
  const grossPrice = displayItem?.price?.gross ?? 0;
  // Minimum order quantity: prefer the product's, floor at 1.
  const minQuantity = Math.max(1, (displayItem as Product)?.minimumQuantity ?? 1);
  // Canonical image accessor (handles product vs cluster default product).
  const imageUrl = isCluster
    ? getClusterImageUrl(item as Cluster)
    : getProductImageUrl(item as Product);
  return {
    productId,
    clusterId,
    name,
    sku: item.sku || displayItem?.sku || '',
    netPrice,
    grossPrice,
    minQuantity,
    imageUrl,
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────────

/**
 * useQuickOrder — product-code resolution + bulk add-to-cart.
 *
 * @remarks
 * GraphQL integration: services are built per-call via `createServices(graphqlClient)`.
 * `searchProducts` calls `services.category.getCategory()` over
 * `configuration.baseCategoryId` — the same path ProductGrid and the SearchBar
 * preview use. The flat `products` resolver ignores orderlist scoping
 * server-side, so searching through it returns products outside the user's
 * catalogue. Without a `baseCategoryId` the search returns nothing rather than
 * falling back to that resolver.
 *
 * `submit` resolves a cart with the shared `initCart` flow, then calls
 * `services.cart.bulkUpdateCartItems()` once with every line (`CartItemBulk`).
 * All calls require an authenticated session.
 */
export function useQuickOrder(options: UseQuickOrderOptions): UseQuickOrderReturn {
  const {
    graphqlClient,
    user,
    companyId,
    configuration = {},
    onCartCreated,
    afterAddToCart,
  } = options;
  const language = options.language || 'NL';
  const searchLimit = options.searchLimit ?? 8;
  const taxZone = options.taxZone || 'NL';
  const { orderlistIds, applyOrderlists } = options;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchProducts = useCallback(
    async (term: string): Promise<QuickOrderMatch[]> => {
      const trimmed = term.trim();
      if (!trimmed || !graphqlClient) return [];
      // No catalog root means no scope to search within. Fail closed rather than
      // fall back to the flat resolver, which would leak the whole catalogue.
      const catId = configuration.baseCategoryId ?? 0;
      if (!catId) return [];
      try {
        const service = createServices(graphqlClient).category;

        // Apply the contract when ids are supplied, else explicitly disable so an
        // authenticated user without one still searches the full catalogue.
        const orderlistScope =
          orderlistIds && orderlistIds.length > 0
            ? { applyOrderlists: applyOrderlists !== false, orderlistIds }
            : { applyOrderlists: false };

        const userId = resolveListingUserId(user, configuration);
        const contactId: number | undefined =
          user && 'contactId' in user ? (user as { contactId?: number }).contactId : undefined;
        const customerId: number | undefined =
          user && 'customerId' in user ? (user as { customerId?: number }).customerId : undefined;

        const input = {
          term: trimmed,
          language,
          page: 1,
          offset: searchLimit,
          statuses: [ProductStatus.A, ProductStatus.P, ProductStatus.T, ProductStatus.S],
          hidden: false,
          sortInputs: [{ field: ProductSortField.RELEVANCE, order: SortOrder.DESC }],
          ...(companyId && { companyId }),
          ...(userId !== undefined && { userId }),
          ...orderlistScope,
          searchFields: [
            {
              fieldNames: [
                ProductSearchableField.SKU,
                ProductSearchableField.NAME,
                ProductSearchableField.KEYWORDS,
                ProductSearchableField.CUSTOM_KEYWORDS,
              ],
              boost: 5,
            },
            {
              fieldNames: [
                ProductSearchableField.MANUFACTURER_CODE,
                ProductSearchableField.EAN_CODE,
                ProductSearchableField.BAR_CODE,
                ProductSearchableField.SUPPLIER_CODE,
                ProductSearchableField.PRODUCT_ID,
              ],
              boost: 1,
            },
          ],
        } as CategoryProductSearchInput & {
          applyOrderlists?: boolean;
          orderlistIds?: number[];
        };

        const variables = {
          categoryId: catId,
          language,
          categoryProductSearchInput: input,
          priceCalculateProductInput: {
            taxZone,
            ...(companyId && { companyId }),
            ...(contactId !== undefined && { contactId }),
            ...(customerId !== undefined && { customerId }),
          },
          imageSearchFilters: configuration.imageSearchFiltersGrid,
          imageVariantFilters: configuration.imageVariantFiltersSmall as TransformationsInput,
        } as CategoryQueryVariables;

        const response = await service.getCategory(variables);
        const items = ((response?.products as { items?: unknown[] } | undefined)?.items ??
          []) as (Product | Cluster)[];
        return items.map((it) => toMatch(it, language));
      } catch {
        // A typeahead must never break typing.
        return [];
      }
    },
    [
      graphqlClient,
      language,
      searchLimit,
      configuration,
      user,
      companyId,
      taxZone,
      orderlistIds,
      applyOrderlists,
    ]
  );

  const submit = useCallback(
    async (lines: QuickOrderLine[]): Promise<QuickOrderSubmitResult> => {
      const valid = lines.filter((l) => l.productId && (l.quantity ?? 0) > 0);
      if (!valid.length) return { success: false, error: 'No items to add' };
      if (!graphqlClient) return { success: false, error: 'No GraphQL client' };

      setSubmitting(true);
      setError(null);
      try {
        const services = createServices(graphqlClient);
        const cart = await initCart({
          services,
          user: user ?? null,
          companyId,
          language,
          imageSearchFilters: configuration.imageSearchFiltersGrid,
          imageVariantFilters: configuration.imageVariantFiltersSmall,
          onCartCreated,
        });

        const items: CartItemBulkInput[] = valid.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          ...(l.clusterId ? { clusterId: l.clusterId } : {}),
        }));

        const bulk = await services.cart.bulkUpdateCartItems({
          input: { cartId: cart.cartId, items },
        });

        // Re-hydrate the cart so callers get the updated line set (the bulk
        // mutation returns counts, not the cart).
        const updated = await services.cart.getCart({
          cartId: cart.cartId,
          language,
          imageSearchFilters: configuration.imageSearchFiltersGrid as MediaImageProductSearchInput,
          imageVariantFilters: configuration.imageVariantFiltersSmall as TransformationsInput,
        });
        const finalCart = updated ?? cart;

        afterAddToCart?.(finalCart);
        return {
          success: true,
          cart: finalCart,
          added: (bulk?.created ?? 0) + (bulk?.updated ?? 0),
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to add items to cart';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setSubmitting(false);
      }
    },
    [graphqlClient, user, companyId, language, configuration, onCartCreated, afterAddToCart]
  );

  return { submitting, error, searchProducts, submit };
}
