'use client';
/**
 * Client wrapper around the pure `OrderSummary` component. Resolves
 * `language`, `currency`, `user` and `portalMode` from `<PropellerProvider>`
 * when the caller doesn't pass them explicitly. The pure version stays
 * exported from `/pure` for RSC use.
 *
 * Without this, every client host had to remember to pass `language` or the
 * order's money silently formatted at the `nl-NL` default — right glyph,
 * Dutch separators — on a shop reading in any other language.
 */
import * as React from 'react';
import OrderSummary, { type OrderSummaryProps } from './OrderSummary';
import { useInfraProps } from '../composables/react/useInfraProps';

function OrderSummaryWithProvider(rawProps: OrderSummaryProps) {
  const props = useInfraProps(rawProps);
  return <OrderSummary {...props} />;
}

export default OrderSummaryWithProvider;
export type { OrderSummaryProps };
