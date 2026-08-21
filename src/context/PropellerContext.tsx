'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { GraphQLClient, Contact, Customer } from '@propeller-commerce/propeller-sdk-v2';
import type {
  Services,
  ShopMode,
  UserMode,
} from '@propeller-commerce/propeller-v2-core-ui';
import { deriveUserMode } from '@propeller-commerce/propeller-v2-core-ui';

/**
 * Tier 1 — application-wide infrastructure. Bound by `<PropellerDepsProvider>`
 * once at the root of the app. These values are app-singletons: the GraphQL
 * client, the SDK Services bundle wired to it, and the cosmetic / branding
 * defaults (currency, configuration). They do not change per subtree — for
 * per-scope state (user, companyId, language) use `<PropellerProvider>`.
 *
 * Why split: per-scope state belongs to a routed section (impersonation,
 * multi-cart, language widgets); deps don't. Splitting lets a deeper
 * `<PropellerProvider>` replace the scope without recreating the GraphQL
 * client or invalidating service references.
 */
export interface PropellerDeps {
  /**
   * The GraphQL client the consumer constructed. Exposed for code that needs
   * to pass it back into SDK helpers (rare — most code should use `services`).
   */
  graphqlClient: GraphQLClient;
  /**
   * The Services bundle (`{ product, cart, user, ... }`) wired to
   * `graphqlClient`. Build it via `createServices(graphqlClient)`.
   */
  services: Services;
  /** Currency symbol used by display components. Default: `'€'`. */
  currency: string;
  /** Free-form configuration bag forwarded to components. */
  configuration: unknown;
}

/**
 * Tier 2 — per-scope state. Bound by `<PropellerProvider>` and replaceable
 * by nesting a second provider deeper in the tree.
 */
export interface PropellerScope {
  /** The authenticated user, or `null` when browsing anonymously. */
  user: Contact | Customer | null;
  /** Active company ID for the current session; `undefined` for non-company users. */
  companyId: number | undefined;
  /** Active language code (e.g. `'NL'`). */
  language: string;
  /** When `true`, display components show tax-inclusive prices. */
  includeTax: boolean;
  /** Portal access mode (e.g. `'open'`, `'semi-closed'`). */
  portalMode: string;
  /**
   * Shop mode declared in `propeller.json`. Combined with `user` to derive
   * `userMode` on the composite context. Defaults to `'hybrid'` when omitted
   * so existing call sites keep their current branching semantics (any
   * logged-in Contact → b2b surface).
   */
  shopMode?: ShopMode;
}

/**
 * Composite of Tier 1 deps + Tier 2 scope. Preserved as the public
 * `PropellerInfra` shape so existing consumers (`useInfraProps`,
 * `useResolvedProps`, card components) keep working unchanged.
 *
 * `userMode` is derived from `user` + `shopMode`; B2B-gated UI should
 * read this rather than re-deriving from `isContact(user)`.
 */
export interface PropellerInfra extends PropellerDeps, PropellerScope {
  userMode: UserMode;
}

const PropellerDepsContext = createContext<PropellerDeps | null>(null);
const PropellerScopeContext = createContext<PropellerScope | null>(null);

export interface PropellerDepsProviderProps {
  /** The Tier 1 deps. Wire once at app root. */
  value: PropellerDeps;
  /** The subtree that gains access to the deps. */
  children: ReactNode;
}

/**
 * Provider for Tier 1 infrastructure (graphqlClient, services, currency,
 * configuration). Mount once at the root of the app, above any routed tree.
 *
 * @example
 * // app/providers.tsx
 * import { GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';
 * import { createServices, PropellerDepsProvider } from 'propeller-v2-react-ui';
 *
 * const graphqlClient = new GraphQLClient({ endpoint: '/api/graphql' });
 * const services = createServices(graphqlClient);
 *
 * export function Providers({ children }) {
 *   return (
 *     <PropellerDepsProvider value={{ graphqlClient, services, currency: '€', configuration }}>
 *       <PropellerProvider value={scopeFromHostStores}>
 *         {children}
 *       </PropellerProvider>
 *     </PropellerDepsProvider>
 *   );
 * }
 */
export function PropellerDepsProvider({ value, children }: PropellerDepsProviderProps) {
  return (
    <PropellerDepsContext.Provider value={value}>
      {children}
    </PropellerDepsContext.Provider>
  );
}

export interface PropellerProviderProps {
  /** The Tier 2 scope. */
  value: PropellerScope;
  /** The subtree that gains access to the scope. */
  children: ReactNode;
}

/**
 * Provider for Tier 2 per-scope state (user, companyId, language,
 * includeTax, portalMode). Wrap the routed tree; nest deeper to override
 * scope for a subtree (impersonation, multi-cart, …).
 */
export function PropellerProvider({ value, children }: PropellerProviderProps) {
  return (
    <PropellerScopeContext.Provider value={value}>
      {children}
    </PropellerScopeContext.Provider>
  );
}

/**
 * Read the installed Tier 1 deps. Returns `null` outside the provider so
 * components stay usable standalone / in tests.
 */
export function usePropellerDeps(): PropellerDeps | null {
  return useContext(PropellerDepsContext);
}

/** Throwing variant — call when deps are required. */
export function useRequiredPropellerDeps(): PropellerDeps {
  const deps = useContext(PropellerDepsContext);
  if (!deps) {
    throw new Error(
      '[propeller-v2-react-ui] useRequiredPropellerDeps() called outside ' +
        '<PropellerDepsProvider>. Wrap your app root with ' +
        '<PropellerDepsProvider value={{ graphqlClient, services, currency, configuration }}>.'
    );
  }
  return deps;
}

/**
 * Read the Tier 2 scope. Returns `null` outside the provider so components
 * stay usable standalone / in tests.
 */
export function usePropellerScope(): PropellerScope | null {
  return useContext(PropellerScopeContext);
}

/**
 * Composite read of Tier 1 deps + Tier 2 scope. Mirrors the previous
 * `PropellerInfra` shape so existing consumers keep working unchanged.
 *
 * Returns `null` when either tier is missing.
 */
export function usePropellerContext(): PropellerInfra | null {
  const deps = useContext(PropellerDepsContext);
  const scope = useContext(PropellerScopeContext);
  return useMemo(() => {
    if (!deps || !scope) return null;
    const userMode = deriveUserMode(scope.user, scope.shopMode ?? 'hybrid');
    return { ...deps, ...scope, userMode };
  }, [deps, scope]);
}

/**
 * Read the active `userMode` directly. Returns `'anonymous'` outside the
 * provider so components stay usable standalone / in tests.
 */
export function useUserMode(): UserMode {
  const scope = useContext(PropellerScopeContext);
  if (!scope) return 'anonymous';
  return deriveUserMode(scope.user, scope.shopMode ?? 'hybrid');
}
