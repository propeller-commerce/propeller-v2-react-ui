'use client';
/**
 * @rsc-blocked — Client-only component: side effects (useEffect).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useEffect } from 'react';
import {
  GraphQLClient,
  Cluster,
  LocalizedString,
  Contact,
  Customer,
} from '@propeller-commerce/propeller-sdk-v2';
import { useProductInfo } from '../composables/react/useProductInfo';
import { useInfraProps } from '../composables/react/useInfraProps';
import { cn } from '../composables/shared/utils/cn';

export interface ClusterInfoProps {
  // ── Data source ──────────────────────────────────────────────────────────
  /** The authenticated user (Contact or Customer). Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer | null;
  /**
   * Pre-fetched cluster object to display.
   * When provided the component skips internal fetching.
   */
  cluster?: Cluster;

  /**
   * Cluster ID to fetch data for when no `cluster` prop is provided.
   * Requires `graphqlClient` to be set.
   */
  clusterId?: number;

  /**
   * Initialised Propeller SDK GraphQL client.
   * Required when `clusterId` is provided for internal data fetching.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Called once the cluster data is loaded — either immediately (when
   * `cluster` prop is supplied) or after the internal fetch completes.
   * Use this to hydrate sibling components (configurator, price, gallery, etc.).
   */
  onClusterLoaded?: (cluster: Cluster) => void;

  // ── Display toggles ───────────────────────────────────────────────────────

  /** Show the cluster name. Defaults to true. */
  showTitle?: boolean;

  /** Show the cluster SKU. Defaults to true. */
  showSku?: boolean;

  // ── Locale ────────────────────────────────────────────────────────────────

  /** Language code used to resolve localised names. Defaults to 'NL'. */
  language?: string;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /**
   * Tax zone to use for price calculation.
   */
  taxZone?: string;

  /**
   * Image search filter passed to ProductService.getProduct().
   * Controls how many image items are returned.
   * Example: { page: 1, offset: 20 }
   */
  imageSearchFilters?: any;

  /**
   * Image variant transformation filter passed to ProductService.getProduct().
   * Controls image size/format variants returned with the product.
   * Example: imageVariantFiltersLarge from @/data/defaults
   * Defaults to { transformations: [] } when omitted.
   */
  imageVariantFilters?: any;

  /**
   * Config object providing imageSearchFiltersGrid and imageVariantFiltersSmall.
   */
  configuration?: any;

  /**
   * Attribute codes/names to look up and display as badge overlays on the product image.
   * Each code is resolved against `product.attributes.items[].attributeDescription.code`
   * (or `.name`). Attributes with no matching value are silently omitted.
   * Example: ['new', 'sale']
   */
  imageLabels?: string[];

  /**
   * Attribute codes/names to look up and display as extra text rows below the product name.
   * Resolved the same way as `imageLabels`.
   * Example: ['brand', 'color']
   */
  textLabels?: string[];
}

/**
 * Displays a cluster's name and SKU heading, either from a supplied `cluster`
 * prop or by fetching it from the SDK by `clusterId`.
 *
 * @remarks Uses {@link useProductInfo} to fetch the cluster when only an ID is given.
 */
function ClusterInfo(rawProps: ClusterInfoProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const { cluster: fetchedCluster, loading, fetchCluster } = useProductInfo(
    props.graphqlClient
      ? { graphqlClient: props.graphqlClient, language: props.language, configuration: props.configuration }
      : { graphqlClient: {} as GraphQLClient, language: props.language, configuration: props.configuration }
  );

  const activeCluster: Cluster | null = props.cluster || fetchedCluster;

  function getClusterName(): string {
    if (!activeCluster) return '';
    const lang = props.language || 'NL';
    const match = activeCluster.names?.find((n: LocalizedString) => n.language === lang);
    return match?.value || activeCluster.names?.[0]?.value || '';
  }

  function getClusterSku(): string {
    return activeCluster?.sku || '';
  }

  useEffect(() => {
    if (props.cluster) {
      if (props.onClusterLoaded) {
        props.onClusterLoaded(props.cluster);
      }
      return;
    }
    if (!props.clusterId || !props.graphqlClient) return;
    fetchCluster(props.clusterId, props.imageSearchFilters, props.imageVariantFilters);
  }, [props.clusterId]);

  useEffect(() => {
    if (fetchedCluster && props.onClusterLoaded) {
      props.onClusterLoaded(fetchedCluster);
    }
  }, [fetchedCluster]);

  return (
    <div className={cn(`propeller-cluster-info ${(props.className as string) || ''}`)} data-loading={loading ? 'true' : 'false'}>
      {loading && !props.cluster ? (
        <div className="propeller-cluster-info__skeleton animate-pulse space-y-3">
          <div className="propeller-cluster-info__skeleton-line h-4 bg-surface-hover rounded w-1/4" />
          <div className="propeller-cluster-info__skeleton-line h-8 bg-surface-hover rounded w-3/4" />
        </div>
      ) : null}
      {!loading || !!props.cluster ? (
        <>
          {props.showSku !== false && !!getClusterSku() ? (
            <div className="text-sm font-mono text-muted-foreground mb-2">
              SKU: {getClusterSku()}
            </div>
          ) : null}
          {props.showTitle !== false && !!getClusterName() ? (
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
              {getClusterName()}
            </h1>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default ClusterInfo;
