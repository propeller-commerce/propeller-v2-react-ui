/**
 * useCheckout (React) — Multi-step checkout SDK logic.
 *
 * Encapsulates all SDK service calls for the checkout flow:
 * - Pre-populating cart addresses from user's saved default addresses
 * - Updating cart invoice/delivery addresses
 * - Updating cart shipping + payment data
 * - Placing an order or quote request (processCart → setOrderStatus → optional triggerQuoteSendRequest)
 * - Syncing a user's stored account address after in-checkout edits
 */

import { useState, useCallback } from 'react';
import {
  createServices,
  isContact,
  isCustomer,
  ok,
  err,
  type AnyUser,
  type Result,
} from '@propeller-commerce/propeller-v2-core-ui';
import { AddressType, CartAddressType, Gender, PaymentStatuses } from '@propeller-commerce/propeller-sdk-v2';
import type {
  GraphQLClient,
  Cart,
  CartUpdateAddressInput,
  CartUpdateInput,
  MediaImageProductSearchInput,
  TransformationsInput,
  Address,
  Company,
} from '@propeller-commerce/propeller-sdk-v2';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Options for {@link useCheckout}. */
export interface UseCheckoutOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** The signed-in user; supplies the saved default addresses pre-populated into the cart. */
  user: AnyUser;
  /** Active company id used to resolve the contact's company addresses. */
  companyId?: number;
  /** Checkout language. Defaults to `'NL'`. */
  language?: string;
  /** Portal configuration: image search/variant filters passed to cart mutations. */
  configuration?: {
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
  };
}

/** Arguments for {@link UseCheckoutReturn.placeOrder}. */
export interface PlaceOrderOptions {
  /** Id of the cart to convert. */
  cartId: string;
  /**
   * Order status to set. `'NEW'` for a completed order, `'REQUEST'` for a quote
   * request, `'UNFINISHED'` for an order awaiting an external payment (PSP) — the
   * payment webhook promotes it to its final status later. Any other backend
   * status string is also accepted.
   */
  orderStatus: 'NEW' | 'REQUEST' | 'UNFINISHED' | (string & {});
  /** Customer reference printed on the order. */
  reference?: string;
  /** Free-text order notes. */
  notes?: string;
  /** When `true`, treats this as a quote: suppresses confirmation email/PDF and triggers a quote-send request. */
  isQuoteMode?: boolean;
  /**
   * Whether this placement *finalizes* the order — i.e. sends the order
   * confirmation email, fires the confirm event, attaches the order PDF, and
   * clears the cart. Defaults to `true` for a normal order and `false` for a
   * quote.
   *
   * Set this to `false` for an order that still awaits an external payment
   * (e.g. `'UNFINISHED'` orders handed off to a PSP). The confirmation/cart
   * deletion should then happen when the payment is confirmed (the PSP webhook),
   * not at placement — otherwise the shopper is emailed and the cart cleared
   * before they've paid.
   */
  finalizeOrder?: boolean;
}

/** State and checkout actions returned by {@link useCheckout}. */
export interface UseCheckoutReturn {
  /** `true` while a checkout call is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** Pre-populate cart addresses from user's default saved addresses. Returns updated cart. */
  populateCartAddresses: (cart: Cart) => Promise<Cart>;
  /** Update a single cart address (invoice or delivery). Returns updated cart. */
  updateCartAddress: (cartId: string, input: CartUpdateAddressInput) => Promise<Cart>;
  /** Update cart shipping carrier + payment method. Returns updated cart. */
  updateCartShipping: (cartId: string, input: CartUpdateInput) => Promise<Cart>;
  /** Process cart to order/quote, set status, optionally trigger quote send. Returns orderId on success. */
  placeOrder: (options: PlaceOrderOptions) => Promise<Result<{ orderId: number }, string>>;
  /** Sync a user's stored account address with data entered during checkout. */
  updateUserAccountAddress: (addressData: Record<string, unknown>, type: CartAddressType) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a `cartUpdateAddress` input from a stored address.
 *
 * Optional fields are omitted when blank: the API validates them whenever they
 * are present and rejects an empty string — for example `email must be an
 * email` — which a delivery address legitimately leaves empty when contact
 * details live on the contact / customer record.
 *
 * @param type - Which cart address slot to write.
 * @param addr - The stored address to copy onto the cart.
 * @returns The mutation input.
 */
function buildAddressInput(type: CartAddressType, addr: Address): CartUpdateAddressInput {
  return {
    type,
    firstName: addr.firstName || '',
    lastName: addr.lastName || '',
    street: addr.street || '',
    postalCode: addr.postalCode || '',
    city: addr.city || '',
    ...(addr.company && { company: addr.company }),
    ...(addr.gender && { gender: addr.gender }),
    ...(addr.middleName && { middleName: addr.middleName }),
    ...(addr.number && { number: addr.number }),
    ...(addr.numberExtension && { numberExtension: addr.numberExtension }),
    ...(addr.country && { country: addr.country }),
    ...(addr.email && { email: addr.email }),
    ...(addr.mobile && { mobile: addr.mobile }),
    ...(addr.phone && { phone: addr.phone }),
  };
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * useCheckout — multi-step checkout SDK logic.
 *
 * @param options - see {@link UseCheckoutOptions}.
 * @returns loading/error state plus async checkout actions — see {@link UseCheckoutReturn}.
 *
 * @remarks
 * GraphQL integration: services are built per-call via `createServices(graphqlClient)`.
 * Cart steps go through `services.cart` (`CartService`) — `populateCartAddresses` and
 * `updateCartAddress` call `updateCartAddress`, `updateCartShipping` calls `updateCart`.
 * `placeOrder` calls `cart.updateCart` (when reference/notes are set), `cart.processCart`
 * to obtain the order id, then `services.order` (`OrderService`) `setOrderStatus` and,
 * in quote mode, `triggerQuoteSendRequest`. `updateUserAccountAddress` writes the
 * user's stored address back via `services.address` (`AddressService`) —
 * `updateCompanyAddress` for contacts, `updateCustomerAddress` for customers.
 * All calls require an authenticated session.
 */
export function useCheckout(options: UseCheckoutOptions): UseCheckoutReturn {
  const { graphqlClient, user, companyId } = options;
  const language = options.language ?? 'NL';
  const configuration = options.configuration ?? {};

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getActiveCompany(): Company | null {
    if (!user || !isContact(user)) return null;
    if (companyId) {
      const items = user.companies?.items;
      if (Array.isArray(items)) {
        const found = items.find((c) => c.companyId === companyId);
        if (found) return found;
      }
    }
    return user.company ?? null;
  }

  function getUserDefaultAddress(type: 'invoice' | 'delivery'): Address | null {
    if (!user) return null;
    let addresses: Address[] = [];
    if (isContact(user)) {
      const company = getActiveCompany();
      if (company) addresses = (company.addresses ?? []) as Address[];
    } else if (isCustomer(user)) {
      addresses = (user.addresses ?? []) as Address[];
    }
    const addressType = type === 'invoice' ? AddressType.invoice : AddressType.delivery;
    return addresses.find((a) => a.type === addressType && a.isDefault === 'Y')
      || addresses.find((a) => a.type === addressType)
      || null;
  }

  // ── Populate cart addresses ───────────────────────────────────────────────

  const populateCartAddresses = useCallback(
    async (cart: Cart): Promise<Cart> => {
      const cartService = createServices(graphqlClient).cart;
      const imageSearchFilters = configuration.imageSearchFiltersGrid;
      const imageVariantFilters = configuration.imageVariantFiltersSmall;
      const hasInvoice = !!cart.invoiceAddress?.street;
      const hasDelivery = !!cart.deliveryAddress?.street;

      let updatedCart = cart;

      if (!hasInvoice) {
        const defaultInvoice = getUserDefaultAddress('invoice');
        if (defaultInvoice) {
          updatedCart = await cartService.updateCartAddress({
            id: updatedCart.cartId,
            input: buildAddressInput(CartAddressType.INVOICE, defaultInvoice),
            imageVariantFilters,
            imageSearchFilters,
            language,
          });
        }
      }

      if (!hasDelivery) {
        const defaultDelivery = getUserDefaultAddress('delivery');
        if (defaultDelivery) {
          updatedCart = await cartService.updateCartAddress({
            id: updatedCart.cartId,
            input: buildAddressInput(CartAddressType.DELIVERY, defaultDelivery),
            imageVariantFilters,
            imageSearchFilters,
            language,
          });
        }
      }

      return updatedCart;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphqlClient, user, companyId, language, configuration]
  );

  // ── Update cart address ───────────────────────────────────────────────────

  const updateCartAddress = useCallback(
    async (cartId: string, input: CartUpdateAddressInput): Promise<Cart> => {
      const cartService = createServices(graphqlClient).cart;
      return cartService.updateCartAddress({
        id: cartId,
        input,
        imageVariantFilters: configuration.imageVariantFiltersSmall,
        imageSearchFilters: configuration.imageSearchFiltersGrid,
        language,
      });
    },
    [graphqlClient, language, configuration]
  );

  // ── Update cart shipping ──────────────────────────────────────────────────

  const updateCartShipping = useCallback(
    async (cartId: string, input: CartUpdateInput): Promise<Cart> => {
      const cartService = createServices(graphqlClient).cart;
      return cartService.updateCart({
        id: cartId,
        input,
        imageVariantFilters: configuration.imageVariantFiltersSmall,
        imageSearchFilters: configuration.imageSearchFiltersGrid,
        language,
      });
    },
    [graphqlClient, language, configuration]
  );

  // ── Place order ───────────────────────────────────────────────────────────

  const placeOrder = useCallback(
    async (opts: PlaceOrderOptions): Promise<Result<{ orderId: number }, string>> => {
      setLoading(true);
      setError(null);
      try {
        const cartService = createServices(graphqlClient).cart;
        const orderService = createServices(graphqlClient).order;
        const { cartId, orderStatus, reference, notes, isQuoteMode } = opts;
        // Whether this placement finalizes the order. Default `true` (a normal
        // order or a quote is "done" at placement). Pass `false` for a PSP order
        // awaiting payment so the confirmation email/event/PDF and cart deletion
        // are deferred to the payment webhook — otherwise the shopper is emailed
        // and the cart cleared before paying.
        const finalizeOrder = opts.finalizeOrder ?? true;
        // Quote placements never send the order-confirmation email/PDF (they
        // trigger a quote-send request instead). A PSP-pending order also
        // suppresses them until paid.
        const sendConfirmation = finalizeOrder && !isQuoteMode;

        if (reference || notes) {
          await cartService.updateCart({
            id: cartId,
            input: { reference: reference || undefined, notes: notes || undefined },
            imageVariantFilters: configuration.imageVariantFiltersSmall,
            imageSearchFilters: configuration.imageSearchFiltersGrid,
            language,
          });
        }

        const response = await cartService.processCart({
          id: cartId,
          input: { orderStatus: orderStatus as string, language },
        });

        if (!response?.cartOrderId) {
          throw new Error('No order ID returned from processCart');
        }

        const orderId = response.cartOrderId;

        await orderService.setOrderStatus({
          orderId,
          status: orderStatus as string,
          payStatus: PaymentStatuses.OPEN,
          sendOrderConfirmationEmail: sendConfirmation,
          addPDFAttachment: sendConfirmation,
          triggerOrderSendConfirmEvent: sendConfirmation,
          // Keep the cart only for an unfinalized (PSP-pending) order so the
          // shopper can retry payment; clear it once the order is finalized
          // (a normal order or a quote).
          deleteCart: finalizeOrder,
        });

        if (isQuoteMode) {
          await orderService.triggerQuoteSendRequest({ orderId, language });
        }

        return ok({ orderId });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to place order';
        setError(msg);
        return err(msg);
      } finally {
        setLoading(false);
      }
    },
    [graphqlClient, language, configuration]
  );

  // ── Update user account address ───────────────────────────────────────────

  const updateUserAccountAddress = useCallback(
    async (addressData: Record<string, unknown>, type: CartAddressType): Promise<void> => {
      if (!user) return;

      const addressService = createServices(graphqlClient).address;
      const addressType = type === CartAddressType.INVOICE
        ? AddressType.invoice
        : AddressType.delivery;

      let addresses: Address[] = [];
      const company = isContact(user) ? getActiveCompany() : null;
      if (isContact(user)) {
        if (!company) return;
        addresses = (company.addresses ?? []) as Address[];
      } else if (isCustomer(user)) {
        addresses = (user.addresses ?? []) as Address[];
      }

      const matchedAddr = addresses.find((a) => a.type === addressType && a.isDefault === 'Y')
        || addresses.find((a) => a.type === addressType);

      if (!matchedAddr?.id) return;

      try {
        const commonFields = {
          id: Number(matchedAddr.id),
          company: addressData.company as string | undefined,
          gender: addressData.gender as Gender | undefined,
          firstName: addressData.firstName as string | undefined,
          middleName: addressData.middleName as string | undefined,
          lastName: addressData.lastName as string | undefined,
          email: addressData.email as string | undefined,
          street: addressData.street as string | undefined,
          number: addressData.number as string | undefined,
          numberExtension: addressData.numberExtension as string | undefined,
          postalCode: addressData.postalCode as string | undefined,
          city: addressData.city as string | undefined,
          country: addressData.country as string | undefined,
          isDefault: matchedAddr.isDefault,
        };

        if (isContact(user) && company) {
          await addressService.updateCompanyAddress({
            ...commonFields,
            companyId: (company as { companyId: number }).companyId,
          });
        } else if (isCustomer(user)) {
          await addressService.updateCustomerAddress({
            ...commonFields,
            customerId: user.customerId,
          });
        }
      } catch (e: unknown) {
        console.error('Error updating user account address:', e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graphqlClient, user, companyId]
  );

  return {
    loading,
    error,
    populateCartAddresses,
    updateCartAddress,
    updateCartShipping,
    placeOrder,
    updateUserAccountAddress,
  };
}
