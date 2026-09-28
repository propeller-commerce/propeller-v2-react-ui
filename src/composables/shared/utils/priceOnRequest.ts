/**
 * Does this product carry a price the shopper cannot see?
 *
 * `priceData.display === 'ON_REQUEST'` means the catalogue holds no price the
 * customer may be quoted: `price.gross`/`price.net` are still populated, almost
 * always with 0, so anything that renders them unguarded shows "€ 0,00" next to
 * a working add-to-cart button.
 *
 * Kept separate from the components because both packages test pure logic in
 * `node` and cannot mount an SFC.
 */
import { PriceDisplay } from '@propeller-commerce/propeller-sdk-v2';

/** A product-ish record carrying the price metadata this reads. */
export interface PriceOnRequestInput {
  priceData?: { display?: PriceDisplay | string | null } | null;
  defaultProduct?: PriceOnRequestInput | null;
}

/**
 * Clusters answer for their default product: the card shows that product's
 * price, so it is that product's display mode that decides.
 */
export function isPriceOnRequest(product: PriceOnRequestInput | null | undefined): boolean {
  if (!product) return false;
  const display = product.priceData?.display ?? product.defaultProduct?.priceData?.display;
  return display === PriceDisplay.ON_REQUEST;
}
