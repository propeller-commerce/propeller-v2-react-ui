'use client';
/**
 * Client wrapper around the pure `ProductShortDescription` component.
 * Resolves `language` from `<PropellerProvider>` when the caller doesn't
 * pass it explicitly. The pure version stays exported from `/pure` for RSC
 * use.
 */
import * as React from 'react';
import ProductShortDescription, { type ProductShortDescriptionProps } from './ProductShortDescription';
import { useInfraProps } from '../composables/react/useInfraProps';

function ProductShortDescriptionWithProvider(rawProps: ProductShortDescriptionProps) {
  const props = useInfraProps(rawProps);
  return <ProductShortDescription {...props} />;
}

export default ProductShortDescriptionWithProvider;
export type { ProductShortDescriptionProps };
