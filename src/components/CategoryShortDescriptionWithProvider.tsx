'use client';
/**
 * Client wrapper around the pure `CategoryShortDescription` component.
 * Resolves `language` from `<PropellerProvider>` when the caller doesn't
 * pass it explicitly. The pure version stays exported from `/pure` for RSC
 * use.
 */
import * as React from 'react';
import CategoryShortDescription, { type CategoryShortDescriptionProps } from './CategoryShortDescription';
import { useInfraProps } from '../composables/react/useInfraProps';

function CategoryShortDescriptionWithProvider(rawProps: CategoryShortDescriptionProps) {
  const props = useInfraProps(rawProps);
  return <CategoryShortDescription {...props} />;
}

export default CategoryShortDescriptionWithProvider;
export type { CategoryShortDescriptionProps };
