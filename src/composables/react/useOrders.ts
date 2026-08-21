/**
 * useOrders (React) — Order list, search, PDF download and reorder flow.
 */

import { useState, useCallback, useEffect } from 'react';
import { createServices } from '@propeller-commerce/propeller-v2-core-ui';
import { OrderItemClass, OrderSearchFields, OrderType, YesNo } from '@propeller-commerce/propeller-sdk-v2';
import type {
  GraphQLClient,
  Order,
  OrderItem,
  Cart,
  OrderSearchArguments,
  DateSearchInput,
  DecimalSearchInput,
  OrderSortInput,
  Base64File,
  CartAddItemVariables,
  MediaImageProductSearchInput,
  TransformationsInput,
  OrderQueryVariables,
} from '@propeller-commerce/propeller-sdk-v2';
import { usePagination } from './shared/usePagination';
import { initCart } from '../shared/utils/cartInit';
import type { AnyUser } from '@propeller-commerce/propeller-v2-core-ui';
import { isContact, isCustomer } from '@propeller-commerce/propeller-v2-core-ui';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Search/filter criteria for the order list. */
export interface OrderSearchForm {
  /** Free-text search term matched against `termFields`. */
  term?: string;
  /** Filter on order creation date. */
  createdAt?: DateSearchInput;
  /** Filter on last-modified date. */
  lastModifiedAt?: DateSearchInput;
  /** Filter on order total price. */
  price?: DecimalSearchInput;
  /** Sort field/direction for the results. */
  sortInput?: Partial<OrderSortInput>;
  /** Restrict to a single order type. */
  type?: OrderType;
}

/** Options for {@link useOrders}. */
export interface UseOrdersOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** The signed-in user; supplies the userId the order query is scoped to. */
  user: AnyUser;
  /** Active company id; scopes orders to a company for B2B users. */
  companyId?: number;
  /** Language for order/PDF queries. Defaults to `'NL'`. */
  language?: string;
  /** Page size for the order list. Defaults to 10. */
  itemsPerPage?: number;
  /** Order statuses to include. Defaults to `['NEW','CONFIRMED','VALIDATED','ORDER']`. */
  orderStatuses?: string[];
  /** Fields the free-text `term` is matched against. */
  termFields?: OrderSearchFields[];
  /**
   * Seed the search/filter form on mount — e.g. rehydrated from the URL query
   * so a bookmarked/shared filtered view restores. The consumer is responsible
   * for the fetch: pass this and the first fetch uses the seeded criteria.
   */
  initialSearchForm?: OrderSearchForm;
  /** Portal configuration: image search/variant filters. */
  configuration?: {
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
  };
  /** Restrict orders to specific sales channels. */
  channelIds?: number[];
  /** Fires when `reorder` creates a fresh cart — use it to persist the cart id. */
  onCartCreated?: (cart: Cart) => void;
  /** Fires after a reorder completes — receives the cart all items were added to. */
  afterReorder?: (cart: Cart) => void;
}

/** State and order actions returned by {@link useOrders}. */
export interface UseOrdersReturn {
  /** The current page of orders. */
  orders: Order[];
  /** `true` while a fetch is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** The active search/filter criteria. */
  searchForm: OrderSearchForm;
  /** Replaces the search criteria (does not trigger a fetch on its own). */
  setSearchForm: (form: OrderSearchForm) => void;
  /** Current page number (1-based). */
  currentPage: number;
  /** Total number of pages. */
  totalPages: number;
  /** Total matching orders across all pages. */
  totalItems: number;
  /** Page size. */
  itemsPerPage: number;
  /** Fetches a page of orders using the current search form. */
  fetchOrders: (page?: number) => Promise<void>;
  /** Navigates to a page. */
  goToPage: (page: number) => void;
  /** Clears the search form and refetches page 1. */
  resetSearch: () => void;
  /** Downloads an order's confirmation PDF to the browser. */
  downloadPdf: (order: Order) => Promise<{ success: boolean; error?: string }>;
  /** Re-adds an order's items to a (new or existing) cart. */
  reorder: (order: Order, cartId?: string) => Promise<{ success: boolean; cart?: Cart; error?: string }>;
  /** Updates a quote/order status by id. */
  setQuoteStatus: (
    orderId: number,
    flags: { status?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  /** Fetches a single order by id. */
  getOrderById: (orderId: number) => Promise<{ success: boolean; order?: Order; error?: string }>;
  /** Downloads a quote PDF for the given order id. */
  downloadQuotePdf: (orderId: number) => Promise<{ success: boolean; error?: string }>;
}

/**
 * useOrders — order list, search, PDF download and reorder flow.
 *
 * @param options - see {@link UseOrdersOptions}.
 * @returns order list, pagination state and async actions — see {@link UseOrdersReturn}.
 *
 * @remarks
 * GraphQL integration: services are built per-call via `createServices(graphqlClient)`.
 * Most calls go through `services.order` (`OrderService`) — `fetchOrders` calls
 * `getOrders` (scoped by `userId`, optional `companyIds` and statuses), `getOrderById`
 * calls `getOrder`, `downloadPdf` / `downloadQuotePdf` call `getOrderPDF` / `getQuotePDF`
 * (decoding the base64 result client-side into a download), and `setQuoteStatus` calls
 * `setOrderStatus`. `reorder` resolves a cart via the shared `initCart` flow then calls
 * `services.cart.addItemToCart` (`CartService`) once per parent order item. Pagination
 * is delegated to `usePagination`. All calls require an authenticated session.
 */
export function useOrders(options: UseOrdersOptions): UseOrdersReturn {
  const {
    graphqlClient,
    user,
    companyId,
    orderStatuses = ['NEW', 'CONFIRMED', 'VALIDATED', 'ORDER'],
    configuration = {},
    onCartCreated,
    afterReorder,
  } = options;

  const language = options.language || 'NL';
  const termFields = options.termFields ?? [
    OrderSearchFields.REFERENCE,
    OrderSearchFields.ITEM_SKU,
    OrderSearchFields.ID,
    OrderSearchFields.ITEM_NAME,
    OrderSearchFields.REMARKS,
  ];

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchForm, setSearchForm] = useState<OrderSearchForm>(
    options.initialSearchForm ?? {},
  );
  const pagination = usePagination(options.itemsPerPage ?? 10);

  // ── Fetch orders ──────────────────────────────────────────────────────────

  const fetchOrders = useCallback(
    async (page = 1): Promise<void> => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const service = createServices(graphqlClient).order;
        const userId: number = isContact(user) ? user.contactId : isCustomer(user) ? user.customerId : 0;
        const resolvedCompanyId = companyId ?? (isContact(user) ? user.company?.companyId : null);

        const searchArgs: OrderSearchArguments = {
          status: orderStatuses,
          userId: [userId!],
          ...(resolvedCompanyId && { companyIds: [resolvedCompanyId] }),
          page,
          offset: pagination.itemsPerPage,
          term: searchForm.term || '',
          termFields,
          ...(searchForm.createdAt && { createdAt: searchForm.createdAt }),
          ...(searchForm.lastModifiedAt && { lastModifiedAt: searchForm.lastModifiedAt }),
          ...(searchForm.price && { price: searchForm.price }),
          ...(searchForm.sortInput && { sortInputs: [searchForm.sortInput as OrderSortInput] }),
          ...(searchForm.type && { type: [searchForm.type] }),
          ...(options.channelIds?.length && { channelIds: options.channelIds }),
        };

        const response = await service.getOrders(searchArgs);
        setOrders(response.items || []);
        pagination.setFromResponse(response);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to fetch orders');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    },
    [graphqlClient, user, companyId, orderStatuses, searchForm, pagination.itemsPerPage]
  );

  useEffect(() => {
    if (user) fetchOrders(pagination.currentPage);
  }, [user, companyId, pagination.currentPage]);

  const resetSearch = useCallback(() => {
    setSearchForm({});
    fetchOrders(1);
  }, [fetchOrders]);

  // ── PDF download ──────────────────────────────────────────────────────────

  const downloadPdf = useCallback(
    async (order: Order): Promise<{ success: boolean; error?: string }> => {
      if (!order?.id) return { success: false, error: 'No order ID' };
      try {
        const service = createServices(graphqlClient).order;
        const pdfResponse = await service.getOrderPDF(order.id);
        if (!pdfResponse) return { success: false, error: 'No PDF response' };

        let byteArray: Uint8Array;
        let contentType = 'application/pdf';
        let fileName = `order-${order.id}-confirmation.pdf`;

        if (typeof pdfResponse === 'object' && (pdfResponse as Base64File).base64) {
          const r = pdfResponse as Base64File;
          const chars = atob(r.base64);
          byteArray = new Uint8Array(chars.length);
          for (let i = 0; i < chars.length; i++) byteArray[i] = chars.charCodeAt(i);
          contentType = r.contentType || contentType;
          fileName = r.fileName || fileName;
        } else if (typeof pdfResponse === 'string') {
          const chars = atob(pdfResponse);
          byteArray = new Uint8Array(chars.length);
          for (let i = 0; i < chars.length; i++) byteArray[i] = chars.charCodeAt(i);
        } else {
          return { success: false, error: 'Unrecognised PDF format' };
        }

        const blob = new Blob([byteArray.buffer as ArrayBuffer], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to download PDF' };
      }
    },
    [graphqlClient]
  );

  // ── Reorder ───────────────────────────────────────────────────────────────

  const reorder = useCallback(
    async (order: Order, existingCartId?: string): Promise<{ success: boolean; cart?: Cart; error?: string }> => {
      if (!order?.items) return { success: false, error: 'No order items' };
      try {
        let resolvedCartId = existingCartId;
        if (!resolvedCartId) {
          const c = await initCart({
            services: createServices(graphqlClient),
            user,
            companyId,
            language,
            imageSearchFilters: configuration.imageSearchFiltersGrid!,
            imageVariantFilters: configuration.imageVariantFiltersSmall!,
            onCartCreated,
          });
          resolvedCartId = c.cartId;
        }

        const cartService = createServices(graphqlClient).cart;
        const allProducts = order.items.filter(
          (item: OrderItem) => item.class === OrderItemClass.product && item.isBonus === YesNo.N
        );
        const parentItems = allProducts.filter((item: OrderItem) => !item.parentOrderItemId);
        const childMap = new Map<number, OrderItem[]>();
        allProducts
          .filter((item: OrderItem) => item.parentOrderItemId)
          .forEach((item: OrderItem) => {
            const arr = childMap.get(item.parentOrderItemId!) || [];
            arr.push(item);
            childMap.set(item.parentOrderItemId!, arr);
          });

        let lastCart: Cart | null = null;
        for (const item of parentItems) {
          if (!item.productId) continue;
          const isCluster = item.product?.cluster && typeof item.product.cluster === 'object';
          const children = childMap.get(item.id) || [];
          let clusterId: number | undefined;
          let childItems: { productId: number; quantity: number }[] | undefined;

          if (isCluster && item.product!.cluster) {
            clusterId = item.product!.cluster.clusterId;
            if (children.length > 0) {
              childItems = children
                .filter((c) => c.productId)
                .map((c) => ({ productId: c.productId!, quantity: c.quantity || item.quantity || 1 }));
            }
          }

          const addVars: CartAddItemVariables = {
            id: resolvedCartId,
            input: {
              productId: item.productId,
              quantity: item.quantity || 1,
              ...(clusterId !== undefined && { clusterId }),
              ...(childItems && { childItems }),
            },
            language,
            imageSearchFilters: configuration.imageSearchFiltersGrid!,
            imageVariantFilters: configuration.imageVariantFiltersSmall!,
          };

          lastCart = await cartService.addItemToCart(addVars);
        }

        if (lastCart) {
          afterReorder?.(lastCart);
          return { success: true, cart: lastCart };
        }
        return { success: false, error: 'No items were added' };
      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'Reorder failed' };
      }
    },
    [graphqlClient, user, companyId, language, configuration, onCartCreated, afterReorder]
  );

  // ── Quote status ──────────────────────────────────────────────────────────

  const setQuoteStatus = useCallback(
    async (
      orderId: number,
      flags: { status?: string }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const service = createServices(graphqlClient).order;
        await service.setOrderStatus({ orderId, ...flags });
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to update status' };
      }
    },
    [graphqlClient]
  );

  // ── Get single order by ID ────────────────────────────────────────────────

  const getOrderById = useCallback(
    async (orderId: number): Promise<{ success: boolean; order?: Order; error?: string }> => {
      try {
        const service = createServices(graphqlClient).order;
        const variables: OrderQueryVariables = {
          orderId,
          imageSearchFilters: configuration.imageSearchFiltersGrid,
          imageVariantFilters: configuration.imageVariantFiltersSmall,
          language,
        };
        const order = await service.getOrder(variables);
        if (!order) return { success: false, error: 'Order not found' };
        return { success: true, order };
      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch order' };
      }
    },
    [graphqlClient, language, configuration]
  );

  // ── Download quote PDF ────────────────────────────────────────────────────

  const downloadQuotePdf = useCallback(
    async (orderId: number): Promise<{ success: boolean; error?: string }> => {
      try {
        const service = createServices(graphqlClient).order;
        const pdfResponse = await service.getQuotePDF(orderId);
        if (!pdfResponse) return { success: false, error: 'No PDF response' };

        let byteArray: Uint8Array;
        let contentType = 'application/pdf';
        let fileName = `quote-${orderId}.pdf`;

        if (typeof pdfResponse === 'object' && (pdfResponse as Base64File).base64) {
          const r = pdfResponse as Base64File;
          const chars = atob(r.base64);
          byteArray = new Uint8Array(chars.length);
          for (let i = 0; i < chars.length; i++) byteArray[i] = chars.charCodeAt(i);
          contentType = r.contentType || contentType;
          fileName = r.fileName || fileName;
        } else if (typeof pdfResponse === 'string') {
          const chars = atob(pdfResponse);
          byteArray = new Uint8Array(chars.length);
          for (let i = 0; i < chars.length; i++) byteArray[i] = chars.charCodeAt(i);
        } else {
          return { success: false, error: 'Unrecognised PDF format' };
        }

        const blob = new Blob([byteArray.buffer as ArrayBuffer], { type: contentType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return { success: true };
      } catch (e: unknown) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to download quote PDF' };
      }
    },
    [graphqlClient]
  );

  return {
    orders,
    loading,
    error,
    searchForm,
    setSearchForm,
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
    totalItems: pagination.totalItems,
    itemsPerPage: pagination.itemsPerPage,
    fetchOrders,
    goToPage: pagination.goToPage,
    resetSearch,
    downloadPdf,
    reorder,
    setQuoteStatus,
    getOrderById,
    downloadQuotePdf,
  };
}
