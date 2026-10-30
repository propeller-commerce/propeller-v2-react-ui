/**
 * PriceRequestList — the anti-spam honeypot field.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import PriceRequestList from '../PriceRequestList';

const items = [{ productId: 1, code: 'SKU-1', name: 'Widget', quantity: 1, minQuantity: 1, unit: 1 }];

function honeypotInput(html: string): string {
  const m = html.match(/<input[^>]*name="website"[^>]*>/);
  expect(m).not.toBeNull();
  return m![0];
}

describe('PriceRequestList — honeypot', () => {
  it('renders an off-screen, unfocusable website input', () => {
    const html = renderToString(<PriceRequestList items={items} />);
    expect(html).toContain('propeller-price-request__honeypot');
    const input = honeypotInput(html);
    expect(input).toContain('tabindex="-1"');
    expect(input).toMatch(/autocomplete="off"/i);
    expect(input).toContain('aria-hidden="true"');
    expect(input).toContain('id="propeller-price-request-website"');
    expect(html).toMatch(/class="propeller-price-request__honeypot"[^>]*style="[^"]*position:absolute[^"]*left:-10000px/);
    expect(html).not.toMatch(/class="propeller-price-request__honeypot[^"]*hidden/);
  });

  it('labels the field, with a default and an override', () => {
    expect(renderToString(<PriceRequestList items={items} />)).toMatch(
      /<label[^>]*for="propeller-price-request-website"[^>]*>Leave this field empty<\/label>/
    );
    expect(
      renderToString(<PriceRequestList items={items} labels={{ honeypotLabel: 'Laat leeg' }} />)
    ).toContain('>Laat leeg</label>');
  });

  it('is not rendered for an empty list', () => {
    expect(renderToString(<PriceRequestList items={[]} />)).not.toContain('name="website"');
  });
});
