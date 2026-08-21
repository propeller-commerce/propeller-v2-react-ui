/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import { Category, LocalizedString } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface BreadcrumbsProps {
  /**
   * The category path from the category, product or cluster response.
   * Obtain from `category.categoryPath` or `product.category.categoryPath`.
   */
  categoryPath: Category[];

  /**
   * When true (default), the last item in the path is displayed as the
   * current page (non-clickable, aria-current="page").
   * When false, the last item is omitted.
   * Ignored when `currentLabel` is provided — the extra crumb becomes
   * the current page instead.
   */
  showCurrent?: boolean;

  /**
   * The category of the current page. When provided and not already
   * the last item in `categoryPath`, it is appended automatically so
   * the trail always ends at the current category. This makes the
   * component correct whether the API's categoryPath includes the
   * current category or only its ancestors.
   */
  currentCategory?: Category;

  /**
   * Optional trailing crumb appended after the category path — typically
   * the name of the current product or cluster on a detail page.
   * When provided, this crumb is marked as the current page and the
   * last category becomes a normal link.
   */
  currentLabel?: string;

  /**
   * Optional URL for the trailing `currentLabel` crumb. When omitted,
   * the crumb is rendered as a non-link `<span>`.
   */
  currentUrl?: string;

  /**
   * When true (default), a "Home" link is prepended to the trail.
   */
  showHome?: boolean;

  /**
   * URL for the Home link. Defaults to '/'.
   */
  homeUrl?: string;

  /**
   * Language code used to resolve localised category names and slugs.
   * Defaults to 'NL'.
   */
  language?: string;

  /**
   * Custom URL builder for category links.
   * Receives the Category object and its zero-based index in the path.
   * When omitted, URLs default to `/category/{categoryId}/{slug}`.
   */
  getUrl?: (category: Category, index: number) => string;

  /**
   * Override any UI string.
   * Available keys: home, separator
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /** Configuration object passed to the component */
  configuration?: any;
}
/**
 * Renders a breadcrumb trail from a category path, with an optional Home link
 * and an optional trailing crumb for the current product/cluster page.
 */
function Breadcrumbs(props: BreadcrumbsProps) {
  const lang = props.language || 'NL';
  // Filter the path to drop the base category, then optionally append the
  // explicit currentCategory if the API didn't already include it as the tail.
  const path = props.categoryPath || [];
  const baseId = props.configuration?.baseCategoryId;
  const filtered = baseId
    ? path.filter((cat: Category) => cat.categoryId !== baseId)
    : path;
  let items = filtered;
  if (props.currentCategory) {
    const last = filtered[filtered.length - 1];
    if (!last || last.categoryId !== props.currentCategory.categoryId) {
      items = [...filtered, props.currentCategory];
    }
  }
  const displayItems = props.showCurrent === false && items.length > 0
    ? items.slice(0, items.length - 1)
    : items;
  function getCategoryName(cat: Category): string {
    const match = cat.names?.find((n: LocalizedString) => n.language === lang);
    return match?.value || cat.names?.[0]?.value || '';
  }
  function getCategoryUrl(cat: Category, index: number): string {
    if (props.getUrl) return props.getUrl(cat, index);
    // Consumer-provided URL builder takes precedence. Fall back to the
    // configuration helper when present (legacy boilerplate pattern), then
    // to the documented default `/category/{categoryId}/{slug}` URL.
    // Reading `configuration.urls.getCategoryUrl` unconditionally crashed
    // pages that don't thread `configuration` into the Breadcrumbs island
    // (CategoryBreadcrumbsIsland / ProductBreadcrumbsIsland in the Next
    // boilerplate both pass only `categoryPath` + `labels`).
    // Invoke the configuration helper as a method (not via an extracted
    // reference) so that `this` is still bound to `configuration.urls` —
    // some boilerplates write the helper as `getCategoryUrl(...) { return
    // ...this.pattern... }` and detaching the reference crashes with
    // "Cannot read properties of undefined (reading 'pattern')".
    const urls = props.configuration?.urls;
    if (urls && typeof urls.getCategoryUrl === 'function') {
      return urls.getCategoryUrl(cat, props.language);
    }
    const slug = cat.slugs?.find((s: LocalizedString) => s.language === lang)?.value
      || cat.slugs?.[0]?.value
      || '';
    return `/category/${cat.categoryId}/${slug}`;
  }
  function isCurrentItem(index: number): boolean {
    if (props.showCurrent === false) return false;
    if (props.currentLabel) return false;
    return index === displayItems.length - 1;
  }
  // Show separator when Home precedes this item, or when a previous category item exists.
  const showSeparatorBefore = (index: number) =>
    props.showHome !== false || index > 0;
  return (
    <nav aria-label={getLabel(props.labels, 'breadcrumbAriaLabel', 'Breadcrumb')} className={cn(`propeller-breadcrumbs ${props.className || ''}`)}>
      <ol className="propeller-breadcrumbs__list flex flex-wrap items-center text-sm text-muted-foreground">
        {props.showHome !== false ? (
          <li className="propeller-breadcrumbs__item flex items-center" data-home="true">
            <a
              className="propeller-breadcrumbs__link hover:text-foreground transition-colors"
              href={props.homeUrl || '/'}
            >
              {getLabel(props.labels, 'home', 'Home')}
            </a>
          </li>
        ) : null}
        {displayItems.map((cat, index) => (
          <li
            className="propeller-breadcrumbs__item flex items-center"
            key={cat.categoryId || index}
            data-current={isCurrentItem(index) ? 'true' : 'false'}
          >
            {showSeparatorBefore(index) ? (
              <span aria-hidden="true" className="propeller-breadcrumbs__separator mx-2 select-none text-muted-foreground/40">
                {getLabel(props.labels, 'separator', '/')}
              </span>
            ) : null}
            {isCurrentItem(index) ? (
              <span
                aria-current="page"
                className="propeller-breadcrumbs__link propeller-breadcrumbs__link--current text-foreground"
              >
                {getCategoryName(cat)}
              </span>
            ) : null}
            {!isCurrentItem(index) ? (
              <a
                className="propeller-breadcrumbs__link hover:text-foreground transition-colors"
                href={getCategoryUrl(cat, index)}
              >
                {getCategoryName(cat)}
              </a>
            ) : null}
          </li>
        ))}
        {props.currentLabel ? (
          <li
            className="propeller-breadcrumbs__item flex items-center"
            data-current="true"
          >
            <span aria-hidden="true" className="propeller-breadcrumbs__separator mx-2 select-none text-muted-foreground/40">
              {getLabel(props.labels, 'separator', '/')}
            </span>
            {props.currentUrl ? (
              <a
                aria-current="page"
                className="propeller-breadcrumbs__link propeller-breadcrumbs__link--current text-foreground"
                href={props.currentUrl}
              >
                {props.currentLabel}
              </a>
            ) : (
              <span
                aria-current="page"
                className="propeller-breadcrumbs__link propeller-breadcrumbs__link--current text-foreground"
              >
                {props.currentLabel}
              </span>
            )}
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
