/**
 * SearchBar's empty-dropdown message: a failed search must not read as
 * "no products found".
 */

import { describe, it, expect } from 'vitest';
import { searchEmptyMessage } from '../searchStatus';

describe('searchEmptyMessage', () => {
  it('shows the no-results text with the term when the search succeeded', () => {
    expect(searchEmptyMessage(undefined, false, 'drill')).toBe('No products found for "drill"');
  });

  it('shows the error text instead when the search failed', () => {
    expect(searchEmptyMessage(undefined, true, 'drill')).toBe('Search is unavailable right now. Please try again.');
  });

  it('uses the host labels', () => {
    const labels = { noResults: 'Niets gevonden voor', searchError: 'Zoeken mislukt' };
    expect(searchEmptyMessage(labels, false, 'boor')).toBe('Niets gevonden voor "boor"');
    expect(searchEmptyMessage(labels, true, 'boor')).toBe('Zoeken mislukt');
  });
});
