'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import {
  Product,
  GraphQLClient,
  PaginatedMediaDocumentResponse,
  PaginatedMediaVideoResponse,
  AttributeResult,
} from '@propeller-commerce/propeller-sdk-v2';
import { useProductSpecs } from '../composables/react/useProductSpecs';
import { useInfraProps } from '../composables/react/useInfraProps';
import DefaultProductDescriptionImpl from './ProductDescription';
import DefaultProductSpecificationsImpl from './ProductSpecifications';
import DefaultProductDownloadsImpl from './ProductDownloads';
import DefaultProductVideosImpl from './ProductVideos';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface ProductTabsProps {
  /** Product for which to display the information. */
  product: Product;

  // ── Tab visibility ────────────────────────────────────────────────────────

  /** If true, displays the Description tab. Defaults to true. */
  showDescription?: boolean;

  /** If true, displays the Specifications tab. Defaults to true. */
  showSpecifications?: boolean;

  /** If true, displays the Downloads tab. Defaults to true. */
  showDownloads?: boolean;

  /** If true, displays the Videos tab. Defaults to true. */
  showVideos?: boolean;

  // ── Shared ────────────────────────────────────────────────────────────────

  /**
   * Language code passed to all sub-components.
   * Defaults to 'NL'.
   */
  language?: string;

  /**
   * Override the tab button labels.
   * Available keys: description, specifications, downloads, videos
   */
  labels?: Record<string, string>;

  // ── Description tab ───────────────────────────────────────────────────────

  /**
   * When true, the description is initially collapsed to `descriptionMaxLength` characters.
   * A "Read more" / "Read less" toggle is shown.
   * Passed as `collapsed` to ProductDescription. Defaults to false.
   */
  descriptionCollapsed?: boolean;

  /**
   * Maximum number of characters shown when the description is collapsed.
   * Passed as `maxLength` to ProductDescription. Defaults to 0 (no truncation).
   */
  descriptionMaxLength?: number;

  // ── Specifications tab ────────────────────────────────────────────────────

  /**
   * Initialised Propeller SDK GraphQL client.
   * Passed to ProductSpecifications for internal attribute fetching.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Product ID to fetch attributes for.
   * Passed to ProductSpecifications for internal attribute fetching.
   */
  productId?: number;

  /**
   * Display layout for the specifications.
   * 'table' — two-column table (name | value). Default.
   * 'list'  — vertical label + value stacked rows.
   * Passed as `layout` to ProductSpecifications.
   */
  specificationsLayout?: string;

  /**
   * When true, groups specifications by their group field with a heading per section.
   * When false or omitted, displays a flat ungrouped table. Default: false.
   * Passed as `grouping` to ProductSpecifications.
   */
  specificationsGrouping?: boolean;

  /**
   * Extra package-description string rendered in the specifications section
   * (e.g. contents / packaging notes). Passed as `packageDescription` to
   * ProductSpecifications.
   */
  specificationsPackageDescription?: string;

  /**
   * Render arbitrary content at the start of the specifications section (before
   * the attribute rows) — e.g. a labelled "Unit of measure" row. Passed as
   * `beforeSpecs` to ProductSpecifications; receives the active `layout` so the
   * consumer can return a `<tr>` (table) or block (list).
   */
  specificationsBeforeSpecs?: (ctx: { layout: 'table' | 'list' }) => React.ReactNode;

  /**
   * Render arbitrary content at the end of the specifications section (after the
   * attribute rows). Passed as `afterSpecs` to ProductSpecifications.
   */
  specificationsAfterSpecs?: (ctx: { layout: 'table' | 'list' }) => React.ReactNode;

  // ── Downloads tab ─────────────────────────────────────────────────────────

  /**
   * Override UI strings for the Downloads section.
   * Available keys: title, download
   * Passed as `labels` to ProductDownloads.
   */
  downloadsLabels?: Record<string, string>;

  // ── Videos tab ───────────────────────────────────────────────────────────

  /**
   * Override UI strings for the Videos section.
   * Available key: title
   * Passed as `labels` to ProductVideos.
   */
  videosLabels?: Record<string, string>;

  // ── Root ─────────────────────────────────────────────────────────────────

  /** Extra CSS class applied to the root element. */
  className?: string;

  // ───── Extension API ─────
  // Replaces each tab-content component when the corresponding tab is active.
  // Each consumes the same props the default tab body would.
  productDescriptionComponent?: React.ComponentType<import('./ProductDescription').ProductDescriptionProps>;
  productSpecificationsComponent?: React.ComponentType<import('./ProductSpecifications').ProductSpecificationsProps>;
  productDownloadsComponent?: React.ComponentType<import('./ProductDownloads').ProductDownloadsProps>;
  productVideosComponent?: React.ComponentType<import('./ProductVideos').ProductVideosProps>;
}
/**
 * Renders a tabbed (desktop) / accordion (mobile) panel for a product's
 * description, specifications, downloads and videos sections.
 *
 * @remarks Uses {@link useProductSpecs} to fetch attributes for the specs tab.
 */
function ProductTabs(rawProps: ProductTabsProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const ProductDescriptionImpl = props.productDescriptionComponent ?? DefaultProductDescriptionImpl;
  const ProductSpecificationsImpl = props.productSpecificationsComponent ?? DefaultProductSpecificationsImpl;
  const ProductDownloadsImpl = props.productDownloadsComponent ?? DefaultProductDownloadsImpl;
  const ProductVideosImpl = props.productVideosComponent ?? DefaultProductVideosImpl;
  // --- composable ---
  const { attributes: fetchedAttributes, fetchSpecs } = useProductSpecs({
    graphqlClient: props.graphqlClient as GraphQLClient,
    language: props.language || 'NL',
  });

  // Lazy-pick the first visible tab so we don't useState('description')
  // and then immediately setActiveTab(...) inside a useEffect.
  const initialTab: string = (() => {
    const lang = props.language || 'NL';
    const descs = props.product?.descriptions;
    const hasDesc = !!descs && descs.length > 0
      && (descs.find((d) => d.language === lang)?.value
        || descs[0]?.value || '').length > 0;
    if (props.showDescription !== false && hasDesc) return 'description';
    if (props.showSpecifications !== false) return 'specifications';
    if (props.showDownloads !== false) return 'downloads';
    return 'videos';
  })();
  const [activeTab, setActiveTab] = useState(() => initialTab);
  const [specsVisited, setSpecsVisited] = useState(
    () => initialTab === 'specifications'
  );
  function getSpecsAttributes() {
    return fetchedAttributes.length
      ? fetchedAttributes
      : (props.product?.attributes?.items as AttributeResult[]) || [];
  }
  function hasDescription() {
    const lang = props.language || 'NL';
    const descriptions = props.product?.descriptions;
    if (!descriptions || descriptions.length === 0) return false;
    const match = descriptions.find((d) => d.language === lang);
    return !!(match?.value || descriptions[0]?.value);
  }
  function isTabVisible(tab: string) {
    if (tab === 'description') return props.showDescription !== false && hasDescription();
    if (tab === 'specifications') return props.showSpecifications !== false;
    if (tab === 'downloads') return props.showDownloads !== false;
    if (tab === 'videos') return props.showVideos !== false;
    return false;
  }
  function isActive(tab: string) {
    return activeTab === tab;
  }
  function selectTab(tab: string) {
    if (tab === 'specifications') {
      setSpecsVisited(true);
    }
    setActiveTab(tab);
  }
  // Re-evaluate the active tab when product / language changes (e.g. user
  // navigates between products with the same component instance). Repeats
  // the initial-tab logic computed lazily above. Intentional external-state
  // sync — the user might have manually switched tabs between renders, but
  // when the product itself changes that selection is no longer meaningful.
  useEffect(() => {
    if (props.showDescription !== false && hasDescription()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('description');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.product, props.language]);
  useEffect(() => {
    if (!props.productId || !props.graphqlClient) return;
    fetchSpecs(props.productId as number);
  }, [props.productId]);
  return (
    <>
      {props.product ? (
        <>
          <div
            className={cn(`propeller-product-tabs ${(props.className as string) || ''}`)}
            data-active-tab={activeTab}
          >
            <div className="propeller-product-tabs__desktop hidden md:block">
              <div className="propeller-product-tabs__tablist flex border-b border-border">
                {isTabVisible('description') ? (
                  <button
                    type="button"
                    onClick={(event) => selectTab('description')}
                    className={`propeller-product-tabs__tab px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${isActive('description') ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
                    data-tab="description"
                    data-active={isActive('description') ? 'true' : 'false'}
                  >
                    {getLabel(props.labels, 'description', 'Description')}
                  </button>
                ) : null}
                {isTabVisible('specifications') ? (
                  <button
                    type="button"
                    onClick={(event) => selectTab('specifications')}
                    className={`propeller-product-tabs__tab px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${isActive('specifications') ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
                    data-tab="specifications"
                    data-active={isActive('specifications') ? 'true' : 'false'}
                  >
                    {getLabel(props.labels, 'specifications', 'Specifications')}
                  </button>
                ) : null}
                {isTabVisible('downloads') ? (
                  <button
                    type="button"
                    onClick={(event) => selectTab('downloads')}
                    className={`propeller-product-tabs__tab px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${isActive('downloads') ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
                    data-tab="downloads"
                    data-active={isActive('downloads') ? 'true' : 'false'}
                  >
                    {getLabel(props.labels, 'downloads', 'Downloads')}
                  </button>
                ) : null}
                {isTabVisible('videos') ? (
                  <button
                    type="button"
                    onClick={(event) => selectTab('videos')}
                    className={`propeller-product-tabs__tab px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${isActive('videos') ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`}
                    data-tab="videos"
                    data-active={isActive('videos') ? 'true' : 'false'}
                  >
                    {getLabel(props.labels, 'videos', 'Videos')}
                  </button>
                ) : null}
              </div>
              <div className="propeller-product-tabs__panel pt-6">
                {isActive('description') && isTabVisible('description') ? (
                  <ProductDescriptionImpl
                    product={props.product}
                    language={props.language}
                    collapsed={props.descriptionCollapsed}
                    maxLength={props.descriptionMaxLength}
                    labels={props.labels}
                  />
                ) : null}
                {specsVisited && isTabVisible('specifications') ? (
                  <div className={isActive('specifications') ? '' : 'hidden'}>
                    <ProductSpecificationsImpl
                      attributes={getSpecsAttributes()}
                      language={props.language}
                      layout={props.specificationsLayout}
                      grouping={props.specificationsGrouping}
                      packageDescription={props.specificationsPackageDescription}
                      beforeSpecs={props.specificationsBeforeSpecs}
                      afterSpecs={props.specificationsAfterSpecs}
                    />
                  </div>
                ) : null}
                {isActive('downloads') && isTabVisible('downloads') ? (
                  <ProductDownloadsImpl
                    downloads={
                      (props.product as Product).media?.documents as PaginatedMediaDocumentResponse
                    }
                    language={(props.language as string) || 'NL'}
                    labels={props.downloadsLabels}
                  />
                ) : null}
                {isActive('videos') && isTabVisible('videos') ? (
                  <ProductVideosImpl
                    videos={(props.product as Product).media?.videos as PaginatedMediaVideoResponse}
                    language={(props.language as string) || 'NL'}
                    labels={props.videosLabels}
                  />
                ) : null}
              </div>
            </div>
            <div className="propeller-product-tabs__mobile md:hidden divide-y divide-border border border-border rounded-container">
              {isTabVisible('description') ? (
                <div>
                  <button
                    type="button"
                    className="propeller-product-tabs__accordion-trigger flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left"
                    onClick={(event) => {
                      setActiveTab(activeTab === 'description' ? '' : 'description');
                    }}
                  >
                    {getLabel(props.labels, 'description', 'Description')}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${isActive('description') ? 'rotate-180' : ''}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {isActive('description') ? (
                    <div className="propeller-product-tabs__accordion-panel px-4 pb-4">
                      <ProductDescriptionImpl
                        product={props.product}
                        language={props.language}
                        collapsed={props.descriptionCollapsed}
                        maxLength={props.descriptionMaxLength}
                        labels={props.labels}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {isTabVisible('specifications') ? (
                <div>
                  <button
                    type="button"
                    className="propeller-product-tabs__accordion-trigger flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left"
                    onClick={(event) => {
                      if (activeTab !== 'specifications') {
                        setSpecsVisited(true);
                        setActiveTab('specifications');
                      } else {
                        setActiveTab('');
                      }
                    }}
                  >
                    {getLabel(props.labels, 'specifications', 'Specifications')}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${isActive('specifications') ? 'rotate-180' : ''}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {specsVisited && isActive('specifications') ? (
                    <div className="propeller-product-tabs__accordion-panel px-4 pb-4">
                      <ProductSpecificationsImpl
                        attributes={getSpecsAttributes()}
                        language={props.language}
                        layout={props.specificationsLayout}
                        grouping={props.specificationsGrouping}
                        packageDescription={props.specificationsPackageDescription}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {isTabVisible('downloads') ? (
                <div>
                  <button
                    type="button"
                    className="propeller-product-tabs__accordion-trigger flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left"
                    onClick={(event) => {
                      setActiveTab(activeTab === 'downloads' ? '' : 'downloads');
                    }}
                  >
                    {getLabel(props.labels, 'downloads', 'Downloads')}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${isActive('downloads') ? 'rotate-180' : ''}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {isActive('downloads') ? (
                    <div className="propeller-product-tabs__accordion-panel px-4 pb-4">
                      <ProductDownloadsImpl
                        downloads={
                          (props.product as Product).media
                            ?.documents as PaginatedMediaDocumentResponse
                        }
                        language={(props.language as string) || 'NL'}
                        labels={props.downloadsLabels}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {isTabVisible('videos') ? (
                <div>
                  <button
                    type="button"
                    className="propeller-product-tabs__accordion-trigger flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-left"
                    onClick={(event) => {
                      setActiveTab(activeTab === 'videos' ? '' : 'videos');
                    }}
                  >
                    {getLabel(props.labels, 'videos', 'Videos')}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${isActive('videos') ? 'rotate-180' : ''}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {isActive('videos') ? (
                    <div className="propeller-product-tabs__accordion-panel px-4 pb-4">
                      <ProductVideosImpl
                        videos={
                          (props.product as Product).media?.videos as PaginatedMediaVideoResponse
                        }
                        language={(props.language as string) || 'NL'}
                        labels={props.videosLabels}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

export default ProductTabs;
