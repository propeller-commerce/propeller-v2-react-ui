import { describe, expect, it } from 'vitest';

/**
 * The quantity grid: a product is orderable at `min`, `min + step`,
 * `min + 2*step`, … This is the rule AddToCart and QuickOrder both snap to;
 * it is duplicated in each because one is a component-local helper and the
 * other a module function, so the behaviour is pinned here.
 */
function snapToStep(value: number, min: number, step: number): number {
  if (!Number.isFinite(value) || value <= min) return min;
  return Math.round((value - min) / (step || 1)) * (step || 1) + min;
}

describe('snapToStep', () => {
  it('floors at the minimum', () => {
    expect(snapToStep(1, 2, 1)).toBe(2);
    expect(snapToStep(0, 5, 5)).toBe(5);
    expect(snapToStep(-3, 1, 1)).toBe(1);
  });

  // min 2, step 6 -> 2, 8, 14, 20
  it('lands on the min + n*step grid', () => {
    expect(snapToStep(8, 2, 6)).toBe(8);
    expect(snapToStep(14, 2, 6)).toBe(14);
  });

  it('rounds to the nearest grid point, not down', () => {
    expect(snapToStep(6, 2, 6)).toBe(8); // 6 is nearer 8 than 2
    expect(snapToStep(4, 2, 6)).toBe(2); // 4 is nearer 2 than 8
  });

  it('is a no-op for step 1', () => {
    expect(snapToStep(7, 1, 1)).toBe(7);
  });

  // A zero or absent step must not divide by zero.
  it('treats a zero step as 1', () => {
    expect(snapToStep(7, 1, 0)).toBe(7);
  });

  // The field can be cleared while typing; NaN must resolve to the minimum
  // rather than propagate.
  it('resolves a non-number to the minimum', () => {
    expect(snapToStep(NaN, 3, 2)).toBe(3);
    expect(snapToStep(Infinity, 3, 2)).toBe(3);
  });
});
