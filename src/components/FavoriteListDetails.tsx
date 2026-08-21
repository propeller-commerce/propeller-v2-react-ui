'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import { useState, useEffect, useMemo } from 'react';
import {
  Product,
  Cluster,
  FavoriteList,
  GraphQLClient,
  Contact,
  Customer,
  Cart,
  CartMainItem,
  CartChildItemInput,
  ProductsResponse,
  FavoriteListVariables,
} from '@propeller-commerce/propeller-sdk-v2';
import { useFavorites } from '../composables/react/useFavorites';
import { useProductSearch } from '../composables/react/useProductSearch';
import { useCart } from '../composables/react/useCart';
import { useInfraProps } from '../composables/react/useInfraProps';
import { createServices } from '@propeller-commerce/propeller-v2-core-ui';
import DefaultFavoriteListItemImpl from './FavoriteListItem';
import DefaultGridPaginationImpl from './GridPagination';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import { getProductImageUrl, getClusterImageUrl } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface FavoriteListDetailsProps {
  /** GraphQL client for the Propeller SDK. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** The logged in user for which the favorite list is going to be displayed. Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer;

  /** The favorite list ID to display */
  favoriteListId: string;

  /** Action method for deleting a single favorite list item. If not provided, delete button is hidden */
  onItemDelete?: (itemId: string, itemType?: string) => void;

  /** Batched delete callback for the floating bar "Remove" action. When provided, it is called once with all selected items; otherwise the component falls back to calling `onItemDelete` per item */
  onItemsDelete?: (items: { id: string; type: 'product' | 'cluster' }[]) => void;

  /** Called after the favorite list is fetched, with the full list object */
  onListLoaded?: (list: FavoriteList) => void;

  /** Called after an item is added to the list from the in-list search modal.
   * Use this to refresh the source the lists overview reads from (e.g. the
   * user object), so the per-list count stays correct after navigating back. */
  onItemAdded?: (item: Product | Cluster) => void;

  /** Number of items to show per page (default: 12) */
  itemsPerPage?: number;

  /** Show pagination controls (default: true) */
  showPagination?: boolean;

  /** Pagination display variant: 'compact' or 'full' (default: 'compact') */
  paginationVariant?: string;

  /** Extra CSS class applied to the root element */
  className?: string;

  /** Configuration object for URL generation */
  configuration?: any;

  /** UI string overrides */
  labels?: Record<string, string>;

  // === FavoriteListItem display props ===

  /** Should item titles link to the PDP (default: true) */
  titleLinkable?: boolean;

  /** Show stock availability on items (default: false) */
  showStockComponent?: boolean;

  /** Show availability status (e.g. "In stock") inside ItemStock (default: true) */
  showAvailability?: boolean;

  /** Show numeric stock quantity inside ItemStock (default: true) */
  showStock?: boolean;

  /** Display the SKU beneath item names (default: true) */
  showSku?: boolean;

  /** Enable add to cart for products. Clusters show "View cluster" instead (default: true) */
  allowAddToCart?: boolean;

  /** Show delete button on each item (default: true) */
  showDelete?: boolean;

  /** Callback when an item title or image is clicked */
  onItemClick?: (item: Product | Cluster) => void;

  // === AddToCart pass-through props (products only) ===

  /** ID of an existing cart to add items to */
  cartId?: string;

  /** Auto-create cart if none exists */
  createCart?: boolean;

  /** Called after a new cart is created internally by AddToCart */
  onCartCreated?: (cart: Cart) => void;

  /** Fully replaces the internal CartService.addItemToCart call */
  onAddToCart?: (
    product: Product,
    clusterId?: number,
    quantity?: number,
    childItems?: CartChildItemInput[],
    notes?: string,
    price?: number,
    showModal?: boolean
  ) => Cart;

  /** Called after every successful add-to-cart */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;

  /** Show modal after successful add (default: false) */
  showModal?: boolean;

  /** Renders increment/decrement buttons beside quantity input (default: true) */
  allowIncrDecr?: boolean;

  /** Validate stock before adding to cart (default: false) */
  enableStockValidation?: boolean;

  /** Language code forwarded to CartService (default: 'NL') */
  language?: string;

  /** Called when "Proceed to checkout" is clicked in AddToCart modal */
  onProceedToCheckout?: () => void;

  /** Called when "Request a Quote" is clicked in AddToCart modal */
  onRequestQuoteClick?: (cart: Cart) => void;

  /** Label overrides for AddToCart UI strings */
  addToCartLabels?: Record<string, string>;

  /** Label overrides for ItemStock UI strings */
  stockLabels?: Record<string, string>;

  /** Label overrides for FavoriteListItem UI strings */
  itemLabels?: Record<string, string>;

  /** Include tax in prices. Pass from PriceContext's usePrice() */ includeTax?: boolean;

  // ───── Extension API ─────
  // Replaces each <FavoriteListItem> rendered in the list.
  favoriteListItemComponent?: React.ComponentType<import('./FavoriteListItem').FavoriteListItemProps>;
  // Replaces the <GridPagination> control.
  gridPaginationComponent?: React.ComponentType<import('./GridPagination').GridPaginationProps>;
}

/**
 * Detail view of a single favorite list: paginated, selectable items with bulk
 * remove / add-to-cart actions and a modal for searching and adding products.
 *
 * @remarks Uses {@link useFavorites}, {@link useCart} and {@link useProductSearch}.
 */
function FavoriteListDetails(rawProps: FavoriteListDetailsProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const FavoriteListItemImpl = props.favoriteListItemComponent ?? DefaultFavoriteListItemImpl;
  const GridPaginationImpl = props.gridPaginationComponent ?? DefaultGridPaginationImpl;
  const { addToList } = useFavorites({
    graphqlClient: props.graphqlClient!,
    user: props.user ?? null,
  });

  const { addItem } = useCart({
    graphqlClient: props.graphqlClient!,
    user: props.user ?? null,
    cartId: props.cartId,
    language: props.language,
    configuration: props.configuration,
    onCartCreated: props.onCartCreated,
  });

  const {
    searchTerm,
    searchResults,
    searchLoading,
    search,
  } = useProductSearch({
    graphqlClient: props.graphqlClient!,
    language: props.language,
    user: props.user ?? null,
    configuration: props.configuration || {},
  });

  const [loading, setLoading] = useState(() => true);
  const [, setFavoriteList] = useState<FavoriteList | null>(() => null);
  const [allItems, setAllItems] = useState<(Product | Cluster)[]>(() => []);
  const [currentPage, setCurrentPage] = useState(() => 1);
  const [isMounted, setIsMounted] = useState(() => false);
  const [prevListId, setPrevListId] = useState(() => '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingItemKey, setAddingItemKey] = useState<string>('');

  function getRowKey(item: Product | Cluster): string {
    if ('productId' in item) return 'p-' + String((item as Product).productId);
    return 'c-' + String((item as Cluster).clusterId);
  }

  function isRowSelected(item: Product | Cluster): boolean {
    return selectedIds.has(getRowKey(item));
  }

  function toggleRow(item: Product | Cluster) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const key = getRowKey(item);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const pageRowKeys = useMemo(
    () => getPagedItems().map((i) => getRowKey(i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allItems, currentPage, props.itemsPerPage]
  );

  function isAllPageSelected(): boolean {
    if (pageRowKeys.length === 0) return false;
    return pageRowKeys.every((k) => selectedIds.has(k));
  }

  function togglePageSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = pageRowKeys.every((k) => next.has(k));
      if (allSelected) pageRowKeys.forEach((k) => next.delete(k));
      else pageRowKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function getSelectedItems(): (Product | Cluster)[] {
    return allItems.filter((i) => selectedIds.has(getRowKey(i)));
  }

  function getSelectedProducts(): Product[] {
    return getSelectedItems().filter((i) => 'productId' in i) as Product[];
  }

  async function handleBulkRemove() {
    if (bulkBusy) return;
    const items = getSelectedItems();
    if (items.length === 0) return;
    setBulkBusy(true);
    try {
      const entries: { id: string; type: 'product' | 'cluster' }[] = items.map((it) => ({
        id: 'productId' in it ? String((it as Product).productId) : String((it as Cluster).clusterId),
        type: 'productId' in it ? 'product' : 'cluster',
      }));
      const remaining = allItems.filter((p) => !selectedIds.has(getRowKey(p)));
      setAllItems(remaining);
      clearSelection();
      const newTotalPages = Math.max(1, Math.ceil(remaining.length / getItemsPerPage()));
      if (currentPage > newTotalPages) {
        setCurrentPage(newTotalPages);
      }
      if (props.onItemsDelete) {
        props.onItemsDelete(entries);
      } else if (props.onItemDelete) {
        entries.forEach((entry) => props.onItemDelete!(entry.id, entry.type));
      }
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkAddToCart() {
    if (bulkBusy) return;
    const products = getSelectedProducts();
    if (products.length === 0) return;
    setBulkBusy(true);
    try {
      for (const product of products) {
        await addItem({
          product,
          quantity: product.minimumQuantity && product.minimumQuantity > 0 ? product.minimumQuantity : 1,
          cartId: props.cartId,
          createCart: props.createCart !== false,
          enableStockValidation: props.enableStockValidation,
          afterAddToCart: (resultCart, addedItem) => {
            props.afterAddToCart?.(resultCart, addedItem || undefined);
          },
        });
      }
      clearSelection();
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleAddItemFromSearch(item: Product | Cluster) {
    const key = getRowKey(item);
    if (addingItemKey) return;
    // Already in the list — nothing to add (guards double-add + count drift).
    if (allItems.some((i) => getRowKey(i) === key)) return;
    setAddingItemKey(key);
    try {
      const productId = 'productId' in item ? (item as Product).productId : undefined;
      const clusterId = 'clusterId' in item ? (item as Cluster).clusterId : undefined;
      await addToList(props.favoriteListId, productId, clusterId);
      // Optimistic append — mirrors the optimistic remove paths. A refetch here
      // raced the just-written item (the read could return the pre-add snapshot)
      // and reset the page to 1, so the count appeared stale and the view
      // jumped. Updating local state keeps the count and page stable.
      setAllItems((prev) =>
        prev.some((i) => getRowKey(i) === key) ? prev : [...prev, item]
      );
      // Let the host refresh whatever the lists overview reads from (the user
      // object), so the per-list count is correct after navigating back.
      props.onItemAdded?.(item);
    } finally {
      setAddingItemKey('');
    }
  }

  function getSearchItemName(item: Product | Cluster): string {
    // `names[0]` is the catalog default language, not the storefront's.
    const language = props.language as string | undefined;
    if ('productId' in item) return getLocalizedValue((item as Product).names, language, 'Product');
    const cluster = item as Cluster;
    return (
      getLocalizedValue(cluster.names, language, '') ||
      getLocalizedValue(cluster.defaultProduct?.names, language, 'Cluster')
    );
  }

  function getSearchItemSku(item: Product | Cluster): string {
    if ('productId' in item) return (item as Product).sku || '';
    const cluster = item as Cluster;
    return cluster.sku || cluster.defaultProduct?.sku || '';
  }

  function getSearchItemImage(item: Product | Cluster): string {
    if ('productId' in item) return getProductImageUrl(item as Product);
    return getClusterImageUrl(item as Cluster);
  }

  function getSearchItemStockLabel(item: Product | Cluster): string {
    const qty =
      'productId' in item
        ? (item as Product).inventory?.totalQuantity
        : (item as Cluster).defaultProduct?.inventory?.totalQuantity;
    if (qty === undefined || qty === null) return '';
    if (qty <= 0) return getLabel(props.labels, 'outOfStock', 'Out of stock');
    if (qty <= 5) return getLabel(props.labels, 'lowStock', 'Low stock');
    return getLabel(props.labels, 'inStock', 'In stock');
  }

  function closeAddModal() {
    setShowAddModal(false);
    search('');
  }



  function getItemsPerPage(): number {
    return props.itemsPerPage || 12;
  }

  function getTotalPages(): number {
    return Math.max(1, Math.ceil(allItems.length / getItemsPerPage()));
  }

  function getPagedItems(): (Product | Cluster)[] {
    const perPage = getItemsPerPage();
    const start = (currentPage - 1) * perPage;
    return allItems.slice(start, start + perPage);
  }

  function getPaginationData(): Record<string, number> {
    return {
      page: currentPage,
      pages: getTotalPages(),
      itemsFound: allItems.length,
      offset: getItemsPerPage(),
    };
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);
  }

  function buildFetchVariables(): Record<string, unknown> {
    const priceInput: Record<string, unknown> = { taxZone: 'NL' };
    if (props.user) {
      if ('customerId' in props.user) {
        const customer = props.user as Customer;
        if (customer.customerId) {
          priceInput.customerId = customer.customerId;
        }
      } else if ('contactId' in props.user) {
        const contact = props.user as Contact;
        if (contact.contactId) {
          priceInput.contactId = contact.contactId;
        }
        if (contact.company?.companyId) {
          priceInput.companyId = contact.company.companyId;
        }
      }
    }
    return {
      id: props.favoriteListId,
      language: props.language || 'NL',
      priceCalculateProductInput: priceInput,
      imageSearchFilters: { page: 1, offset: 1 },
      imageVariantFilters: {
        transformations: [
          {
            name: 'cart_thumb',
            transformation: { format: 'WEBP', height: 200, width: 200, fit: 'BOUNDS' },
          },
        ],
      },
    };
  }

  async function fetchList() {
    if (!props.graphqlClient || !props.favoriteListId) return;
    setLoading(true);
    try {
      const service = createServices(props.graphqlClient).favoriteList;
      const list = await service.getFavoriteList(
        buildFetchVariables() as unknown as FavoriteListVariables
      );
      setFavoriteList(list);
      if (props.onListLoaded) {
        props.onListLoaded(list);
      }
      const items: (Product | Cluster)[] = [];
      const productsRef = list?.products as ProductsResponse;
      if (productsRef?.items && Array.isArray(productsRef.items)) {
        (productsRef.items as Product[]).forEach((item: Product) => items.push(item));
      }
      const clustersRef = list?.clusters as ProductsResponse;
      if (clustersRef?.items && Array.isArray(clustersRef.items)) {
        (clustersRef.items as Cluster[]).forEach((item: Cluster) => items.push(item));
      }
      setAllItems(items);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching favorite list:', error);
      setFavoriteList(null);
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }

  function handleItemDelete(itemId: string) {
    /* Determine item type before removing from local state */ const deletedItem = allItems.find(
      (item: Product | Cluster) => {
        if ('productId' in item) return String(item.productId) === itemId;
        return String((item as Cluster).clusterId) === itemId;
      }
    );
    const itemType: string = deletedItem && 'clusterId' in deletedItem ? 'cluster' : 'product';
    /* Optimistic: remove from local state */ setAllItems(
      allItems.filter((item: Product | Cluster) => {
        if ('productId' in item) return String(item.productId) !== itemId;
        return String((item as Cluster).clusterId) !== itemId;
      })
    );
    /* Adjust current page if needed */ if (currentPage > getTotalPages()) {
      setCurrentPage(Math.max(1, getTotalPages()));
    }
    /* Notify parent with type info */ if (props.onItemDelete) {
      props.onItemDelete(itemId, itemType);
    }
  }

  useEffect(() => {
    setIsMounted(true);
    setPrevListId(props.favoriteListId || '');
    fetchList();
  }, []);

  useEffect(() => {
    if (props.favoriteListId && props.favoriteListId !== prevListId) {
      setPrevListId(props.favoriteListId);
      fetchList();
    }
  }, [props.favoriteListId]);

  return (
    <div className={cn(`propeller-favorite-list-details ${props.className || ''}`)} data-loading={loading ? 'true' : 'false'}>
      {loading ? (
        <div className="propeller-favorite-list-details__skeleton space-y-4">
          {[1, 2, 3]?.map((i) => (
            <div
              className="propeller-favorite-list-details__skeleton-row flex items-center gap-4 p-4 border-b border-border animate-pulse"
              key={i}
            >
              <div className="w-20 h-20 bg-surface-hover rounded-control flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-surface-hover rounded" />
                <div className="h-5 w-1/2 bg-surface-hover rounded" />
                <div className="h-4 w-1/6 bg-surface-hover rounded" />
              </div>
              <div className="h-10 w-28 bg-surface-hover rounded" />
            </div>
          ))}
        </div>
      ) : null}
      {!loading && isMounted ? (
        <>
          {allItems.length > 0 ? (
            <div className="propeller-favorite-list-details__list space-y-3">
              <div className="propeller-favorite-list-details__select-all flex items-center gap-2 pb-2">
                <input
                  id="favorite-list-select-all-top"
                  type="checkbox"
                  className="propeller-favorite-list-details__select-all-checkbox h-4 w-4 rounded border-border accent-secondary cursor-pointer"
                  checked={isAllPageSelected()}
                  onChange={() => togglePageSelectAll()}
                />
                <label
                  htmlFor="favorite-list-select-all-top"
                  className="propeller-favorite-list-details__select-all-label text-sm font-medium cursor-pointer select-none"
                >
                  {getLabel(props.labels, 'selectAll', 'Select all')}
                </label>
              </div>
              {getPagedItems()?.map((item) => (
                <div
                  key={
                    'productId' in item
                      ? 'p-' + (item as Product).productId
                      : 'c-' + (item as Cluster).clusterId
                  }
                  className="propeller-favorite-list-details__row flex items-center gap-3"
                  data-selected={isRowSelected(item) ? 'true' : 'false'}
                >
                  <input
                    type="checkbox"
                    className="propeller-favorite-list-details__row-checkbox h-4 w-4 flex-shrink-0 rounded border-border accent-secondary cursor-pointer"
                    checked={isRowSelected(item)}
                    onChange={() => toggleRow(item)}
                    aria-label={getLabel(props.labels, 'selectItem', 'Select item')}
                  />
                  <div className="propeller-favorite-list-details__row-item flex-1 min-w-0">
                  <FavoriteListItemImpl
                    item={item}
                    cartId={props.cartId}
                    createCart={props.createCart}
                    onCartCreated={props.onCartCreated}
                    onAddToCart={props.onAddToCart}
                    afterAddToCart={props.afterAddToCart}
                    showModal={props.showModal}
                    allowIncrDecr={props.allowIncrDecr}
                    enableStockValidation={props.enableStockValidation}
                    onProceedToCheckout={props.onProceedToCheckout}
                    onRequestQuoteClick={props.onRequestQuoteClick}
                    addToCartLabels={props.addToCartLabels}
                    stockLabels={props.stockLabels}
                    labels={props.itemLabels}
                    titleLinkable={props.titleLinkable}
                    showStockComponent={props.showStockComponent}
                    showAvailability={props.showAvailability}
                    showStock={props.showStock}
                    showSku={props.showSku}
                    allowAddToCart={props.allowAddToCart}
                    showDelete={props.showDelete}
                    onDelete={(itemId) => handleItemDelete(itemId)}
                    onItemClick={props.onItemClick}
                    includeTax={props.includeTax}
                  />
                  </div>
                </div>
              ))}
              {props.showPagination !== false && getTotalPages() > 1 ? (
                <div className="propeller-favorite-list-details__pagination mt-6">
                  <GridPaginationImpl
                    products={getPaginationData() as unknown as ProductsResponse}
                    onPageChange={(page) => handlePageChange(page)}
                    variant={props.paginationVariant || 'compact'}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="propeller-favorite-list-details__add-wrapper mt-6">
            <button
              type="button"
              className="propeller-favorite-list-details__add-btn inline-flex items-center justify-center rounded-control bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90"
              onClick={() => setShowAddModal(true)}
            >
              {getLabel(props.labels, 'addProductDirectly', 'Add product to favorite list')}
            </button>
          </div>
          {allItems.length === 0 ? (
            <div className="propeller-favorite-list-details__empty border border-border rounded-container p-12 text-center space-y-4">
              <div className="propeller-favorite-list-details__empty-icon-wrapper bg-surface-hover p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="propeller-favorite-list-details__empty-icon text-foreground-subtle"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <div>
                <p className="propeller-favorite-list-details__empty-title text-lg font-medium">{getLabel(props.labels, 'emptyTitle', 'List is empty')}</p>
                <p className="propeller-favorite-list-details__empty-message text-muted-foreground">
                  {getLabel(props.labels, 'emptyDescription', "You haven't added any products or clusters to this list yet.")}
                </p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {selectedIds.size > 0 ? (
        <div className="propeller-favorite-list-details__floating-bar fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card shadow-lg">
          <div className="propeller-favorite-list-details__floating-bar-inner flex items-center justify-between gap-4 px-6 py-4">
            <div className="propeller-favorite-list-details__floating-bar-status flex items-center gap-2">
              <input
                id="favorite-list-select-all-floating"
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-secondary cursor-pointer"
                checked={isAllPageSelected()}
                onChange={() => togglePageSelectAll()}
              />
              <label
                htmlFor="favorite-list-select-all-floating"
                className="text-sm font-medium cursor-pointer select-none"
              >
                {getLabel(props.labels, 'selectAll', 'Select all')}
              </label>
              <span className="propeller-favorite-list-details__floating-bar-count text-sm text-foreground-subtle ml-3">
                {selectedIds.size} {getLabel(props.labels, 'ofWord', 'of')} {allItems.length} {getLabel(props.labels, 'itemsSelected', 'items selected')}
              </span>
            </div>
            <div className="propeller-favorite-list-details__floating-bar-actions flex items-center gap-3">
              <button
                type="button"
                className="propeller-favorite-list-details__bulk-remove-btn inline-flex items-center justify-center rounded-control border border-border bg-transparent px-4 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-hover disabled:opacity-50"
                disabled={bulkBusy}
                onClick={() => handleBulkRemove()}
              >
                {getLabel(props.labels, 'removeFromList', 'Remove from this list')}
              </button>
              <button
                type="button"
                className="propeller-favorite-list-details__bulk-add-btn inline-flex items-center justify-center gap-2 rounded-control bg-secondary px-6 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-50"
                disabled={bulkBusy || getSelectedProducts().length === 0}
                onClick={() => handleBulkAddToCart()}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                {getLabel(props.labels, 'addToCart', 'Add to cart')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showAddModal ? (
        <div
          className="propeller-favorite-list-details__modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => closeAddModal()}
        >
          <div
            className="propeller-favorite-list-details__modal w-full max-w-xl rounded-container bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="propeller-favorite-list-details__modal-header border-b border-border px-6 py-4">
              <h2 className="propeller-favorite-list-details__modal-title text-lg font-bold">
                {getLabel(props.labels, 'addProductModalTitle', 'Add product to list')}
              </h2>
            </div>
            <div className="propeller-favorite-list-details__modal-body px-6 py-4 space-y-4">
              <div className="propeller-favorite-list-details__search-input-wrapper relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-subtle"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="propeller-favorite-list-details__search-input w-full rounded-control border border-border bg-card px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
                  placeholder={getLabel(props.labels, 'searchPlaceholder', 'Search for products...')}
                  value={searchTerm}
                  onChange={(e) => search(e.target.value)}
                  autoFocus
                />
                {searchTerm ? (
                  <button
                    type="button"
                    className="propeller-favorite-list-details__search-clear absolute right-3 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground"
                    onClick={() => search('')}
                    aria-label={getLabel(props.labels, 'clearSearchAriaLabel', 'Clear search')}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                ) : null}
              </div>
              <div className="propeller-favorite-list-details__search-results max-h-80 overflow-y-auto">
                {searchLoading ? (
                  <div className="propeller-favorite-list-details__search-loading py-6 text-center text-sm text-foreground-subtle">
                    {getLabel(props.labels, 'searching', 'Searching...')}
                  </div>
                ) : null}
                {!searchLoading && searchTerm && searchResults.length === 0 ? (
                  <div className="propeller-favorite-list-details__search-empty py-6 text-center text-sm text-foreground-subtle">
                    {getLabel(props.labels, 'noResults', 'No results')}
                  </div>
                ) : null}
                {!searchLoading && searchResults.length > 0 ? (
                  <ul className="propeller-favorite-list-details__search-list divide-y divide-border">
                    {searchResults.map((item) => {
                      const key = getRowKey(item);
                      const isAdding = addingItemKey === key;
                      return (
                        <li
                          key={key}
                          className="propeller-favorite-list-details__search-item flex items-center gap-3 py-3 cursor-pointer hover:bg-surface-hover transition-colors px-2 rounded-control"
                          onClick={() => handleAddItemFromSearch(item)}
                          data-adding={isAdding ? 'true' : 'false'}
                        >
                          <div className="propeller-favorite-list-details__search-item-media h-14 w-14 flex-shrink-0 rounded-control bg-surface-hover overflow-hidden flex items-center justify-center">
                            {getSearchItemImage(item) ? (
                              <img
                                src={getSearchItemImage(item)}
                                alt={getSearchItemName(item)}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-foreground-subtle"
                              >
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                              </svg>
                            )}
                          </div>
                          <div className="propeller-favorite-list-details__search-item-body flex-1 min-w-0">
                            <p className="propeller-favorite-list-details__search-item-name text-sm font-medium line-clamp-2">
                              {getSearchItemName(item)}
                            </p>
                            {getSearchItemSku(item) ? (
                              <p className="propeller-favorite-list-details__search-item-sku font-mono text-xs text-foreground-subtle mt-0.5">
                                SKU: {getSearchItemSku(item)}
                              </p>
                            ) : null}
                            {getSearchItemStockLabel(item) ? (
                              <p className="propeller-favorite-list-details__search-item-stock text-xs text-foreground-subtle mt-0.5">
                                {getSearchItemStockLabel(item)}
                              </p>
                            ) : null}
                          </div>
                          {isAdding ? (
                            <span className="propeller-favorite-list-details__search-item-spinner text-xs text-foreground-subtle">
                              {getLabel(props.labels, 'adding', 'Adding...')}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </div>
            <div className="propeller-favorite-list-details__modal-footer border-t border-border px-6 py-4 flex justify-end">
              <button
                type="button"
                className="propeller-favorite-list-details__modal-close inline-flex items-center justify-center rounded-control border border-border px-6 py-2 text-sm font-medium text-secondary transition-colors hover:bg-surface-hover"
                onClick={() => closeAddModal()}
              >
                {getLabel(props.labels, 'close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
export default FavoriteListDetails;
