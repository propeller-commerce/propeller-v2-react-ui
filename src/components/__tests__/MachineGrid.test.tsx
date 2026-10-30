/**
 * MachineGrid — mode selection by URL segments, plus the loading layout.
 *
 * The component's one structural decision: empty `segments` → the root
 * installations list (title only, since the concat fetch is an effect that
 * doesn't run under SSR); non-empty `segments` → the node view with breadcrumbs
 * and the leaf title derived from its slug. Rendered with `renderToString` in the
 * package's Node env. Without a client both data hooks stay idle; with one, the
 * first render is the loading state, which is what the loading tests assert.
 */

import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import MachineGrid, { type MachineGridProps, type MachineListingState } from '../MachineGrid';

const paginationProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('../GridPagination', () => ({
  default: (props: Record<string, unknown>) => {
    paginationProps.push(props);
    return null;
  },
}));

const LISTING: MachineListingState = {
  page: 1,
  offset: 12,
  sortField: 'NAME',
  sortOrder: 'ASC',
  filters: {},
  term: '',
};

// Never resolves; SSR runs no effects, so it is never even called.
const CLIENT = { execute: () => new Promise(() => {}) } as never;

function render(segments: string[], extra: Partial<MachineGridProps> = {}): string {
  return renderToString(
    <MachineGrid
      segments={segments}
      basePath="/machines"
      rootTitle="Machines"
      listing={LISTING}
      onListingChange={() => {}}
      {...extra}
    />
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('MachineGrid — mode selection', () => {
  it('root (empty segments) renders the installations title', () => {
    const html = render([]);
    expect(html).toContain('Machines');
    // No breadcrumb trail at the root.
    expect(html).not.toContain('aria-current');
  });

  it('node (non-empty segments) renders breadcrumbs + the leaf title from its slug', () => {
    const html = render(['mixer-pump']);
    expect(html).toContain('Mixer Pump'); // slugToLabel('mixer-pump')
    expect(html).toContain('aria-current'); // the leaf crumb
    expect(html).toContain('Breadcrumb');
  });
});

describe('MachineGrid — root loading', () => {
  const root = (ids: string[]) =>
    render([], { graphqlClient: CLIENT, source: 'ERP', sourceIds: ids });

  it('shows one skeleton card per installation instead of a text line', () => {
    const html = root(['a', 'b', 'c']);
    expect(count(html, 'propeller-machine-card-skeleton ')).toBe(3);
    expect(html).not.toContain('No machines found.');
  });

  it('caps the skeletons at 8', () => {
    const html = root(Array.from({ length: 12 }, (_, i) => `id-${i}`));
    expect(count(html, 'propeller-machine-card-skeleton ')).toBe(8);
  });

  it('marks the grid busy and keeps the loading label for screen readers', () => {
    const html = root(['a']);
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/role="status"[^>]*>Loading…</);
  });
});

describe('MachineGrid — machine page loading', () => {
  const node = (extra: Partial<MachineGridProps> = {}) =>
    render(['mixer-pump'], { graphqlClient: CLIENT, ...extra });

  it('renders the parts area with the product skeleton during the first load', () => {
    const html = node();
    expect(html).toContain('propeller-product-grid__skeleton-card');
    expect(html).toContain('aria-label="Search parts"');
  });

  it('shows child machine skeletons during the first load', () => {
    expect(node()).toContain('propeller-machine-children--loading');
  });

  it('shows a title skeleton instead of the slug label while the machine loads', () => {
    const html = node();
    expect(html).toContain('propeller-machine-title-skeleton');
    expect(html).not.toContain('Mixer Pump');
  });

  it('does not show the not-found text while loading', () => {
    expect(node()).not.toContain('This machine could not be found.');
  });
});

describe('MachineGrid — view mode', () => {
  const node = (extra: Partial<MachineGridProps> = {}) =>
    render(['mixer-pump'], { graphqlClient: CLIENT, ...extra });

  it('opens the parts as a list by default', () => {
    const html = node();
    expect(html).toContain('propeller-product-grid__skeleton-grid flex flex-col');
  });

  it('opens the parts in the 3-column grid with defaultViewMode="grid"', () => {
    const html = node({ defaultViewMode: 'grid' });
    expect(html).toContain('propeller-product-grid__skeleton-grid grid grid-cols-2 lg:grid-cols-3');
  });
});

describe('MachineGrid — pagination variant', () => {
  const lastVariant = (extra: Partial<MachineGridProps>) => {
    paginationProps.length = 0;
    render(['mixer-pump'], { graphqlClient: CLIENT, ...extra });
    return paginationProps[paginationProps.length - 1]?.variant;
  };

  it('defaults to the compact pager', () => {
    expect(lastVariant({})).toBe('compact');
  });

  it('forwards paginationVariant="full"', () => {
    expect(lastVariant({ paginationVariant: 'full' })).toBe('full');
  });
});
