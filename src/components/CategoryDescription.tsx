'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import type { Category, LocalizedString } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface CategoryDescriptionProps {
  // ── Required ────────────────────────────────────────────────────────────

  /**
   * Language code used to resolve the correct localised description
   * from `category.description`.
   */
  language: string;

  // ── Optional ────────────────────────────────────────────────────────────

  /**
   * Propeller Category object.
   * The component reads `category.description` (an array of LocalizedString)
   * and renders the matching language entry as HTML.
   */
  category?: Category;

  /**
   * When `true` (default), the description is truncated to `maxLength`
   * characters and a "Read more" / "Read less" toggle is shown.
   */
  collapsed?: boolean;

  /**
   * Maximum number of characters to display before truncating.
   * Only applies when `collapsed` is `true`.
   * Defaults to 200.
   */
  maxLength?: number;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /** Translated labels: `readMore`, `readLess`. */
  labels?: Record<string, string>;
}
/**
 * Renders a category's localised HTML description, optionally truncated with a
 * "Read more" / "Read less" toggle.
 */
function CategoryDescription(props: CategoryDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  // All values below are derived from props or local state — pure, computed on render.
  const match = props.category?.descriptions?.find(
    (d: LocalizedString) => d.language === props.language,
  );
  const html = match?.value || '';
  const maxLen = props.maxLength || 200;
  const shouldTruncate = props.collapsed !== false && html.length > maxLen;
  function getTruncated(): string {
    const plain = html.replace(/<[^>]*>/g, '');
    if (plain.length <= maxLen) return html;
    const truncated = plain.substring(0, maxLen);
    return truncated.substring(0, truncated.lastIndexOf(' ')) + '…';
  }
  return (
    <>
      {!!html ? (
        <div
          className={cn(`propeller-category-description mb-6 ${props.className || ''}`)}
          data-expanded={expanded ? 'true' : 'false'}
          data-truncatable={shouldTruncate ? 'true' : 'false'}
        >
          {!shouldTruncate || expanded ? (
            <div
              className="propeller-category-description__content prose prose-slate max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <p className="propeller-category-description__truncated text-muted-foreground">{getTruncated()}</p>
          )}
          {shouldTruncate ? (
            <button
              type="button"
              className="propeller-category-description__toggle mt-2 text-sm font-medium text-primary hover:underline"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded
                ? getLabel(props.labels, 'readLess', 'Read less')
                : getLabel(props.labels, 'readMore', 'Read more')}
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export default CategoryDescription;
