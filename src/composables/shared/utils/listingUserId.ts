/**
 * Resolve the `userId` a catalog listing query should be scoped to.
 *
 * Logged in: the contact's or customer's own id. Logged out: the channel's
 * ANONYMOUS user, supplied by the host as `configuration.anonymousUserId`.
 *
 * Sending nothing for an anonymous visitor is not equivalent to sending the
 * anonymous user. The backend applies assortment rules — negative order lists
 * in particular — per user, so an unscoped query returns products the visitor
 * is not supposed to see. The host's SSR seed already scopes to the channel's
 * anonymous user; without this the client refetch asked a differently-scoped
 * question and quietly replaced the correct server-rendered list.
 *
 * The id is resolved server-side (only the server can reach the channel) and
 * seeded into `configuration`, the same route `baseCategoryId` takes since
 * No module guesses it.
 */
export function resolveListingUserId(
  user: { contactId?: number; customerId?: number } | null | undefined,
  configuration?: { anonymousUserId?: number } | null
): number | undefined {
  if (user && 'contactId' in user) return user.contactId;
  if (user && 'customerId' in user) return user.customerId;
  return configuration?.anonymousUserId;
}
