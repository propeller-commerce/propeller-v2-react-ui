'use client';
/**
 * Client wrapper around the pure `GridTitle` component. Resolves `language`
 * from `<PropellerProvider>` when the caller doesn't pass it explicitly. The
 * pure version stays exported from `/pure` for RSC use.
 */
import * as React from 'react';
import GridTitle, { type GridTitleProps } from './GridTitle';
import { useInfraProps } from '../composables/react/useInfraProps';

function GridTitleWithProvider(rawProps: GridTitleProps) {
  const props = useInfraProps(rawProps);
  return <GridTitle {...props} />;
}

export default GridTitleWithProvider;
export type { GridTitleProps };
