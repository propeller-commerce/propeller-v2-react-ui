/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 *
 * Emits a single `<script type="application/ld+json">` with the schema.org
 * Product payload built from the SDK `Product`. Returns `null` (no DOM) when
 * the input has no usable name AND no URL. Offers are gated by portal mode
 * (semi-closed + anonymous → no `offers` block).
 */
import * as React from 'react';
import type { Product } from '@propeller-commerce/propeller-sdk-v2';
import {
  buildProductJsonLd,
  safeJsonStringify,
  type JsonLdContext,
} from '@propeller-commerce/propeller-v2-core-ui';

export interface ProductJsonLdProps {
  /** The product to describe. */
  product: Product;
  /** Per-request context: siteUrl, language, currency, portalMode, user, URL builders. */
  context: JsonLdContext;
}

function ProductJsonLd(props: ProductJsonLdProps) {
  const data = buildProductJsonLd(props.product, props.context);
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
    />
  );
}

export default React.memo(ProductJsonLd);
