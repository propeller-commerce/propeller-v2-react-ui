/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import {
  PaginatedMediaVideoResponse,
  MediaVideo,
  LocalizedVideo,
  LocalizedString,
} from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface ProductVideosProps {
  /**
   * Media videos for the product.
   * Obtain from `product.media.videos`.
   */
  videos: PaginatedMediaVideoResponse;

  /**
   * Language code used to resolve the correct localised video URI.
   */
  language: string;

  /**
   * Override any UI string.
   * Available keys: title, empty
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
/**
 * Renders a product's media videos, embedding YouTube/Vimeo URLs in an iframe
 * and other URLs in a native `<video>` player.
 */
function ProductVideos(props: ProductVideosProps) {
  const items: MediaVideo[] = props.videos?.items || [];
  const hasItems = items.length > 0;
  const lang = props.language || 'NL';
  function getVideoUri(video: MediaVideo): string {
    const vids = video.videos || [];
    const match = vids.find((v: LocalizedVideo) => v.language === lang);
    return match?.uri || vids?.[0]?.uri || '';
  }
  function getVideoTitle(video: MediaVideo): string {
    const alts = video.alt || [];
    const match = alts.find((a: LocalizedString) => a.language === lang);
    return match?.value || alts?.[0]?.value || 'Video';
  }
  function isEmbeddable(uri: string): boolean {
    return uri.includes('youtube.com') || uri.includes('youtu.be') || uri.includes('vimeo.com');
  }
  function getEmbedUrl(uri: string): string {
    // Already an embed URL — return as-is
    if (uri.includes('youtube.com/embed/') || uri.includes('player.vimeo.com/video/')) {
      return uri;
    }
    // YouTube watch URL → embed URL
    if (uri.includes('youtube.com/watch')) {
      const url = new URL(uri);
      const videoId = url.searchParams.get('v') || '';
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // YouTube short URL
    if (uri.includes('youtu.be/')) {
      const videoId = uri.split('youtu.be/')[1]?.split('?')[0] || '';
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // Vimeo standard URL (https://vimeo.com/ID or https://vimeo.com/ID/HASH)
    if (uri.includes('vimeo.com/')) {
      const parts = uri.split('vimeo.com/')[1]?.split('?')[0]?.split('/') || [];
      const videoId = parts[0] || '';
      const hash = parts[1] || '';
      return hash
        ? `https://player.vimeo.com/video/${videoId}?h=${hash}`
        : `https://player.vimeo.com/video/${videoId}`;
    }
    return uri;
  }
  return (
    <div className={cn(`propeller-product-videos ${props.className || ''}`)}>
      {hasItems ? (
        <h3 className="propeller-product-videos__title text-base font-semibold text-foreground mb-3">
          {getLabel(props.labels, 'title', 'Videos')}
        </h3>
      ) : null}
      {hasItems ? (
        <div className="propeller-product-videos__list space-y-4">
          {items.map((video, index) => (
            <div
              className="propeller-product-videos__item rounded-container overflow-hidden border border-border bg-foreground"
              key={index}
              data-embedded={!!getVideoUri(video) && isEmbeddable(getVideoUri(video)) ? 'true' : 'false'}
            >
              {!!getVideoUri(video) ? (
                <>
                  {isEmbeddable(getVideoUri(video)) ? (
                    <div
                      className="propeller-product-videos__embed relative w-full"
                      style={{
                        paddingBottom: '56.25%',
                      }}
                    >
                      <iframe
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        className="propeller-product-videos__iframe absolute inset-0 w-full h-full"
                        src={getEmbedUrl(getVideoUri(video))}
                        title={getVideoTitle(video)}
                        allowFullScreen
                      />
                    </div>
                  ) : null}
                  {!isEmbeddable(getVideoUri(video)) ? (
                    <video preload="metadata" className="propeller-product-videos__video w-full" controls>
                      <source src={getVideoUri(video)} />
                    </video>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {!hasItems ? (
        <p className="propeller-product-videos__empty text-sm text-muted-foreground">{getLabel(props.labels, 'empty', 'No videos')}</p>
      ) : null}
    </div>
  );
}

export default ProductVideos;
