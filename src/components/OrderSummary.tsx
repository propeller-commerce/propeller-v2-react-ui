/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import { getLabel, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import { getCountryName as _getCountryName } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';

export interface OrderSummaryProps {
  /**
   * Storefront language ('EN', 'NL', …). Decides the number format prices are
   * rendered in — without it they fall back to Dutch separators regardless of
   * the language the shopper is reading.
   */
  language?: string;

  /** The order object from propeller-sdk-v2 */
  order: any;

  /** The CSS class for the order summary container */
  orderSummaryContainerClass?: string;

  /** Title of the order summary */
  title?: string;

  /** Show the order number */
  showOrderNumber?: boolean;

  /** Show the order date */
  showOrderDate?: boolean;

  /** Show the order status */
  showOrderStatus?: boolean;

  /** Show the order total */
  showOrderTotal?: boolean;

  /** Custom price formatting function */
  formatPrice?: (price: number) => string;

  /** Show the invoice address */
  showInvoiceAddress?: boolean;

  /** Show the delivery address */
  showDeliveryAddress?: boolean;

  /** Show payment, carrier, and delivery date info */
  showDeliveryInfo?: boolean;

  /** Show order remarks and reference */
  showRemarks?: boolean;

  /** Custom date formatting function */
  formatDate?: (dateString: string) => string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /**
   * Localized order/quote status labels, keyed by the raw backend status
   * (e.g. `{ NEW: 'Nieuw', REQUEST: 'Aangevraagd' }`). Unknown → raw value.
   */
  statusLabels?: Record<string, string>;

  /**
   * Localized payment-method names, keyed by the raw method value LOWER-CASED
   * (e.g. `{ rekening: 'Op rekening', account: 'Op rekening' }`). The backend
   * sends different raw values on the order vs quote path (REKENING / ACCOUNT),
   * so mapping both here makes the same method render identically. Unknown →
   * raw value.
   */
  paymethodLabels?: Record<string, string>;

  /** List of countries for resolving codes to names [{code: 'NL', name: 'Netherlands'}, ...] */
  countries?: {
    code: string;
    name: string;
  }[];

  /** Currency symbol used by the default formatter. Default: `'€'`. */
  currency?: string;
}

/**
 * Renders a read-only summary of an order: meta fields (number, date, status,
 * total), invoice/delivery addresses, delivery info and remarks.
 */
function OrderSummary(props: OrderSummaryProps) {
  const order = props.order;

  const containerClass = props.orderSummaryContainerClass || 'order-summary';
  const showOrderNumber = props.showOrderNumber !== undefined ? props.showOrderNumber : true;
  const showOrderDate = props.showOrderDate !== undefined ? props.showOrderDate : true;
  const showOrderStatus = props.showOrderStatus !== undefined ? props.showOrderStatus : true;
  const showInvoiceAddress =
    props.showInvoiceAddress !== undefined ? props.showInvoiceAddress : true;
  const showDeliveryAddress =
    props.showDeliveryAddress !== undefined ? props.showDeliveryAddress : true;
  const showOrderTotal = props.showOrderTotal !== undefined ? props.showOrderTotal : true;
  const showDeliveryInfo = props.showDeliveryInfo !== undefined ? props.showDeliveryInfo : true;
  const showRemarks = props.showRemarks !== undefined ? props.showRemarks : true;

  // Order field accessors — computed once per render (previously each was a
  // function redefined every render; addresses.find() ran on every JSX read).
  const orderNumber = order?.id || '';
  const orderDate = order?.createdAt || '';
  const rawStatus = order?.status || '';
  // Map raw backend enums to localized labels; unknown → raw value. Was printing
  // the raw enum (NEW / REQUEST / REKENING / ACCOUNT) straight to the customer.
  const orderStatus = rawStatus ? (props.statusLabels?.[rawStatus] || rawStatus) : '';
  const orderTotal = Number(order?.total?.net || 0);
  const orderReference = order?.reference || '';
  const orderRemarks = order?.remarks || '';
  const rawPaymentMethod = order?.paymentData?.method || '';
  const paymentMethod = rawPaymentMethod
    ? (props.paymethodLabels?.[rawPaymentMethod.toLowerCase()] || rawPaymentMethod)
    : '';
  const carrierName = order?.postageData?.carrier || '';
  const addresses = order?.addresses || [];
  const invoiceAddress = addresses.find((a: any) => a.type === 'invoice') || null;
  const deliveryAddress = addresses.find((a: any) => a.type === 'delivery') || null;

  function formatItemPrice(price: number): string {
    if (props.formatPrice) {
      return props.formatPrice(price);
    }
    return formatPrice(price || 0, { symbol: props.currency ?? '€', locale: localeForLanguage(props.language) });
  }

  // Numeric day-first DD-MM-YYYY. Was hardcoded en-US (M/D/YYYY), which NL
  // readers misparse by months. Locale-neutral order; override via `formatDate`.
  function numericDate(dateString: string): string {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${d.getFullYear()}`;
  }

  function formatOrderDate(dateString: string): string {
    if (props.formatDate) {
      return props.formatDate(dateString);
    }
    return numericDate(dateString);
  }

  const requestDateRaw = order?.postageData?.requestDate;
  let requestDate = '';
  if (requestDateRaw) {
    if (props.formatDate) {
      requestDate = props.formatDate(requestDateRaw);
    } else {
      requestDate = numericDate(requestDateRaw);
    }
  }

  const getCountryName = (code: string): string => _getCountryName(code, props.countries);

  return (
    <div className={`propeller-order-summary ${containerClass}`}>
      {props.title ? (
        <h2 className="propeller-order-summary__title text-xl font-bold mb-4">{props.title}</h2>
      ) : null}
      <div className="propeller-order-summary__meta grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-5 border-b border-border mb-5">
        {showOrderNumber && orderNumber ? (
          <div className="propeller-order-summary__meta-item" data-meta="order-number">
            <p className="propeller-order-summary__meta-label text-sm text-muted-foreground mb-1">
              {getLabel(props.labels, 'orderNumber', 'Order Number')}
            </p>
            <p className="propeller-order-summary__meta-value font-semibold">{orderNumber}</p>
          </div>
        ) : null}
        {showOrderDate && orderDate ? (
          <div className="propeller-order-summary__meta-item" data-meta="order-date">
            <p className="propeller-order-summary__meta-label text-sm text-muted-foreground mb-1">
              {getLabel(props.labels, 'orderDate', 'Order Date')}
            </p>
            <p className="propeller-order-summary__meta-value font-semibold">
              {formatOrderDate(orderDate)}
            </p>
          </div>
        ) : null}
        {showOrderStatus && orderStatus ? (
          <div className="propeller-order-summary__meta-item" data-meta="status">
            <p className="propeller-order-summary__meta-label text-sm text-muted-foreground mb-1">
              {getLabel(props.labels, 'status', 'Status')}
            </p>
            <span className="propeller-order-summary__status inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
              {orderStatus}
            </span>
          </div>
        ) : null}
        {showOrderTotal ? (
          <div className="propeller-order-summary__meta-item" data-meta="total">
            <p className="propeller-order-summary__meta-label text-sm text-muted-foreground mb-1">
              {getLabel(props.labels, 'total', 'Total')}
            </p>
            <p className="propeller-order-summary__total font-bold text-lg">
              {formatItemPrice(orderTotal)}
            </p>
          </div>
        ) : null}
      </div>
      <div className="propeller-order-summary__addresses grid grid-cols-1 md:grid-cols-2 gap-6 pb-5">
        {showInvoiceAddress ? (
          <div className="propeller-order-summary__address space-y-2" data-address="invoice">
            <h3 className="propeller-order-summary__address-title text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {getLabel(props.labels, 'invoiceAddress', 'Invoice Address')}
            </h3>
            {invoiceAddress && invoiceAddress.street ? (
              <div className="text-sm space-y-1">
                {invoiceAddress.company ? (
                  <p className="font-medium">{invoiceAddress.company}</p>
                ) : null}
                <p>
                  {[invoiceAddress.firstName, invoiceAddress.middleName, invoiceAddress.lastName]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                <p>
                  {[invoiceAddress.street, invoiceAddress.number, invoiceAddress.numberExtension]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                <p>{[invoiceAddress.postalCode, invoiceAddress.city].filter(Boolean).join(' ')}</p>
                {invoiceAddress.country ? <p>{getCountryName(invoiceAddress.country)}</p> : null}
                {invoiceAddress.email ? (
                  <p className="propeller-order-summary__address-email text-muted-foreground">
                    {invoiceAddress.email}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {showDeliveryAddress ? (
          <div className="propeller-order-summary__address space-y-2" data-address="delivery">
            <h3 className="propeller-order-summary__address-title text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {getLabel(props.labels, 'deliveryAddress', 'Delivery Address')}
            </h3>
            {deliveryAddress && deliveryAddress.street ? (
              <div className="text-sm space-y-1">
                {deliveryAddress.company ? (
                  <p className="font-medium">{deliveryAddress.company}</p>
                ) : null}
                <p>
                  {[deliveryAddress.firstName, deliveryAddress.middleName, deliveryAddress.lastName]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                <p>
                  {[deliveryAddress.street, deliveryAddress.number, deliveryAddress.numberExtension]
                    .filter(Boolean)
                    .join(' ')}
                </p>
                <p>{[deliveryAddress.postalCode, deliveryAddress.city].filter(Boolean).join(' ')}</p>
                {deliveryAddress.country ? <p>{getCountryName(deliveryAddress.country)}</p> : null}
                {deliveryAddress.email ? (
                  <p className="propeller-order-summary__address-email text-muted-foreground">
                    {deliveryAddress.email}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {showDeliveryInfo && (paymentMethod || carrierName || requestDate) ? (
        <div className="propeller-order-summary__info-panel bg-surface-hover p-4 rounded-control border border-border space-y-2 text-sm">
          {paymentMethod ? (
            <div className="flex justify-between">
              <span className="font-medium">{getLabel(props.labels, 'payment', 'Payment:')}</span>
              <span>{paymentMethod}</span>
            </div>
          ) : null}
          {carrierName ? (
            <div className="flex justify-between">
              <span className="font-medium">{getLabel(props.labels, 'carrier', 'Carrier:')}</span>
              <span>{carrierName}</span>
            </div>
          ) : null}
          {requestDate ? (
            <div className="flex justify-between">
              <span className="font-medium">
                {getLabel(props.labels, 'deliveryDate', 'Delivery Date:')}
              </span>
              <span>{requestDate}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {showRemarks && (orderReference || orderRemarks) ? (
        <div className="propeller-order-summary__remarks-panel bg-surface-hover p-4 rounded-control border border-border space-y-2 text-sm mt-4">
          {orderReference ? (
            <div className="flex justify-between">
              <span className="font-medium">
                {getLabel(props.labels, 'reference', 'Reference:')}
              </span>
              <span>{orderReference}</span>
            </div>
          ) : null}
          {orderRemarks ? (
            <div className="flex justify-between">
              <span className="font-medium">{getLabel(props.labels, 'remarks', 'Remarks:')}</span>
              <span>{orderRemarks}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default OrderSummary;
