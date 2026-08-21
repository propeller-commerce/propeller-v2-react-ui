'use client';
/**
 * @rsc-blocked — Client-only component (ships under the package's "use client"
 * boundary alongside the other order components). Holds no state itself.
 */
import * as React from 'react';

import { Order, OrderItem } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, getNettedBonusItems } from '@propeller-commerce/propeller-v2-core-ui';
import { useInfraProps } from '../composables/react/useInfraProps';
import DefaultOrderItemCardImpl from './OrderItemCard';
import { cn } from '../composables/shared/utils/cn';

export interface OrderBonusItemsProps {
  /** Order whose bonus items are displayed. When omitted, pass `items` directly. */
  order?: Order | null;
  /** Pre-resolved order items. When omitted, `order.items` is used. */
  items?: OrderItem[];
  /** Currency symbol for prices, forwarded to OrderItemCard. Resolved from PropellerProvider when omitted; defaults to '€'. */
  currency?: string;
  /** Additional CSS class for the root element. */
  className?: string;
  /** Label overrides. Keys: `title` ('Bonus items'). */
  labels?: Record<string, string>;
  // ───── Extension API ─────
  // Replaces each <OrderItemCard> rendered in the bonus-items list.
  orderItemCardComponent?: React.ComponentType<import('./OrderItemCard').OrderItemCardProps>;
}

/**
 * Renders an order's bonus items — free items added through incentives — as a
 * read-only "Bonus items" section (heading + table of OrderItemCard rows).
 *
 * Bonus items are order items of `class === 'product'` with `isBonus === 'Y'`.
 * The API models the discount as a separate sibling `incentive` item that
 * carries the negative delta and points back via `parentOrderItemId`, so the
 * product line alone still shows the undiscounted price. Each bonus line is
 * therefore netted against its incentive siblings before display — a fully
 * discounted item reaches 0, a partially discounted one keeps the remainder.
 *
 * Renders nothing when there are no bonus items, so it's safe to drop into any
 * order surface (thank-you, order details, quote details) unconditionally.
 *
 * `currency` resolves from `<PropellerProvider>` via `useInfraProps` when not
 * passed explicitly.
 */
function OrderBonusItems(rawProps: OrderBonusItemsProps) {
  const props = useInfraProps(rawProps);
  const allItems: OrderItem[] = props.items ?? props.order?.items ?? [];
  const bonusItems = getNettedBonusItems(allItems);
  if (bonusItems.length === 0) return null;

  const OrderItemCardImpl = props.orderItemCardComponent ?? DefaultOrderItemCardImpl;

  return (
    <div className={cn(`propeller-order-bonus-items ${props.className || 'mb-8'}`)}>
      <h3 className="propeller-order-bonus-items__title text-lg font-bold mb-3 text-foreground">
        {getLabel(props.labels, 'title', 'Bonus items')}
      </h3>
      <div className="propeller-order-bonus-items__table bg-card rounded-container shadow overflow-hidden">
        <table className="w-full">
          {bonusItems.map((item: OrderItem) => (
            <OrderItemCardImpl
              key={item.id}
              orderItem={item}
              titleLinkable={false}
              currency={props.currency}
              // OrderItemCard is RSC-safe and reads no context, so the language
              // has to come from here.
              language={props.language as string | undefined}
            />
          ))}
        </table>
      </div>
    </div>
  );
}

export default OrderBonusItems;
