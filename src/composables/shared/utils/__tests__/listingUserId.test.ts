/**
 * Listing queries are always user-scoped.
 *
 * The backend applies assortment rules — negative order lists in particular —
 * per user, so an anonymous listing sent with no userId comes back with items
 * the visitor should not see. The server seed already scoped to the channel's
 * anonymous user; the client hooks sent nothing, so the client refetch quietly
 * replaced a correctly-scoped server render with an unscoped one.
 */

import { describe, it, expect } from 'vitest';
import { resolveListingUserId } from '../listingUserId';

const CONFIG = { anonymousUserId: 1 };

describe('resolveListingUserId', () => {
  it('uses the contact id when a contact is signed in', () => {
    expect(resolveListingUserId({ contactId: 42 }, CONFIG)).toBe(42);
  });

  it('uses the customer id when a customer is signed in', () => {
    expect(resolveListingUserId({ customerId: 7 }, CONFIG)).toBe(7);
  });

  it("falls back to the channel's anonymous user when logged out", () => {
    // The regression: this returned undefined, so the key was omitted and the
    // query ran unscoped.
    expect(resolveListingUserId(null, CONFIG)).toBe(1);
    expect(resolveListingUserId(undefined, CONFIG)).toBe(1);
  });

  it('sends nothing when the host seeds no anonymous user', () => {
    // Hosts that never seed it keep the previous behaviour rather than
    // inventing an id.
    expect(resolveListingUserId(null, {})).toBeUndefined();
    expect(resolveListingUserId(null, undefined)).toBeUndefined();
  });
});
