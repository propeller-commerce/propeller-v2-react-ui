'use client';
/**
 * @rsc-blocked — Client-only component: JSX event handlers (onClick).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { SparePartsMachine } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface MachineCardProps {
  // === Core ===

  /** The machine (spare-parts tree node) to display. */
  machine: SparePartsMachine;

  /**
   * Destination for the card link — the child node's URL.
   *
   * Passed in rather than derived from `configuration.urls` because a machine's
   * URL is its ancestor path (`/machines/a/b/c`), which only the host route
   * knows; the machine object carries just its own slug.
   */
  href: string;

  // === Display toggles ===

  /** Show the machine image. Defaults to true. */
  showImage?: boolean;

  /** Show the machine description under the name. Defaults to false. */
  showDescription?: boolean;

  // === Locale / labels ===

  /** Language used to resolve the localized name/description. */
  language?: string;

  /** UI label overrides. Supported key: `viewMachine`. */
  labels?: Record<string, string>;

  // === Escape hatches ===

  /** Extra classes on the card root. */
  className?: string;

  /** Click handler for the card link (e.g. analytics). Does not prevent navigation. */
  onClick?: (machine: SparePartsMachine) => void;
}

/** First image variant URL, mirroring `getProductImageUrl`'s media walk. */
function getMachineImageUrl(machine: SparePartsMachine | null | undefined): string {
  return machine?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '';
}

/**
 * A single node in the spare-parts machine tree, rendered as a card that
 * navigates one level deeper.
 *
 * Deliberately a plain link, not an add-to-cart surface: a machine is a
 * container you browse into. (The WP reference styles this link with its
 * add-to-basket button class, which reads as "buy" — not copied.)
 */
export default function MachineCard(props: MachineCardProps): React.JSX.Element {
  const { machine, href, language } = props;
  const showImage = props.showImage ?? true;
  const showDescription = props.showDescription ?? false;

  const name = getLocalizedValue(machine.name, language);
  const description = showDescription
    ? getLocalizedValue(machine.description, language)
    : '';
  const imageUrl = showImage ? getMachineImageUrl(machine) : '';

  const handleClick = (): void => props.onClick?.(machine);

  return (
    <div
      className={cn(`propeller-machine-card group relative flex h-full flex-col overflow-hidden rounded-lg border border-border bg-background ${props.className ?? ''}`)}
    >
      <a
        href={href}
        onClick={handleClick}
        className="flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {showImage && (
          <div className="propeller-machine-card__image aspect-square w-full overflow-hidden bg-background-subtle">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                loading="lazy"
                className="h-full w-full object-contain object-top"
              />
            ) : (
              /* Empty alt + aria-hidden: decorative placeholder, the name below
                 already labels the card for screen readers. */
              <div
                aria-hidden="true"
                className="propeller-machine-card__image-placeholder flex h-full w-full items-center justify-center text-foreground-subtle"
              >
                <svg
                  className="h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm9 4.5 9-4.5m-9 4.5-9-4.5m9 4.5V21"
                  />
                </svg>
              </div>
            )}
          </div>
        )}

        <div className="propeller-machine-card__body flex flex-1 flex-col gap-1 p-4">
          <span className="propeller-machine-card__name font-medium text-foreground group-hover:text-primary">
            {name}
          </span>

          {description && (
            <span className="propeller-machine-card__description line-clamp-2 text-sm text-foreground-subtle">
              {description}
            </span>
          )}

          {/* Styled as a full-width button matching AddToCart's secondary
              colour. It's a span, not a button — the whole card is already the
              <a>, and a button inside an anchor is invalid; group-hover mirrors
              AddToCart's hover since the card is the hover target. */}
          <span className="propeller-machine-card__view mt-auto inline-flex w-full items-center justify-center rounded-control h-10 px-6 text-sm font-medium text-secondary-foreground bg-secondary transition-colors group-hover:bg-secondary/90">
            {getLabel(props.labels, 'viewMachine', 'View')}
          </span>
        </div>
      </a>
    </div>
  );
}
