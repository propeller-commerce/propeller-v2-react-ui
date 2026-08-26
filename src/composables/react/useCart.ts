/**
 * useCart (React) — Cart management hook.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { createServices, ok, err, type AnyUser, type Result } from '@propeller-commerce/propeller-v2-core-ui';
import { CrossupsellType, PurchaseRole } from '@propeller-commerce/propeller-sdk-v2';
import type { GraphQLClient, Cart, CartMainItem, Product, Cluster, Contact, Customer, MediaImageProductSearchInput, TransformationsInput, PurchaseAuthorizationConfig, Crossupsell, CrossupsellsQueryVariables, CrossupsellSearchInput, CartProcessResponse } from '@propeller-commerce/propeller-sdk-v2';
import { initCart, type CartInitConfig } from '../shared/utils/cartInit';

// The cart mutations take the media arguments that decide whether the returned
// cart items carry any `imageVariants` at all. They are optional and nothing
// warns when they are missing: the mutation succeeds and every consumer that
// reads `media.images.items[0].imageVariants[0].url` — CartItem,
// CartIconAndSidebar, the add-to-cart modal — renders an empty tile for a
// product that has a perfectly good PIM image. The failure shows up two screens
// away from the call site, so default them here rather than requiring every
// host to rediscover it. An explicit `configuration` still wins.
const DEFAULT_IMAGE_SEARCH_FILTERS = { page: 1, offset: 1 } as MediaImageProductSearchInput;
const DEFAULT_IMAGE_VARIANT_FILTERS = {
  transformations: [
    { name: 'thumb', transformation: { format: 'WEBP', height: 100, width: 100, fit: 'BOUNDS' } },
  ],
} as unknown as TransformationsInput;

/** Options for {@link useCart}. */
export interface UseCartOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** The signed-in user (Contact or Customer); scopes cart lookup and pricing. */
  user: AnyUser;
  /** Existing cart id to seed the hook with, skipping `resolveCart`. */
  cartId?: string;
  /** Active company id for B2B carts and purchase-authorization checks. */
  companyId?: number;
  /** Cart language. Falls back to `configuration.language`, then `'NL'`. */
  language?: string;
  /** Portal configuration: language plus image search/variant filters. */
  configuration?: { language?: string; imageSearchFiltersGrid?: MediaImageProductSearchInput; imageVariantFiltersSmall?: TransformationsInput };
  /** Fires once whenever a cart is resolved or created — use it to persist `cart.cartId`. */
  onCartCreated?: (cart: Cart) => void;
}

/** Arguments for {@link UseCartReturn.addItem}. */
export interface AddItemOptions {
  /** Product to add. */
  product: Product;
  /** Cluster the product belongs to, when adding a configured cluster item. */
  cluster?: Cluster;
  /** Child product ids for bundle/cluster composite items. */
  childItems?: number[];
  /** Quantity to add. */
  quantity: number;
  /** Free-text line-item notes. */
  notes?: string;
  /** Explicit unit price override. */
  price?: number;
  /** Override: when provided, replaces the SDK call and returns the cart synchronously. */
  onAddToCart?: (product: Product, clusterId?: number, quantity?: number, childItems?: { productId: number; quantity: number }[], notes?: string, price?: number) => Cart | Promise<Cart>;
  /** Fires after the item is added — receives the updated cart and the matched line item. */
  afterAddToCart?: (cart: Cart, item: CartMainItem | null) => void;
  /** When `true`, rejects the add if `product.inventory.totalQuantity` is below `quantity`. */
  enableStockValidation?: boolean;
  /** Explicit cart id to add into; defaults to the hook's resolved cart. */
  cartId?: string;
  /** When `true` and no cart exists, resolves/creates one before adding. */
  createCart?: boolean;
}

/** Arguments for {@link UseCartReturn.getCrossupsells}. */
export interface GetCrossupsellsOptions {
  /** Source product id to fetch crossupsells for. */
  productId?: number;
  /** Source cluster id to fetch crossupsells for. */
  clusterId?: number;
  /** Crossupsell types; defaults to `[ACCESSORIES]`. */
  types?: string[];
  /** Tax zone for price calculation. Defaults to `'NL'`. */
  taxZone?: string;
  /** Image transformation filters for the returned items. */
  imageVariantFilters?: TransformationsInput;
}

/** Cart state and actions returned by {@link useCart}. */
export interface UseCartReturn {
  /** The resolved cart, or `null` before `resolveCart` runs. */
  cart: Cart | null;
  /** Id of the resolved cart, or `''`. */
  cartId: string;
  /** `true` while a mutating cart call is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** `false` when a B2B purchaser's authorization limit is exceeded by the cart total. */
  checkoutAllowed: boolean;
  /** Resolves an existing cart or creates one via the shared `initCart` flow. */
  resolveCart: () => Promise<Cart>;
  /** Adds a product (optionally a cluster/bundle) to the cart. */
  addItem: (
    options: AddItemOptions,
  ) => Promise<Result<{ cart: Cart; item: CartMainItem | null }, string>>;
  /**
   * Adds several products in one call, sequentially, threading the resolved
   * cart id from each add into the next. Use this instead of looping over
   * `addItem` yourself. Stops at the first failure and returns that error.
   */
  addItems: (
    items: AddItemOptions[],
  ) => Promise<Result<{ cart: Cart; items: (CartMainItem | null)[] }, string>>;
  /** Updates a line item's quantity. */
  updateItemQuantity: (cartItemId: string, quantity: number) => Promise<Cart | undefined>;
  /** Debounced update of a line item's notes (`debounceMs` defaults to 500). */
  updateItemNotes: (cartItemId: string, notes: string, debounceMs?: number) => void;
  /** Removes a line item from the cart. */
  deleteItem: (cartItemId: string) => Promise<Cart | undefined>;
  /** Applies a promotional action code to the cart. */
  addActionCode: (code: string) => Promise<Cart | undefined>;
  /** Removes a previously-applied action code. */
  removeActionCode: (code: string) => Promise<Cart | undefined>;
  /** Submits the cart for purchase authorization (B2B). */
  requestAuthorization: () => Promise<Result<void, string>>;
  /** Converts the cart into an order (`orderStatus` defaults to `'COMPLETE'`). */
  processCart: (orderStatus?: string) => Promise<Result<CartProcessResponse, string>>;
  /** Fetches crossupsell / accessory products for a product or cluster. */
  getCrossupsells: (options: GetCrossupsellsOptions) => Promise<Crossupsell[]>;
  /** Returns the minimum orderable quantity for a product (>= 1). */
  getMinQuantity: (product: Product | null | undefined) => number;
  /** Returns the quantity step / unit increment for a product (>= 1). */
  getStep: (product: Product | null | undefined) => number;
}

/**
 * useCart — cart resolution and line-item management.
 *
 * @param options - see {@link UseCartOptions}.
 * @returns cart state plus async actions — see {@link UseCartReturn}.
 *
 * @remarks
 * GraphQL integration: all backend calls go through `services.cart` (`CartService`)
 * and `services.crossupsell` (`CrossupsellService`), derived from
 * `options.graphqlClient` via `createServices`. `resolveCart()` runs the shared
 * `initCart` flow (`getCarts` → `startCart` → `updateCartAddress`). `addItem` calls
 * `addItemToCart`; `updateItemQuantity` / `updateItemNotes` call `updateCartItem`
 * (the notes update is debounced); `deleteItem` calls `deleteCartItem`;
 * `addActionCode` / `removeActionCode` call `addActionCodeToCart` /
 * `removeActionCodeFromCart`; `requestAuthorization` calls
 * `requestPurchaseAuthorization`; `processCart` calls `processCart` to convert the
 * cart to an order; `getCrossupsells` calls `crossupsell.getCrossupsells`. Cart
 * mutations require a cart id; `addItem` can create one on demand via `createCart`.
 */
export function useCart(options: UseCartOptions): UseCartReturn {
  const { graphqlClient, user, companyId, configuration, onCartCreated } = options;
  const language = options.language || configuration?.language || 'NL';

  const [cart, setCart] = useState<Cart | null>(null);
  // The caller's cart id has to keep winning AFTER mount. This used to seed
  // state once with `useState(options.cartId || '')`, so a component that
  // mounted before the cart resolved — `CartIconAndSidebar` lives in the header
  // and renders on the first paint of every page — held '' forever. Every
  // action guarded on the id then failed silently: "Request authorization"
  // rendered enabled, fired, and returned `err('No cart')`.
  // Derived rather than an effect, so there is no render in between where the
  // hook still reports the stale id.
  const [createdCartId, setCreatedCartId] = useState('');
  const cartId = options.cartId || createdCartId;
  // State does not update until the next render, so a handler that adds several
  // products in one tick read the same stale id on every iteration: the 2nd..nth
  // add failed with "No cart ID provided", or — with `createCart` — quietly
  // started a NEW cart per product so only the last one survived. The ref is
  // written the moment a cart is resolved, within the same tick.
  const cartIdRef = useRef(cartId);
  if (cartId && cartIdRef.current !== cartId) cartIdRef.current = cartId;

  // Every place that learns a cart id goes through here, so the ref can never
  // drift from the state.
  const rememberCart = useCallback((c: Cart) => {
    setCart(c);
    setCreatedCartId(c.cartId);
    cartIdRef.current = c.cartId;
  }, []);

  const imageSearchFilters = useCallback(
    (): MediaImageProductSearchInput =>
      (configuration?.imageSearchFiltersGrid as MediaImageProductSearchInput) ?? DEFAULT_IMAGE_SEARCH_FILTERS,
    [configuration],
  );
  const imageVariantFilters = useCallback(
    (): TransformationsInput =>
      (configuration?.imageVariantFiltersSmall as TransformationsInput) ?? DEFAULT_IMAGE_VARIANT_FILTERS,
    [configuration],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const checkoutAllowed = useMemo<boolean>(() => {
    if (!user || !('contactId' in user)) return true;
    if (!companyId) return true;
    if (!cart) return true;
    const pacData = (user as Contact).purchaseAuthorizationConfigs;
    const items: PurchaseAuthorizationConfig[] = pacData?.items ?? [];
    const purchaserPac = items.find((pac: PurchaseAuthorizationConfig) =>
      pac.purchaseRole === PurchaseRole.PURCHASER && pac.company?.companyId === companyId
    );
    if (!purchaserPac) return true;
    const limit = purchaserPac.authorizationLimit ?? 0;
    const totalGross = cart.total?.totalGross ?? 0;
    return totalGross <= limit;
  }, [user, companyId, cart]);

  function getMinQuantity(product: Product | null | undefined): number { const min = product?.minimumQuantity; return min && min > 0 ? min : 1; }
  function getStep(product: Product | null | undefined): number { const unit = product?.unit; return unit && unit > 0 ? unit : 1; }

  const resolveCart = useCallback(async (): Promise<Cart> => {
    const config: CartInitConfig = {
      services: createServices(graphqlClient),
      user, companyId, language,
      imageSearchFilters: imageSearchFilters(),
      imageVariantFilters: imageVariantFilters(),
      onCartCreated: (c) => { rememberCart(c); onCartCreated?.(c); },
    };
    const resolved = await initCart(config);
    rememberCart(resolved);
    return resolved;
  }, [graphqlClient, user, companyId, language, configuration, onCartCreated]);

  const addItem = useCallback(async (
    opts: AddItemOptions,
  ): Promise<Result<{ cart: Cart; item: CartMainItem | null }, string>> => {
    setLoading(true); setError(null);
    try {
      if (opts.enableStockValidation) {
        const available = opts.product.inventory?.totalQuantity ?? 0;
        if (available < opts.quantity) return err('Insufficient stock available');
      }
      const childItemInputs = opts.childItems?.map((id) => ({ productId: id, quantity: opts.quantity }));
      if (opts.onAddToCart) {
        const resultCart = await opts.onAddToCart(opts.product, opts.cluster?.clusterId, opts.quantity, childItemInputs, opts.notes, opts.price);
        rememberCart(resultCart);
        const addedItem = resultCart.items?.find((i: CartMainItem) => i.productId === opts.product.productId) ?? null;
        opts.afterAddToCart?.(resultCart, addedItem);
        return ok({ cart: resultCart, item: addedItem });
      }
      let resolvedCartId = opts.cartId || cartIdRef.current || cartId;
      if (!resolvedCartId) {
        if (opts.createCart) { const c = await resolveCart(); resolvedCartId = c.cartId; }
        else return err('No cart ID provided');
      }
      const service = createServices(graphqlClient).cart;
      const resultCart = await service.addItemToCart({
        id: resolvedCartId,
        input: { productId: opts.product.productId, quantity: opts.quantity, ...(opts.cluster?.clusterId !== undefined && { clusterId: opts.cluster.clusterId }), ...(childItemInputs && { childItems: childItemInputs }), ...(opts.notes && { notes: opts.notes }), ...(opts.price !== undefined && { price: opts.price }) },
        language, imageSearchFilters: imageSearchFilters(), imageVariantFilters: imageVariantFilters(),
      });
      rememberCart(resultCart);
      const addedItem = resultCart.items?.find((i: CartMainItem) => i.productId === opts.product.productId) ?? null;
      opts.afterAddToCart?.(resultCart, addedItem);
      return ok({ cart: resultCart, item: addedItem });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add item to cart';
      setError(msg);
      return err(msg);
    } finally { setLoading(false); }
  }, [graphqlClient, cartId, language, configuration, resolveCart, rememberCart, imageSearchFilters, imageVariantFilters]);

  /**
   * Sequential bulk add. Each add hands its resolved cart id to the next, so
   * the first one may create the cart and the rest land in it.
   */
  const addItems = useCallback(async (
    items: AddItemOptions[],
  ): Promise<Result<{ cart: Cart; items: (CartMainItem | null)[] }, string>> => {
    const added: (CartMainItem | null)[] = [];
    let lastCart: Cart | null = null;
    for (const item of items) {
      const result = await addItem({ createCart: true, ...item });
      if (!result.ok) return err(result.error);
      lastCart = result.data.cart;
      added.push(result.data.item);
    }
    if (!lastCart) return err('No items to add');
    return ok({ cart: lastCart, items: added });
  }, [addItem]);

  const updateItemQuantity = useCallback(async (cartItemId: string, quantity: number): Promise<Cart | undefined> => {
    if (!cartId) return undefined; setLoading(true);
    try {
      const service = createServices(graphqlClient).cart;
      const updated = await service.updateCartItem({ id: cartId, itemId: cartItemId, input: { quantity }, language, imageSearchFilters: imageSearchFilters(), imageVariantFilters: imageVariantFilters() });
      setCart(updated);
      return updated;
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to update quantity'); }
    finally { setLoading(false); }
  }, [graphqlClient, cartId, language, configuration]);

  const updateItemNotes = useCallback((cartItemId: string, notes: string, debounceMs = 500): void => {
    if (notesTimers.current[cartItemId]) clearTimeout(notesTimers.current[cartItemId]);
    notesTimers.current[cartItemId] = setTimeout(async () => {
      delete notesTimers.current[cartItemId];
      if (!cartId) return;
      try {
        const service = createServices(graphqlClient).cart;
        const updated = await service.updateCartItem({ id: cartId, itemId: cartItemId, input: { notes }, language, imageSearchFilters: imageSearchFilters(), imageVariantFilters: imageVariantFilters() });
        setCart(updated);
      } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to update notes'); }
    }, debounceMs);
  }, [graphqlClient, cartId, language, configuration]);

  const deleteItem = useCallback(async (cartItemId: string): Promise<Cart | undefined> => {
    if (!cartId) return undefined; setLoading(true);
    try {
      const service = createServices(graphqlClient).cart;
      const updated = await service.deleteCartItem({
        id: cartId,
        input: { itemId: cartItemId },
        language,
        imageSearchFilters: imageSearchFilters(),
        imageVariantFilters: imageVariantFilters()
      });
      setCart(updated);
      return updated;
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to delete item'); }
    finally { setLoading(false); }
  }, [graphqlClient, cartId, language, configuration]);

  const addActionCode = useCallback(async (code: string): Promise<Cart | undefined> => {
    if (!cartId) return undefined;
    try {
      const service = createServices(graphqlClient).cart;
      const updated = await service.addActionCodeToCart({ id: cartId, input: { actionCode: code }, language, imageSearchFilters: imageSearchFilters(), imageVariantFilters: imageVariantFilters() });
      setCart(updated);
      return updated;
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to add action code'); }
  }, [graphqlClient, cartId, language, configuration]);

  const removeActionCode = useCallback(async (code: string): Promise<Cart | undefined> => {
    if (!cartId) return undefined;
    try {
      const service = createServices(graphqlClient).cart;
      const updated = await service.removeActionCodeFromCart({ id: cartId, input: { actionCode: code }, language, imageSearchFilters: imageSearchFilters(), imageVariantFilters: imageVariantFilters() });
      setCart(updated);
      return updated;
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to remove action code'); }
  }, [graphqlClient, cartId, language, configuration]);

  const requestAuthorization = useCallback(async (): Promise<Result<void, string>> => {
    if (!cartId) return err('No cart');
    try {
      const service = createServices(graphqlClient).cart;
      await service.requestPurchaseAuthorization({ id: cartId });
      return ok(undefined);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to request authorization');
    }
  }, [graphqlClient, cartId]);

  const processCart = useCallback(async (orderStatus = 'COMPLETE'): Promise<Result<CartProcessResponse, string>> => {
    if (!cartId) return err('No cart');
    try {
      const service = createServices(graphqlClient).cart;
      const response = await service.processCart({ id: cartId, input: { orderStatus, language } });
      return ok(response);
    } catch (e: unknown) {
      return err(e instanceof Error ? e.message : 'Failed to process cart');
    }
  }, [graphqlClient, cartId, language]);

  const getCrossupsells = useCallback(async (opts: GetCrossupsellsOptions): Promise<Crossupsell[]> => {
    // `opts.imageVariantFilters` is read through `opts` on purpose — destructuring
    // it here would shadow the hook's resolver of the same name.
    const { productId, clusterId, types, taxZone } = opts;
    if (!productId && !clusterId) return [];
    try {
      const service = createServices(graphqlClient).crossupsell;
      const variables: CrossupsellsQueryVariables = {
        input: {
          types: (types ?? [CrossupsellType.ACCESSORIES]) as CrossupsellSearchInput['types'],
          page: 1,
          offset: 50,
          ...(productId && !clusterId && { productIdsFrom: [productId] }),
          ...(clusterId && { clusterIdsFrom: [clusterId] }),
        },
        language,
        imageSearchFilters: imageSearchFilters(),
        imageVariantFilters: opts.imageVariantFilters ?? imageVariantFilters(),
        priceCalculateProductInput: {
          taxZone: taxZone || 'NL',
          ...(user && 'company' in user && { companyId: (user as Contact)?.company?.companyId }),
          ...(user && 'contactId' in user && { contactId: (user as Contact)?.contactId }),
          ...(user && 'customerId' in user && { customerId: (user as Customer)?.customerId }),
        },
      };
      const result = await service.getCrossupsells(variables);
      return result?.items ?? [];
    } catch { return []; }
  }, [graphqlClient, language, user, imageSearchFilters, imageVariantFilters]);

  return { cart, cartId, loading, error, checkoutAllowed, resolveCart, addItem, addItems, updateItemQuantity, updateItemNotes, deleteItem, addActionCode, removeActionCode, requestAuthorization, processCart, getCrossupsells, getMinQuantity, getStep };
}
