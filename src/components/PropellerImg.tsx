/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 */
import * as React from 'react';
import type { ImgComponentProps } from '@propeller-commerce/propeller-v2-core-ui';

export interface PropellerImgProps extends ImgComponentProps {
  /** The host's image component. RSC-safe callers pass it; others use `useImgComponent()`. */
  as?: React.ComponentType<ImgComponentProps>;
}

/** The package's single `<img>` site. Falls back to `<img>` when nothing is injected. */
export function PropellerImg({ as: Injected, ...props }: PropellerImgProps): React.JSX.Element {
  if (Injected) return <Injected {...props} />;
  const { src, alt, className, width, height, loading, onClick } = props;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={loading}
      onClick={onClick as React.MouseEventHandler<HTMLImageElement> | undefined}
    />
  );
}

export default PropellerImg;
