import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';

/** Empty-dropdown text for SearchBar: the error label when the search failed, else "no results" for the term. */
export function searchEmptyMessage(
  labels: Record<string, string> | undefined,
  searchError: boolean,
  term: string,
): string {
  if (searchError) {
    return getLabel(labels, 'searchError', 'Search is unavailable right now. Please try again.');
  }
  return `${getLabel(labels, 'noResults', 'No products found for')} "${term}"`;
}
