'use client';

import { usePropellerContext, PropellerInfra } from '../../context/PropellerContext';

type InfraKey = keyof PropellerInfra;

const INFRA_KEYS: InfraKey[] = [
  'graphqlClient',
  'user',
  'companyId',
  'language',
  'includeTax',
  'currency',
  'configuration',
  'portalMode',
];

/**
 * useInfraProps — resolves the Tier 1 infrastructure props for a component.
 *
 * - An explicit prop value (defined and non-null) always wins — existing call
 *   sites keep working unchanged (additive / opt-in, no breaking change).
 * - Otherwise the value is taken from `<PropellerProvider>`.
 * - Non-infra props pass through untouched.
 * - Null-context safe: with no provider the props are returned as-is, so
 *   components still work standalone / in tests.
 *
 * @param props - the component's raw props, possibly carrying infra keys.
 * @returns the same props with any unset infra keys filled in from the provider.
 */
export function useInfraProps<P extends Partial<Record<InfraKey, unknown>>>(
  props: P,
): P & Partial<PropellerInfra> {
  const ctx = usePropellerContext();
  const resolved = { ...props } as P & Partial<PropellerInfra>;
  for (const key of INFRA_KEYS) {
    const explicit = (props as Record<string, unknown>)[key];
    if (explicit !== undefined && explicit !== null) continue;
    if (ctx && ctx[key] !== undefined) {
      (resolved as Record<string, unknown>)[key] = ctx[key];
    }
  }
  return resolved;
}
