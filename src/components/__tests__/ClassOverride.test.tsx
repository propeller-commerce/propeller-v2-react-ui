/**
 * A host `className` override must beat the component's own utility.
 *
 * The class attribute used to be built by string-appending the override after
 * the package's defaults, which does nothing: `text-white text-cocoa` renders
 * white, because order in the attribute is not the cascade. Overrides are now
 * merged with tailwind-merge, so the later value replaces the conflicting one.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { cn } from '../../composables/shared/utils/cn';
import CartIconAndSidebar from '../CartIconAndSidebar';
import type { Cart } from '@propeller-commerce/propeller-sdk-v2';

describe('cn', () => {
  it('lets the later utility win within a group', () => {
    expect(cn('text-white', 'text-cocoa')).toBe('text-cocoa');
  });

  it('keeps non-conflicting utilities and unknown classes', () => {
    const out = cn('propeller-x inline-flex text-white', 'text-cocoa');
    expect(out).toContain('propeller-x');
    expect(out).toContain('inline-flex');
    expect(out).toContain('text-cocoa');
    expect(out).not.toContain('text-white');
  });
});

describe('iconClassName override', () => {
  it('replaces the trigger colour instead of racing it', () => {
    // `cart` is required by the props type; the trigger's classes don't depend
    // on it, so an empty cart is enough to render one.
    const html = renderToString(
      <CartIconAndSidebar cart={{} as Cart} iconClassName="text-cocoa" />
    );
    const trigger = html.match(/class="(propeller-cart-icon__trigger [^"]*)"/)?.[1] ?? '';
    expect(trigger).toContain('text-cocoa');
    expect(trigger).not.toContain('text-foreground');
  });
});
