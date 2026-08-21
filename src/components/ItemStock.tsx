/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import { ProductInventory } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface ItemStockProps {
  /**
   * Product inventory to display stock and availability for.
   * Required — drives all stock calculations and display logic.
   */
  inventory: ProductInventory;

  /**
   * Shows whether the product is available or not available.
   * Defaults to true.
   */
  showAvailability?: boolean;

  /**
   * Shows the actual stock quantity (`inventory.totalQuantity`).
   * Defaults to true.
   */
  showStock?: boolean;

  /**
   * UI string overrides.
   * Available keys: inStock, outOfStock, lowStock, available, notAvailable, pieces
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
/**
 * Renders stock badges for a product: an availability indicator and/or a
 * stock-status badge (in stock / low stock / out of stock) with quantity.
 */
function ItemStock(props: ItemStockProps) {
  
  function getTotalQuantity(): number {
    const qty = (props.inventory as ProductInventory)?.totalQuantity;
    return qty !== undefined && qty !== null ? qty : -1;
  }
  function isAvailable(): boolean {
    return getTotalQuantity() > 0;
  }
  function getStockStatusLabel(): string {
    const qty = getTotalQuantity();
    if (qty < 0) return '';
    if (qty === 0) return getLabel(props.labels, 'outOfStock', 'Out of stock');
    if (qty <= 5) return getLabel(props.labels, 'lowStock', 'Low stock');
    return getLabel(props.labels, 'inStock', 'In stock');
  }
  function getStockStatusClass(): string {
    const qty = getTotalQuantity();
    if (qty <= 0) return 'text-destructive bg-destructive/10 border-destructive/20';
    if (qty <= 5) return 'text-warning bg-warning/10 border-warning/20';
    return 'text-success bg-success/10 border-success/20';
  }
  function getStockStatusData(): string {
    const qty = getTotalQuantity();
    if (qty <= 0) return 'out';
    if (qty <= 5) return 'low';
    return 'in';
  }
  function getAvailabilityLabel(): string {
    return isAvailable()
      ? getLabel(props.labels, 'available', 'Available')
      : getLabel(props.labels, 'notAvailable', 'Not available');
  }
  function getAvailabilityClass(): string {
    return isAvailable()
      ? 'text-success bg-success/10 border-success/20'
      : 'text-destructive bg-destructive/10 border-destructive/20';
  }
  function getAvailabilityDotClass(): string {
    return isAvailable() ? 'bg-success' : 'bg-destructive';
  }
  function hasInventory(): boolean {
    return !!(props.inventory as ProductInventory) && getTotalQuantity() >= 0;
  }
  return (
    <>
      {hasInventory() ? (
        <>
          <div
            className={cn(`propeller-item-stock flex flex-wrap items-center gap-1.5 ${(props.className as string) || ''}`)}
            data-available={isAvailable() ? 'true' : 'false'}
            data-stock={getStockStatusData()}
          >
            {props.showAvailability !== false ? (
              <span
                className={`propeller-item-stock__availability inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${getAvailabilityClass()}`}
              >
                <span
                  className={`propeller-item-stock__availability-dot h-1.5 w-1.5 flex-shrink-0 rounded-full ${getAvailabilityDotClass()}`}
                />
                {getAvailabilityLabel()}
              </span>
            ) : null}
            {props.showStock !== false && !!getStockStatusLabel() ? (
              <span
                className={`propeller-item-stock__status inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStockStatusClass()}`}
              >
                {getStockStatusLabel()}
                {getTotalQuantity() > 0 ? (
                  <span className="propeller-item-stock__count opacity-70">
                    ({getTotalQuantity()}
                    {getLabel(props.labels, 'pieces', 'pcs')})
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}

// Memoized: pure leaf rendered inside memoized cards; skips re-render when its
// (inventory / labels / flags) props are shallow-equal (rbp §5.2).
export default React.memo(ItemStock);
