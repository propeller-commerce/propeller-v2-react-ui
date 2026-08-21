/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import type { Category, LocalizedString } from '@propeller-commerce/propeller-sdk-v2';
import { cn } from '../composables/shared/utils/cn';

export interface CategoryShortDescriptionProps {
  // ── Required ────────────────────────────────────────────────────────────

  /**
   * Language code used to resolve the correct localised short description
   * from `category.shortDescriptions`.
   */
  language: string;

  // ── Optional ────────────────────────────────────────────────────────────

  /**
   * Propeller Category object.
   * The component reads `category.shortDescriptions` (an array of LocalizedString)
   * and renders the matching language entry as HTML.
   */
  category?: Category;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
/**
 * Renders a category's localised HTML short description.
 */
function CategoryShortDescription(props: CategoryShortDescriptionProps) {
  // Derived from props — computed once on render.
  const match = props.category?.shortDescriptions?.find(
    (d: LocalizedString) => d.language === props.language,
  );
  const html = match?.value || '';
  return (
    <>
      {!!html ? (
        <div className={cn(`propeller-category-short-description mb-6 ${props.className || ''}`)}>
          <div
            className="propeller-category-short-description__content prose prose-slate max-w-none text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : null}
    </>
  );
}

export default CategoryShortDescription;
