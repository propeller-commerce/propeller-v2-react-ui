/**
 * @rsc-safe — Pure display component. No React hooks, no event handlers, no
 * browser APIs, no context reads. Renders directly from props and can be
 * imported into a React Server Component without a 'use client' boundary.
 * Verified C0.2 (2026-05-20).
 */
import * as React from 'react';
import {
  PaginatedMediaDocumentResponse,
  MediaDocument,
  LocalizedDocument,
  LocalizedString,
} from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface ProductDownloadsProps {
  /**
   * Media documents for the product.
   * Obtain from `product.media.documents`.
   */
  downloads: PaginatedMediaDocumentResponse;

  /**
   * Language code used to resolve the correct localised document URL and label.
   */
  language: string;

  /**
   * Override any UI string.
   * Available keys: title, download, empty
   */
  labels?: Record<string, string>;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
/**
 * Renders a product's downloadable media documents as a list of localised
 * download links, or an empty-state message when there are none.
 */
function ProductDownloads(props: ProductDownloadsProps) {
  const items: MediaDocument[] = props.downloads?.items || [];
  const hasItems = items.length > 0;
  const lang = props.language || 'NL';
  function getDocumentUrl(doc: MediaDocument): string {
    const docs = doc.documents || [];
    const match = docs.find((d: LocalizedDocument) => d.language === lang);
    return match?.originalUrl || docs?.[0]?.originalUrl || '';
  }
  function getDocumentName(doc: MediaDocument): string {
    const alts = doc.alt || [];
    const match = alts.find((a: LocalizedString) => a.language === lang);
    return match?.value || alts?.[0]?.value || 'Download';
  }
  return (
    <div className={cn(`propeller-product-downloads ${props.className || ''}`)}>
      {hasItems ? (
        <h3 className="propeller-product-downloads__title text-base font-semibold text-foreground mb-3">
          {getLabel(props.labels, 'title', 'Downloads')}
        </h3>
      ) : null}
      {hasItems ? (
        <ul className="propeller-product-downloads__list space-y-2">
          {items.map((doc, index) => (
            <li className="propeller-product-downloads__item" key={index}>
              {!!getDocumentUrl(doc) ? (
                <a
                  target="_blank"
                  className="propeller-product-downloads__link flex items-center gap-3 rounded-container border border-border bg-card px-4 py-3 text-sm text-foreground hover:bg-muted/30 hover:border-primary/40 transition-colors group"
                  href={getDocumentUrl(doc)}
                  download
                >
                  <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      strokeWidth={1.5}
                    />
                  </svg>
                  <span className="flex-1 min-w-0 truncate">{getDocumentName(doc)}</span>
                  <svg
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      strokeWidth={2}
                    />
                  </svg>
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!hasItems ? (
        <p className="propeller-product-downloads__empty text-sm text-muted-foreground">{getLabel(props.labels, 'empty', 'No downloads')}</p>
      ) : null}
    </div>
  );
}

export default ProductDownloads;
