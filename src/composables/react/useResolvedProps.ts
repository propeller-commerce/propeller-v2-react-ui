'use client';

import { useInfraProps } from './useInfraProps';
import { useProductGridConfig, ProductGridConfig } from '../../context/ProductGridContext';
import { PropellerInfra } from '../../context/PropellerContext';

/**
 * Declarative resolver for the two-tier prop precedence used by ProductCard /
 * ClusterCard:
 *
 *   explicit prop  >  ProductGrid context (Tier 2)  >  Propeller infra (Tier 1)  >  default
 *
 * Before this, each card hand-wrote a ~25–40 line object literal of
 * `rawProps.x ?? grid?.x ?? infra.x ?? d` lines — easy to get the precedence
 * order wrong per key and impossible to scan. This collapses it to a spec
 * table. It internally calls the same non-throwing `useInfraProps` and
 * `useProductGridConfig` hooks, so callers no longer invoke them directly and
 * standalone usage (no provider) still works.
 *
 * Spec per key:
 *   - `infra`  : fall back to PropellerInfra[key] (Tier 1)
 *   - `grid`   : fall back to ProductGridConfig[key] (Tier 2)
 *   - `default`: final fallback when nothing else resolved
 *   - `transform(gridValue)`: when the grid value needs wrapping before use
 *                             (e.g. ProductCard's onToggleFavorite adapter)
 *
 * A key absent from the spec is treated as `raw`-only (passes through unchanged).
 */

type InfraKey = keyof PropellerInfra;
type GridKey = keyof ProductGridConfig;

interface ResolveSpecEntry {
  /** Tier-1 infra key to fall back to (after the explicit prop). */
  infra?: InfraKey;
  /** Tier-2 grid-config key to fall back to (after the explicit prop). */
  grid?: GridKey;
  /** Final fallback when neither explicit prop nor context resolved a value. */
  default?: unknown;
  /**
   * Optional adapter applied to the *grid* value when it is the one chosen.
   * Used by the card `onToggleFavorite` wrappers that re-shape the grid
   * callback signature.
   */
  transform?: (gridValue: NonNullable<ProductGridConfig[GridKey]>) => unknown;
}

/** Per-prop resolution spec: maps each prop key to its {@link ResolveSpecEntry}. */
export type ResolveSpec<P> = Partial<Record<keyof P, ResolveSpecEntry>>;

/**
 * useResolvedProps — resolves props through the two-tier precedence
 * `explicit prop > ProductGrid context > Propeller infra > default`.
 *
 * @param rawProps - the component's raw props.
 * @param spec - per-key resolution rules; keys absent from the spec pass through unchanged.
 * @returns the props with each spec'd key resolved to its highest-precedence value.
 */
export function useResolvedProps<P extends object>(rawProps: P, spec: ResolveSpec<P>): P {
  const grid = useProductGridConfig();
  const infra = useInfraProps(
    rawProps as Record<string, unknown>,
  ) as Record<string, unknown> & Partial<PropellerInfra>;

  const resolved = { ...rawProps } as Record<string, unknown>;

  const rawRecord = rawProps as Record<string, unknown>;

  for (const key of Object.keys(spec)) {
    const entry = (spec as Record<string, ResolveSpecEntry>)[key];
    const explicit = rawRecord[key];
    if (explicit !== undefined && explicit !== null) {
      // Explicit prop always wins — keep the spread value.
      continue;
    }

    // Tier 2: ProductGrid config.
    if (entry.grid && grid) {
      const gridValue = grid[entry.grid];
      if (gridValue !== undefined && gridValue !== null) {
        resolved[key] = entry.transform
          ? entry.transform(gridValue as NonNullable<ProductGridConfig[GridKey]>)
          : gridValue;
        continue;
      }
    }

    // Tier 1: Propeller infra.
    if (entry.infra) {
      const infraValue = (infra as Partial<PropellerInfra>)[entry.infra];
      if (infraValue !== undefined && infraValue !== null) {
        resolved[key] = infraValue;
        continue;
      }
    }

    // Final default.
    if (entry.default !== undefined) {
      resolved[key] = entry.default;
    }
  }

  return resolved as P;
}
