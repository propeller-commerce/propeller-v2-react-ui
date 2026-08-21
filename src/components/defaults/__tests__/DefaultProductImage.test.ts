/**
 * Tests for the language-fallback image picker used by DefaultProductImage.
 *
 * The picker is exported indirectly through the component, but the React
 * render itself can't run under vitest's node env. We re-implement the
 * exact same priority order here to lock in the fallback contract:
 *   1. imageVariant matching target language
 *   2. originalUrl matching target language
 *   3. any imageVariant URL
 *   4. any originalUrl
 *   5. null
 *
 * If this contract changes in DefaultProductImage.tsx, this test must
 * change with it.
 */

import { describe, it, expect } from 'vitest';

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

// Mirror of the implementation in DefaultProductImage.tsx — keep in sync.
function pickImageUrl(mediaItems: MediaItem[], target: string): string | null {
  if (!mediaItems || mediaItems.length === 0) return null;
  for (const m of mediaItems) {
    const match = m.imageVariants?.find((v) => v.language === target && v.url);
    if (match?.url) return match.url;
  }
  for (const m of mediaItems) {
    const match = m.images?.find((i) => i.language === target && i.originalUrl);
    if (match?.originalUrl) return match.originalUrl;
  }
  for (const m of mediaItems) {
    const first = m.imageVariants?.find((v) => v.url);
    if (first?.url) return first.url;
  }
  for (const m of mediaItems) {
    const first = m.images?.find((i) => i.originalUrl);
    if (first?.originalUrl) return first.originalUrl;
  }
  return null;
}

describe('DefaultProductImage — language-aware URL picker', () => {
  it('returns null for empty media', () => {
    expect(pickImageUrl([], 'NL')).toBeNull();
  });

  it('prefers an imageVariant in the target language', () => {
    const items: MediaItem[] = [
      {
        imageVariants: [
          { language: 'EN', url: 'https://cdn/img-en.webp' },
          { language: 'NL', url: 'https://cdn/img-nl.webp' },
        ],
      },
    ];
    expect(pickImageUrl(items, 'NL')).toBe('https://cdn/img-nl.webp');
  });

  it('falls back to a localized originalUrl when no matching variant', () => {
    const items: MediaItem[] = [
      {
        imageVariants: [{ language: 'EN', url: 'https://cdn/img-en.webp' }],
        images: [
          { language: 'NL', originalUrl: 'https://cdn/orig-nl.jpg' },
          { language: 'EN', originalUrl: 'https://cdn/orig-en.jpg' },
        ],
      },
    ];
    expect(pickImageUrl(items, 'NL')).toBe('https://cdn/orig-nl.jpg');
  });

  it('falls back to ANY imageVariant URL when no language matches', () => {
    const items: MediaItem[] = [
      {
        imageVariants: [{ language: 'DE', url: 'https://cdn/img-de.webp' }],
      },
    ];
    expect(pickImageUrl(items, 'NL')).toBe('https://cdn/img-de.webp');
  });

  it('falls back to ANY originalUrl when no transformation is available at all', () => {
    const items: MediaItem[] = [
      {
        images: [{ language: 'FR', originalUrl: 'https://cdn/orig-fr.jpg' }],
      },
    ];
    expect(pickImageUrl(items, 'NL')).toBe('https://cdn/orig-fr.jpg');
  });

  it('returns null when both arrays are empty', () => {
    expect(pickImageUrl([{ images: [], imageVariants: [] }], 'NL')).toBeNull();
  });

  it('keeps the priority order across multiple media items', () => {
    // First media has only English variants; second has Dutch — Dutch wins.
    const items: MediaItem[] = [
      { imageVariants: [{ language: 'EN', url: 'https://cdn/a-en.webp' }] },
      { imageVariants: [{ language: 'NL', url: 'https://cdn/b-nl.webp' }] },
    ];
    expect(pickImageUrl(items, 'NL')).toBe('https://cdn/b-nl.webp');
  });
});
