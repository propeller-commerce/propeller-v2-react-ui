/**
 * OrderTotals must not count shipping in the subtotal: `total.gross` already
 * includes it, so a subtotal of `total.gross` listed shipping twice.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { Order } from '@propeller-commerce/propeller-sdk-v2';
import OrderTotals from '../OrderTotals';

const row = (html: string, name: string) =>
  html.match(new RegExp(`data-row="${name}"[^]*?propeller-order-totals__value">([^<]*)<`))?.[1];

const render = (order: unknown) =>
  renderToString(<OrderTotals order={order as Order} language="EN" formatPrice={String} />);

describe('OrderTotals', () => {
  it('shows the lines as the subtotal, without the shipping costs', () => {
    const html = render({
      total: { gross: 800.58, net: 968.7, tax: 168.12, discountType: 'N', discountValue: 0, taxPercentages: [] },
      postageData: { gross: 24.79 },
      paymentData: { gross: 0 },
    });
    expect(row(html, 'subtotal')).toBe('775.79');
    expect(row(html, 'shipping-costs')).toBe('24.79');
    expect(row(html, 'total-excl-vat')).toBe('800.58');
  });

  it('shows the subtotal after an amount discount without the costs', () => {
    const html = render({
      total: { gross: 56.575, net: 68.46, tax: 11.88, discountType: 'A', discountValue: 4, taxPercentages: [] },
      postageData: { gross: 10 },
      paymentData: { gross: 25 },
    });
    expect(row(html, 'subtotal')).toBe('25.575');
    expect(row(html, 'subtotal-with-discount')).toBe('21.575');
  });
});
