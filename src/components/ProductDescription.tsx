'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import type { Product, Cluster, LocalizedString } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface ProductDescriptionProps {
  /**
   * Product or Cluster object.
   * The component reads `product.descriptions` (an array of LocalizedString)
   * and renders the matching language entry as HTML.
   */
  product: Product | Cluster;

  /**
   * Language code used to resolve the correct localised description.
   * Defaults to 'NL'.
   */
  language?: string;

  /**
   * When true, the description is initially collapsed to `maxLength` characters.
   * A "Read more" / "Read less" toggle is shown.
   * Defaults to false.
   */
  collapsed?: boolean;

  /**
   * Maximum number of characters shown when collapsed.
   * Set to 0 to display the entire description without truncation.
   * Defaults to 0.
   */
  maxLength?: number;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /** Translated labels: `readMore`, `readLess`. */
  labels?: Record<string, string>;
}
/**
 * Renders a product's localised HTML description, optionally collapsed to a
 * character limit with a "Read more" / "Read less" toggle.
 */
function ProductDescription(props: ProductDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  // Derived from props — no state needed. Was previously set via useEffect
  // (set-state-in-effect anti-pattern) which caused an extra render per
  // prop change with no real benefit.
  function getDescription(): string {
    const product = props.product as Product;
    if (!product?.descriptions) return '';
    const lang = props.language || 'NL';
    const match = product.descriptions.find((d: LocalizedString) => d.language === lang);
    return match?.value || product.descriptions?.[0]?.value || '';
  }
  const html = getDescription();
  const maxLen = !props.maxLength || props.maxLength <= 0 ? 0 : props.maxLength;
  const shouldTruncate = !!props.collapsed && maxLen > 0
    && html.replace(/<[^>]*>/g, '').length > maxLen;
  function getTruncated(): string {
    const plain = html.replace(/<[^>]*>/g, '');
    if (maxLen === 0 || plain.length <= maxLen) return html;
    const truncated = plain.substring(0, maxLen);
    return truncated.substring(0, truncated.lastIndexOf(' ')) + '\u2026';
  }
  return (
    <>
      {!!html ? (
        <div
          className={cn(`propeller-product-description ${props.className || ''}`)}
          data-expanded={expanded ? 'true' : 'false'}
          data-truncatable={shouldTruncate ? 'true' : 'false'}
        >
          {!shouldTruncate || expanded ? (
            <div
              className="propeller-product-description__content prose prose-slate max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="propeller-product-description__truncated text-muted-foreground">{getTruncated()}</p>
          )}
          {shouldTruncate ? (
            <button
              type="button"
              className="propeller-product-description__toggle mt-2 text-sm font-medium text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? getLabel(props.labels, 'readLess', 'Read less')
                : getLabel(props.labels, 'readMore', 'Read more')}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export default ProductDescription;
