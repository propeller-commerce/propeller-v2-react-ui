/**
 * useUserIdentity (React) — Contact vs Customer detection and ID extraction.
 *
 * Derives all values from the user argument without internal state
 * (caller passes user from their own useState).
 */

import { useMemo } from 'react';
import type { Contact, Customer, Address, Company } from '@propeller-commerce/propeller-sdk-v2';
import {
  isContact,
  isCustomer,
  getUserId,
  getCompany,
  getCompanyId,
  getAddresses,
  getDefaultInvoiceAddress,
  getDefaultDeliveryAddress,
} from '@propeller-commerce/propeller-v2-core-ui';

/** Identity facts derived from a user by {@link useUserIdentity}. */
export interface UserIdentityResult {
  /** `true` when the user is a B2B Contact. */
  isContact: boolean;
  /** `true` when the user is a B2C Customer. */
  isCustomer: boolean;
  /** The user's id (contactId or customerId), or `null` when no user. */
  userId: number | null;
  /** The user's company id, or `null` for customers / no user. */
  companyId: number | null;
  /** The user's company, or `null`. */
  company: Company | null;
  /** All of the user's addresses. */
  addresses: Address[];
  /** The user's default invoice address, or `undefined`. */
  defaultInvoiceAddress: Address | undefined;
  /** The user's default delivery address, or `undefined`. */
  defaultDeliveryAddress: Address | undefined;
}

/**
 * useUserIdentity — derives Contact-vs-Customer facts and id/address shortcuts
 * from a user object, with no internal state.
 *
 * @param user - the current user, or `null` when anonymous.
 * @returns memoized identity facts derived from `user` — see {@link UserIdentityResult}.
 */
export function useUserIdentity(user: Contact | Customer | null): UserIdentityResult {
  return useMemo(() => ({
    isContact: isContact(user),
    isCustomer: isCustomer(user),
    userId: getUserId(user),
    companyId: getCompanyId(user),
    company: getCompany(user),
    addresses: getAddresses(user),
    defaultInvoiceAddress: getDefaultInvoiceAddress(user),
    defaultDeliveryAddress: getDefaultDeliveryAddress(user),
  }), [user]);
}
