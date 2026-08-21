'use client';

import { useRequiredPropellerDeps } from '../../context/PropellerContext';
import type { Services } from '@propeller-commerce/propeller-v2-core-ui';

/**
 * Read the SDK services bundle from `<PropellerDepsProvider>`.
 *
 * The package ships no default `graphqlClient` / `services`. The consumer
 * constructs both at app startup and passes them through
 * `<PropellerDepsProvider value={{ graphqlClient, services, ... }}>`. Per-scope
 * state (user, companyId, language) goes through `<PropellerProvider>`
 * separately.
 *
 * Throws when used outside the deps provider — that's an integration error
 * the consumer fixes at the root layout, not something to paper over with a
 * singleton.
 */
export function useServices(): Services {
  return useRequiredPropellerDeps().services;
}
