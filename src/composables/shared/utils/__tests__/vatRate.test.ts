import { describe, expect, it } from 'vitest';
import { formatVatRate, vatRate } from '../vatRate';

describe('vatRate', () => {
  it('prefers the exact rate over the rounded one', () => {
    expect(vatRate({ taxPercentage: 8, taxPercentageDecimal: 8.1 })).toBe(8.1);
    expect(vatRate({ percentage: 8, percentageDecimal: 8.1 })).toBe(8.1);
  });

  // A rate under 1% rounds to 0; the "> 0" filters must still see it.
  it('keeps a sub-1% rate that rounds to 0', () => {
    expect(vatRate({ taxPercentage: 0, taxPercentageDecimal: 0.4 })).toBe(0.4);
  });

  it('falls back to the rounded rate on an SDK or API without the decimal', () => {
    expect(vatRate({ taxPercentage: 21 })).toBe(21);
    expect(vatRate({ percentage: 9, percentageDecimal: null })).toBe(9);
    expect(vatRate({})).toBe(0);
  });
});

describe('formatVatRate', () => {
  it('uses the storefront number format', () => {
    expect(formatVatRate(8.1, 'NL')).toBe('8,1');
    expect(formatVatRate(8.1, 'EN')).toBe('8.1');
    expect(formatVatRate(21, 'NL')).toBe('21');
  });
});
