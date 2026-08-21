/**
 * fetchActiveCart — fetches the user's existing OPEN cart filtered by user/company.
 *
 * Framework-agnostic helper so login/register pages can reuse the same logic
 * without forcing a state-management store dependency.
 */

import { CartStatus } from '@propeller-commerce/propeller-sdk-v2';
import type { Services } from '@propeller-commerce/propeller-v2-core-ui';
import type {
  Cart,
  CartSearchInput,
  Contact,
  Customer,
  MediaImageProductSearchInput,
  TransformationsInput,
} from '@propeller-commerce/propeller-sdk-v2';
import type { CartQueryVariables } from '@propeller-commerce/propeller-sdk-v2';

/** Configuration object for {@link fetchActiveCart}. */
export interface FetchActiveCartConfig {
  /**
   * The Services bundle — pass `services` from `usePropellerContext()` / the
   * provider's value object. Replaces the previous `graphqlClient` field.
   */
  services: Services;
  /** The authenticated user (Contact or Customer) whose cart to look up. */
  user: Contact | Customer;
  /** Active company ID — narrows the cart search for company users. */
  companyId?: number;
  /** Language code for the localised cart query. */
  language: string;
  /** Image search filters forwarded to the cart query that hydrates item media. */
  imageSearchFilters: MediaImageProductSearchInput;
  /** Image transformation filters forwarded to the cart query that hydrates item media. */
  imageVariantFilters: TransformationsInput;
}

/**
 * Fetches the user's existing OPEN cart, or `null` when none exists.
 *
 * @param cfg - The fetch configuration.
 * @returns The hydrated open cart, or `null` if none is found or the lookup fails.
 *
 * @remarks
 * Uses the {@link Services.cart} SDK service:
 * - `cart.getCarts` searches `OPEN` carts filtered by contact/customer/company.
 * - `cart.getCart` hydrates the most recent matching cart by `cartId`.
 * Errors are caught, logged, and surfaced as a `null` return.
 */
export async function fetchActiveCart(
  cfg: FetchActiveCartConfig,
): Promise<Cart | null> {
  const cartService = cfg.services.cart;
  try {
    const searchInput: CartSearchInput = {
      offset: 100,
      statuses: [CartStatus.OPEN],
    };
    let scopedByCompany = false;
    if ('contactId' in cfg.user && cfg.user.contactId) {
      searchInput.contactIds = [cfg.user.contactId];
      if (cfg.companyId) {
        searchInput.companyIds = [cfg.companyId];
        scopedByCompany = true;
      }
    } else if ('customerId' in cfg.user && cfg.user.customerId) {
      searchInput.customerIds = [cfg.user.customerId];
    }

    // The backend authorizes the `companyIds` cart filter against the contact's
    // memberships; a `companyId` the contact doesn't belong to (e.g. a stale
    // selection left from a previous session) makes the whole query fail with
    // "Unauthorized use of companyIds". Drop the company narrowing and retry on
    // the contact alone — that returns the same cart and never 403s. The caller
    // is expected to reconcile the bad selection separately.
    let carts;
    try {
      carts = await cartService.getCarts(searchInput);
    } catch (companyScopedErr) {
      if (!scopedByCompany) throw companyScopedErr;
      console.warn(
        '[fetchActiveCart] company-scoped cart lookup failed; retrying without companyIds:',
        companyScopedErr,
      );
      delete searchInput.companyIds;
      carts = await cartService.getCarts(searchInput);
    }

    if (carts?.items?.length) {
      const existingCartId = carts.items[carts.items.length - 1].cartId;
      const cartVars: CartQueryVariables = {
        cartId: existingCartId,
        imageSearchFilters: cfg.imageSearchFilters,
        imageVariantFilters: cfg.imageVariantFilters,
        language: cfg.language,
      };
      return (await cartService.getCart(cartVars)) ?? null;
    }
    return null;
  } catch (e) {
    console.error('[fetchActiveCart] Failed to fetch active cart:', e);
    return null;
  }
}
