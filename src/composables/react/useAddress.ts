/**
 * useAddress (React) — Address display and CRUD.
 *
 * Uses proper SDK types for all address service calls.
 * CompanyAddressUpdateInput / CustomerAddressUpdateInput do not have a `type` field —
 * the address type is only set on creation.
 */

import { useState, useCallback } from 'react';
import { createServices } from '@propeller-commerce/propeller-v2-core-ui';
import { AddressType, Gender, YesNo } from '@propeller-commerce/propeller-sdk-v2';
import type {
  GraphQLClient,
  Address,
  Customer,
  CompanyAddressCreateInput,
  CustomerAddressCreateInput,
  CompanyAddressUpdateInput,
  CustomerAddressUpdateInput,
} from '@propeller-commerce/propeller-sdk-v2';
import type { AnyUser } from '@propeller-commerce/propeller-v2-core-ui';
import { isContact, isCustomer } from '@propeller-commerce/propeller-v2-core-ui';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Flat, framework-agnostic address payload accepted by the CRUD methods. */
export interface AddressInput {
  /** Address type (invoice/delivery). Only honoured on create — defaults to `invoice` for companies, `delivery` for customers. */
  type?: AddressType;
  /** Recipient's first name. */
  firstName?: string;
  /** Recipient's last name. */
  lastName?: string;
  /** Recipient's middle name / tussenvoegsel. */
  middleName?: string;
  /** Company name printed on the address. */
  company?: string;
  /** Street name. Required. */
  street: string;
  /** House number. */
  number?: string;
  /** House-number suffix / addition. */
  numberExtension?: string;
  /** Postal / ZIP code. Required. */
  postalCode: string;
  /** City. Required. */
  city: string;
  /** ISO country code. Required. */
  country: string;
  /** Contact email for this address. */
  email?: string;
  /** Landline phone number. */
  phone?: string;
  /** Mobile phone number. */
  mobile?: string;
  /** Recipient gender. */
  gender?: Gender;
  /** When `Y`, marks this address as the default for its type. */
  isDefault?: YesNo;
  /** Free-text notes attached to the address. */
  notes?: string;
}

export interface UseAddressOptions {
  /**
   * GraphQL client. Nullable so callers can invoke the hook unconditionally
   * (Rules of Hooks) even when the client isn't ready yet — the CRUD methods
   * bail with `{ success: false, error: 'No client' }` until it is.
   */
  graphqlClient: GraphQLClient | null | undefined;
  /** Authenticated user. Nullable for the same reason as `graphqlClient`. */
  user: AnyUser | null | undefined;
  /** Explicit company id; overrides the contact's `company.companyId` when resolving the address owner. */
  companyId?: number;
}

/** State and CRUD actions returned by {@link useAddress}. */
export interface UseAddressReturn {
  /** `true` while any CRUD call is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** Creates a company- or customer-scoped address depending on the user kind. */
  createAddress: (input: AddressInput) => Promise<{ success: boolean; address?: Address; error?: string }>;
  /** Updates an existing address by id; address `type` cannot be changed. */
  updateAddress: (addressId: number, input: Partial<AddressInput>) => Promise<{ success: boolean; address?: Address; error?: string }>;
  /** Deletes an address by id. */
  deleteAddress: (addressId: number) => Promise<{ success: boolean; error?: string }>;
  /** Marks an address as default by issuing an update with `isDefault: Y`. */
  setDefaultAddress: (addressId: number) => Promise<{ success: boolean; error?: string }>;
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * useAddress — display and CRUD for company / customer addresses.
 *
 * @param options - see {@link UseAddressOptions}.
 * @returns loading/error state plus async CRUD actions — see {@link UseAddressReturn}.
 *
 * @remarks
 * GraphQL integration: every call goes through `services.address` (`AddressService`),
 * built per-call via `createServices(graphqlClient)`. The user kind decides which
 * mutation runs — contacts use `createCompanyAddress` / `updateCompanyAddress` /
 * `deleteCompanyAddress` (companyId from `options.companyId` or `user.company`),
 * customers use `createCustomerAddress` / `updateCustomerAddress` /
 * `deleteCustomerAddress` (customerId from the user). All mutations require an
 * authenticated session; methods short-circuit with `{ success: false }` when the
 * client or user context is missing. `setDefaultAddress` delegates to `updateAddress`.
 */
export function useAddress(options: UseAddressOptions): UseAddressReturn {
  const { graphqlClient, user, companyId } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resolveIds(): { companyId?: number; customerId?: number } {
    if (!user) return {};
    if (isContact(user)) return { companyId: companyId ?? user.company?.companyId };
    if (isCustomer(user)) return { customerId: (user as Customer).customerId };
    return {};
  }

  // ── Create address ────────────────────────────────────────────────────────

  const createAddress = useCallback(
    async (input: AddressInput): Promise<{ success: boolean; address?: Address; error?: string }> => {
      if (!graphqlClient) return { success: false, error: 'No client' };
      setLoading(true);
      setError(null);
      try {
        const service = createServices(graphqlClient).address;
        const ids = resolveIds();
        let address: Address;

        if (ids.companyId) {
          const createInput: CompanyAddressCreateInput = {
            street: input.street,
            postalCode: input.postalCode,
            city: input.city,
            country: input.country,
            type: input.type ?? AddressType.invoice,
            companyId: ids.companyId,
            ...(input.firstName && { firstName: input.firstName }),
            ...(input.lastName && { lastName: input.lastName }),
            ...(input.middleName && { middleName: input.middleName }),
            ...(input.company && { company: input.company }),
            ...(input.number && { number: input.number }),
            ...(input.numberExtension && { numberExtension: input.numberExtension }),
            ...(input.email && { email: input.email }),
            ...(input.phone && { phone: input.phone }),
            ...(input.mobile && { mobile: input.mobile }),
            ...(input.gender && { gender: input.gender }),
            ...(input.isDefault && { isDefault: input.isDefault }),
            ...(input.notes && { notes: input.notes }),
          };
          address = await service.createCompanyAddress(createInput);
        } else if (ids.customerId) {
          const createInput: CustomerAddressCreateInput = {
            street: input.street,
            postalCode: input.postalCode,
            city: input.city,
            country: input.country,
            type: input.type ?? AddressType.delivery,
            customerId: ids.customerId,
            ...(input.firstName && { firstName: input.firstName }),
            ...(input.lastName && { lastName: input.lastName }),
            ...(input.middleName && { middleName: input.middleName }),
            ...(input.number && { number: input.number }),
            ...(input.numberExtension && { numberExtension: input.numberExtension }),
            ...(input.email && { email: input.email }),
            ...(input.phone && { phone: input.phone }),
            ...(input.mobile && { mobile: input.mobile }),
            ...(input.gender && { gender: input.gender }),
            ...(input.isDefault && { isDefault: input.isDefault }),
            ...(input.notes && { notes: input.notes }),
          };
          address = await service.createCustomerAddress(createInput);
        } else {
          return { success: false, error: 'No user context' };
        }

        return { success: true, address };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to create address';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [graphqlClient, user, companyId]
  );

  // ── Update address ────────────────────────────────────────────────────────
  // Note: SDK update inputs do not have an `type` field; type is fixed at creation.

  const updateAddress = useCallback(
    async (addressId: number, input: Partial<AddressInput>): Promise<{ success: boolean; address?: Address; error?: string }> => {
      if (!graphqlClient) return { success: false, error: 'No client' };
      setLoading(true);
      setError(null);
      try {
        const service = createServices(graphqlClient).address;
        const ids = resolveIds();
        let address: Address;

        if (ids.companyId) {
          const updateInput: CompanyAddressUpdateInput = {
            id: addressId,
            companyId: ids.companyId,
            ...(input.firstName && { firstName: input.firstName }),
            ...(input.lastName && { lastName: input.lastName }),
            ...(input.middleName && { middleName: input.middleName }),
            ...(input.company && { company: input.company }),
            ...(input.street && { street: input.street }),
            ...(input.number !== undefined && { number: input.number }),
            ...(input.numberExtension && { numberExtension: input.numberExtension }),
            ...(input.postalCode && { postalCode: input.postalCode }),
            ...(input.city && { city: input.city }),
            ...(input.country && { country: input.country }),
            ...(input.email && { email: input.email }),
            ...(input.phone && { phone: input.phone }),
            ...(input.mobile && { mobile: input.mobile }),
            ...(input.gender && { gender: input.gender }),
            ...(input.isDefault && { isDefault: input.isDefault }),
            ...(input.notes && { notes: input.notes }),
          };
          address = await service.updateCompanyAddress(updateInput);
        } else if (ids.customerId) {
          const updateInput: CustomerAddressUpdateInput = {
            id: addressId,
            customerId: ids.customerId,
            ...(input.firstName && { firstName: input.firstName }),
            ...(input.lastName && { lastName: input.lastName }),
            ...(input.middleName && { middleName: input.middleName }),
            ...(input.street && { street: input.street }),
            ...(input.number !== undefined && { number: input.number }),
            ...(input.numberExtension && { numberExtension: input.numberExtension }),
            ...(input.postalCode && { postalCode: input.postalCode }),
            ...(input.city && { city: input.city }),
            ...(input.country && { country: input.country }),
            ...(input.email && { email: input.email }),
            ...(input.phone && { phone: input.phone }),
            ...(input.mobile && { mobile: input.mobile }),
            ...(input.gender && { gender: input.gender }),
            ...(input.isDefault && { isDefault: input.isDefault }),
            ...(input.notes && { notes: input.notes }),
          };
          address = await service.updateCustomerAddress(updateInput);
        } else {
          return { success: false, error: 'No user context' };
        }

        return { success: true, address };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to update address';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [graphqlClient, user, companyId]
  );

  // ── Delete address ────────────────────────────────────────────────────────

  const deleteAddress = useCallback(
    async (addressId: number): Promise<{ success: boolean; error?: string }> => {
      if (!graphqlClient) return { success: false, error: 'No client' };
      setLoading(true);
      setError(null);
      try {
        const service = createServices(graphqlClient).address;
        const ids = resolveIds();
        if (ids.companyId) {
          await service.deleteCompanyAddress({ id: addressId, companyId: ids.companyId });
        } else if (ids.customerId) {
          await service.deleteCustomerAddress({ id: addressId, customerId: ids.customerId });
        } else {
          return { success: false, error: 'No user context' };
        }
        return { success: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to delete address';
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setLoading(false);
      }
    },
    [graphqlClient, user, companyId]
  );

  const setDefaultAddress = useCallback(
    async (addressId: number): Promise<{ success: boolean; error?: string }> =>
      updateAddress(addressId, { isDefault: YesNo.Y }),
    [updateAddress]
  );

  return { loading, error, createAddress, updateAddress, deleteAddress, setDefaultAddress };
}
