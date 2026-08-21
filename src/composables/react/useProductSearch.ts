/**
 * useProductSearch (React) — Product fetching, filtering, race condition prevention.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createServices, buildInventoryFilter, type Availability } from '@propeller-commerce/propeller-v2-core-ui';
import { ProductSearchableField, ProductSortField, ProductStatus, SortOrder } from '@propeller-commerce/propeller-sdk-v2';
import type {
  GraphQLClient,
  Product,
  Cluster,
  Contact,
  Customer,
  ProductsResponse,
  AttributeFilter,
  ProductTextFilterInput,
  Category,
  CategoryQueryVariables,
  CategoryProductSearchInput,
  ProductSortInput,
  SearchFieldsInput,
  ProductPriceFilterInput,
  PriceCalculateProductInput,
  FilterAvailableAttributeInput,
  MediaImageProductSearchInput,
  TransformationsInput,
  ProductsQueryVariables,
  ProductSearchInput,
  AttributeResultSearchInput,
} from '@propeller-commerce/propeller-sdk-v2';
import { usePagination } from './shared/usePagination';
import { resolveListingUserId } from '../shared/utils/listingUserId';

// Module-level dedup set — prevents two concurrent identical fetches from both
// hitting the API (React Strict Mode runs every effect twice in development).
const inflightFetches = new Set<string>();

/** `productTrackAttributes` → the query's attribute input. Undefined when empty. */
function buildAttributeInput(names?: string[]): AttributeResultSearchInput | undefined {
  if (!names || names.length === 0) return undefined;
  return { attributeDescription: { names } } as AttributeResultSearchInput;
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** Options for {@link useProductSearch}. */
export interface UseProductSearchOptions {
  /** GraphQL client; omit it together with a `products` array for controlled mode. */
  graphqlClient?: GraphQLClient;
  /** When provided, the hook is controlled — it renders these products and skips fetching. */
  products?: (Product | Cluster)[];
  /** Category id to list products from. */
  categoryId?: number;
  /** Free-text search term — triggers a wide search across the base category. */
  term?: string;
  /** Manufacturer/brand to filter by — also triggers a wide search. */
  brand?: string;
  /** Language for product queries. Defaults to `'NL'`. */
  language?: string;
  /** Tax zone for price calculation. Defaults to `'NL'`. */
  taxZone?: string;
  /** The signed-in user; supplies userId/contactId/customerId for pricing. */
  user?: Contact | Customer | null;
  /** Active company id for company-scoped pricing/visibility. */
  companyId?: number;
  /** Scope the product fetch to specific orderlist IDs (e.g. a chosen B2B contract). */
  orderlistIds?: number[];
  /**
   * Apply the orderlist filter on the search input. Defaults to `true` when
   * `orderlistIds` is non-empty, `false` otherwise — so an authenticated user
   * without a contract still sees the full catalogue.
   */
  applyOrderlists?: boolean;
  /**
   * Attribute names to request per product, e.g. `['MPN']`. Unset returns the
   * first page of ALL attributes (12 per product), so products with more than
   * 12 silently lose the rest — name what you render.
   */
  productTrackAttributes?: string[];
  /** Attribute text filters applied to the category search. */
  textFilters?: ProductTextFilterInput[];
  /** Lower price bound filter. */
  priceFilterMin?: number;
  /** Upper price bound filter. */
  priceFilterMax?: number;
  /**
   * Stock selection to filter by. `'all'` or unset sends no stock filter.
   * Filtering happens server-side, so `itemsFound` and the page count
   * describe the filtered set.
   */
  availability?: Availability;
  /** Minimum stock quantity for the `'in-stock'` selection. */
  minStock?: number;
  /** Sort field; overrides the internal sort state when set. */
  sortField?: string;
  /** Sort direction (`'ASC'` / `'DESC'`); overrides internal state when set. */
  sortOrder?: string;
  /** Page size. Defaults to 12. */
  pageSize?: number;
  /** Portal configuration: base category fallback plus image filters. */
  configuration: {
    baseCategoryId?: number;
    /** The channel's anonymous user, seeded by the host. Scopes logged-out
     *  listings exactly like the SSR seed does. */
    anonymousUserId?: number;
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersMedium?: TransformationsInput;
  };
  /** Fires with the available attribute filters from the category response. */
  onFiltersChange?: (filters: AttributeFilter[]) => void;
  /** Fires with the min/max price bounds from the category response. */
  onPriceBoundsChange?: (min: number, max: number) => void;
  /** Fires with the total matching item count whenever it changes. */
  onItemsFoundChange?: (count: number) => void;
  /** Fires when the current page changes. */
  onPageChange?: (page: number) => void;
  /** Fires with the raw `ProductsResponse` after each category fetch. */
  onProductsResponse?: (products: ProductsResponse) => void;
  /** Fires with the resolved category object after each category fetch. */
  onCategoryChange?: (category: Category) => void;
}

/** State and search actions returned by {@link useProductSearch}. */
export interface UseProductSearchReturn {
  /** Products to render — controlled `products` or the internally fetched list. */
  displayProducts: (Product | Cluster)[];
  /** Total matching products across all pages. */
  itemsFound: number;
  /** `true` while the main category fetch is in flight (uncontrolled mode only). */
  isLoading: boolean;
  /** Active sort field. */
  currentSortField: string;
  /** Active sort direction. */
  currentSortOrder: string;
  /** Current page number (1-based). */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** The current search-bar term. */
  searchTerm: string;
  /** Results of the debounced search-bar query. */
  searchResults: (Product | Cluster)[];
  /** Total items found by the search-bar query. */
  searchItemsFound: number;
  /** `true` while the debounced search-bar query is in flight. */
  searchLoading: boolean;
  /** Runs the main category product fetch. */
  fetchProducts: () => Promise<void>;
  /** Sets the search-bar term and triggers a debounced product search. */
  search: (term: string) => void;
  /** Navigates the main product list to a page. */
  goToPage: (page: number) => void;
}

/**
 * useProductSearch — product fetching, filtering and race-condition prevention.
 *
 * @param options - see {@link UseProductSearchOptions}.
 * @returns product list, sort/pagination state and search actions — see {@link UseProductSearchReturn}.
 *
 * @remarks
 * GraphQL integration: services are built per-call via `createServices(graphqlClient)`.
 * `fetchProducts` calls `services.category.getCategory()` (`CategoryService`) with a
 * `categoryProductSearchInput` (statuses, term, manufacturers, text/price filters,
 * sort) plus `priceCalculateProductInput` for per-user pricing. The debounced
 * `search` calls `services.product.getProducts()` (`ProductService`) 300 ms after the
 * last keystroke. Two race guards are in place: a per-instance `fetchIdRef` so only
 * the latest fetch commits, and a module-level `inflightFetches` set that dedups
 * identical concurrent fetches (e.g. React Strict Mode's double effect). In
 * controlled mode (a `products` array supplied) no API calls are made.
 */
export function useProductSearch(options: UseProductSearchOptions): UseProductSearchReturn {
  const { graphqlClient, configuration } = options;

  const isControlled = options.products !== undefined;
  const language = options.language || 'NL';
  const taxZone = options.taxZone || 'NL';
  const pageSize = options.pageSize ?? 12;

  const [internalProducts, setInternalProducts] = useState<(Product | Cluster)[]>([]);
  const [itemsFound, setItemsFound] = useState(0);
  const [internalLoading, setInternalLoading] = useState(false);
  const [currentSortField, setCurrentSortField] = useState(
    options.sortField ?? ProductSortField.RELEVANCE
  );
  const [currentSortOrder, setCurrentSortOrder] = useState(options.sortOrder ?? 'DESC');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<(Product | Cluster)[]>([]);
  const [searchItemsFound, setSearchItemsFound] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchIdRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pagination = usePagination(pageSize);

  // Stable string key from the user's ID — prevents re-fetches when the user
  // object reference changes but the underlying identity hasn't (common with
  // useReducer-based auth contexts that return a new state object on every
  // dispatch, even if the user data is unchanged).
  const userKey = options.user
    ? ('contactId' in options.user
      ? String((options.user as Contact).contactId)
      : String((options.user as Customer).customerId))
    : '';

  const displayProducts = useMemo<(Product | Cluster)[]>(
    () => (isControlled ? options.products! : internalProducts),
    [isControlled, options.products, internalProducts]
  );

  const isLoading = !isControlled && internalLoading;

  // ── Language filter ───────────────────────────────────────────────────────

  function filterByLanguage(products: (Product | Cluster)[], lang: string): (Product | Cluster)[] {
    if (!lang) return products;
    return products.filter((p) => {
      const names = (p as Product).names || (p as Cluster).names || [];
      if (!names || names.length === 0) return true;
      return names.some((n: { language?: string }) => n.language === lang);
    });
  }

  // ── Fetch products ────────────────────────────────────────────────────────

  const fetchProducts = useCallback(async (): Promise<void> => {
    if (!graphqlClient || isControlled) return;

    const thisId = ++fetchIdRef.current;

    // ── Inflight dedup (guards against React Strict Mode double-effect) ───────
    // Bail out when nothing to fetch: no categoryId, term, or brand.
    // This prevents components like SearchBar (which only use `search()`) from
    // triggering a spurious category fetch on mount via the baseCategoryId fallback.
    if (!options.categoryId && !options.term && !options.brand) return;

    const isWideSearch = !!options.term || !!options.brand;
    const catId = isWideSearch
      ? (configuration?.baseCategoryId ?? 0)
      : (options.categoryId ?? configuration?.baseCategoryId ?? 0);

    if (!catId) return;

    const inflightKey = [
      catId, language, pagination.currentPage, pageSize,
      options.term ?? '', options.brand ?? '',
      options.sortField ?? '', options.sortOrder ?? '',
      options.companyId ?? '', userKey,
      JSON.stringify(options.textFilters ?? []),
      options.priceFilterMin ?? '', options.priceFilterMax ?? '',
      options.availability ?? '', options.minStock ?? '',
    ].join('|');

    if (inflightFetches.has(inflightKey)) {
      // Identical fetch already in flight — undo the ID increment so the
      // in-flight request can still commit its result via the thisId check.
      fetchIdRef.current--;
      return;
    }
    inflightFetches.add(inflightKey);

    setInternalLoading(true);

    try {
      const service = createServices(graphqlClient).category;

      const lang = language;
      const activeSortField = (options.sortField ?? currentSortField) as ProductSortField;
      const activeSortOrder = (options.sortOrder ?? currentSortOrder) as SortOrder;

      // Build sort inputs
      const sortInputs: ProductSortInput[] = (activeSortField)
        ? [{ field: activeSortField, order: activeSortOrder }]
        : [];

      // Build search fields with boost when searching by term
      const searchFields: SearchFieldsInput[] = options.term
        ? [
          {
            fieldNames: [
              ProductSearchableField.NAME,
              ProductSearchableField.KEYWORDS,
              ProductSearchableField.SKU,
              ProductSearchableField.CUSTOM_KEYWORDS,
            ],
            boost: 5,
          },
          {
            fieldNames: [
              ProductSearchableField.DESCRIPTION,
              ProductSearchableField.MANUFACTURER,
              ProductSearchableField.MANUFACTURER_CODE,
              ProductSearchableField.EAN_CODE,
              ProductSearchableField.BAR_CODE,
              ProductSearchableField.CLUSTER_ID,
              ProductSearchableField.CUSTOM_KEYWORDS,
              ProductSearchableField.PRODUCT_ID,
              ProductSearchableField.SHORT_DESCRIPTION,
              ProductSearchableField.SUPPLIER,
              ProductSearchableField.SUPPLIER_CODE,
            ],
            boost: 1,
          },
        ]
        : [];

      // Build price filter
      const priceFilter: ProductPriceFilterInput | undefined =
        options.priceFilterMin !== undefined || options.priceFilterMax !== undefined
          ? { from: options.priceFilterMin ?? 0, to: options.priceFilterMax ?? 999999 }
          : undefined;

      const inventoryFilter = buildInventoryFilter(options.availability, options.minStock);

      // Resolve user IDs
      const userId = resolveListingUserId(options.user, configuration);

      const contactId: number | undefined =
        options.user && 'contactId' in options.user
          ? (options.user as Contact).contactId
          : undefined;

      const customerId: number | undefined =
        options.user && 'customerId' in options.user
          ? (options.user as Customer).customerId
          : undefined;

      // Orderlist (contract) scoping. When orderlistIds are supplied, apply them
      // (unless explicitly disabled); otherwise send applyOrderlists:false so an
      // authenticated user without a contract still sees the full catalogue.
      // `applyOrderlists`/`orderlistIds` are accepted by the backend but not yet
      // present on the SDK's CategoryProductSearchInput type — cast to include them.
      const orderlistScope =
        options.orderlistIds && options.orderlistIds.length > 0
          ? {
              applyOrderlists: options.applyOrderlists !== false,
              orderlistIds: options.orderlistIds,
            }
          : { applyOrderlists: false };

      const categoryProductSearchInput = {
        language: lang,
        page: pagination.currentPage,
        offset: pageSize,
        statuses: [
          ProductStatus.A,
          ProductStatus.P,
          ProductStatus.T,
          ProductStatus.S,
        ],
        hidden: false,
        ...(options.term && { term: options.term, searchFields }),
        ...(options.brand && { manufacturers: [options.brand] }),
        ...(options.textFilters?.length && { textFilters: options.textFilters }),
        ...(priceFilter && { price: priceFilter }),
        ...(inventoryFilter && { inventory: inventoryFilter }),
        ...(sortInputs.length && { sortInputs }),
        ...(options.companyId && { companyId: options.companyId }),
        ...(userId !== undefined && { userId }),
        ...orderlistScope,
      } as CategoryProductSearchInput & {
        applyOrderlists?: boolean;
        orderlistIds?: number[];
      };

      const priceCalculateProductInput: PriceCalculateProductInput = {
        taxZone,
        ...(options.companyId && { companyId: options.companyId }),
        ...(contactId !== undefined && { contactId }),
        ...(customerId !== undefined && { customerId }),
      };

      const filterAvailableAttributeInput: FilterAvailableAttributeInput = {
        isSearchable: true,
      };

      const attributeInput = buildAttributeInput(options.productTrackAttributes);

      const variables: CategoryQueryVariables = {
        categoryId: catId,
        language: lang,
        categoryProductSearchInput,
        priceCalculateProductInput,
        filterAvailableAttributeInput,
        imageSearchFilters: configuration?.imageSearchFiltersGrid,
        imageVariantFilters: configuration?.imageVariantFiltersMedium,
        ...(attributeInput && { attributeResultSearchInput: attributeInput }),
      };

      const response = await service.getCategory(variables);

      if (thisId !== fetchIdRef.current) return;

      const productsResponse = response?.products as ProductsResponse | undefined;
      const rawProducts = (productsResponse?.items ?? []) as (Product | Cluster)[];
      const filtered = filterByLanguage(rawProducts, lang);

      setInternalProducts(filtered);

      const untranslatedCount = rawProducts.length - filtered.length;
      const apiTotal = productsResponse?.itemsFound ?? rawProducts.length;
      const found = Math.max(0, apiTotal - untranslatedCount);

      setItemsFound(found);
      options.onItemsFoundChange?.(found);

      if (productsResponse) {
        pagination.setFromResponse({
          itemsFound: found,
          pages: productsResponse.pages ?? 1,
          offset: productsResponse.offset ?? pageSize,
        });
        options.onProductsResponse?.(productsResponse);
      }

      if (productsResponse?.filters) {
        options.onFiltersChange?.(productsResponse.filters);
      }

      // Price-slider bounds. The API's aggregated `minPrice`/`maxPrice` are
      // populated for anonymous catalog reads, but come back as 0 for a
      // logged-in (contact/company-priced) request — which would make the slider
      // fall back to a bogus 9999 cap. When the aggregate max is missing or 0,
      // derive the bounds from the resolved per-item prices in THIS result set
      // instead (the items carry the contact price). Uses `gross` (the catalog
      // filter scale; same field the API aggregate reflects), falling back to
      // `net`. Note: derived bounds reflect the current result page, not the
      // whole catalog — but that is strictly better than no/9999 bound, and the
      // anonymous path still uses the true catalog aggregate.
      const aggMin = productsResponse?.minPrice;
      const aggMax = productsResponse?.maxPrice;
      if (aggMax !== undefined && aggMax > 0) {
        options.onPriceBoundsChange?.(aggMin ?? 0, aggMax);
      } else {
        const prices = ((productsResponse?.items ?? []) as Product[])
          .map((p) => p?.price?.gross ?? p?.price?.net)
          .filter((n): n is number => typeof n === 'number' && n > 0);
        if (prices.length) {
          options.onPriceBoundsChange?.(Math.floor(Math.min(...prices)), Math.ceil(Math.max(...prices)));
        }
      }

      if (response) {
        options.onCategoryChange?.(response as Category);
      }
    } catch (e) {
      console.error('[useProductSearch] fetchProducts error:', e);
      if (thisId === fetchIdRef.current) setInternalProducts([]);
    } finally {
      inflightFetches.delete(inflightKey);
      if (thisId === fetchIdRef.current) setInternalLoading(false);
    }
  }, [
    graphqlClient,
    isControlled,
    options.categoryId,
    options.term,
    options.brand,
    options.textFilters,
    options.priceFilterMin,
    options.priceFilterMax,
    options.availability,
    options.minStock,
    options.sortField,
    options.sortOrder,
    options.companyId,
    userKey,
    language,
    taxZone,
    pageSize,
    pagination.currentPage,
    configuration,
    // Stringified: callers pass an array literal, so identity changes each render.
    JSON.stringify(options.productTrackAttributes ?? []),
  ]);

  // ── Search bar (debounced) ────────────────────────────────────────────────

  const search = useCallback(
    (term: string): void => {
      setSearchTerm(term);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (!term.trim()) {
        setSearchResults([]);
        setSearchItemsFound(0);
        return;
      }
      searchTimerRef.current = setTimeout(async () => {
        if (!graphqlClient) return;
        setSearchLoading(true);
        try {
          // Route the autosuggest through the SAME category term-search the grid
          // uses (`getCategory` over the base category), NOT the flat
          // `getProducts` search. Orderlist (contract) scoping is honoured by
          // the `category.products` resolver but NOT by the flat `products`
          // resolver — sending orderlistIds on a ProductSearchInput was silently
          // ignored server-side, so the preview leaked the full catalogue while
          // the grid (and the submitted results) stayed contract-scoped. Using
          // the category path makes the preview and the grid agree.
          const service = createServices(graphqlClient).category;
          const catId = configuration?.baseCategoryId ?? 0;
          if (!catId) {
            setSearchResults([]);
            setSearchItemsFound(0);
            return;
          }

          // When orderlistIds are supplied, apply them (unless explicitly
          // disabled); otherwise send applyOrderlists:false so an authed user
          // without a contract still previews the full catalogue.
          const orderlistScope =
            options.orderlistIds && options.orderlistIds.length > 0
              ? {
                  applyOrderlists: options.applyOrderlists !== false,
                  orderlistIds: options.orderlistIds,
                }
              : { applyOrderlists: false };

          const userId = resolveListingUserId(options.user, configuration);
          const contactId: number | undefined =
            options.user && 'contactId' in options.user
              ? (options.user as Contact).contactId
              : undefined;
          const customerId: number | undefined =
            options.user && 'customerId' in options.user
              ? (options.user as Customer).customerId
              : undefined;

          const inventoryFilter = buildInventoryFilter(options.availability, options.minStock);

          const categoryProductSearchInput = {
            language,
            page: 1,
            offset: 10,
            statuses: [
              ProductStatus.A,
              ProductStatus.P,
              ProductStatus.T,
              ProductStatus.S,
            ],
            hidden: false,
            ...(inventoryFilter && { inventory: inventoryFilter }),
            term,
            searchFields: [
              {
                fieldNames: [
                  ProductSearchableField.NAME,
                  ProductSearchableField.KEYWORDS,
                  ProductSearchableField.SKU,
                  ProductSearchableField.CUSTOM_KEYWORDS,
                ],
                boost: 5,
              },
              {
                fieldNames: [
                  ProductSearchableField.DESCRIPTION,
                  ProductSearchableField.MANUFACTURER,
                  ProductSearchableField.MANUFACTURER_CODE,
                  ProductSearchableField.EAN_CODE,
                  ProductSearchableField.BAR_CODE,
                  ProductSearchableField.CLUSTER_ID,
                  ProductSearchableField.CUSTOM_KEYWORDS,
                  ProductSearchableField.PRODUCT_ID,
                  ProductSearchableField.SHORT_DESCRIPTION,
                  ProductSearchableField.SUPPLIER,
                  ProductSearchableField.SUPPLIER_CODE,
                ],
                boost: 1,
              },
            ],
            sortInputs: [{ field: ProductSortField.RELEVANCE, order: SortOrder.DESC }],
            ...(options.companyId && { companyId: options.companyId }),
            ...(userId !== undefined && { userId }),
            ...orderlistScope,
          } as CategoryProductSearchInput & {
            applyOrderlists?: boolean;
            orderlistIds?: number[];
          };

          const priceCalculateProductInput: PriceCalculateProductInput = {
            taxZone,
            ...(options.companyId && { companyId: options.companyId }),
            ...(contactId !== undefined && { contactId }),
            ...(customerId !== undefined && { customerId }),
          };

          const attributeInput = buildAttributeInput(options.productTrackAttributes);

          const variables: CategoryQueryVariables = {
            categoryId: catId,
            language,
            categoryProductSearchInput,
            priceCalculateProductInput,
            imageSearchFilters: configuration?.imageSearchFiltersGrid,
            imageVariantFilters: configuration?.imageVariantFiltersMedium as TransformationsInput,
            ...(attributeInput && { attributeResultSearchInput: attributeInput }),
          };

          const response = await service.getCategory(variables);
          const productsResponse = response?.products as ProductsResponse | undefined;
          const rawItems = (productsResponse?.items ?? []) as (Product | Cluster)[];
          // Drop products with no name in the active language — same as the grid
          // (`fetchProducts`), so the preview shows EN results under EN instead
          // of leaking other-language variants. Adjust the total by how many
          // were filtered out so "View all (N)" stays consistent.
          const items = filterByLanguage(rawItems, language);
          const untranslated = rawItems.length - items.length;
          const apiTotal = productsResponse?.itemsFound ?? rawItems.length;
          setSearchResults(items);
          setSearchItemsFound(Math.max(0, apiTotal - untranslated));
        } catch {
          setSearchResults([]);
          setSearchItemsFound(0);
        } finally {
          setSearchLoading(false);
        }
      }, 300);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphqlClient, language, configuration, userKey, JSON.stringify(options.orderlistIds ?? []), options.applyOrderlists, JSON.stringify(options.productTrackAttributes ?? [])]
  );

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isControlled) fetchProducts();
  }, [
    options.categoryId,
    options.term,
    options.brand,
    language,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(options.textFilters),
    options.priceFilterMin,
    options.priceFilterMax,
    options.availability,
    options.minStock,
    options.sortField,
    options.sortOrder,
    pageSize,
    options.companyId,
    userKey,
    pagination.currentPage,
  ]);

  return {
    displayProducts,
    itemsFound,
    isLoading,
    currentSortField,
    currentSortOrder,
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
    searchTerm,
    searchResults,
    searchItemsFound,
    searchLoading,
    fetchProducts,
    search,
    goToPage: pagination.goToPage,
  };
}
