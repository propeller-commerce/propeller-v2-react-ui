import { describe, expect, it } from 'vitest';
import { isCartNotFound } from '../cartInit';

describe('isCartNotFound', () => {
  it('matches the API error code', () => {
    expect(
      isCartNotFound({ errors: [{ extensions: { code: 'CART_NOT_FOUND_ERROR' }, message: 'nope' }] })
    ).toBe(true);
  });

  // The code is the contract; the message is the fallback for a response that
  // carries no extensions.
  it('matches the message when no code is present', () => {
    expect(
      isCartNotFound({ errors: [{ message: 'Cart: 01a10b51-2ece-7ed7-9367-cbdc2b97ba5f not found' }] })
    ).toBe(true);
  });

  it('ignores unrelated cart errors', () => {
    expect(
      isCartNotFound({ errors: [{ extensions: { code: 'CART_LOCKED_ERROR' }, message: 'Cart is locked' }] })
    ).toBe(false);
    expect(isCartNotFound({ errors: [{ message: 'Unauthorized use of companyIds' }] })).toBe(false);
  });

  it('ignores a product-not-found error', () => {
    expect(
      isCartNotFound({ errors: [{ extensions: { code: 'PRODUCT_NOT_FOUND_ERROR' }, message: 'Product: 417 not found' }] })
    ).toBe(false);
  });

  it('is safe on anything that is not a GraphQL error', () => {
    expect(isCartNotFound(new Error('network down'))).toBe(false);
    expect(isCartNotFound(undefined)).toBe(false);
    expect(isCartNotFound(null)).toBe(false);
    expect(isCartNotFound({ errors: 'not-an-array' })).toBe(false);
  });
});
