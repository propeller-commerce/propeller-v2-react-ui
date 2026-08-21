/**
 * useProductSlider (React) — Crossupsell/product fetch + scroll tracking.
 *
 * Responsibilities:
 * - fetchCrossupsells: CrossupsellService with priceCalculateProductInput + extract productTo/clusterTo
 * - fetchProducts: ProductService.getProducts() batch call (NOT per-item getProduct())
 *   with statuses filter and filterAvailableAttributeInput
 * - Scroll position tracking for responsive sliding
 */

import { useState, useCallback } from 'react';
import { createServices } from '@propeller-commerce/propeller-v2-core-ui';
import { CrossupsellType, ProductStatus } from '@propeller-commerce/propeller-sdk-v2';
import type {
  GraphQLClient,
  Product,
  Cluster,
  Contact,
  Customer,
  Crossupsell,
  CrossupsellsQueryVariables,
  ProductsQueryVariables,
  ProductSearchInput,
  PriceCalculateProductInput,
  FilterAvailableAttributeInput,
  MediaImageProductSearchInput,
  TransformationsInput,
} from '@propeller-commerce/propeller-sdk-v2';
import { resolveListingUserId } from '../shared/utils/listingUserId';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Arguments for {@link UseProductSliderReturn.fetchCrossupsells}. */
export interface FetchCrossupsellsInput {
  /** Source product id to fetch crossupsells for. */
  productId?: number;
  /** Source cluster id to fetch crossupsells for. */
  clusterId?: number;
  /** Crossupsell types to include. */
  types?: CrossupsellType[];
}

/** Options for {@link useProductSlider}. */
export interface UseProductSliderOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** Language for product/crossupsell queries. Defaults to `'NL'`. */
  language?: string;
  /** Tax zone for price calculation. Defaults to `'NL'`. */
  taxZone?: string;
  /** The signed-in user; supplies contactId/customerId for per-user pricing. */
  user?: Contact | Customer | null;
  /** Active company id for company-scoped pricing. */
  companyId?: number;
  /** Portal configuration: image search/variant filters. */
  configuration?: {
    /** The channel's anonymous user, seeded by the host. Scopes logged-out
     *  listings exactly like the SSR seed does. */
    anonymousUserId?: number;
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersMedium?: TransformationsInput;
  };
}

/** State and slider actions returned by {@link useProductSlider}. */
export interface UseProductSliderReturn {
  /** The products/clusters currently shown in the slider. */
  products: (Product | Cluster)[];
  /** `true` while a fetch is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** `true` when the slider can scroll further left. */
  canScrollLeft: boolean;
  /** `true` when the slider can scroll further right. */
  canScrollRight: boolean;
  /** Fetches crossupsell products for a product/cluster and extracts their targets. */
  fetchCrossupsells: (input: FetchCrossupsellsInput) => Promise<void>;
  /** Batch-fetches products/clusters by id. */
  fetchProducts: (productIds: number[], clusterIds?: number[]) => Promise<void>;
  /** Scrolls the container left by one item width (default 280px). */
  scrollLeft: (containerEl: HTMLElement, itemWidth?: number) => void;
  /** Scrolls the container right by one item width (default 280px). */
  scrollRight: (containerEl: HTMLElement, itemWidth?: number) => void;
  /** Recomputes `canScrollLeft` / `canScrollRight` from the container's scroll position. */
  onScroll: (containerEl: HTMLElement) => void;
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * useProductSlider — crossupsell / product fetch plus scroll tracking.
 *
 * @param options - see {@link UseProductSliderOptions}.
 * @returns slider product state and fetch/scroll actions — see {@link UseProductSliderReturn}.
 *
 * @remarks
 * GraphQL integration: services are built per-call via `createServices(graphqlClient)`.
 * `fetchCrossupsells` calls `services.crossupsell.getCrossupsells()`
 * (`CrossupsellService`) with `priceCalculateProductInput`, then unwraps each
 * `Crossupsell`'s `productTo` / `clusterTo` target. `fetchProducts` calls
 * `services.product.getProducts()` (`ProductService`) as a single batch query (never
 * a per-id `getProduct`), with a status filter and `filterAvailableAttributeInput`.
 * The `scrollLeft` / `scrollRight` / `onScroll` helpers are pure DOM operations and
 * make no API calls.
 */
export function useProductSlider(options: UseProductSliderOptions): UseProductSliderReturn {
  const { graphqlClient, configuration = {} } = options;
  const language = options.language ?? 'NL';
  const taxZone = options.taxZone ?? 'NL';

  const [products, setProducts] = useState<(Product | Cluster)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // ── Price input builder ───────────────────────────────────────────────────

  function buildPriceInput(): PriceCalculateProductInput {
    const input: PriceCalculateProductInput = { taxZone };
    if (options.companyId) input.companyId = options.companyId;
    if (options.user && 'contactId' in options.user) input.contactId = (options.user as Contact).contactId;
    if (options.user && 'customerId' in options.user) input.customerId = (options.user as Customer).customerId;
    return input;
  }

  // ── Assortment filter ───────────────────────────────────────────────────
  // Resolves crossupsell items against the user's assortment via the same
  // `getProducts` query the listings use, and returns only the items that come
  // back (preserving the input order). Products outside the contact's
  // assortment are dropped — the backend simply omits them, exactly as it does
  // on the catalog/search pages (which scope by userId/companyId). On a query
  // failure we return the input unchanged so the slider isn't blanked.

  const resolveCompanyId = (): number | undefined => {
    if (options.companyId) return options.companyId;
    if (options.user && 'contactId' in options.user) return (options.user as Contact).company?.companyId;
    return undefined;
  };

  async function filterToAssortment(items: (Product | Cluster)[]): Promise<(Product | Cluster)[]> {
    if (!items.length) return items;

    const productIds: number[] = [];
    const clusterIds: number[] = [];
    for (const item of items) {
      if ('productId' in item && (item as Product).productId !== undefined) {
        productIds.push((item as Product).productId);
      } else if ('clusterId' in item && (item as Cluster).clusterId !== undefined) {
        clusterIds.push((item as Cluster).clusterId);
      }
    }
    if (!productIds.length && !clusterIds.length) return items;

    const userId = resolveUserId();
    const companyId = resolveCompanyId();
    const searchInput: ProductSearchInput = {
      ...(productIds.length && { productIds }),
      ...(clusterIds.length && { clusterIds }),
      language,
      page: 1,
      offset: 50,
      statuses: [ProductStatus.A, ProductStatus.P, ProductStatus.T, ProductStatus.S],
      ...(userId !== undefined && { userId }),
      ...(companyId !== undefined && { companyId }),
    };
    const filterAvailableAttributeInput: FilterAvailableAttributeInput = { isSearchable: true };
    const variables: ProductsQueryVariables = {
      input: searchInput,
      imageSearchFilters: configuration.imageSearchFiltersGrid,
      imageVariantFilters: configuration.imageVariantFiltersMedium as TransformationsInput,
      filterAvailableAttributeInput,
    };

    try {
      const response = await createServices(graphqlClient).product.getProducts(variables);
      const resolved = (response?.items ?? []) as (Product | Cluster)[];
      const allowed = new Set<number>();
      for (const r of resolved) {
        const id = (r as Product).productId ?? (r as Cluster).clusterId;
        if (id !== undefined) allowed.add(id);
      }
      return items.filter((item) => {
        const id = (item as Product).productId ?? (item as Cluster).clusterId;
        return id !== undefined && allowed.has(id);
      });
    } catch {
      // Verification failed — don't blank the slider; show the raw crossupsells.
      return items;
    }
  }

  function resolveUserId(): number | undefined {
    return resolveListingUserId(options.user, options.configuration);
  }

  // ── Fetch crossupsells ────────────────────────────────────────────────────
  // - includes priceCalculateProductInput
  // - extracts productTo / clusterTo from each Crossupsell

  const fetchCrossupsells = useCallback(async (input: FetchCrossupsellsInput): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const service = createServices(graphqlClient).crossupsell;
      const variables: CrossupsellsQueryVariables = {
        input: {
          page: 1,
          offset: 50,
          ...(input.types && input.types.length > 0 && { types: input.types }),
          ...(input.productId && { productIdsFrom: [input.productId] }),
          ...(input.clusterId && { clusterIdsFrom: [input.clusterId] }),
        },
        language,
        imageSearchFilters: configuration.imageSearchFiltersGrid,
        imageVariantFilters: configuration.imageVariantFiltersMedium as TransformationsInput,
        priceCalculateProductInput: buildPriceInput(),
      };

      const result = await service.getCrossupsells(variables);
      const crossupsells: Crossupsell[] = result?.items ?? [];

      const items: (Product | Cluster)[] = [];
      for (const cu of crossupsells) {
        if (cu.productTo) items.push(cu.productTo as Product);
        else if (cu.clusterTo) items.push(cu.clusterTo as Cluster);
      }

      // Crossupsell relationships are NOT scoped to the user's assortment —
      // they can reference products/clusters the signed-in contact may not
      // order or even open (the PDP returns "not found"). Re-resolve the
      // extracted ids through the assortment-aware `getProducts` query (the
      // same one `fetchProducts` uses, scoped by userId/companyId like the
      // catalog/search listings) and keep only the items that come back, in
      // the original crossupsell order. If this verification call fails we
      // fall back to the raw items so a transient error doesn't blank the
      // slider.
      const orderableItems = await filterToAssortment(items);
      setProducts(orderableItems);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch crossupsells');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [graphqlClient, language, taxZone, options.user, options.companyId, configuration]);

  // ── Fetch products (batch) ────────────────────────────────────────────────
  // - uses ProductService.getProducts() (batch), NOT per-item getProduct()
  // - includes statuses filter and filterAvailableAttributeInput

  const fetchProducts = useCallback(async (productIds: number[], clusterIds: number[] = []): Promise<void> => {
    if (!productIds.length && !clusterIds.length) return;
    setLoading(true);
    setError(null);
    try {
      const service = createServices(graphqlClient).product;

      const searchInput: ProductSearchInput = {
        productIds,
        clusterIds,
        language,
        page: 1,
        offset: 50,
        statuses: [
          ProductStatus.A,
          ProductStatus.P,
          ProductStatus.T,
          ProductStatus.S,
        ],
      };

      const filterAvailableAttributeInput: FilterAvailableAttributeInput = { isSearchable: true };

      const variables: ProductsQueryVariables = {
        input: searchInput,
        imageSearchFilters: configuration.imageSearchFiltersGrid,
        imageVariantFilters: configuration.imageVariantFiltersMedium as TransformationsInput,
        filterAvailableAttributeInput,
      };

      const response = await service.getProducts(variables);
      setProducts((response?.items ?? []) as (Product | Cluster)[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [graphqlClient, language, configuration]);

  // ── Scroll helpers ────────────────────────────────────────────────────────

  const onScroll = useCallback((containerEl: HTMLElement): void => {
    setCanScrollLeft(containerEl.scrollLeft > 0);
    setCanScrollRight(containerEl.scrollLeft + containerEl.clientWidth < containerEl.scrollWidth - 1);
  }, []);

  const scrollLeft = useCallback((containerEl: HTMLElement, itemWidth = 280): void => {
    containerEl.scrollBy({ left: -itemWidth, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback((containerEl: HTMLElement, itemWidth = 280): void => {
    containerEl.scrollBy({ left: itemWidth, behavior: 'smooth' });
  }, []);

  return {
    products,
    loading,
    error,
    canScrollLeft,
    canScrollRight,
    fetchCrossupsells,
    fetchProducts,
    scrollLeft,
    scrollRight,
    onScroll,
  };
}
