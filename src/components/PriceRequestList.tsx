'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState).
 */
import * as React from 'react';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';
import type { PriceRequestItem } from '../composables/shared/utils/priceRequestList';

export interface PriceRequestListProps {
  /** The collected products. Pass `items` from `usePriceRequest`. */
  items: PriceRequestItem[];
  /** Drops a product from the list. */
  onRemove?: (code: string) => void;
  /** Changes a requested quantity. */
  onQuantityChange?: (code: string, quantity: number) => void;
  /** Sends the request. Resolves true on success. */
  onSubmit?: (comment: string) => Promise<boolean> | boolean;
  /** True while the request is in flight. */
  submitting?: boolean;
  /**
   * Override any UI string. Keys: `title`, `colCode`, `colName`, `colQuantity`,
   * `comments`, `send`, `sending`, `empty`, `remove`, `sent`.
   */
  labels?: Record<string, string>;
  /** Extra CSS class applied to the root element. */
  className?: string;
}

/**
 * The price-request list: products awaiting a quote, with quantities and one
 * comment, submitted together.
 */
export function PriceRequestList(props: PriceRequestListProps) {
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const L = (key: string, fallback: string) => getLabel(props.labels, key, fallback);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!props.onSubmit) return;
    const ok = await props.onSubmit(comment);
    if (ok) {
      setComment('');
      setSent(true);
    }
  }

  if (sent) {
    return (
      <div className={cn(`propeller-price-request ${props.className || ''}`)}>
        <p className="propeller-price-request__sent py-8 text-center text-foreground">
          {L('sent', 'Price request sent. We will contact you.')}
        </p>
      </div>
    );
  }

  if (!props.items.length) {
    return (
      <div className={cn(`propeller-price-request ${props.className || ''}`)}>
        <p className="propeller-price-request__empty py-8 text-center text-foreground-subtle">
          {L('empty', 'Your price request list is empty.')}
        </p>
      </div>
    );
  }

  return (
    <form
      className={cn(`propeller-price-request ${props.className || ''}`)}
      onSubmit={handleSubmit}
    >
      <h2 className="propeller-price-request__title mb-4 text-xl font-semibold text-foreground">
        {L('title', 'Price request')}
      </h2>

      <table className="propeller-price-request__table w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-foreground-subtle">
            <th scope="col" className="py-2 pr-4 font-medium">{L('colCode', 'Article no. / SKU')}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{L('colName', 'Product name')}</th>
            <th scope="col" className="py-2 pr-4 font-medium">{L('colQuantity', 'Quantity')}</th>
            <th scope="col" className="py-2 w-10"><span className="sr-only">{L('remove', 'Remove')}</span></th>
          </tr>
        </thead>
        <tbody>
          {props.items.map((item) => (
            <tr key={item.code} className="border-b border-border-subtle">
              <td className="py-2 pr-4 font-mono text-xs text-foreground">{item.code}</td>
              <td className="py-2 pr-4 text-foreground">{item.name}</td>
              <td className="py-2 pr-4">
                <label className="sr-only" htmlFor={`pr-qty-${item.code}`}>
                  {L('colQuantity', 'Quantity')}
                </label>
                <input
                  id={`pr-qty-${item.code}`}
                  type="number"
                  min={item.minQuantity}
                  step={item.unit || 1}
                  value={item.quantity}
                  onChange={(e) =>
                    props.onQuantityChange?.(item.code, parseInt(e.target.value, 10) || item.minQuantity)
                  }
                  className="w-20 rounded border border-border bg-background px-2 py-1"
                />
              </td>
              <td className="py-2">
                <button
                  type="button"
                  onClick={() => props.onRemove?.(item.code)}
                  aria-label={L('remove', 'Remove')}
                  title={L('remove', 'Remove')}
                  className="text-foreground-subtle transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="propeller-price-request__comment mt-6">
        <label
          htmlFor="propeller-price-request-comment"
          className="mb-2 block font-medium text-foreground"
        >
          {L('comments', 'Comments')}
        </label>
        <textarea
          id="propeller-price-request-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full rounded border border-border bg-background px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={props.submitting}
        className="propeller-price-request__submit mt-4 rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {props.submitting ? L('sending', 'Sending…') : L('send', 'Send request')}
      </button>
    </form>
  );
}

export default PriceRequestList;
