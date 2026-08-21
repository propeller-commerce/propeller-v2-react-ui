/**
 * GridFilters — the per-option result count.
 *
 * Once a group holds a selection the backend's `count` for a sibling option is
 * the INTERSECTION with that selection, not the option's own total. Rendering
 * it produced a season facet reading "(1)" that added 2 products when ticked.
 * `countActive` is the same option counted with its own group's filters lifted,
 * which is the number that belongs on screen.
 *
 * Fixture numbers are the real payload from sandbox-2 category 1845 with
 * "Winter / 3PMSF" active: 16 products, Winter 13, All season 3, overlap 1.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import GridFilters from '../GridFilters';
import type { AttributeFilter } from '@propeller-commerce/propeller-sdk-v2';

/** TYRE_SEASON as returned while "Winter / 3PMSF" is the active selection. */
const SEASON_WITH_WINTER_ACTIVE = [
  {
    id: 'season',
    attributeDescription: {
      id: 'season',
      name: 'TYRE_SEASON',
      descriptions: [{ language: 'NL', value: 'Seizoen' }],
      type: 'ENUM',
    },
    type: 'ENUM',
    textFilters: [
      { value: 'Winter / 3PMSF', count: 13, countTotal: 13, countActive: 13, isSelected: true },
      // The sibling: 3 products carry it, exactly 1 of which is also a Winter tyre.
      { value: 'All season / M+S', count: 1, countTotal: 3, countActive: 3, isSelected: false },
      { value: 'Zomer', count: 0, countTotal: 1, countActive: 1, isSelected: false },
    ],
  },
] as unknown as AttributeFilter[];

/** The same group with nothing selected — count and countActive agree. */
const SEASON_UNFILTERED = [
  {
    id: 'season',
    attributeDescription: {
      id: 'season',
      name: 'TYRE_SEASON',
      descriptions: [{ language: 'NL', value: 'Seizoen' }],
      type: 'ENUM',
    },
    type: 'ENUM',
    textFilters: [
      { value: 'Winter / 3PMSF', count: 13, countTotal: 13, countActive: 13, isSelected: false },
      { value: 'All season / M+S', count: 3, countTotal: 3, countActive: 3, isSelected: false },
      { value: 'Zomer', count: 1, countTotal: 1, countActive: 1, isSelected: false },
    ],
  },
] as unknown as AttributeFilter[];

/** `renderToString` splits interpolated text with `<!-- -->` markers. */
const render = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

/** The counts as rendered, in order: ["13", "3", "1"]. */
const counts = (html: string) =>
  [...html.matchAll(/__option-count[^>]*>\s*\((\d+)\)/g)].map((m) => m[1]);

describe('GridFilters option counts', () => {
  it('shows an unticked sibling its own total, not the intersection', () => {
    const html = render(
      <GridFilters
        filters={SEASON_WITH_WINTER_ACTIVE}
        collapsed={false}
        activeTextFilters={{ TYRE_SEASON: ['Winter / 3PMSF'] }}
        onFilterChange={() => {}}
      />
    );

    // "All season / M+S" — 3 products carry it. `count` (the intersection with
    // the active Winter selection) is 1; that 1 is what the bug rendered.
    expect(counts(html)).toEqual(['13', '3', '1']);
  });

  it('is a no-op when the group has no selection', () => {
    const html = render(
      <GridFilters filters={SEASON_UNFILTERED} collapsed={false} onFilterChange={() => {}} />
    );

    expect(counts(html)).toEqual(['13', '3', '1']);
  });
});
