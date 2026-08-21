'use client';

import React from 'react';
import { getLanguageString } from '@propeller-commerce/propeller-v2-core-ui';
import type { ImageComponentProps } from '@propeller-commerce/propeller-v2-core-ui';

/**
 * Default product / cluster image renderer for the extension API.
 *
 * Standalone implementation of the `ImageComponentProps` contract — accepts a
 * `product` OR `cluster`, picks the best image URL for the consumer's
 * language, and renders an `<img>` with lazy loading.
 *
 * URL resolution preference, applied across `product.media.images.items`
 * (or the cluster's `defaultProduct` equivalent):
 *   1. The first `MediaImage` whose `imageVariants` has an entry matching
 *      the target `language`.
 *   2. The first `MediaImage` whose plain `images` (LocalizedImage) has an
 *      entry matching the target `language`.
 *   3. The first available `imageVariants[0].url` across any media item
 *      (single-language fallback so products always have an image).
 *   4. The first available `images[0].originalUrl` across any media item
 *      (final fallback before the placeholder).
 *
 * Note: the SDK helper `getProductImageUrl` returns `items[0].imageVariants[0].url`
 * unconditionally — no language filter. This component does the filtering
 * client-side so a standalone `<DefaultProductImage>` (e.g. inside a
 * consumer-built card) is correct even when the upstream fetch didn't filter
 * media by language.
 */
interface LocalizedImage {
  language?: string;
  originalUrl?: string;
}

interface ImageVariant {
  language?: string;
  url?: string;
  name?: string;
}

interface MediaItem {
  images?: LocalizedImage[];
  imageVariants?: ImageVariant[];
}

/**
 * Pick the best image URL across a product's `media.images.items` list,
 * preferring (in order):
 *   1. an `imageVariant.url` whose `language` matches `target`
 *   2. an `image.originalUrl` whose `language` matches `target`
 *   3. the first available `imageVariant.url` (any language)
 *   4. the first available `image.originalUrl` (any language)
 *   5. null when no URL is found
 */
function pickImageUrl(mediaItems: MediaItem[], target: string): string | null {
  if (!mediaItems || mediaItems.length === 0) return null;

  // Pass 1: prefer transformations matching the target language.
  for (const m of mediaItems) {
    const match = m.imageVariants?.find((v) => v.language === target && v.url);
    if (match?.url) return match.url;
  }
  // Pass 2: prefer original images matching the target language.
  for (const m of mediaItems) {
    const match = m.images?.find((i) => i.language === target && i.originalUrl);
    if (match?.originalUrl) return match.originalUrl;
  }
  // Pass 3: any transformation URL.
  for (const m of mediaItems) {
    const first = m.imageVariants?.find((v) => v.url);
    if (first?.url) return first.url;
  }
  // Pass 4: any original URL.
  for (const m of mediaItems) {
    const first = m.images?.find((i) => i.originalUrl);
    if (first?.originalUrl) return first.originalUrl;
  }
  return null;
}

export function DefaultProductImage(props: ImageComponentProps): React.JSX.Element | null {
  const { product, cluster, className } = props;
  const targetLanguage = props.language ?? 'NL';

  const mediaItems = (() => {
    const target = product ?? (cluster as { defaultProduct?: unknown } | undefined)?.defaultProduct ?? cluster;
    return (
      (target as { media?: { images?: { items?: unknown[] } } } | undefined)?.media?.images?.items ?? []
    ) as MediaItem[];
  })();

  const url = pickImageUrl(mediaItems, targetLanguage);

  const altText = (() => {
    const target = product ?? cluster;
    if (!target) return '';
    const name = (target as { name?: unknown }).name;
    if (Array.isArray(name)) {
      return getLanguageString(name as never, targetLanguage, '') ?? '';
    }
    return typeof name === 'string' ? name : '';
  })();

  if (!url) {
    return (
      <div
        className={className ?? 'propeller-default-image-placeholder flex items-center justify-center bg-surface-hover'}
        aria-hidden="true"
      >
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-12 w-12 text-foreground-subtle">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={altText}
      className={className ?? 'h-full w-full object-contain'}
      loading="lazy"
    />
  );
}

export default DefaultProductImage;
