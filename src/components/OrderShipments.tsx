'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import { Order, Shipment, ShipmentItem, TrackAndTrace, OrderItem } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface OrderShipmentsProps {
  /** The current order the user is viewing */
  order: Order;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Additional CSS class for the root element */
  className?: string;
}
/**
 * Renders an order's shipments as a table, with a modal showing per-shipment
 * item details and track-and-trace links.
 */
function OrderShipments(props: OrderShipmentsProps) {
  const [activeShipment, setActiveShipment] = useState<Shipment | null>(null);
  const shipments: Shipment[] = props.order?.shipments || [];
  function formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    // Numeric day-first DD-MM-YYYY, consistent with the order list / summary.
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${d.getFullYear()}`;
  }
  function getOrderItemForShipmentItem(shipmentItem: ShipmentItem): OrderItem | null {
    if (!props.order?.items || !shipmentItem.orderItemId) return null;
    return props.order.items.find((oi: OrderItem) => oi.id === shipmentItem.orderItemId) || null;
  }
  function buildTrackAndTraceUrl(tat: TrackAndTrace): string {
    const baseUrl = tat.carrier?.trackAndTraceURL || '';
    const code = tat.code || '';
    return `${baseUrl}${code}`;
  }
  return (
    <div className={cn(`order-shipments ${props.className || ''}`)}>
      {shipments.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">{getLabel(props.labels, 'title', 'Shipping details')}</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {getLabel(props.labels, 'colStatus', 'Status')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {getLabel(props.labels, 'colCreatedAt', 'Date')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {getLabel(props.labels, 'colExpectedDelivery', 'Expected delivery')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    {getLabel(props.labels, 'colItems', 'Items')}
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    {getLabel(props.labels, 'colActions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shipments?.map((shipment, index) => (
                  <tr className="hover:bg-muted/30 transition-colors" key={index}>
                    <td className="px-4 py-3">
                      {!!shipment.status ? (
                        <span className="propeller-order-shipments__status inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                          {shipment.status}
                        </span>
                      ) : null}
                      {!shipment.status ? <span className="text-muted-foreground">-</span> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(shipment.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {!!shipment.expectedDeliveryAt ? (
                        <>{formatDate(shipment.expectedDeliveryAt!)}</>
                      ) : null}
                      {!shipment.expectedDeliveryAt ? <>-</> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(shipment.items || []).length}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-primary hover:text-primary/80 text-sm font-medium hover:underline"
                        onClick={() => setActiveShipment(shipment)}
                      >
                        {getLabel(props.labels, 'details', 'Details')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {!!activeShipment ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveShipment(null)}
        >
          <div className="propeller-order-shipments__modal-backdrop absolute inset-0 bg-foreground/50" />
          <div
            className="propeller-order-shipments__modal-content relative z-10 w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-card rounded-container shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">
                {getLabel(props.labels, 'modalTitle', 'Shipment details')}
              </h3>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setActiveShipment(null)}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  className="h-5 w-5"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">
                    {getLabel(props.labels, 'labelStatus', 'Status')}
                  </span>
                  <p className="mt-0.5">
                    {!!activeShipment?.status ? (
                      <span className="propeller-order-shipments__status inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
                        {activeShipment?.status}
                      </span>
                    ) : null}
                    {!activeShipment?.status ? <span>-</span> : null}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">
                    {getLabel(props.labels, 'labelExpectedDelivery', 'Expected delivery')}
                  </span>
                  <p className="mt-0.5">
                    {!!activeShipment?.expectedDeliveryAt ? (
                      <>{formatDate(activeShipment?.expectedDeliveryAt!)}</>
                    ) : null}
                    {!activeShipment?.expectedDeliveryAt ? <>-</> : null}
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">{getLabel(props.labels, 'itemsTitle', 'Items')}</h4>
                {(activeShipment?.items || []).length > 0 ? (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                            {getLabel(props.labels, 'colProduct', 'Product')}
                          </th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                            {getLabel(props.labels, 'colSku', 'SKU')}
                          </th>
                          <th className="text-center px-4 py-2 font-medium text-muted-foreground">
                            {getLabel(props.labels, 'colQuantity', 'Qty')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {((activeShipment?.items as ShipmentItem[]) || []).map((shipmentItem: ShipmentItem, idx: number) => (
                            <tr className="hover:bg-muted/20" key={idx}>
                              <td className="px-4 py-2">
                                {!!shipmentItem.name ? <>{shipmentItem.name}</> : null}
                                {!shipmentItem.name ? (
                                  <>
                                    {!!getOrderItemForShipmentItem(shipmentItem) ? (
                                      <>
                                        {getOrderItemForShipmentItem(shipmentItem)?.name ||
                                          '-'}
                                      </>
                                    ) : null}
                                    {!getOrderItemForShipmentItem(shipmentItem) ? <>-</> : null}
                                  </>
                                ) : null}
                              </td>
                              <td className="px-4 py-2 text-muted-foreground">
                                {!!shipmentItem.sku ? <>{shipmentItem.sku}</> : null}
                                {!shipmentItem.sku ? (
                                  <>
                                    {!!getOrderItemForShipmentItem(shipmentItem) ? (
                                      <>
                                        {getOrderItemForShipmentItem(shipmentItem)?.product?.sku ||
                                          getOrderItemForShipmentItem(shipmentItem)?.sku ||
                                          '-'}
                                      </>
                                    ) : null}
                                    {!getOrderItemForShipmentItem(shipmentItem) ? <>-</> : null}
                                  </>
                                ) : null}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {shipmentItem.quantity || '-'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {(activeShipment?.items || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {getLabel(props.labels, 'noItems', 'No items in this shipment')}
                  </p>
                ) : null}
              </div>
              {(activeShipment?.trackAndTraces || []).length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold mb-2">
                    {getLabel(props.labels, 'trackAndTraceTitle', 'Track & Trace')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {((activeShipment?.trackAndTraces as TrackAndTrace[]) || []).map((tat: TrackAndTrace, tatIdx: number) =>
                        !!tat.carrier?.trackAndTraceURL ? (
                          <a
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
                            href={buildTrackAndTraceUrl(tat)}
                          >
                            <svg
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              className="h-4 w-4"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                              />
                            </svg>
                            {!!tat.carrier?.name ? (
                              <>
                                {getLabel(props.labels, 'trackAndTrace', 'Track & Trace')}-{tat.carrier?.name}
                              </>
                            ) : null}
                            {!tat.carrier?.name ? (
                              <>
                                {getLabel(props.labels, 'trackAndTrace', 'Track & Trace')}({tat.code})
                              </>
                            ) : null}
                          </a>
                        ) : null
                      )}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end px-6 py-4 border-t">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
                onClick={() => setActiveShipment(null)}
              >
                {getLabel(props.labels, 'close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default OrderShipments;
