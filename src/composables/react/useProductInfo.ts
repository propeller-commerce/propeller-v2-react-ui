/**
 * useProductInfo (React) — Sequential product/cluster data fetching.
 *
 * Responsibilities:
 * - ProductInfo: getOrderlists → getProduct (sequential; orderlists needed for price tier)
 * - ClusterInfo: getClusterConfig → getCluster (sequential; config drives attribute names)
 * - priceCalculateProductInput + userBulkPriceProductInput for correct per-user pricing
 * - Cluster fallback chain: cluster → defaultProduct for name/sku/price/image
 */

import { useState, useCallback, useMemo } from 'react';
import { createServices } from '@propeller-commerce/propeller-v2-core-ui';
import type {
  GraphQLClient,
  Product,
  Cluster,
  Contact,
  Customer,
  LocalizedString,
  ClusterConfigSetting,
  ProductQueryVariables,
  ClusterVariables,
  PriceCalculateProductInput,
  UserBulkPriceProductInput,
  AttributeResultSearchInput,
  MediaImageProductSearchInput,
  TransformationsInput,
  OrderlistSearchInput,
} from '@propeller-commerce/propeller-sdk-v2';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Options for {@link useProductInfo}. */
export interface UseProductInfoOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** Language for product/cluster queries. Defaults to `'NL'`. */
  language?: string;
  /** Tax zone used for price calculation. Defaults to `'NL'`. */
  taxZone?: string;
  /** The signed-in user; supplies contactId/customerId for per-user pricing. */
  user?: Contact | Customer | null;
  /** Active company id for company-scoped pricing and orderlist resolution. */
  companyId?: number;
  /**
   * Scope the product fetch to specific orderlist IDs (e.g. a chosen B2B
   * contract). When provided, these override the default behaviour of resolving
   * and applying ALL of the company's orderlists.
   */
  orderlistIds?: number[];
  /**
   * Apply the orderlist filter. Defaults to `true` when `orderlistIds` is
   * non-empty (or resolved from the company), `false` when explicitly set so an
   * authenticated user without a contract sees the full catalogue.
   */
  applyOrderlists?: boolean;
  /** Attribute names to include in attributeResultSearchInput (productTrackAttributes). */
  productTrackAttributes?: string[];
  /** Portal configuration: image search/variant filters per size. */
  configuration?: {
    /** Image search filters applied to product/cluster media. */
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    /** Used for products (ProductInfo). */
    imageVariantFiltersLarge?: TransformationsInput;
    /** Used for clusters (ClusterInfo). */
    imageVariantFiltersMedium?: TransformationsInput;
    /** Alias: some configs use imageVariantFiltersSmall for product images. */
    imageVariantFiltersSmall?: TransformationsInput;
  };
}

/** State and fetch actions returned by {@link useProductInfo}. */
export interface UseProductInfoReturn {
  /** The fetched product, or `null`. */
  product: Product | null;
  /** The fetched cluster, or `null`. */
  cluster: Cluster | null;
  /** `true` while a product/cluster fetch is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** Fetches a product by id, optionally overriding the image filters. */
  fetchProduct: (productId: number, imageSearchFilters?: MediaImageProductSearchInput, imageVariantFilters?: TransformationsInput) => Promise<void>;
  /** Fetches a cluster by id, optionally overriding the image filters. */
  fetchCluster: (clusterId: number, imageSearchFilters?: MediaImageProductSearchInput, imageVariantFilters?: TransformationsInput) => Promise<void>;
  // Cluster display helpers (fallback chain: cluster → defaultProduct)
  /** Cluster name, falling back to the default product's name. */
  clusterName: string;
  /** Cluster SKU, falling back to the default product's SKU. */
  clusterSku: string;
  /** Cluster gross price taken from the default product, or `null`. */
  clusterPrice: number | null;
  /** First image URL of the cluster's default product, or `''`. */
  clusterImageUrl: string;
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * useProductInfo — sequential product / cluster data fetching.
 *
 * @param options - see {@link UseProductInfoOptions}.
 * @returns product/cluster state, fetch actions and cluster display helpers — see {@link UseProductInfoReturn}.
 *
 * @remarks
 * GraphQL integration: services are built per-call via `createServices(graphqlClient)`.
 * `fetchProduct` runs two sequential calls — first `services.orderlist.getOrderlists()`
 * (`OrderlistService`, only when a user + company are present, to resolve price-tier
 * orderlist ids), then `services.product.getProduct()` (`ProductService`) with
 * `priceCalculateProductInput` / `userBulkPriceProductInput` for per-user pricing.
 * `fetchCluster` runs `services.cluster.getClusterConfig()` then
 * `services.cluster.getCluster()` (`ClusterService`), passing the config-derived
 * attribute names. The cluster display helpers are pure derivations of `cluster`.
 */
export function useProductInfo(options: UseProductInfoOptions): UseProductInfoReturn {
  const { graphqlClient, configuration = {} } = options;
  const language = options.language ?? 'NL';
  const taxZone = options.taxZone ?? 'NL';

  const [product, setProduct] = useState<Product | null>(null);
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Shared price input builders ───────────────────────────────────────────

  function buildPriceInput(): PriceCalculateProductInput {
    const input: PriceCalculateProductInput = { taxZone };
    if (options.companyId) input.companyId = options.companyId;
    if (options.user && 'contactId' in options.user) input.contactId = (options.user as Contact).contactId;
    if (options.user && 'customerId' in options.user) input.customerId = (options.user as Customer).customerId;
    return input;
  }

  function buildBulkPriceInput(): UserBulkPriceProductInput {
    const input: UserBulkPriceProductInput = { taxZone };
    if (options.companyId) input.companyId = options.companyId;
    if (options.user && 'contactId' in options.user) input.contactId = (options.user as Contact).contactId;
    if (options.user && 'customerId' in options.user) input.customerId = (options.user as Customer).customerId;
    return input;
  }

  function buildAttributeInput(): AttributeResultSearchInput | undefined {
    const names = options.productTrackAttributes;
    if (!names || names.length === 0) return undefined;
    return { attributeDescription: { names } };
  }

  // ── Fetch product ─────────────────────────────────────────────────────────
  // getOrderlists first (if user+companyId), then getProduct.

  const fetchProduct = useCallback(async (
    productId: number,
    imageSearchFilters?: MediaImageProductSearchInput,
    imageVariantFilters?: TransformationsInput,
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: resolve orderlist IDs.
      // Explicit options.orderlistIds (e.g. a chosen contract) take precedence
      // and skip the auto-resolution of all company orderlists. When the caller
      // sets applyOrderlists:false, disable orderlist scoping entirely (unscoped
      // catalogue for an authenticated user without a contract).
      let orderlistIds: number[] = [];
      let applyOrderlists = true;
      if (options.orderlistIds && options.orderlistIds.length > 0) {
        orderlistIds = options.orderlistIds;
        applyOrderlists = options.applyOrderlists !== false;
      } else if (options.applyOrderlists === false) {
        applyOrderlists = false;
      } else if (options.user && options.companyId) {
        const orderlistService = createServices(graphqlClient).orderlist;
        const searchInput: OrderlistSearchInput = { companyIds: [options.companyId] };
        const orderlists = await orderlistService.getOrderlists(searchInput);
        orderlistIds = (orderlists?.items ?? []).map((ol) => ol.id);
      }

      // Step 2: fetch product with full inputs
      const service = createServices(graphqlClient).product;
      const attributeInput = buildAttributeInput();

      const variables: ProductQueryVariables = {
        productId,
        language,
        applyOrderlists,
        orderlistIds,
        imageSearchFilters: imageSearchFilters ?? configuration.imageSearchFiltersGrid,
        imageVariantFilters: (imageVariantFilters ?? configuration.imageVariantFiltersLarge ?? configuration.imageVariantFiltersSmall) as TransformationsInput,
        priceCalculateProductInput: buildPriceInput(),
        userBulkPriceProductInput: buildBulkPriceInput(),
        ...(attributeInput && { attributeResultSearchInput: attributeInput }),
      };

      const result = await service.getProduct(variables);
      setProduct(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch product');
    } finally {
      setLoading(false);
    }
  }, [graphqlClient, language, taxZone, options.user, options.companyId, options.productTrackAttributes, configuration]);

  // ── Fetch cluster ─────────────────────────────────────────────────────────
  // getClusterConfig first, then getCluster with attributeNames.

  const fetchCluster = useCallback(async (
    clusterId: number,
    imageSearchFilters?: MediaImageProductSearchInput,
    imageVariantFilters?: TransformationsInput,
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const service = createServices(graphqlClient).cluster;

      // Step 1: get cluster config to extract attribute names
      const clusterConfig = await service.getClusterConfig(clusterId);
      const attributeNames: string[] =
        (clusterConfig?.config?.settings ?? []).map(
          (setting: ClusterConfigSetting) => setting.attributeName
        );

      // Step 2: fetch cluster with full inputs
      const variables: ClusterVariables = {
        clusterId,
        language,
        imageSearchFilters: imageSearchFilters ?? configuration.imageSearchFiltersGrid,
        imageVariantFilters: (imageVariantFilters ?? configuration.imageVariantFiltersMedium) as TransformationsInput,
        priceCalculateProductInput: buildPriceInput(),
        ...(attributeNames.length > 0 && {
          attributeResultSearchInput: {
            attributeDescription: { names: attributeNames },
          } as AttributeResultSearchInput,
        }),
      };

      const result = await service.getCluster(variables);
      setCluster(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch cluster');
    } finally {
      setLoading(false);
    }
  }, [graphqlClient, language, taxZone, options.user, options.companyId, configuration]);

  // ── Cluster display helpers (fallback chain: cluster → defaultProduct) ────

  const clusterName = useMemo<string>(() => {
    if (!cluster) return '';
    const lang = language;
    const names: LocalizedString[] = cluster.names ?? [];
    if (names.length) {
      const match = names.find(n => n.language === lang);
      return match?.value ?? names[0]?.value ?? '';
    }
    const dp = cluster.defaultProduct;
    const dpNames: LocalizedString[] = dp?.names ?? [];
    const dpMatch = dpNames.find(n => n.language === lang);
    return dpMatch?.value ?? dpNames[0]?.value ?? '';
  }, [cluster, language]);

  const clusterSku = useMemo<string>(() => {
    if (!cluster) return '';
    return cluster.sku || cluster.defaultProduct?.sku || '';
  }, [cluster]);

  const clusterPrice = useMemo<number | null>(() => {
    if (!cluster) return null;
    const dp = cluster.defaultProduct;
    return dp?.price?.gross ?? null;
  }, [cluster]);

  const clusterImageUrl = useMemo<string>(() => {
    if (!cluster) return '';
    const dp = cluster.defaultProduct;
    return dp?.media?.images?.items?.[0]?.imageVariants?.[0]?.url ?? '';
  }, [cluster]);

  return {
    product,
    cluster,
    loading,
    error,
    fetchProduct,
    fetchCluster,
    clusterName,
    clusterSku,
    clusterPrice,
    clusterImageUrl,
  };
}
