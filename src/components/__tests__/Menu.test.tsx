/**
 * Menu — style selection and the `renderMenu` escape hatch.
 *
 * Rendered with `renderToString` in the package's Node env and fed a
 * pre-fetched `tree`, so `useMenu` stays idle and we assert the markup the
 * component computes synchronously.
 *
 * The cases here are the ones that previously failed silently: a style with no
 * renderer produced an empty panel with no clue why, and `accordion` — the
 * style the depth warning recommends — was hidden above `md` because it doubles
 * as the mobile drawer.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import Menu, { type MenuRenderContext } from '../Menu';
import type { MenuCategory } from '../../composables/react/useMenu';

const TREE: MenuCategory[] = [
  {
    categoryId: 1,
    name: 'Level 1',
    slug: 'level-1',
    children: [
      {
        categoryId: 2,
        name: 'Level 2',
        slug: 'level-2',
        children: [
          { categoryId: 3, name: 'Level 3', slug: 'level-3', children: [] },
        ],
      },
    ],
  },
];

const CONFIG = {
  urls: {
    getCategoryUrl: (c: { categoryId?: number }) => `/category/${c.categoryId}`,
  },
};

function render(props: Record<string, unknown> = {}): string {
  return renderToString(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(Menu as any, {
      tree: TREE,
      categoryId: 17,
      language: 'EN',
      configuration: CONFIG,
      ...props,
    })
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Menu — built-in styles', () => {
  it('renders the flyout for dropdown-vertical', () => {
    const html = render({ menuStyle: 'dropdown-vertical' });
    expect(html).toContain('data-variant="dropdown-vertical"');
    expect(html).toContain('Level 1');
  });

  it('renders the accordion at every breakpoint when chosen explicitly', () => {
    const html = render({ menuStyle: 'accordion', depth: 3 });
    expect(html).toContain('data-variant="accordion"');
    expect(html).toContain('Level 1');
    // The accordion nav must NOT be md:hidden when it IS the chosen style —
    // that class is what made `menuStyle="accordion"` invisible on desktop.
    expect(html).not.toMatch(/propeller-menu__nav[^"]*md:hidden/);
  });

  it('still renders the accordion as the mobile drawer for other styles', () => {
    const html = render({ menuStyle: 'dropdown-vertical' });
    expect(html).toMatch(/propeller-menu__nav[^"]*md:hidden/);
  });

  it('falls back to the accordion and warns for an unknown style', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = render({ menuStyle: 'no-such-style' });
    expect(html).toContain('Level 1');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('has no built-in renderer')
    );
  });
});

describe('Menu — depth', () => {
  it('caps the flyout and warns past its ceiling', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render({ menuStyle: 'dropdown-vertical', depth: 9 });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('exceeds what menuStyle="dropdown-vertical" can lay out (5)')
    );
  });

  it('does not cap the accordion', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render({ menuStyle: 'accordion', depth: 9 });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('Menu — renderMenu escape hatch', () => {
  it('renders custom output instead of the built-in style', () => {
    const html = render({
      menuStyle: 'my-custom-style',
      renderMenu: (ctx: MenuRenderContext) =>
        React.createElement(
          'div',
          { className: 'custom-menu' },
          ctx.categories.map((c) =>
            React.createElement('span', { key: c.categoryId }, ctx.getCategoryName(c))
          )
        ),
    });
    expect(html).toContain('custom-menu');
    expect(html).toContain('Level 1');
    // No fallback warning: a custom style paired with renderMenu is legitimate.
    expect(html).not.toContain('propeller-menu__nav');
  });

  it('passes helpers that honour the component config', () => {
    let seen: MenuRenderContext | null = null;
    render({
      renderMenu: (ctx: MenuRenderContext) => {
        seen = ctx;
        return React.createElement('div', null, 'custom');
      },
    });
    expect(seen).not.toBeNull();
    const ctx = seen as unknown as MenuRenderContext;
    expect(ctx.getCategoryUrl(TREE[0])).toBe('/category/1');
    expect(ctx.getSubCategories(TREE[0])).toHaveLength(1);
    expect(ctx.isOpenAt(0, 1)).toBe(false);
  });

  it('falls through to menuStyle when renderMenu returns null', () => {
    const html = render({
      menuStyle: 'dropdown-vertical',
      renderMenu: () => null,
    });
    expect(html).toContain('data-variant="dropdown-vertical"');
    expect(html).toContain('propeller-menu__nav');
  });
});
