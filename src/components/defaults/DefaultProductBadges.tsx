'use client';

import React from 'react';
import { collectAttributeValues } from '@propeller-commerce/propeller-v2-core-ui';
import type { BadgesComponentProps } from '@propeller-commerce/propeller-v2-core-ui';

/**
 * Default badges renderer for the extension API.
 *
 * Standalone implementation of the `BadgesComponentProps` contract — looks at
 * the product/cluster attributes for an `imageLabel` attribute (case-
 * insensitive substring match via core-ui's `collectAttributeValues`) and
 * renders each value as a small badge pill.
 *
 * The hardcoded `imageLabel` attribute name matches what `ProductCard`
 * exposes by default via its `imageLabels` prop. Consumers with a different
 * attribute taxonomy inject their own `badgesComponent`.
 */
export function DefaultProductBadges(props: BadgesComponentProps): React.JSX.Element | null {
  const { product, cluster, className } = props;
  const target = product ?? cluster;
  if (!target) return null;

  const attributes = (target as { attributes?: unknown[] }).attributes ?? [];
  const labels = collectAttributeValues(attributes as never, 'imageLabel');

  if (!labels || labels.length === 0) return null;

  return (
    <div className={className ?? 'pointer-events-none absolute left-2 top-2 flex flex-col gap-1'}>
      {labels.map((label) => (
        <span
          key={label}
          className="inline-block rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground shadow-sm"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export default DefaultProductBadges;
