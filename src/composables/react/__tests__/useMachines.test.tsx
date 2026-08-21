/**
 * useMachines — the concatenated root query + idle contract.
 *
 * Two load-bearing behaviours:
 *  1. `buildRootMachinesQuery(n)` emits one shared `$source`/`$language` plus one
 *     `$sourceId_N` variable and one `machine_N:` alias per id — the WP-style
 *     mega-query. If the alias/variable count drifts, the single-request root
 *     silently resolves the wrong machines.
 *  2. With no `source`/`sourceIds` the hook must NOT call `client.execute` (idle),
 *     the same discipline as `useSpareParts`'s controlled sentinel.
 *
 * Node env + `renderToString` (no jsdom) — effects don't run under SSR, so the
 * idle path is asserted via the guard in the fetch, and the builder directly.
 */

import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { useMachines, buildRootMachinesQuery } from '../useMachines';

describe('buildRootMachinesQuery', () => {
  it('emits one $sourceId_N + machine_N: alias per id, shared $source/$language', () => {
    const q = buildRootMachinesQuery(3);
    expect(q).toContain('$source: String');
    expect(q).toContain('$language: String');
    // imageVariants requires a NON_NULL TransformationsInput! — must be declared
    // and applied, or the query fails validation.
    expect(q).toContain('$imageVariantFilters: TransformationsInput!');
    expect(q).toContain('imageVariants(input: $imageVariantFilters)');
    for (const i of [0, 1, 2]) {
      expect(q).toContain(`$sourceId_${i}: String`);
      expect(q).toContain(`machine_${i}: machine(source: $source, sourceId: $sourceId_${i}, language: $language)`);
    }
    expect((q.match(/machine_\d+: machine/g) ?? []).length).toBe(3);
  });

  it('is a valid (empty-body) query for zero ids', () => {
    const q = buildRootMachinesQuery(0);
    expect(q).toContain('query RootMachines');
    expect(q).not.toContain('machine_0');
  });
});

function Probe(props: { source?: string; sourceIds?: string[]; client?: unknown }): React.JSX.Element {
  const { machines, isLoading } = useMachines({
    graphqlClient: props.client as never,
    source: props.source,
    sourceIds: props.sourceIds,
    language: 'EN',
  });
  // Single interpolated child — adjacent `{a}|{b}` would get React 19's
  // `<!-- -->` SSR markers between them and break substring assertions.
  return <span>{`${machines.length}|${String(isLoading)}`}</span>;
}

describe('useMachines — idle', () => {
  it('does not fetch and reports empty when there are no sourceIds', () => {
    const client = { execute: vi.fn() };
    const html = renderToString(<Probe source="ACME" sourceIds={[]} client={client} />);
    expect(html).toContain('0|false');
    expect(client.execute).not.toHaveBeenCalled();
  });

  it('does not fetch when source is absent', () => {
    const client = { execute: vi.fn() };
    const html = renderToString(<Probe sourceIds={['M-1']} client={client} />);
    expect(html).toContain('0|');
    expect(client.execute).not.toHaveBeenCalled();
  });
});
