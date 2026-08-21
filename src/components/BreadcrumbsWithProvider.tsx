'use client';
/**
 * Client wrapper around the pure `Breadcrumbs` component. Resolves
 * `language` and `configuration` from `<PropellerProvider>` when the caller
 * doesn't pass them explicitly, then forwards every prop to the pure
 * component. The pure version stays exported from `/pure` for RSC use,
 * where explicit props are required and the provider isn't reachable.
 */
import * as React from 'react';
import Breadcrumbs, { type BreadcrumbsProps } from './Breadcrumbs';
import { useInfraProps } from '../composables/react/useInfraProps';

function BreadcrumbsWithProvider(rawProps: BreadcrumbsProps) {
  const props = useInfraProps(rawProps);
  return <Breadcrumbs {...props} />;
}

export default BreadcrumbsWithProvider;
export type { BreadcrumbsProps };
