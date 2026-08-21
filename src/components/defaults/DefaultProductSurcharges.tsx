'use client';

import React from 'react';
import { formatSurcharge, getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import type { ProductSurchargesComponentProps } from '@propeller-commerce/propeller-v2-core-ui';

/**
 * Default surcharges renderer for the extension API.
 *
 * Standalone implementation of the `ProductSurchargesComponentProps` contract
 * — accepts either a `product` (PDP surcharges from `product.surcharges`) or
 * a `cartItem` (line-item surcharges) and renders them as a stacked list
 * with formatted amounts via core-ui's `formatSurcharge`.
 *
 * Used as the fallback when `ProductInfo` or `CartItem` has no
 * `surchargesComponent` injected.
 */
export function DefaultProductSurcharges(
  props: ProductSurchargesComponentProps,
): React.JSX.Element | null {
  const { product, cartItem, includeTax, labels, className } = props;

  const source =
    (cartItem as { surcharges?: unknown[] } | undefined)?.surcharges ??
    (product as { surcharges?: unknown[] } | undefined)?.surcharges ??
    [];

  if (!source || source.length === 0) return null;

  return (
    <ul className={className ?? 'text-xs text-foreground-subtle space-y-0.5'}>
      {source.map((s, idx) => {
        const item = s as {
          id?: string | number;
          code?: string;
          name?: string;
          description?: string;
        };
        const key = item?.id ?? idx;
        const labelKey = item?.code ?? 'surcharge';
        const fallback = item?.description ?? item?.name ?? 'Surcharge';
        return (
          <li key={key}>
            {getLabel(labels, labelKey, fallback)}: {formatSurcharge(s as never, includeTax as never)}
          </li>
        );
      })}
    </ul>
  );
}

export default DefaultProductSurcharges;
