/**
 * useSpareParts — controlled-mode contract.
 *
 * The load-bearing behaviour: when `parts` is DEFINED the hook is controlled —
 * it echoes those parts back and must never fetch. This is what lets a host
 * seed an SSR-rendered first page and hand fetching over to the hook only after
 * the first user interaction. If the sentinel regresses to a truthiness check,
 * `parts={[]}` (controlled-empty) silently starts fetching and the SSR seed
 * fights the client.
 *
 * Rendered with `renderToString` rather than @testing-library/react: this
 * package's vitest runs in the `node` environment on purpose (see
 * vitest.config.ts) and effects don't run during SSR anyway — the sentinel and
 * `displayParts` are both computed in the component body, which is exactly what
 * this exercises. No jsdom, no new deps.
 */

import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { SparePart } from '@propeller-commerce/propeller-sdk-v2';
import { useSpareParts } from '../useSpareParts';

const PARTS = [
  { id: 1, sku: 'BOLT-1', quantity: 2 },
  { id: 2, sku: 'NUT-2', quantity: 4 },
] as unknown as SparePart[];

/** Probe that surfaces the hook's controlled-mode output as text. */
function Probe(props: { parts?: SparePart[]; client?: unknown }): React.JSX.Element {
  const { displayParts, isLoading } = useSpareParts({
    parts: props.parts,
    slug: 'mixer',
    language: 'EN',
    graphqlClient: props.client as never,
  });
  // Single interpolated child — adjacent `{a}|{b}` would get React 19's
  // `<!-- -->` SSR markers between them and break substring assertions.
  return <span>{`${displayParts.map((p) => p.sku).join(',')}|${String(isLoading)}`}</span>;
}

describe('useSpareParts — controlled mode', () => {
  it('echoes the controlled parts and reports not-loading', () => {
    const html = renderToString(<Probe parts={PARTS} />);
    expect(html).toContain('BOLT-1,NUT-2');
    expect(html).toContain('|false');
  });

  it('treats an EMPTY array as controlled, not as "please fetch"', () => {
    // The sentinel must be `!== undefined`, not truthiness — `[]` is a
    // deliberate "controlled, and empty".
    const client = { execute: vi.fn(), query: vi.fn() };
    const html = renderToString(<Probe parts={[]} client={client} />);

    expect(html).toContain('|false');
    expect(client.execute).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });

  it('is uncontrolled when parts is undefined', () => {
    // No client passed → the fetch short-circuits, but the hook must still
    // render its (empty) uncontrolled list rather than throwing.
    const html = renderToString(<Probe />);
    expect(html).toContain('|false');
  });
});
