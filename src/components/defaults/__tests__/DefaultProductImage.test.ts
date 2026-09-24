/**
 * Tests for the language-fallback image picker used by DefaultProductImage.
 *
 * Imports the real `pickImageUrl` rather than re-implementing it. This file
 * used to carry a copy headed "keep in sync", which meant it asserted against
 * itself: the copy and the component could drift and the suite would stay
 * green. The contract under test:
 *   1. imageVariant matching target language (case-insensitive)
 *   2. originalUrl matching target language (case-insensitive)
 *   3. any imageVariant URL
 *   4. any originalUrl
 *   5. null
 */

import { describe, it, expect } from 'vitest';
import { pickImageUrl } from '../DefaultProductImage';

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

  it('matches the language case-insensitively', () => {
    // The API lowercases some media language fields; an exact compare picked
    // the wrong image (PWP-984 / PWP-983).
    const items: MediaItem[] = [
      {
        imageVariants: [
          { language: 'en', url: 'https://cdn/img-en.webp' },
          { language: 'nl', url: 'https://cdn/img-nl.webp' },
        ],
      },
    ];
    expect(pickImageUrl(items, 'NL')).toBe('https://cdn/img-nl.webp');
    expect(pickImageUrl(items, 'en')).toBe('https://cdn/img-en.webp');
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
