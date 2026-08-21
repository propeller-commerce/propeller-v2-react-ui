/**
 * useSpareParts (React) — a machine node's spare-parts list.
 *
 * The machine-tree sibling of `useProductSearch`: same contract (options in,
 * state + actions out), same controlled/uncontrolled sentinel, same race
 * guards — but sourced from `machine(slug:).sparePartProducts` instead of
 * `category(categoryId:).products`.
 *
 * Two things it deliberately does NOT copy from `useProductSearch`:
 *  - the debounced search-bar path (`search()` / `searchResults`). Searching
 *    within a machine is server-side and scoped to this node's parts, so it is
 *    just the `term` option feeding the same fetch.
 *  - the derived price-bounds fallback. The parts response carries the same
 *    aggregate `minPrice`/`maxPrice` fields, so the fallback is kept — see
 *    the note at the call site.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  machineService,
  ProductStatus,
  type GraphQLClient,
  type SparePartsMachine,
  type SparePartsMachineProductSearchInput,
  type SparePart,
  type SparePartsResponse,
  type AttributeFilter,
  type Contact,
  type Customer,
  type ProductSortInput,
  type ProductSortField,
  type SortOrder,
  type ProductTextFilterInput,
  type ProductPriceFilterInput,
  type PriceCalculateProductInput,
  type FilterAvailableAttributeInput,
} from '@propeller-commerce/propeller-sdk-v2';
import { resolveListingUserId } from '../shared/utils/listingUserId';

/**
 * Module-level in-flight set — dedups identical concurrent fetches, which
 * React Strict Mode's double-effect would otherwise fire twice.
 * Mirrors `useProductSearch`.
 */
const inflightFetches = new Set<string>();

/** Statuses the storefront shows. Mirrors `useProductSearch` / `lib/server`. */
const STOREFRONT_STATUSES: ProductStatus[] = [
  ProductStatus.A,
  ProductStatus.P,
  ProductStatus.T,
  ProductStatus.S,
];

export interface UseSparePartsOptions {
  /** SDK client. Without it the hook stays idle (controlled mode needs no client). */
  graphqlClient?: GraphQLClient;

  /**
   * Controlled mode: pre-fetched parts (e.g. SSR-seeded). When DEFINED the hook
   * performs no fetching at all and simply echoes these back. Pass `[]` (not
   * `undefined`) to show an empty state while the host controls loading.
   */
  parts?: SparePart[];

  /** Slug of the machine whose parts to list. */
  slug?: string;

  /** Free-text search, scoped server-side to this machine's parts. */
  term?: string;

  /** Language for the spare parts themselves (the storefront language). */
  language: string;

  /**
   * Language the MACHINE TREE is authored in. Defaults to `language`.
   *
   * `machine(slug:, language:)` is language-scoped and hard-errors with
   * "No machine found for slug and language" when the machine has no name/slug
   * in that language. Machine trees are commonly maintained in one language
   * (typically EN) while their spare parts are localized — so the lookup and the
   * parts list need different languages. Set this when they diverge.
   */
  machineLanguage?: string;

  /** Tax zone for price calculation. */
  taxZone?: string;

  /** Active user — drives `userId` scoping and contact/customer pricing. */
  user?: Contact | Customer | null;

  /** Active company — scopes the assortment. */
  companyId?: number;

  /** Attribute (facet) filters. */
  textFilters?: ProductTextFilterInput[];

  /** Price-range filter lower bound. */
  priceFilterMin?: number;

  /** Price-range filter upper bound. */
  priceFilterMax?: number;

  /** Sort field. */
  sortField?: ProductSortField | string;

  /** Sort direction. */
  sortOrder?: SortOrder | string;

  /** Items per page. Defaults to 12. */
  pageSize?: number;

  /** Image filter config, mirroring `useProductSearch`'s `configuration`. */
  configuration?: {
    /** The channel's anonymous user, seeded by the host. Scopes logged-out
     *  listings exactly like the SSR seed does. */
    anonymousUserId?: number;
    imageSearchFiltersGrid?: unknown;
    imageVariantFiltersMedium?: unknown;
  };

  /** Fired with the facet list after each fetch. */
  onFiltersChange?: (filters: AttributeFilter[]) => void;
  /** Fired with the price-slider bounds after each fetch. */
  onPriceBoundsChange?: (min: number, max: number) => void;
  /** Fired with the total item count after each fetch. */
  onItemsFoundChange?: (count: number) => void;
  /** Fired with the raw parts response after each fetch. */
  onPartsResponse?: (response: SparePartsResponse) => void;
  /** Fired with the machine itself after each fetch (name, child machines, …). */
  onMachineChange?: (machine: SparePartsMachine) => void;
}

export interface UseSparePartsReturn {
  /** The parts to render — the controlled prop when set, else the fetched list. */
  displayParts: SparePart[];
  /** Child machines of this node, for rendering alongside the parts. */
  childMachines: SparePartsMachine[];
  /** Total parts found. */
  itemsFound: number;
  /** `true` while an internal fetch is in flight. Always `false` when controlled. */
  isLoading: boolean;
  /** Current page (1-based). */
  currentPage: number;
  /** Total pages. */
  totalPages: number;
  /** Re-run the fetch. No-op in controlled mode. */
  fetchParts: () => Promise<void>;
  /** Navigate to a page. */
  goToPage: (page: number) => void;
}

/**
 * useSpareParts — fetch and paginate a machine node's spare-parts list.
 *
 * @param options - see {@link UseSparePartsOptions}
 * @returns parts, child machines, paging state and actions — see {@link UseSparePartsReturn}
 */
export function useSpareParts(options: UseSparePartsOptions): UseSparePartsReturn {
  const isControlled = options.parts !== undefined;
  const pageSize = options.pageSize ?? 12;
  const graphqlClient = options.graphqlClient;

  const [internalParts, setInternalParts] = useState<SparePart[]>([]);
  const [childMachines, setChildMachines] = useState<SparePartsMachine[]>([]);
  const [itemsFound, setItemsFound] = useState(0);
  const [internalLoading, setInternalLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  /** Per-instance guard: only the newest fetch commits. Mirrors `useProductSearch`. */
  const fetchIdRef = useRef(0);

  const displayParts = useMemo(
    () => (isControlled ? options.parts! : internalParts),
    [isControlled, options.parts, internalParts]
  );

  const isLoading = !isControlled && internalLoading;

  const userId = resolveListingUserId(options.user, options.configuration);

  const contactId: number | undefined =
    options.user && 'contactId' in options.user ? (options.user as Contact).contactId : undefined;
  const customerId: number | undefined =
    options.user && 'customerId' in options.user ? (options.user as Customer).customerId : undefined;

  // Identity key for the user, so the effect re-runs on login/logout without
  // depending on an object reference.
  const userKey = `${contactId ?? ''}:${customerId ?? ''}`;

  const fetchParts = useCallback(async (): Promise<void> => {
    if (!graphqlClient || isControlled || !options.slug) return;

    const thisId = ++fetchIdRef.current;

    const inflightKey = [
      options.slug, options.language, options.machineLanguage ?? '', currentPage, pageSize,
      options.term ?? '', options.sortField ?? '', options.sortOrder ?? '',
      options.companyId ?? '', userKey,
      JSON.stringify(options.textFilters ?? []),
      options.priceFilterMin ?? '', options.priceFilterMax ?? '',
    ].join('|');

    if (inflightFetches.has(inflightKey)) {
      // Identical fetch already in flight — undo the ID bump so the in-flight
      // request can still commit via its own thisId check.
      fetchIdRef.current--;
      return;
    }
    inflightFetches.add(inflightKey);

    setInternalLoading(true);

    try {
      // `machineService(client)` rather than `createServices(client).machine` —
      // the core-ui `Services` bundle has no machine entry.
      // ponytail: swap to the bundle if core-ui ever ships it.
      const service = machineService(graphqlClient);

      const sortInputs: ProductSortInput[] = options.sortField
        ? [{
            field: options.sortField as ProductSortField,
            order: options.sortOrder as SortOrder,
          }]
        : [];

      const priceFilter: ProductPriceFilterInput | undefined =
        options.priceFilterMin !== undefined || options.priceFilterMax !== undefined
          ? { from: options.priceFilterMin ?? 0, to: options.priceFilterMax ?? 999999 }
          : undefined;

      // `language`/`page`/`offset`/`statuses` are NON_NULL on the schema —
      // passing this input at all means passing all four.
      const sparePartsMachineProductSearchInput: SparePartsMachineProductSearchInput = {
        language: options.language,
        page: currentPage,
        offset: pageSize,
        statuses: STOREFRONT_STATUSES,
        hidden: false,
        ...(options.term && { term: options.term }),
        ...(options.textFilters?.length && { textFilters: options.textFilters }),
        ...(priceFilter && { price: priceFilter }),
        ...(sortInputs.length && { sortInputs }),
        ...(options.companyId && { companyId: options.companyId }),
        ...(userId !== undefined && { userId }),
      };

      const priceCalculateProductInput: PriceCalculateProductInput = {
        ...(options.taxZone && { taxZone: options.taxZone }),
        ...(options.companyId && { companyId: options.companyId }),
        ...(contactId !== undefined && { contactId }),
        ...(customerId !== undefined && { customerId }),
      };

      // Without this the response's `filters` array is empty and the filter
      // sidebar renders "No filters available".
      const filterAvailableAttributeInput: FilterAvailableAttributeInput = {
        isSearchable: true,
      };

      const machine = await service.getMachine({
        slug: options.slug,
        // The machine tree's language, NOT the parts' — see `machineLanguage`.
        language: options.machineLanguage ?? options.language,
        sparePartsMachineProductSearchInput,
        filterAvailableAttributeInput,
        priceCalculateProductInput,
        imageSearchFilters: options.configuration?.imageSearchFiltersGrid as never,
        imageVariantFilters: options.configuration?.imageVariantFiltersMedium as never,
      });

      if (thisId !== fetchIdRef.current) return;

      const partsResponse = machine?.sparePartProducts as SparePartsResponse | undefined;
      const items = (partsResponse?.items ?? []) as SparePart[];

      setInternalParts(items);
      setChildMachines((machine?.machines ?? []) as SparePartsMachine[]);

      const found = partsResponse?.itemsFound ?? items.length;
      setItemsFound(found);
      options.onItemsFoundChange?.(found);
      setTotalPages(partsResponse?.pages ?? 1);

      if (partsResponse) options.onPartsResponse?.(partsResponse);
      if (partsResponse?.filters) options.onFiltersChange?.(partsResponse.filters);

      // Price-slider bounds. Same caveat as `useProductSearch`: the API's
      // aggregate is populated for anonymous reads but comes back 0 for a
      // contact-priced request, so fall back to the resolved per-item prices
      // in this result set (which carry the contact price).
      const aggMin = partsResponse?.minPrice;
      const aggMax = partsResponse?.maxPrice;
      if (aggMax !== undefined && aggMax > 0) {
        options.onPriceBoundsChange?.(aggMin ?? 0, aggMax);
      } else {
        const prices = items
          .map((p) => {
            const product = p?.product as { price?: { gross?: number; net?: number } } | undefined;
            return product?.price?.gross ?? product?.price?.net;
          })
          .filter((n): n is number => typeof n === 'number' && n > 0);
        if (prices.length) {
          options.onPriceBoundsChange?.(
            Math.floor(Math.min(...prices)),
            Math.ceil(Math.max(...prices))
          );
        }
      }

      if (machine) options.onMachineChange?.(machine);
    } catch (e) {
      console.error('[useSpareParts] fetchParts error:', e);
      if (thisId === fetchIdRef.current) setInternalParts([]);
    } finally {
      inflightFetches.delete(inflightKey);
      if (thisId === fetchIdRef.current) setInternalLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    graphqlClient,
    isControlled,
    options.slug,
    options.term,
    options.language,
    options.machineLanguage,
    options.taxZone,
    options.companyId,
    options.textFilters,
    options.priceFilterMin,
    options.priceFilterMax,
    options.sortField,
    options.sortOrder,
    currentPage,
    pageSize,
    userId,
    userKey,
  ]);

  // Key the fetch on its INPUTS (content), not on `fetchParts` identity. A
  // caller (MachineGrid) rebuilds `textFilters` from the fetched facet list on
  // every response, so keying on the callback — whose deps include that array by
  // reference — would re-fetch on its own output forever. `JSON.stringify` keys
  // on filter *content*; a new-but-equal array no longer retriggers. Mirrors
  // `useProductSearch`'s effect exactly.
  useEffect(() => {
    if (!isControlled) void fetchParts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isControlled,
    options.slug,
    options.term,
    options.language,
    options.machineLanguage,
    options.companyId,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(options.textFilters ?? []),
    options.priceFilterMin,
    options.priceFilterMax,
    options.sortField,
    options.sortOrder,
    currentPage,
    pageSize,
    userKey,
  ]);

  const goToPage = useCallback((page: number) => {
    setCurrentPage((prev) => {
      // `totalPages <= 1` means the count isn't known yet (e.g. still showing an
      // SSR-seeded page), so don't reject — else the first pagination click is
      // silently dropped. Mirrors `usePagination.goToPage`.
      if (page >= 1 && (totalPages <= 1 || page <= totalPages)) return page;
      return prev;
    });
  }, [totalPages]);

  return {
    displayParts,
    childMachines,
    itemsFound,
    isLoading,
    currentPage,
    totalPages,
    fetchParts,
    goToPage,
  };
}
