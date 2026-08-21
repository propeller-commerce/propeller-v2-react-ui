/**
 * MachineGrid — mode selection by URL segments.
 *
 * The component's one structural decision: empty `segments` → the root
 * installations list (title only, since the concat fetch is an effect that
 * doesn't run under SSR); non-empty `segments` → the node view with breadcrumbs
 * and the leaf title derived from its slug. Rendered with `renderToString` in the
 * package's Node env — no client, so both data hooks stay idle and we assert the
 * body the component computes synchronously.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import MachineGrid, { type MachineListingState } from '../MachineGrid';

const LISTING: MachineListingState = {
  page: 1,
  offset: 12,
  sortField: 'NAME',
  sortOrder: 'ASC',
  filters: {},
  term: '',
};

function render(segments: string[]): string {
  return renderToString(
    <MachineGrid
      segments={segments}
      basePath="/machines"
      rootTitle="Machines"
      listing={LISTING}
      onListingChange={() => {}}
    />
  );
}

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
