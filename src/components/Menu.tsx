'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { GraphQLClient, Category, Contact, Customer } from '@propeller-commerce/propeller-sdk-v2';
import { useMenu, MenuCategory } from '../composables/react/useMenu';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface MenuProps {
  /**
   * Initialised Propeller SDK GraphQL client.
   * Used internally to fetch the category hierarchy. Not required when
   * `tree` is supplied — that pre-fetched form skips the internal fetch.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Base category ID for fetching all categories.
   * This is the root of the menu tree.
   */
  categoryId: number;

  /**
   * Pre-fetched menu tree. When provided, the component skips its internal
   * `useMenu` fetch entirely and renders the tree directly — mirrors the
   * `ProductGrid.products` opt-in. Use this from a Server Component that
   * resolved the tree itself (e.g. via a server-side `fetchMenu`), so the
   * host can attach Next.js cache hints and the menu HTML lands in the
   * initial response.
   *
   * When omitted, the component falls back to the legacy client-side fetch
   * via `useMenu`, identical to the v0.x behaviour.
   */
  tree?: MenuCategory[];

  /**
   * Language code for fetching localised category names and slugs.
   * Resolved from PropellerProvider when omitted.
   */
  language?: string;

  /**
   * Maximum nesting depth of the menu hierarchy.
   * Defaults to 3.
   */
  depth?: number;

  /**
   * CSS class applied to the menu container element.
   */
  menuClass?: string;

  /**
   * Main menu display type.
   * - 'dropdown-vertical': nested flyout panels on hover (default). Lays each
   *   level out as another 256px column, so it caps at 5 levels.
   * - 'jumbotron': full-width mega-menu panel showing all subcategories.
   * - 'accordion': inline vertical nesting at every breakpoint. The only style
   *   with no depth ceiling — use it for trees deeper than a flyout can show.
   *   (Also the mobile presentation of the other styles.)
   *
   * Typed as `MenuStyle | (string & {})` so the built-ins autocomplete while
   * any other value still type-checks — pair a custom value with
   * {@link MenuProps.renderMenu} to render it. Without `renderMenu`, an
   * unrecognised value falls back to 'accordion' and warns in development.
   */
  menuStyle?: MenuStyle | (string & {});

  /**
   * Render the menu yourself instead of using a built-in `menuStyle`.
   *
   * The built-in styles cover the common shapes, but they are just three
   * arrangements of the same tree — this is the escape hatch for a fourth.
   * Receives the fetched categories plus the state and helpers the built-in
   * renderers use, so a custom menu gets working open/close behaviour, URL
   * building and click handling without reimplementing them.
   *
   * Return `null` to fall through to the `menuStyle` rendering (useful for
   * overriding a single breakpoint or category).
   */
  renderMenu?: (ctx: MenuRenderContext) => React.ReactNode;

  /**
   * URL pattern for category links.
   * Use `{categoryId}` and `{slug}` as placeholders.
   * Defaults to 'category/{categoryId}/{slug}'.
   */
  menuLinkFormat?: string;

  /**
   * Custom URL builder for category links. Overrides `menuLinkFormat` /
   * `configuration.urls.getCategoryUrl`. Lets hosts inject dynamic query strings
   * (e.g. `?contract=…`) that a static format string cannot express.
   * Mirrors the `getUrl` prop on Breadcrumbs.
   */
  getUrl?: (category: Category) => string;

  /**
   * Called when a menu item is clicked.
   * Use for SPA-style routing instead of full-page navigation.
   */
  onMenuItemClick: (category: Category) => void;

  /**
   * Override any UI string.
   * Available keys: loading, error, empty
   */
  labels?: Record<string, string>;

  /**
   * Authenticated user object. When user changes (login/logout),
   * the menu cache is cleared and the menu is re-fetched.
   */
  user?: Contact | Customer | null;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /** Configuration object passed to the component */
  configuration?: any;
}

/** Every style with a built-in renderer — the source of truth for the union. */
const RENDERED_STYLES = ['dropdown-vertical', 'jumbotron', 'accordion'] as const;

export type MenuStyle = (typeof RENDERED_STYLES)[number];

/**
 * Everything a custom `renderMenu` needs to draw the tree: the data, the
 * open/close state, and the same helpers the built-in styles use.
 *
 * Exposing the helpers rather than just the categories is the point — URL
 * building respects `getUrl`/`configuration`, `handleItemClick` honours
 * `onMenuItemClick`, and the `openPath` helpers give working expand/collapse.
 * A custom renderer that only got `categories` would have to reimplement all
 * of that and would drift from the built-ins.
 */
export interface MenuRenderContext {
  /** Root-level categories of the fetched tree. */
  categories: MenuCategory[];
  /** True while the internal fetch is in flight (never when `tree` is passed). */
  isLoading: boolean;
  /** True when the internal fetch failed. */
  hasError: boolean;
  /** Levels that may be rendered, after the style's cap is applied. */
  maxDepth: number;
  /** Children of `cat`, minus entries with no name or slug. */
  getSubCategories: (cat: MenuCategory) => MenuCategory[];
  /** Localised display name. */
  getCategoryName: (cat: MenuCategory) => string;
  /** Href honouring `getUrl` when provided, else `configuration.urls`. */
  getCategoryUrl: (cat: MenuCategory) => string;
  /** Click handler that fires `onMenuItemClick` and suppresses navigation. */
  handleItemClick: (cat: MenuCategory, e: React.MouseEvent) => void;
  /** Currently open branch as category ids, root → deepest. */
  openPath: number[];
  /** Is `categoryId` the open branch at `level` (0-based)? */
  isOpenAt: (level: number, categoryId: number) => boolean;
  /** Open a branch at `level`, closing anything deeper. Pass null to close. */
  openAt: (level: number, categoryId: number | null) => void;
  /** Toggle a branch at `level` — the accordion's click behaviour. */
  toggleAt: (level: number, categoryId: number) => void;
}

/**
 * Renders a multi-level category navigation menu from the fetched category
 * tree: a dropdown flyout or jumbotron mega-menu on desktop, an accordion on
 * mobile — or an accordion on every breakpoint when `menuStyle="accordion"`,
 * which is the option to pick for trees deeper than a flyout can lay out.
 *
 * @remarks Uses {@link useMenu} to fetch the category hierarchy.
 */
function Menu(rawProps: MenuProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  // Which branch is open, root → deepest, as category ids. One value instead of
  // a pair of state slots per level: "opening a shallower item closes the
  // deeper ones" falls out of `slice(0, level)` rather than a hand-written
  // reset per level, which grows quadratically and is easy to get wrong.
  const [openPath, setOpenPath] = useState<number[]>([]);

  // Stable string key derived from user identity — used as dep so that a new
  // user object reference (same ID) never triggers a spurious re-fetch.
  const userKey = props.user
    ? ('contactId' in (props.user as any)
      ? `c${(props.user as Contact).contactId}`
      : `u${(props.user as Customer).customerId}`)
    : '';

  // Branch on whether the host pre-fetched the tree. When supplied, the
  // internal fetch is skipped — no loading state, no client roundtrip. This
  // is the path Server Components should use; the fallback (no `tree`) keeps
  // the legacy client-side fetch behaviour for callers that haven't migrated.
  const hasPrefetchedTree = Array.isArray(props.tree);
  const { categories: fetchedCategories, loading: fetchedLoading, error: menuError, fetchMenu } = useMenu({
    graphqlClient: props.graphqlClient!,
    language: props.language,
    depth: props.depth,
  });
  const menuCategories: MenuCategory[] = hasPrefetchedTree ? (props.tree as MenuCategory[]) : fetchedCategories;
  const isLoading = hasPrefetchedTree ? false : fetchedLoading;
  const hasError = !hasPrefetchedTree && menuError !== null;

  function getCategoryName(cat: MenuCategory): string {
    return cat.name;
  }
  function getCategoryUrl(cat: MenuCategory): string {
    const lang = props.language || 'NL';
    const category = {
      categoryId: cat.categoryId,
      slugs: [{ value: cat.slug, language: lang }],
    } as Category;
    // Consumer-provided URL builder takes precedence (mirrors Breadcrumbs.getUrl).
    if (props.getUrl) return props.getUrl(category);
    return props.configuration.urls.getCategoryUrl(category, lang);
  }
  function getSubCategories(cat: MenuCategory): MenuCategory[] {
    return (cat.children || []).filter((sub) => sub.name && sub.slug);
  }
  function handleItemClick(cat: MenuCategory, e: any): void {
    if (props.onMenuItemClick) {
      e.preventDefault();
      const lang = props.language || 'NL';
      props.onMenuItemClick({
        categoryId: cat.categoryId,
        names: [{ value: cat.name, language: lang }],
        slugs: [{ value: cat.slug, language: lang }],
      } as Category);
    }
  }
  /** Open `categoryId` at `level` (0-based), discarding any deeper open branch. */
  function openAt(level: number, categoryId: number | null): void {
    setOpenPath((prev) => {
      const next = prev.slice(0, level);
      if (categoryId !== null) next.push(categoryId);
      return next;
    });
  }

  /** Accordion variant — re-selecting the open item collapses it. */
  function toggleAt(level: number, categoryId: number): void {
    setOpenPath((prev) =>
      prev[level] === categoryId
        ? prev.slice(0, level)
        : [...prev.slice(0, level), categoryId]
    );
  }

  /** True when `categoryId` is the open branch at `level`. */
  function isOpenAt(level: number, categoryId: number): boolean {
    return openPath[level] === categoryId;
  }


  function getMenuStyle(): MenuStyle {
    const requested = (props.menuStyle as string | undefined) || 'dropdown-vertical';
    if (!(RENDERED_STYLES as readonly string[]).includes(requested)) {
      // A custom value is legitimate when paired with `renderMenu` — but we
      // only reach here if `renderMenu` was absent or returned null, so the
      // style genuinely has nothing to draw it. Fall back to the accordion
      // (which can display any tree) rather than the old behaviour of matching
      // no branch and rendering an empty panel with no clue why.
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
          `[Menu] menuStyle="${requested}" has no built-in renderer (available: ${RENDERED_STYLES.join(', ')}); falling back to "accordion". Pass \`renderMenu\` to draw a custom style.`
        );
      }
      return 'accordion';
    }
    return requested as MenuStyle;
  }

  /**
   * Levels each style can actually display. The flyout styles lay every level
   * out as another horizontal `w-64` (256px) column, so the ceiling is how many
   * fit on screen: 5 columns = 1280px, which clears a 1440px desktop. Past that
   * they run off the viewport. The accordion nests vertically and has no
   * layout ceiling.
   */
  function getRenderableDepth(): number {
    const requested = Math.max(1, (props.depth as number) ?? 3);
    const cap = getMenuStyle() === 'accordion' ? Number.POSITIVE_INFINITY : 5;
    if (process.env.NODE_ENV !== 'production' && requested > cap) {
      console.warn(
        `[Menu] depth={${requested}} exceeds what menuStyle="${getMenuStyle()}" can lay out (${cap}); rendering ${cap} levels. Use menuStyle="accordion" for deeper trees.`
      );
    }
    return Math.min(requested, cap);
  }
  const maxDepth = getRenderableDepth();

  /** Chevron shown when an item has children that this depth will actually render. */
  function renderChevron(cat: MenuCategory, level: number, rotated = false): React.ReactNode {
    if (getSubCategories(cat).length === 0 || level + 1 >= maxDepth) return null;
    return (
      <svg
        className={`propeller-menu__chevron w-3.5 h-3.5 flex-shrink-0 transition-transform ${rotated ? 'rotate-180' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {rotated ? <polyline points="6 9 12 15 18 9" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    );
  }

  /**
   * Flyout column renderer for `dropdown-vertical`.
   *
   * Each level is a SIBLING column inside one flex row — not a nested list — so
   * this emits a flat array of `<ul>`s, walking `openPath` one level at a time,
   * rather than nesting children inside their parent `<li>`.
   */
  function renderColumns(items: MenuCategory[], level: number): React.ReactNode[] {
    if (!items.length || level >= maxDepth) return [];
    const openId = openPath[level];
    const openCat = items.find((c) => c.categoryId === openId);
    const column = (
      <ul
        key={`col-${level}`}
        className={`propeller-menu__list w-64 py-1 flex-shrink-0 ${level + 1 < maxDepth ? 'border-r border-border' : ''}`}
        data-level={level + 1}
      >
        {items.map((cat, idx) => (
          <li
            key={`l${level}-${cat.categoryId}-${idx}`}
            className="propeller-menu__item"
            data-level={level + 1}
            data-active={isOpenAt(level, cat.categoryId) ? 'true' : 'false'}
            onMouseEnter={() => openAt(level, cat.categoryId)}
          >
            <a
              href={getCategoryUrl(cat)}
              onClick={(e) => handleItemClick(cat, e)}
              className={`propeller-menu__link flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${isOpenAt(level, cat.categoryId) ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'}`}
            >
              <span className="propeller-menu__label">{getCategoryName(cat)}</span>
              {renderChevron(cat, level)}
            </a>
          </li>
        ))}
      </ul>
    );
    const deeper = openCat ? renderColumns(getSubCategories(openCat), level + 1) : [];
    return [column, ...deeper];
  }

  /** Nested accordion renderer — vertical nesting, so genuinely unbounded. */
  function renderAccordion(items: MenuCategory[], level: number): React.ReactNode {
    if (!items.length || level >= maxDepth) return null;
    return (
      <ul
        className={`propeller-menu__list ${level === 0 ? 'divide-y divide-border' : level === 1 ? 'bg-accent/30' : 'bg-accent/20'}`}
        data-level={level + 1}
      >
        {items.map((cat, idx) => {
          const children = getSubCategories(cat);
          const expanded = isOpenAt(level, cat.categoryId);
          const canExpand = children.length > 0 && level + 1 < maxDepth;
          return (
            <li
              key={`l${level}-${cat.categoryId}-${idx}`}
              className="propeller-menu__item"
              data-level={level + 1}
              data-expanded={expanded ? 'true' : 'false'}
            >
              <div className="flex items-center justify-between">
                <a
                  href={getCategoryUrl(cat)}
                  onClick={(e) => handleItemClick(cat, e)}
                  className="propeller-menu__link flex-1 px-4 py-3 text-sm text-foreground"
                  style={{ paddingLeft: `${1 + level}rem` }}
                >
                  {getCategoryName(cat)}
                </a>
                {canExpand ? (
                  <button
                    type="button"
                    // `cursor-pointer` is explicit because Tailwind v4 resets
                    // buttons to `cursor: default`; without it the only control
                    // that expands a branch doesn't look clickable.
                    className="propeller-menu__toggle cursor-pointer px-4 py-3 text-muted-foreground transition-colors hover:text-foreground"
                    aria-expanded={expanded}
                    aria-label={getCategoryName(cat)}
                    onClick={() => toggleAt(level, cat.categoryId)}
                  >
                    {renderChevron(cat, level, expanded)}
                  </button>
                ) : null}
              </div>
              {expanded && canExpand ? renderAccordion(children, level + 1) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  useEffect(() => {
    // When the host pre-fetched the tree, do nothing — re-fetching would
    // defeat the point of server-side caching and cause an avoidable
    // client-side request after hydration.
    if (hasPrefetchedTree) return;
    if (!props.graphqlClient) return;
    fetchMenu(props.categoryId, userKey);
  }, [hasPrefetchedTree, props.graphqlClient, props.categoryId, props.language, userKey, fetchMenu]);

  // Custom renderer wins over the built-in styles. Called before the loading /
  // error branches so it owns those states too — a custom menu may want its own
  // skeleton. Returning null falls through to the normal rendering.
  const customMenu = props.renderMenu
    ? props.renderMenu({
        categories: menuCategories,
        isLoading,
        hasError,
        maxDepth,
        getSubCategories,
        getCategoryName,
        getCategoryUrl,
        handleItemClick,
        openPath,
        isOpenAt,
        openAt,
        toggleAt,
      })
    : null;

  if (customMenu !== null && customMenu !== undefined) {
    return (
      <div
        className={cn(`propeller-menu ${(props.className as string) || ''}`)}
        data-variant={(props.menuStyle as string) || 'custom'}
        data-loading={isLoading ? 'true' : 'false'}
      >
        {customMenu}
      </div>
    );
  }

  return (
    <div
      className={cn(`propeller-menu ${(props.className as string) || ''}`)}
      data-variant={getMenuStyle()}
      data-loading={isLoading ? 'true' : 'false'}
    >
      {isLoading ? (
        <div className="propeller-menu__loading flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{getLabel(props.labels, 'loading', 'Loading menu...')}</span>
        </div>
      ) : null}
      {!isLoading && hasError ? (
        <div className="propeller-menu__error px-4 py-3 text-sm text-destructive">
          {getLabel(props.labels, 'error', 'Failed to load menu')}
        </div>
      ) : null}
      {!isLoading && !hasError && menuCategories.length === 0 ? (
        <div className="propeller-menu__empty px-4 py-3 text-sm text-muted-foreground">
          {getLabel(props.labels, 'empty', 'No categories found')}
        </div>
      ) : null}
      {!isLoading &&
      !hasError &&
      menuCategories.length > 0 &&
      getMenuStyle() === 'dropdown-vertical' ? (
        <nav
          className={`propeller-menu__nav hidden md:block ${(props.menuClass as string) || ''}`}
        >
          {/*
            `max-w-[100vw] overflow-x-auto` so a deep tree degrades to a scroll
            rather than running off the viewport: at 5 levels the columns total
            1280px, which clears a 1440px desktop but not a smaller laptop or a
            trigger positioned mid-page.
          */}
          <div className="flex max-w-[100vw] overflow-x-auto bg-popover border border-border shadow-lg">
            {renderColumns(menuCategories, 0)}
          </div>
        </nav>
      ) : null}
      {!isLoading &&
      !hasError &&
      menuCategories.length > 0 &&
      getMenuStyle() === 'jumbotron' ? (
        <nav
          className={`propeller-menu__nav hidden md:block ${(props.menuClass as string) || ''}`}
        >
          <div className="propeller-menu__tabs flex items-center border-b border-border">
            {menuCategories?.map((l1, idx) => (
              <button
                key={`l1-${l1.categoryId}-${idx}`}
                // `cursor-pointer` is explicit — Tailwind v4 resets buttons to
                // `cursor: default`, so tabs otherwise don't look clickable.
                className={`propeller-menu__tab cursor-pointer px-5 py-3 text-sm font-medium transition-colors border-b-2 ${isOpenAt(0, l1.categoryId) ? 'border-primary text-primary' : 'border-transparent text-foreground hover:text-primary hover:border-primary/50'}`}
                data-level="1"
                data-active={isOpenAt(0, l1.categoryId) ? 'true' : 'false'}
                onMouseEnter={(event) => openAt(0, l1.categoryId)}
                onClick={(e) => handleItemClick(l1, e)}
              >
                <span className="propeller-menu__label">{getCategoryName(l1)}</span>
              </button>
            ))}
          </div>
          {menuCategories?.map((l1, idx) =>
            isOpenAt(0, l1.categoryId) && getSubCategories(l1).length > 0 ? (
              <div
                className="propeller-menu__panel bg-popover border border-border border-t-0 shadow-lg p-6"
                onMouseEnter={(event) => openAt(0, l1.categoryId)}
                onMouseLeave={(event) => openAt(0, null)}
              >
                <div className="propeller-menu__panel-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {getSubCategories(l1)?.map((l2, idx2) => (
                    <div key={`l2-${l2.categoryId}-${idx2}`} className="propeller-menu__group" data-level="2">
                      <a
                        className="propeller-menu__link text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        href={getCategoryUrl(l2)}
                        onClick={(e) => handleItemClick(l2, e)}
                      >
                        <span className="propeller-menu__label">{getCategoryName(l2)}</span>
                      </a>
                      {getSubCategories(l2).length > 0 ? (
                        <ul className="propeller-menu__list mt-2 space-y-1" data-level="3">
                          {getSubCategories(l2)?.map((l3, idx3) => (
                            <li key={`l3-${l3.categoryId}-${idx3}`} className="propeller-menu__item" data-level="3">
                              <a
                                className="propeller-menu__link text-sm text-muted-foreground hover:text-primary transition-colors"
                                href={getCategoryUrl(l3)}
                                onClick={(e) => handleItemClick(l3, e)}
                              >
                                <span className="propeller-menu__label">{getCategoryName(l3)}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </nav>
      ) : null}
      {/*
        Accordion. Two roles:
          • the mobile drawer for EVERY style (the flyout columns can't lay out
            on a narrow screen), hence it renders regardless of `menuStyle`
          • the desktop menu when `menuStyle="accordion"` is chosen explicitly —
            the only style with no layout ceiling, so the one to pick for trees
            deeper than a flyout can show

        Without the second role `menuStyle="accordion"` matched no desktop
        branch and rendered an empty panel above `md`, while the depth warning
        recommended exactly that style for deep trees.
      */}
      {!isLoading &&
      !hasError &&
      menuCategories.length > 0 ? (
        <nav
          className={`propeller-menu__nav ${getMenuStyle() === 'accordion' ? 'block' : 'md:hidden'} ${(props.menuClass as string) || ''}`}
        >
          {renderAccordion(menuCategories, 0)}
        </nav>
      ) : null}
    </div>
  );
}

export default Menu;
