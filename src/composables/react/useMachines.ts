'use client';

/**
 * useMachines (React) — the machine-tree ROOT: a company's installations.
 *
 * The sibling of `useSpareParts` for the root level. Where `useSpareParts`
 * fetches one node by slug, this resolves a *list* of installation ids
 * (`MY_INSTALLATIONS`) in ONE request, by concatenating an aliased
 * `machine(source:, sourceId:)` selection per id — mirroring the WordPress
 * reference's `installations()` mega-query. One shared `$source`/`$language`,
 * one `$sourceId_N` per id, all resolved in a single round-trip.
 *
 * It calls `graphqlClient.execute()` with a hand-built document rather than an
 * SDK operation because the alias count is dynamic (N ids → N aliases) — there
 * is no static operation for that. The selection is the minimal set a
 * `MachineCard` needs (`id`/`name`/`description`/`slug`/first image url).
 *
 * Same controlled/idle discipline and race guards as `useSpareParts`.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { GraphQLClient, SparePartsMachine } from '@propeller-commerce/propeller-sdk-v2';

/**
 * Module-level in-flight set — dedups identical concurrent fetches, which
 * React Strict Mode's double-effect would otherwise fire twice.
 * Mirrors `useSpareParts` / `useProductSearch`.
 */
const inflightFetches = new Set<string>();

/**
 * The minimal fields a root `MachineCard` needs. Inlined (not the SDK's
 * `SparePartsMachineMinimalFields` fragment) because that fragment drags in
 * image-transform variables we don't want on the lightweight root list, and the
 * concat query hand-writes its own variable block. `imageVariants[0].url` is the
 * exact field `MachineCard`'s image walk reads.
 */
const ROOT_MACHINE_FIELDS = `
  id
  name(language: $language) { language value }
  description(language: $language) { language value }
  slug(language: $language) { language value }
  media {
    images {
      items { imageVariants(input: $imageVariantFilters) { url } }
    }
  }
`;

/**
 * Build ONE aliased query resolving every installation in a single request:
 * `machine_0: machine(source: $source, sourceId: $sourceId_0, language: $language) { … }`
 * per id. One shared `$source`/`$language`/`$imageVariantFilters`, one
 * `$sourceId_N` per id. `imageVariants(input:)` is NON_NULL — the same
 * `TransformationsInput!` the SDK `machine`/`category` queries require.
 */
export function buildRootMachinesQuery(count: number): string {
  const vars = [
    '$source: String',
    '$language: String',
    '$imageVariantFilters: TransformationsInput!',
    ...Array.from({ length: count }, (_, i) => `$sourceId_${i}: String`),
  ].join('\n    ');

  const aliases = Array.from({ length: count }, (_, i) => `
    machine_${i}: machine(source: $source, sourceId: $sourceId_${i}, language: $language) {
      ${ROOT_MACHINE_FIELDS}
    }`).join('\n');

  return `query RootMachines(\n    ${vars}\n  ) {${aliases}\n  }`;
}

export interface UseMachinesOptions {
  /** SDK client. Without it the hook stays idle. */
  graphqlClient?: GraphQLClient;
  /** External system the machine ids belong to (pairs with each id). */
  source?: string;
  /** Installation ids (from the `MY_INSTALLATIONS` company track attribute). */
  sourceIds?: string[];
  /** Language the machine TREE is authored in (usually EN). */
  language?: string;
  /**
   * Image transformation for the card thumbnail — the `TransformationsInput!`
   * the schema requires on `imageVariants(input:)`. Without it the query fails
   * validation ("argument input of type TransformationsInput! is required").
   * Pass `config.imageVariantFiltersMedium` (same value the node query uses).
   */
  imageVariantFilters?: unknown;
}

export interface UseMachinesReturn {
  /** Resolved installations, in `sourceIds` order, nulls dropped. */
  machines: SparePartsMachine[];
  /** `true` while the concat request is in flight. */
  isLoading: boolean;
  /** Re-run the fetch. */
  fetchMachines: () => Promise<void>;
}

/**
 * useMachines — resolve a company's installations in one concatenated request.
 *
 * @param options - see {@link UseMachinesOptions}
 * @returns machines + loading + refetch — see {@link UseMachinesReturn}
 */
export function useMachines(options: UseMachinesOptions): UseMachinesReturn {
  const { graphqlClient, source, language, imageVariantFilters } = options;
  const sourceIds = options.sourceIds ?? [];
  const idsKey = sourceIds.join(',');

  const [machines, setMachines] = useState<SparePartsMachine[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /** Per-instance guard: only the newest fetch commits. Mirrors `useSpareParts`. */
  const fetchIdRef = useRef(0);

  const fetchMachines = useCallback(async (): Promise<void> => {
    // Idle: no client / source / ids → don't fetch and don't setState (a
    // synchronous set here would be a set-state-in-effect). The derived return
    // below gates the output on `sourceIds`, so a stale list never shows.
    if (!graphqlClient || !source || sourceIds.length === 0) return;

    const thisId = ++fetchIdRef.current;
    const inflightKey = ['machines', source, language ?? '', idsKey].join('|');

    if (inflightFetches.has(inflightKey)) {
      fetchIdRef.current--;
      return;
    }
    inflightFetches.add(inflightKey);

    setIsLoading(true);

    try {
      const variables: Record<string, unknown> = {
        source,
        language: language ?? '',
        imageVariantFilters,
      };
      sourceIds.forEach((id, i) => {
        variables[`sourceId_${i}`] = id;
      });

      const result = await graphqlClient.execute<Record<string, SparePartsMachine | null>>({
        query: buildRootMachinesQuery(sourceIds.length),
        variables,
        operationName: 'RootMachines',
      });

      if (thisId !== fetchIdRef.current) return;

      const data = result.data ?? {};
      setMachines(
        sourceIds
          .map((_, i) => data[`machine_${i}`])
          .filter((m): m is SparePartsMachine => m != null)
      );
    } catch (e) {
      console.error('[useMachines] fetchMachines error:', e);
      if (thisId === fetchIdRef.current) setMachines([]);
    } finally {
      inflightFetches.delete(inflightKey);
      if (thisId === fetchIdRef.current) setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphqlClient, source, language, idsKey, imageVariantFilters]);

  useEffect(() => {
    void fetchMachines();
  }, [fetchMachines]);

  // Gate the output on `sourceIds` so a switch to an empty installation set
  // shows nothing immediately, even before a stale fetch result clears.
  return { machines: sourceIds.length > 0 ? machines : [], isLoading, fetchMachines };
}
