/**
 * cartInit — 3-step cart initialisation shared by useCart and useProductBundles.
 *
 * Step 1: Search for an existing OPEN cart for this user.
 * Step 2: If none found, create a new cart via startCart.
 * Step 3: Assign default invoice and delivery addresses to the new cart.
 *
 * Framework-agnostic async function.
 */

import { CartAddressType, CartStatus, Gender } from '@propeller-commerce/propeller-sdk-v2';
import type {
  Cart,
  CartSearchInput,
  CartStartInput,
  CartStartVariables,
  CartUpdateAddressInput,
  Address,
  MediaImageProductSearchInput,
  TransformationsInput,
} from '@propeller-commerce/propeller-sdk-v2';
import {
  isContact,
  isCustomer,
  getAddresses,
  type AnyUser,
  type Services,
} from '@propeller-commerce/propeller-v2-core-ui';

/** Configuration object for {@link initCart}. */
export interface CartInitConfig {
  /**
   * The Services bundle — pass `services` from `usePropellerContext()` / the
   * provider's value object. Replaces the previous `graphqlClient` field
   * which forced this util to know how to construct services.
   */
  services: Services;
  /** The current user (Contact or Customer); `null` for anonymous carts. */
  user: AnyUser;
  /** Active company ID — overrides user's default company for cart lookup and creation */
  companyId?: number;
  /** Language code for localised cart queries. Defaults to `'NL'`. */
  language?: string;
  /** Image search filters forwarded to cart queries that hydrate item media. */
  imageSearchFilters?: MediaImageProductSearchInput;
  /** Image transformation filters forwarded to cart queries that hydrate item media. */
  imageVariantFilters?: TransformationsInput;
  /** Callback invoked with the resolved cart once it is fetched or created. */
  onCartCreated?: (cart: Cart) => void;
}

/**
 * Resolves the active cart for the current user.
 * Returns an existing OPEN cart if one exists, otherwise creates and
 * initialises a new cart with default addresses.
 *
 * @param config - The cart initialisation configuration.
 * @returns The resolved (existing or newly created) cart.
 *
 * @remarks
 * Uses the {@link Services.cart} SDK service exclusively:
 * - `cart.getCarts` searches for an existing `OPEN` cart by contact/customer/company.
 * - `cart.getCart` hydrates the matched cart by `cartId`.
 * - `cart.startCart` creates a new cart when no open cart is found.
 * - `cart.updateCartAddress` assigns the user's default invoice and delivery
 *   addresses to the new cart (best-effort; failures are swallowed).
 */
export async function initCart(config: CartInitConfig): Promise<Cart> {
  const {
    services,
    user,
    companyId,
    language = 'NL',
    imageSearchFilters,
    imageVariantFilters,
    onCartCreated,
  } = config;

  const cartService = services.cart;

  // ── Step 1: Look for an existing open cart ────────────────────────────────
  if (user) {
    try {
      const searchInput: CartSearchInput = {
        offset: 100,
        statuses: [CartStatus.OPEN],
      };

      if (isContact(user) && user.contactId) {
        searchInput.contactIds = [user.contactId];
        const resolvedCompanyId = companyId ?? user.company?.companyId;
        if (resolvedCompanyId) {
          searchInput.companyIds = [resolvedCompanyId];
        }
      } else if (isCustomer(user) && user.customerId) {
        searchInput.customerIds = [user.customerId];
      }

      const carts = await cartService.getCarts(searchInput);

      if (carts?.items && carts.items.length > 0) {
        const existingCartId = carts.items[carts.items.length - 1].cartId;
        const cart = await cartService.getCart({
          cartId: existingCartId,
          imageSearchFilters: imageSearchFilters as MediaImageProductSearchInput,
          imageVariantFilters: imageVariantFilters as TransformationsInput,
          language,
        });
        onCartCreated?.(cart);
        return cart;
      }
    } catch (e) {
      console.error('[cartInit] Failed to fetch existing carts:', e);
    }
  }

  // ── Step 2: Create a new cart ─────────────────────────────────────────────
  const startInput: CartStartInput = { language };

  if (user) {
    if (isContact(user) && user.contactId) {
      startInput.contactId = user.contactId;
      const resolvedCompanyId = companyId ?? user.company?.companyId;
      if (resolvedCompanyId) {
        startInput.companyId = resolvedCompanyId;
      }
    } else if (isCustomer(user) && user.customerId) {
      startInput.customerId = user.customerId;
    }
  }

  const startVars: CartStartVariables = {
    input: startInput,
    imageSearchFilters: imageSearchFilters as MediaImageProductSearchInput,
    imageVariantFilters: imageVariantFilters as TransformationsInput,
    language,
  };

  let cart = await cartService.startCart(startVars);

  // ── Step 3: Assign default addresses ─────────────────────────────────────
  if (cart && user) {
    const addresses = getAddresses(user);

    const defaultInvoice = addresses.find(
      (addr: Address) => addr.isDefault === 'Y' && addr.type === 'invoice'
    );
    const defaultDelivery = addresses.find(
      (addr: Address) => addr.isDefault === 'Y' && addr.type === 'delivery'
    );

    const addressBase = (addr: Address): Omit<CartUpdateAddressInput, 'type'> => {
      const base: Omit<CartUpdateAddressInput, 'type'> = {
        firstName: addr.firstName || '',
        lastName: addr.lastName || '',
        street: addr.street || '',
        postalCode: addr.postalCode || '',
        city: addr.city || '',
        country: addr.country || 'NL',
        gender: addr.gender || Gender.U,
      };
      if (addr.middleName) base.middleName = addr.middleName;
      if (addr.number) base.number = String(addr.number);
      if (addr.numberExtension) base.numberExtension = String(addr.numberExtension);
      if (addr.company) base.company = addr.company;
      if (addr.email) base.email = addr.email;
      if (addr.mobile) base.mobile = addr.mobile;
      if (addr.phone) base.phone = addr.phone;
      if (addr.notes) base.notes = addr.notes;
      return base;
    };

    if (defaultInvoice) {
      try {
        cart = await cartService.updateCartAddress({
          id: cart.cartId,
          input: { type: CartAddressType.INVOICE, ...addressBase(defaultInvoice) },
          imageSearchFilters: imageSearchFilters as MediaImageProductSearchInput,
          imageVariantFilters: imageVariantFilters as TransformationsInput,
          language,
        });
      } catch {
        // Address update is best-effort; cart still works without it
        // and the user can set the address at checkout.
      }
    }

    if (defaultDelivery) {
      try {
        cart = await cartService.updateCartAddress({
          id: cart.cartId,
          input: { type: CartAddressType.DELIVERY, ...addressBase(defaultDelivery) },
          imageSearchFilters: imageSearchFilters as MediaImageProductSearchInput,
          imageVariantFilters: imageVariantFilters as TransformationsInput,
          language,
        });
      } catch {
        // Address update is best-effort; cart still works without it
        // and the user can set the address at checkout.
      }
    }
  }

  onCartCreated?.(cart);
  return cart;
}
