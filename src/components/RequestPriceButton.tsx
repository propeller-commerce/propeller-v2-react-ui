'use client';
/**
 * @rsc-blocked — Client-only component: takes click handlers.
 */
import * as React from 'react';
import { Tag } from 'lucide-react';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface RequestPriceButtonProps {
  /** Adds the product to the price-request list. */
  onRequestPrice?: () => void;
  /**
   * Sends an anonymous visitor to log in. A quote is addressed to someone, so
   * the list is only offered to signed-in shoppers.
   */
  onLoginClick?: () => void;
  /** True once the product is on the list. */
  added?: boolean;
  /** Whether a session exists. Anonymous visitors get the log-in action. */
  isAuthenticated?: boolean;
  /** Translated labels. Keys: `requestPrice`, `priceRequested`. */
  labels?: Record<string, string>;
  /** Extra classes appended to the button. */
  className?: string;
}

/**
 * "Request a price" — shown in place of add-to-cart when a product's price is
 * quoted rather than published.
 */
export function RequestPriceButton(props: RequestPriceButtonProps) {
  const anonymous = !props.isAuthenticated;
  const label = anonymous
    ? getLabel(props.labels, 'requestPrice', 'Request a price')
    : props.added
      ? getLabel(props.labels, 'priceRequested', 'On your request list')
      : getLabel(props.labels, 'requestPrice', 'Request a price');
  return (
    <button
      type="button"
      data-added={props.added ? 'true' : 'false'}
      className={cn(
        `propeller-request-price inline-flex items-center justify-center gap-2 h-10 px-4 w-full rounded-control text-sm font-medium transition-opacity hover:opacity-90 ${
          props.added && !anonymous
            ? 'bg-surface-hover text-foreground border border-border'
            : 'bg-primary text-primary-foreground'
        } ${props.className || ''}`
      )}
      onClick={() => {
        if (anonymous) {
          if (props.onLoginClick) props.onLoginClick();
          return;
        }
        if (props.onRequestPrice) props.onRequestPrice();
      }}
    >
      <Tag className="propeller-request-price__icon w-4 h-4" aria-hidden="true" />
      {label}
    </button>
  );
}

export default RequestPriceButton;
