/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads.
 *
 * Emits a single `<script type="application/ld+json">` containing a schema.org
 * `ItemList` of `Product` items, one per element in the `products` array.
 * Scope is intentionally first-page only — caller passes whatever array is
 * present in the initial SSR HTML; client-side filter/sort/page navigation
 * does NOT update the script tag (crawlers only see the SSR snapshot anyway).
 *
 * Clusters in the response are unwrapped to their `defaultProduct` for the
 * embedded Product node, but the ListItem URL points to the cluster page.
 * Returns `null` when the list is empty.
 */
import * as React from 'react';
import type { Product } from '@propeller-commerce/propeller-sdk-v2';
import {
  buildItemListJsonLd,
  safeJsonStringify,
  type JsonLdContext,
} from '@propeller-commerce/propeller-v2-core-ui';

export interface ItemListJsonLdProps {
  /** First-page products (from server-side fetch). */
  products: ReadonlyArray<Product>;
  /** Per-request context: siteUrl, language, currency, portalMode, user, URL builders. */
  context: JsonLdContext;
}

function ItemListJsonLd(props: ItemListJsonLdProps) {
  const data = buildItemListJsonLd(props.products, props.context);
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
    />
  );
}

export default React.memo(ItemListJsonLd);
