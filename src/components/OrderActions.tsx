'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import {
  GraphQLClient,
  Order,
  Cart,
  Contact,
  Customer,
  MediaImageProductSearchInput,
  TransformationsInput,
  Company,
} from '@propeller-commerce/propeller-sdk-v2';
import { useOrders } from '../composables/react/useOrders';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface OrderActionsProps {
  /** GraphQL client for the Propeller SDK. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;
  /** The order to act upon */
  order: Order;
  /** The authenticated user. Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer | null;
  /** Cart ID — if provided, re-order adds items to this cart */
  cartId?: string;
  /** Active company ID from the company switcher */
  companyId?: number;
  /** Configuration object (imageSearchFiltersGrid, imageVariantFiltersSmall, etc.) */
  configuration?: any;
  /** Label overrides for UI strings */
  labels?: Record<string, string>;
  /** Additional CSS class for the root element */
  className?: string;
  /** Callback when a new cart is created during re-order */
  onCartCreated?: (cart: Cart) => void;
  /** Callback fired after all re-order items have been added */
  afterReorder?: (cart: Cart) => void;
}
/** GraphQL query variables used internally when re-loading a cart during re-order. */
export interface CartQueryVariables {
  /** ID of the cart to query. */
  cartId: string;
  /** Language code for localised product fields. */
  language: string;
  /** Image search filters applied to product media in results. */
  imageSearchFilters: MediaImageProductSearchInput;
  /** Image transformation filters applied to returned product images. */
  imageVariantFilters: TransformationsInput;
}

/**
 * Renders the per-order action buttons (download confirmation PDF, re-order)
 * with an inline toast for success/error feedback.
 *
 * @remarks Uses {@link useOrders} for PDF download and re-order operations.
 */
function OrderActions(rawProps: OrderActionsProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const [reordering, setReordering] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const { downloadPdf, reorder } = useOrders({
    graphqlClient: props.graphqlClient!,
    user: props.user as any,
    companyId: props.companyId,
    configuration: props.configuration,
    onCartCreated: props.onCartCreated,
    afterReorder: props.afterReorder,
  });

  function showToast(message: string, type: string) {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 3000);
  }

  function dismissToast() {
    setToastVisible(false);
  }

  

  async function handleDownloadPDF() {
    if (!props.order?.id) return;
    setDownloading(true);
    try {
      const result = await downloadPdf(props.order);
      if (result.success) {
        showToast(getLabel(props.labels, 'pdfSuccess', 'PDF downloaded successfully'), 'success');
      } else {
        showToast(getLabel(props.labels, 'pdfError', 'Failed to download PDF'), 'error');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showToast(getLabel(props.labels, 'pdfError', 'Failed to download PDF'), 'error');
    } finally {
      setDownloading(false);
    }
  }

  async function handleReorder() {
    if (!props.order?.items) return;
    setReordering(true);
    try {
      const result = await reorder(props.order, props.cartId);
      if (result.success) {
        showToast(getLabel(props.labels, 'reorderSuccess', 'All items added to cart'), 'success');
      } else {
        showToast(getLabel(props.labels, 'reorderError', 'Failed to add items to cart'), 'error');
      }
    } catch (error) {
      console.error('Error during re-order:', error);
      showToast(getLabel(props.labels, 'reorderError', 'Failed to add items to cart'), 'error');
    } finally {
      setReordering(false);
    }
  }

  return (
    // `flex-shrink-0` on the wrapper so OrderActions keeps its natural width
    // when it sits next to OrderTotals in a flex row — otherwise the parent's
    // shrink behaviour squeezes the buttons until the labels wrap mid-word
    // (the bug screenshot showed "Order / confirmation / (PDF)" on three lines).
    // `whitespace-nowrap` on the buttons is the belt-and-braces guarantee that
    // text never wraps even in narrow containers without flex sizing.
    <div className={cn(`propeller-order-actions flex-shrink-0 ${props.className || ''}`)}>
      <div className="propeller-order-actions__actions flex flex-row items-center gap-3 flex-shrink-0">
        <button
          type="button"
          className="propeller-order-actions__pdf-btn text-primary hover:text-primary/80 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          onClick={(event) => handleDownloadPDF()}
          disabled={downloading}
        >
          {downloading ? <>{getLabel(props.labels, 'downloadingPdf', 'Downloading...')}</> : null}
          {!downloading ? <>{getLabel(props.labels, 'downloadPdf', 'Order confirmation (PDF)')}</> : null}
        </button>
        <button
          type="button"
          className="propeller-order-actions__reorder-btn text-primary hover:text-primary/80 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          onClick={(event) => handleReorder()}
          disabled={reordering}
        >
          {reordering ? <>{getLabel(props.labels, 'reordering', 'Adding items...')}</> : null}
          {!reordering ? <>{getLabel(props.labels, 'reorder', 'Order again')}</> : null}
        </button>
      </div>
      {toastVisible ? (
        <div
          className={`propeller-order-actions__toast fixed top-4 right-4 z-50 flex items-start gap-3 w-80 rounded-container shadow-lg p-4 ${toastType === 'success' ? 'bg-success border border-success text-success-foreground' : 'bg-destructive border border-destructive text-destructive-foreground'}`}
          data-toast-type={toastType}
        >
          <div
            className={`propeller-order-actions__toast-icon flex-shrink-0 w-5 h-5 mt-0.5 ${toastType === 'success' ? 'text-success-foreground' : 'text-destructive-foreground'}`}
          >
            {toastType === 'success' ? (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : null}
            {toastType === 'error' ? (
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            ) : null}
          </div>
          <p
            className={`propeller-order-actions__toast-message flex-1 text-sm font-medium ${toastType === 'success' ? 'text-success-foreground' : 'text-destructive-foreground'}`}
          >
            {toastMessage}
          </p>
          <button
            type="button"
            onClick={(event) => dismissToast()}
            className={`propeller-order-actions__toast-close flex-shrink-0 rounded focus:outline-none ${toastType === 'success' ? 'text-success-foreground hover:text-success-foreground/80' : 'text-destructive-foreground hover:text-destructive-foreground/80'}`}
          >
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-4 w-4"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default OrderActions;
