/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads.
 *
 * Emits a `<script type="application/ld+json">` with a schema.org Product
 * payload representing the cluster (clusters use `@type: "Product"` — schema.org
 * has no Cluster type; the cluster's `defaultProduct` supplies brand/SKU/price/image).
 * Returns `null` when the cluster has no usable name AND no URL.
 */
import * as React from 'react';
import type { Cluster } from '@propeller-commerce/propeller-sdk-v2';
import {
  buildClusterJsonLd,
  safeJsonStringify,
  type JsonLdContext,
} from '@propeller-commerce/propeller-v2-core-ui';

export interface ClusterJsonLdProps {
  /** The cluster to describe. */
  cluster: Cluster;
  /** Per-request context: siteUrl, language, currency, portalMode, user, URL builders. */
  context: JsonLdContext;
}

function ClusterJsonLd(props: ClusterJsonLdProps) {
  const data = buildClusterJsonLd(props.cluster, props.context);
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonStringify(data) }}
    />
  );
}

export default React.memo(ClusterJsonLd);
