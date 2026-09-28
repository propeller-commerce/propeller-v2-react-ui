import { describe, expect, it } from 'vitest';
import { PriceDisplay } from '@propeller-commerce/propeller-sdk-v2';
import { isPriceOnRequest } from '../priceOnRequest';

describe('isPriceOnRequest', () => {
  it('detects a product quoted on request', () => {
    expect(isPriceOnRequest({ priceData: { display: PriceDisplay.ON_REQUEST } })).toBe(true);
  });

  it('leaves an ordinary product alone', () => {
    expect(isPriceOnRequest({ priceData: { display: PriceDisplay.DEFAULT } })).toBe(false);
  });

  // FROM_FOR renders a struck-through suggested price; it is still a real price.
  it('does not treat other display modes as on-request', () => {
    expect(isPriceOnRequest({ priceData: { display: 'FROM_FOR' } })).toBe(false);
  });

  it('falls back to the default product for a cluster', () => {
    expect(
      isPriceOnRequest({ defaultProduct: { priceData: { display: PriceDisplay.ON_REQUEST } } })
    ).toBe(true);
  });

  it('prefers the product\u2019s own display over its default product', () => {
    expect(
      isPriceOnRequest({
        priceData: { display: PriceDisplay.DEFAULT },
        defaultProduct: { priceData: { display: PriceDisplay.ON_REQUEST } },
      })
    ).toBe(false);
  });

  it('treats missing price metadata as a normal price', () => {
    expect(isPriceOnRequest(null)).toBe(false);
    expect(isPriceOnRequest(undefined)).toBe(false);
    expect(isPriceOnRequest({})).toBe(false);
    expect(isPriceOnRequest({ priceData: null })).toBe(false);
  });
});
