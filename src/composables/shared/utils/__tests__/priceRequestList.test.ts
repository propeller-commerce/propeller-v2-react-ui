import { describe, expect, it } from 'vitest';
import {
  addItem,
  containsItem,
  parseStoredList,
  removeItem,
  setItemQuantity,
  type PriceRequestItem,
} from '../priceRequestList';

const item = (over: Partial<PriceRequestItem> = {}): PriceRequestItem => ({
  productId: 1,
  code: 'SKU-1',
  name: 'Product one',
  quantity: 1,
  minQuantity: 1,
  unit: 1,
  ...over,
});

describe('addItem', () => {
  it('adds a product to an empty list', () => {
    expect(addItem([], item())).toHaveLength(1);
  });

  // The plugin rejects a duplicate rather than incrementing it.
  it('ignores a code already on the list', () => {
    const list = addItem([], item());
    expect(addItem(list, item({ name: 'Renamed' }))).toBe(list);
  });

  it('raises a below-minimum quantity to the minimum', () => {
    const [added] = addItem([], item({ quantity: 1, minQuantity: 5 }));
    expect(added.quantity).toBe(5);
  });

  it('keeps a quantity above the minimum', () => {
    const [added] = addItem([], item({ quantity: 10, minQuantity: 5 }));
    expect(added.quantity).toBe(10);
  });
});

describe('removeItem', () => {
  it('drops the matching code and leaves the rest', () => {
    const list = [item(), item({ productId: 2, code: 'SKU-2' })];
    expect(removeItem(list, 'SKU-1')).toEqual([item({ productId: 2, code: 'SKU-2' })]);
  });

  it('is a no-op for a code that is not listed', () => {
    const list = [item()];
    expect(removeItem(list, 'NOPE')).toEqual(list);
  });
});

describe('setItemQuantity', () => {
  it('sets the quantity', () => {
    const list = [item({ minQuantity: 1 })];
    expect(setItemQuantity(list, 'SKU-1', 7)[0].quantity).toBe(7);
  });

  it('floors at the item minimum', () => {
    const list = [item({ minQuantity: 5, quantity: 5 })];
    expect(setItemQuantity(list, 'SKU-1', 2)[0].quantity).toBe(5);
  });
});

describe('containsItem', () => {
  it('matches by code', () => {
    expect(containsItem([item()], 'SKU-1')).toBe(true);
    expect(containsItem([item()], 'SKU-2')).toBe(false);
  });
});

describe('parseStoredList', () => {
  it('round-trips a stored list', () => {
    expect(parseStoredList(JSON.stringify([item()]))).toHaveLength(1);
  });

  // Storage can hold anything; a bad read must not break the page.
  it('returns an empty list for absent or corrupt storage', () => {
    expect(parseStoredList(null)).toEqual([]);
    expect(parseStoredList('')).toEqual([]);
    expect(parseStoredList('not json')).toEqual([]);
    expect(parseStoredList('{"not":"an array"}')).toEqual([]);
  });

  it('drops entries missing an identity', () => {
    expect(parseStoredList(JSON.stringify([item(), { name: 'junk' }, null]))).toHaveLength(1);
  });
});
