'use client';
/**
 * Client wrapper around the pure `ProductPrice` component. Resolves
 * `includeTax`, `user`, `portalMode`, and `currency` from
 * `<PropellerProvider>` when the caller doesn't pass them explicitly. The
 * pure version stays exported from `/pure` for RSC use.
 */
import * as React from 'react';
import ProductPrice, { type ProductPriceProps } from './ProductPrice';
import { useInfraProps } from '../composables/react/useInfraProps';

function ProductPriceWithProvider(rawProps: ProductPriceProps) {
  const props = useInfraProps(rawProps);
  return <ProductPrice {...props} />;
}

export default ProductPriceWithProvider;
export type { ProductPriceProps };
