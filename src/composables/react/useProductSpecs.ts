/**
 * useProductSpecs (React) — Product attribute fetch and grouping.
 */

import { useState, useCallback } from 'react';
import { createServices } from '@propeller-commerce/propeller-v2-core-ui';
import type { GraphQLClient, AttributeResult, AttributeResultSearchInput } from '@propeller-commerce/propeller-sdk-v2';
import { extractAttributeValues, getAttributeDisplayName } from '@propeller-commerce/propeller-v2-core-ui';

/** A named group of product attributes for display. */
export interface AttributeGroup {
  /** Group name; `''` for ungrouped attributes. */
  name: string;
  /** Attributes belonging to this group. */
  attributes: AttributeDisplayItem[];
}

/** A single product attribute prepared for display. */
export interface AttributeDisplayItem {
  /** Raw attribute name. */
  name: string;
  /** Localized, human-readable attribute label. */
  displayName: string;
  /** The attribute's value(s) as display strings. */
  values: string[];
  /** Attribute value type (e.g. `'TEXT'`). */
  type: string;
}

/** Options for {@link useProductSpecs}. */
export interface UseProductSpecsOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** Language used to resolve attribute display names. Defaults to `'NL'`. */
  language?: string;
}

/** State and actions returned by {@link useProductSpecs}. */
export interface UseProductSpecsReturn {
  /** Raw attribute results for the fetched product. */
  attributes: AttributeResult[];
  /** Attributes organised into display groups. */
  groupedAttributes: AttributeGroup[];
  /** `true` while a specs fetch is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** Fetches and groups the public attributes for a product. */
  fetchSpecs: (productId: number) => Promise<void>;
}

/**
 * useProductSpecs — product attribute fetch and grouping.
 *
 * @param options - see {@link UseProductSpecsOptions}.
 * @returns attribute state plus the `fetchSpecs` action — see {@link UseProductSpecsReturn}.
 *
 * @remarks
 * GraphQL integration: `fetchSpecs` calls `services.product.getAttributeResultByProductId()`
 * (`ProductService`), built per-call via `createServices(graphqlClient)`, with an
 * `AttributeResultSearchInput` that requests public attributes only
 * (`attributeDescription.isPublic: true`, page 1, offset 2000). The results are then
 * grouped client-side by their `attributeDescription.group`.
 */
export function useProductSpecs(options: UseProductSpecsOptions): UseProductSpecsReturn {
  const { graphqlClient } = options;
  const language = options.language || 'NL';

  const [attributes, setAttributes] = useState<AttributeResult[]>([]);
  const [groupedAttributes, setGroupedAttributes] = useState<AttributeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Groups attributes by their attribute group. Accepts a language param for
  // group-name resolution.
  function buildGroups(attrs: AttributeResult[], lang: string): AttributeGroup[] {
    const ungrouped: AttributeDisplayItem[] = [];
    const groupMap: Record<string, AttributeDisplayItem[]> = {};
    for (const attr of attrs) {
      const values = extractAttributeValues(attr);
      if (!values.length) continue;
      const displayName = getAttributeDisplayName(attr, lang);
      const item: AttributeDisplayItem = {
        name: attr.attributeDescription?.name || '',
        displayName,
        values,
        type: attr.value?.type || 'TEXT',
      };
      const groupName = attr.attributeDescription?.group || '';
      if (groupName) {
        if (!groupMap[groupName]) groupMap[groupName] = [];
        groupMap[groupName].push(item);
      } else { ungrouped.push(item); }
    }
    const groups: AttributeGroup[] = Object.entries(groupMap).map(([name, attributes]) => ({ name, attributes }));
    if (ungrouped.length) groups.push({ name: '', attributes: ungrouped });
    return groups;
  }

  const fetchSpecs = useCallback(async (productId: number): Promise<void> => {
    setLoading(true); setError(null);
    try {
      const service = createServices(graphqlClient).product;
      // Public attributes only, fetched in a single large page: isPublic: true, page: 1, offset: 2000
      const searchInput: AttributeResultSearchInput = {
        attributeDescription: { isPublic: true },
        page: 1,
        offset: 2000,
      };
      const result = await service.getAttributeResultByProductId(productId, searchInput);
      const items: AttributeResult[] = result?.items ?? [];
      setAttributes(items);
      setGroupedAttributes(buildGroups(items, language));
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to fetch specifications'); }
    finally { setLoading(false); }
  }, [graphqlClient, language]);

  return { attributes, groupedAttributes, loading, error, fetchSpecs };
}
