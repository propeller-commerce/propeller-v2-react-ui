/**
 * The VAT rate a tax line shows (PWP-1065).
 *
 * The API's `taxPercentage` / `percentage` is a rounded Int, so the Swiss 8.1%
 * arrived as 8 and a rate under 1% as 0, which the "> 0" filters then dropped.
 * SDK 0.19.0 adds the exact `*Decimal` Float next to it. The rounded field is
 * the fallback for an older SDK or API (the SDK peer is `*`).
 *
 * Kept separate from the components because both packages test pure logic in
 * `node` and cannot mount an SFC.
 */
import { localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';

/** A cart tax level (`taxPercentage*`) or an order tax total (`percentage*`). */
export interface VatRateFields {
  taxPercentage?: number | null;
  taxPercentageDecimal?: number | null;
  percentage?: number | null;
  percentageDecimal?: number | null;
}

/** The exact rate (8.1); the rounded one (8) when no decimal is present. */
export function vatRate(t: VatRateFields): number {
  return t.taxPercentageDecimal ?? t.percentageDecimal ?? t.taxPercentage ?? t.percentage ?? 0;
}

/** The rate in the storefront's number format: 8,1 in NL, 8.1 in EN. */
export function formatVatRate(rate: number, language?: string | null): string {
  return rate.toLocaleString(localeForLanguage(language));
}
