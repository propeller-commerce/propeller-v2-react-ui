'use client';
/**
 * Client wrapper around the pure `ProductBulkPrices` component. Resolves
 * `includeTax`, `user`, `portalMode`, and `currency` from
 * `<PropellerProvider>` when the caller doesn't pass them explicitly. The
 * pure version stays exported from `/pure` for RSC use.
 */
import * as React from 'react';
import ProductBulkPrices, { type ProductBulkPricesProps } from './ProductBulkPrices';
import { useInfraProps } from '../composables/react/useInfraProps';

function ProductBulkPricesWithProvider(rawProps: ProductBulkPricesProps) {
  const props = useInfraProps(rawProps);
  return <ProductBulkPrices {...props} />;
}

export default ProductBulkPricesWithProvider;
export type { ProductBulkPricesProps };
