/**
 * useMenu (React) — Category tree fetch with depth-configurable recursive GraphQL query.
 *
 * Responsibilities:
 * - Dynamic recursive GraphQL category query (depth-configurable, default 3)
 * - localStorage cache with 12h TTL, user-specific cache key
 * - Maps LocalizedString arrays to flat name/slug strings per language
 */

import { useState, useCallback } from 'react';
import type { GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Raw category shape returned by the recursive GraphQL query */
interface MenuCategoryRaw {
  categoryId: number;
  hidden?: boolean | 'Y' | 'N' | string | null;
  // Every translation, not just the active language — see `mapCategory`.
  names: Array<{ value: string; language: string }>;
  slugs: Array<{ value: string; language: string }>;
  categories?: MenuCategoryRaw[];
}

function isHidden(raw: MenuCategoryRaw): boolean {
  return raw.hidden === true || raw.hidden === 'Y';
}

/** A flattened category node in the menu tree. */
export interface MenuCategory {
  /** Category id. */
  categoryId: number;
  /** Category name resolved for the active language. */
  name: string;
  /** Category URL slug. */
  slug: string;
  /** Nested child categories (hidden ones filtered out). */
  children: MenuCategory[];
}

/** Options for {@link useMenu}. */
export interface UseMenuOptions {
  /** GraphQL client used to run the recursive category query. */
  graphqlClient: GraphQLClient;
  /** Language used to resolve category names/slugs. Defaults to `'NL'`. */
  language?: string;
  /** Nesting depth for the category tree. Default: 3. */
  depth?: number;
  /** Cache TTL in milliseconds. Default: 12h. */
  cacheTtlMs?: number;
}

/** State and actions returned by {@link useMenu}. */
export interface UseMenuReturn {
  /** The fetched top-level category tree. */
  categories: MenuCategory[];
  /** `true` while a menu fetch is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** Fetches the category tree for a root category id; `userKey` scopes the cache. */
  fetchMenu: (rootCategoryId: number, userKey?: string) => Promise<void>;
  /** Removes the cached menu entry for the given root category / language / user. */
  clearCache: (rootCategoryId: number, language: string, userKey?: string) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CACHE_TTL_DEFAULT = 12 * 60 * 60 * 1000; // 12h

// Module-level inflight dedup map — prevents two concurrent fetchMenu calls for
// the same key (e.g. Menu + HomeFallback both mounting at the same time) from
// both hitting the API. The second caller awaits the promise and reads from cache.
const inflightFetches = new Map<string, Promise<void>>();

// ── Pure helpers (module-level, no reactive deps) ─────────────────────────────

/**
 * Builds recursive `categories { ... }` fragment string for the GraphQL query.
 */
function buildCategoriesQuery(depth: number): string {
  if (depth === 0) return '';
  return `
    categories {
      categoryId
      hidden
      names { value language }
      slugs { value language }
      ${buildCategoriesQuery(depth - 1)}
    }
  `;
}

/**
 * Maps a raw SDK category (LocalizedString arrays) to a flat MenuCategory.
 * Picks the entry matching `language`, falls back to the first translation that
 * exists.
 *
 * That fallback only works because the query asks for `names`/`slugs` with NO
 * language argument, so every translation comes back. It used to filter
 * server-side — `names(language: $language)` — which meant a category with no
 * translation in the active language returned an EMPTY array, `[0]` was
 * `undefined` too, and the row rendered with a blank label and an empty slug:
 * invisible and unclickable. An untranslated category now falls back to the
 * name it does have rather than disappearing from the menu.
 */
function mapCategory(raw: MenuCategoryRaw, language: string): MenuCategory {
  const nameEntry = raw.names?.find(n => n.language === language) ?? raw.names?.[0];
  const slugEntry = raw.slugs?.find(s => s.language === language) ?? raw.slugs?.[0];
  return {
    categoryId: raw.categoryId,
    name: nameEntry?.value ?? '',
    slug: slugEntry?.value ?? '',
    children: (raw.categories ?? [])
      .filter(child => !isHidden(child))
      .map(child => mapCategory(child, language)),
  };
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * useMenu — category-tree fetch with a depth-configurable recursive GraphQL query.
 *
 * @param options - see {@link UseMenuOptions}.
 * @returns the category tree, loading/error state and fetch/cache actions — see {@link UseMenuReturn}.
 *
 * @remarks
 * GraphQL integration: unlike the SDK-service hooks, `fetchMenu` runs a raw query
 * directly via `graphqlClient.query()` — it builds a recursive `categories { ... }`
 * fragment to the configured `depth` and reads the root category's children.
 * Results are cached in `localStorage` with a 12h TTL under a key scoped by root
 * category, language and `userKey`. A module-level `inflightFetches` map dedups
 * concurrent fetches for the same key so a second caller awaits the first and reads
 * from cache. The category query is public and needs no authenticated session.
 */
export function useMenu(options: UseMenuOptions): UseMenuReturn {
  const { graphqlClient } = options;
  const language = options.language ?? 'NL';
  const depth = options.depth ?? 3;
  const cacheTtlMs = options.cacheTtlMs ?? CACHE_TTL_DEFAULT;

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Cache helpers ──────────────────────────────────────────────────────────

  function cacheKey(categoryId: number, lang: string, userKey = ''): string {
    return `propeller_menu_${categoryId}_${lang}${userKey ? `_${userKey}` : ''}`;
  }

  function getFromCache(key: string): MenuCategory[] | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed: { data: MenuCategory[]; expiresAt: number } = JSON.parse(raw);
      // Reject stale format (old Menu.tsx stored { data: Category, expires: ... })
      if (!Array.isArray(parsed.data)) { localStorage.removeItem(key); return null; }
      if (Date.now() > parsed.expiresAt) { localStorage.removeItem(key); return null; }
      return parsed.data;
    } catch { return null; }
  }

  function saveToCache(key: string, data: MenuCategory[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify({ data, expiresAt: Date.now() + cacheTtlMs }));
    } catch { /* localStorage quota exceeded — silently ignore */ }
  }

  const clearCache = useCallback((rootCategoryId: number, lang: string, userKey = ''): void => {
    if (typeof window === 'undefined') return;
    try { localStorage.removeItem(cacheKey(rootCategoryId, lang, userKey)); } catch {}
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchMenu = useCallback(async (rootCategoryId: number, userKey = ''): Promise<void> => {
    const key = cacheKey(rootCategoryId, language, userKey);
    const cached = getFromCache(key);
    if (cached) { setCategories(cached); return; }

    // Piggyback on an in-flight fetch for the same key instead of firing a
    // duplicate request (e.g. Menu + HomeFallback both mounting simultaneously).
    if (inflightFetches.has(key)) {
      setLoading(true);
      await inflightFetches.get(key);
      setLoading(false);
      const fresh = getFromCache(key);
      if (fresh) setCategories(fresh);
      return;
    }

    setLoading(true);
    setError(null);

    let resolve!: () => void;
    const promise = new Promise<void>(res => { resolve = res; });
    inflightFetches.set(key, promise);

    try {
      // Build recursive query — buildCategoriesQuery() fragment + query string
      // No `$language`: the localized fields are fetched unfiltered so
      // `mapCategory` can fall back when a category has no translation in the
      // active language. Declaring an unused variable is a GraphQL validation
      // error ("All Variables Used"), so it is gone from the signature too —
      // `language` still keys the cache and drives the pick in `mapCategory`.
      const gql = `
        query Menu($categoryId: Float) {
          category(categoryId: $categoryId) {
            categoryId
            hidden
            names { value language }
            slugs { value language }
            ${buildCategoriesQuery(depth)}
          }
        }
      `;
      const variables: Record<string, unknown> = { categoryId: rootCategoryId };

      // graphqlClient.query() extracts .data and throws on GraphQL errors
      const data = await graphqlClient.query<{ category: MenuCategoryRaw }>(gql, variables);
      const root = data?.category ?? null;

      // Return subcategories of root (L1 items) — same as Menu.tsx getSubCategories(rootCategory)
      const items: MenuCategory[] = root
        ? (root.categories ?? [])
            .filter(cat => !isHidden(cat))
            .map(cat => mapCategory(cat, language))
        : [];

      setCategories(items);
      if (items.length > 0) saveToCache(key, items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch menu');
    } finally {
      inflightFetches.delete(key);
      resolve();
      setLoading(false);
    }
  }, [graphqlClient, language, depth, cacheTtlMs]);

  return { categories, loading, error, fetchMenu, clearCache };
}
