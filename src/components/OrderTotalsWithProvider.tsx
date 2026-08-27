'use client';
/**
 * Client wrapper around the pure `OrderTotals` component. Resolves
 * `language`, `currency` and `includeTax` from `<PropellerProvider>` when the
 * caller doesn't pass them explicitly. The pure version stays exported from
 * `/pure` for RSC use.
 *
 * Without this, every client host had to remember to pass `language` or the
 * totals silently formatted at the `nl-NL` default — right glyph, Dutch
 * separators — on a shop reading in any other language.
 */
import * as React from 'react';
import OrderTotals, { type OrderTotalsProps } from './OrderTotals';
import { useInfraProps } from '../composables/react/useInfraProps';

function OrderTotalsWithProvider(rawProps: OrderTotalsProps) {
  const props = useInfraProps(rawProps);
  return <OrderTotals {...props} />;
}

export default OrderTotalsWithProvider;
export type { OrderTotalsProps };
