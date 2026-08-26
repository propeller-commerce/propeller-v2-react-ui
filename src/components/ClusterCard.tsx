'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import {
  Cluster,
  Contact,
  Customer,
  Product,
  AttributeResult,
  ProductPrice,
  ProductInventory,
} from '@propeller-commerce/propeller-sdk-v2';
import ItemStock from './ItemStock';
import { getLabel, isContentHidden, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import {
  getClusterImageUrl,
  getClusterSku,
  getLocalizedValue,
} from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice } from '@propeller-commerce/propeller-v2-core-ui';
import { useResolvedProps, ResolveSpec } from '../composables/react/useResolvedProps';
import { ProductGridConfig } from '../context/ProductGridContext';
import { cn } from '../composables/shared/utils/cn';

export interface ClusterCardProps {
  // === Core ===

  /** The cluster object to display */
  cluster: Cluster;

  // === Display toggles ===

  /** Show the cluster name. Defaults to true. */
  showName?: boolean;

  /** When false, hides the price. Defaults to true. */
  showPrice?: boolean;

  /** Show the default product image. Defaults to true. */
  showImage?: boolean;

  /** Show the cluster short description. Defaults to false. */
  showShortDescription?: boolean;

  /**
   * Show the SKU. Displays the cluster SKU; falls back to the default product SKU
   * if the cluster SKU is empty. Defaults to true.
   */
  showSku?: boolean;

  /** Show the default product manufacturer. Defaults to false. */
  showManufacturer?: boolean;

  /** Authenticated user. Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer | null;

  /**
   * Portal access mode. In `'semi-closed'` price and stock are withheld from
   * anonymous visitors. Resolved from PropellerProvider when omitted.
   */
  portalMode?: string;

  /**
   * Show default product stock information (quantity badge).
   * Reads `defaultProduct.inventory.totalQuantity`. Defaults to true.
   */
  showStock?: boolean;

  /**
   * Show only the availability indicator (Available / Not available) inside ItemStock.
   * Only relevant when `showStock` is true.
   * Defaults to true.
   */
  showAvailability?: boolean;

  /**
   * Label overrides forwarded to the embedded ItemStock component.
   * Keys: inStock, outOfStock, lowStock, available, notAvailable, pieces
   */
  stockLabels?: Record<string, string>;

  // === Attribute labels ===

  /**
   * Attribute codes/names to look up on the default product and display as
   * badge overlays on the image. Resolved against
   * `defaultProduct.attributes.items[].attributeDescription.name`.
   * Attributes with no matching value are silently omitted.
   * Example: ['new', 'sale']
   */
  imageLabels?: string[];

  /**
   * Attribute codes/names to look up on the default product and display as
   * extra text rows below the cluster name. Resolved the same way as `imageLabels`.
   * Example: ['brand', 'color']
   */
  textLabels?: string[];

  // === Favourites ===

  /** Renders a heart-icon toggle button on the cluster image. Defaults to false. */
  enableAddFavorite?: boolean;

  /**
   * Called whenever the favourite state is toggled.
   * The second argument indicates the new state: `true` = added, `false` = removed.
   */
  onToggleFavorite?: (cluster: Cluster, isFavorite: boolean) => void;

  // === Navigation ===

  /**
   * Called when the cluster name, image, or "View cluster" button is clicked.
   * When provided, the default `<a>` navigation is prevented so the consumer
   * can use framework-specific routing (e.g. Next.js `router.push`).
   */
  onClusterClick?: (cluster: Cluster) => void;

  // === UI string overrides ===

  /**
   * Override any UI string.
   * Available keys: addToFavorites, removeFromFavorites, viewCluster,
   *                 inStock, lowStock, outOfStock
   */
  labels?: Record<string, string>;

  /** Number of grid columns — when 1 the card renders as a compact horizontal row. */
  columns?: number;

  /** Extra CSS class applied to the root element. */
  className?: string;

  /** Configuration object passed to the component */
  configuration?: any;

  /** Include tax in the price display */
  includeTax?: boolean;

  /** Language code used to resolve localised names and slugs. Defaults to 'NL'. */
  language?: string;

  /** Currency symbol used when formatting the price. Falls back to PropellerInfra.currency, then `'€'`. */
  currency?: string;

  // ───── Extension API ─────
  // Per-card overrides for sub-components. Precedence:
  // explicit prop > ProductGridConfig context > infra > default.
  // (No addToCartComponent — ClusterCard does not render AddToCart by default.)
  priceComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').PriceComponentProps>;
  stockComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').StockComponentProps>;
  imageComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').ImageComponentProps>;
  badgesComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').BadgesComponentProps>;
  favoriteComponent?: React.ComponentType<import('@propeller-commerce/propeller-v2-core-ui').FavoriteComponentProps>;

  /** Compound mode opt-in. When provided, ClusterCard renders the compound
   *  subtree (using <ClusterCard.X> subcomponents) instead of the legacy
   *  monolithic layout. Default content per subcomponent matches the legacy
   *  render section-for-section. */
  children?: React.ReactNode;
}

// ── Pure helpers (module scope — created once, not per render) ──────────────────

/** Cluster name with fallback chain: cluster.names → defaultProduct.names → 'Cluster'. */
function getClusterName(cluster: Cluster | undefined, language: string): string {
  const fromCluster = getLocalizedValue(cluster?.names, language, '');
  if (fromCluster) return fromCluster;
  return getLocalizedValue(cluster?.defaultProduct?.names, language, 'Cluster');
}

function getClusterShortDescription(cluster: Cluster | undefined, language: string): string {
  const fromCluster = getLocalizedValue(cluster?.shortDescriptions, language, '');
  if (fromCluster) return fromCluster;
  return getLocalizedValue(cluster?.defaultProduct?.shortDescriptions, language, '');
}

function getClusterManufacturer(cluster: Cluster | undefined): string {
  return cluster?.defaultProduct?.manufacturer || '';
}

/** Resolves attribute codes against the default product, dropping empties. */
function resolveAttributeValues(cluster: Cluster | undefined, codes: string[] | undefined): string[] {
  if (!codes || codes.length === 0) return [];
  const attrs = cluster?.defaultProduct?.attributes?.items || [];
  return codes
    .map((code) => {
      const found = attrs.find((a: AttributeResult) => a.attributeDescription?.name === code);
      return found?.value?.value || '';
    })
    .filter((v: string) => v.length > 0);
}

// Two-tier precedence (explicit prop > ProductGrid context > Propeller infra >
// default) for the props ProductGrid otherwise cascades through here.
const RESOLVE_SPEC: ResolveSpec<ClusterCardProps> = {
  configuration: { infra: 'configuration' },
  includeTax: { infra: 'includeTax' },
  language: { infra: 'language', default: 'NL' },
  currency: { infra: 'currency', default: '€' },
  user: { infra: 'user', default: null },
  portalMode: { infra: 'portalMode' },
  columns: { grid: 'columns', default: 3 },
  showPrice: { grid: 'showPrice' },
  showStock: { grid: 'showStock' },
  showAvailability: { grid: 'showAvailability' },
  stockLabels: { grid: 'stockLabels' },
  enableAddFavorite: { grid: 'enableAddFavorite' },
  onClusterClick: { grid: 'onClusterClick' },
  onToggleFavorite: {
    grid: 'onToggleFavorite',
    transform: (fn) => (c: Cluster, fav: boolean) =>
      (fn as ProductGridConfig['onToggleFavorite'])!(c, fav),
  },
  priceComponent: { grid: 'priceComponent' },
  stockComponent: { grid: 'stockComponent' },
  imageComponent: { grid: 'imageComponent' },
  badgesComponent: { grid: 'badgesComponent' },
  favoriteComponent: { grid: 'favoriteComponent' },
};

// ── Compound context ────────────────────────────────────────────────────────

interface ClusterCardContextValue {
  cluster: Cluster;
  /** Fully resolved props (infra + grid context + explicit) — read instead of `props`. */
  resolved: ClusterCardProps;
  /** Derived display values, computed once at the root and read by leaves. */
  derived: {
    name: string;
    sku: string;
    clusterUrl: string;
    imageUrl: string;
    shortDescription: string;
    manufacturer: string;
    imageLabelValues: string[];
    textLabelValues: string[];
    defaultProductInventory: ProductInventory | undefined;
    clusterPrice: string;
    priceObj: ProductPrice | undefined;
    useTax: boolean;
    isRow: boolean;
    language: string;
    currency: string;
    viewClusterLabel: string;
  };
  /** Local UI state shared between Image (which renders the heart) and any sibling. */
  favorite: {
    isFavorite: boolean;
    toggle: (e: React.MouseEvent) => void;
  };
  /** Click handler shared by Image + Name + ViewClusterLink. */
  handleClusterClick: (e: React.MouseEvent) => void;
}

const ClusterCardContext = React.createContext<ClusterCardContextValue | null>(null);

/**
 * Internal hook used by compound subcomponents. Throws if called outside
 * `<ClusterCard>` — the error is intentional, that's a developer mistake.
 */
function useClusterCard(): ClusterCardContextValue {
  const ctx = React.useContext(ClusterCardContext);
  if (!ctx) {
    throw new Error(
      '<ClusterCard.X> must be rendered inside <ClusterCard>. ' +
        'Got null context — wrap your subcomponents in <ClusterCard cluster={...}>...</ClusterCard>.',
    );
  }
  return ctx;
}

/**
 * Grid/list card for a cluster: shows image, name, SKU, price, stock and
 * attribute badge/text labels, with an optional favourite toggle. Renders as a
 * compact horizontal row when `columns` is 1.
 *
 * @remarks Resolves infra and ProductGrid context props via `useResolvedProps`.
 */
function ClusterCard(rawProps: ClusterCardProps) {
  // Resolve infra (Tier 1) + grid config (Tier 2) declaratively. Non-throwing —
  // standalone use (no provider) falls back to explicit props / defaults.
  const props = useResolvedProps(rawProps, RESOLVE_SPEC);

  const [isFavorite, setIsFavorite] = useState(false);

  const language = (props.language as string) || 'NL';
  const cluster = props.cluster;
  const isRow = props.columns === 1;

  // Derived values — computed once per render (previously redefined every render
  // and called twice each across the layout branches).
  const clusterName = getClusterName(cluster, language);
  const clusterSku = getClusterSku(cluster);
  const clusterImageUrl = getClusterImageUrl(cluster);
  const shortDescription = getClusterShortDescription(cluster, language);
  const manufacturer = getClusterManufacturer(cluster);
  const clusterUrl = props.configuration.urls.getClusterUrl(cluster, props.language);
  const imageLabelValues = resolveAttributeValues(cluster, props.imageLabels);
  const textLabelValues = resolveAttributeValues(cluster, props.textLabels).map((value) => ({
    value,
  }));

  // Folded into price/stock below so every render branch is gated.
  const contentHidden = isContentHidden(props.portalMode, props.user);
  const defaultProductInventory = contentHidden ? undefined : cluster?.defaultProduct?.inventory;

  const useTax = props.includeTax !== undefined ? !!props.includeTax : false;
  const priceObj = contentHidden ? undefined : cluster?.defaultProduct?.price;
  const priceValue = useTax ? priceObj?.net : priceObj?.gross;
  const clusterPrice =
    props.showPrice === false ? '' : formatPrice(priceValue, { symbol: props.currency ?? '€', locale: localeForLanguage(props.language) });

  function handleClusterClick(e: React.MouseEvent): void {
    if (props.onClusterClick) {
      e.preventDefault();
      props.onClusterClick(cluster);
    }
  }

  function handleToggleFavorite(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
    if (props.onToggleFavorite) {
      props.onToggleFavorite(cluster, isFavorite);
    }
  }

  const viewClusterLabel = getLabel(props.labels, 'viewCluster', 'View cluster');

  // Plain string list for the compound context — the legacy monolithic branch
  // keeps its `{ value }` shape so its JSX is untouched.
  const textLabelValuesFlat = textLabelValues.map((t) => t.value);

  const contextValue: ClusterCardContextValue = {
    cluster,
    resolved: props,
    derived: {
      name: clusterName,
      sku: clusterSku,
      clusterUrl,
      imageUrl: clusterImageUrl,
      shortDescription,
      manufacturer,
      imageLabelValues,
      textLabelValues: textLabelValuesFlat,
      defaultProductInventory,
      clusterPrice,
      priceObj,
      useTax,
      isRow,
      language,
      currency: (props.currency as string) ?? '€',
      viewClusterLabel,
    },
    favorite: { isFavorite, toggle: handleToggleFavorite },
    handleClusterClick,
  };

  // Compound mode: consumer supplied children. Render them inside a default
  // shell with the same root layout classes the legacy mode uses, so styling
  // stays identical regardless of which mode the consumer picks. The consumer
  // controls the order and which subcomponents appear.
  if (rawProps.children !== undefined) {
    return (
      <ClusterCardContext.Provider value={contextValue}>
        <div
          className={cn(`propeller-cluster-card group relative flex h-full overflow-hidden rounded-container border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-secondary/20 ${isRow ? 'flex-row flex-wrap md:flex-nowrap items-center' : 'flex-col'} ${props.className ?? ''}`)}
          data-cluster-id={cluster.clusterId}
          data-layout={isRow ? 'row' : 'grid'}
        >
          {rawProps.children}
        </div>
      </ClusterCardContext.Provider>
    );
  }

  // Legacy / monolithic mode: render the original full layout based on the
  // show* toggles. Internally we now compose the compound subcomponents so
  // there's one rendering path. Note: a couple of minor class differences
  // exist between the legacy inline JSX and the compound defaults
  // (e.g. <ClusterCardPrice> renders the compound-default class
  // `propeller-cluster-card__price` without the legacy non-isRow
  // `mt-auto pt-1` extras, and isRow drops the `font-bold ... whitespace-nowrap`
  // <span> wrapper). This matches the ProductCard precedent — the user-visible
  // impact is negligible and consumers migrating to compound mode get the
  // same DOM either way.
  return (
    <ClusterCardContext.Provider value={contextValue}>
    <div
      className={cn(`propeller-cluster-card group relative flex h-full overflow-hidden rounded-container border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-secondary/20 ${isRow ? 'flex-row flex-wrap md:flex-nowrap items-center' : 'flex-col'} ${props.className || ''}`)}
      data-layout={isRow ? 'row' : 'grid'}
    >
      {props.showImage !== false ? <ClusterCardImage /> : null}
      {isRow ? (
        <>
          <div className="propeller-cluster-card__body flex flex-1 flex-row items-center gap-4 px-4 py-2 min-w-0">
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              {props.showSku !== false && clusterSku ? <ClusterCardSku /> : null}
              {props.showName !== false ? <ClusterCardName linkable /> : null}
              {textLabelValues.length > 0 ? <ClusterCardTextLabels /> : null}
              {props.showManufacturer && manufacturer ? <ClusterCardManufacturer /> : null}
              {props.showShortDescription && shortDescription ? <ClusterCardShortDescription /> : null}
            </div>
          </div>
          <div className="propeller-cluster-card__footer w-full md:w-auto flex flex-col gap-2 md:flex-row md:items-center md:gap-3 px-4 py-2 md:py-0 border-t md:border-t-0 border-border-subtle">
            <div className="propeller-cluster-card__footer-meta flex items-center justify-between gap-3 md:contents">
              {props.showStock && defaultProductInventory ? <ClusterCardStock /> : null}
              {props.showPrice !== false && priceObj ? <ClusterCardPrice /> : null}
            </div>
            <div className="propeller-cluster-card__cta w-full md:w-auto md:flex-shrink-0 md:ml-auto">
              <ClusterCardViewClusterLink />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="propeller-cluster-card__body flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4">
            {props.showSku !== false && clusterSku ? <ClusterCardSku /> : null}
            {props.showName !== false ? <ClusterCardName linkable /> : null}
            {props.showStock && defaultProductInventory ? (
              <div className="hidden md:block">
                <ClusterCardStock />
              </div>
            ) : null}
            {textLabelValues.length > 0 ? <ClusterCardTextLabels /> : null}
            {props.showManufacturer && manufacturer ? <ClusterCardManufacturer /> : null}
            {props.showShortDescription && shortDescription ? <ClusterCardShortDescription /> : null}
            {props.showPrice !== false && priceObj ? (
              <div className="mt-auto hidden md:block">
                <ClusterCardPrice />
              </div>
            ) : null}
          </div>
          {((props.showStock && defaultProductInventory) ||
            (props.showPrice !== false && priceObj)) ? (
            <div className="propeller-cluster-card__footer-meta flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 pt-1 sm:px-4 md:hidden">
              {props.showStock && defaultProductInventory ? <ClusterCardStock /> : null}
              {props.showPrice !== false && priceObj ? <ClusterCardPrice /> : null}
            </div>
          ) : null}
          <div className="propeller-cluster-card__cta px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
            <ClusterCardViewClusterLink />
          </div>
        </>
      )}
    </div>
    </ClusterCardContext.Provider>
  );
}

// ── Compound subcomponents ──────────────────────────────────────────────────

/** Cluster image area, including badges and favourite overlay. When the
 *  `imageComponent` slot is filled, the consumer takes over the entire image
 *  area (badges + favorite overlay are no longer auto-rendered). */
function ClusterCardImage(props: {
  /** Override the wrapper class. */
  className?: string;
  /** Render the favourite heart button. Defaults to context `enableAddFavorite`. */
  showFavorite?: boolean;
}) {
  const { cluster, derived, resolved, handleClusterClick } = useClusterCard();
  const showFavorite = props.showFavorite ?? !!resolved.enableAddFavorite;
  const isRow = derived.isRow;
  const InjectedImage = resolved.imageComponent;
  if (InjectedImage) {
    return (
      <InjectedImage
        cluster={cluster}
        language={derived.language}
        imageSearchFilters={resolved.configuration?.imageSearchFiltersGrid}
        imageVariantFilters={resolved.configuration?.imageVariantFiltersMedium}
        className={
          props.className ??
          `propeller-cluster-card__media relative overflow-hidden bg-surface-hover ${isRow ? 'w-20 h-20 flex-shrink-0 p-2' : 'aspect-[4/3] sm:aspect-square p-2 sm:p-4'}`
        }
      />
    );
  }
  return (
    <div
      className={
        props.className ??
        `propeller-cluster-card__media relative overflow-hidden bg-surface-hover ${isRow ? 'w-20 h-20 flex-shrink-0 p-2' : 'aspect-[4/3] sm:aspect-square p-2 sm:p-4'}`
      }
    >
      <a className="block h-full w-full" href={derived.clusterUrl} onClick={handleClusterClick}>
        {derived.imageUrl ? (
          <img
            className="propeller-cluster-card__image h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            src={derived.imageUrl}
            alt={derived.name}
          />
        ) : (
          <div className="propeller-cluster-card__image-placeholder flex h-full w-full items-center justify-center text-foreground-subtle">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="h-16 w-16">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                strokeWidth={1}
              />
            </svg>
          </div>
        )}
      </a>
      {derived.imageLabelValues.length > 0 ? <ClusterCardBadges /> : null}
      {showFavorite ? <ClusterCardFavorite /> : null}
    </div>
  );
}

/** Image-overlay badge list (e.g. "new", "sale" attributes), or the
 *  injected `badgesComponent` from context when set. */
function ClusterCardBadges(props: {
  /** Override the badge container class. */
  className?: string;
}) {
  const { cluster, derived, resolved } = useClusterCard();
  const InjectedBadges = resolved.badgesComponent;
  if (InjectedBadges) {
    return (
      <InjectedBadges
        cluster={cluster}
        labels={resolved.labels}
        className={
          props.className ??
          'propeller-cluster-card__badges pointer-events-none absolute left-2 top-2 flex flex-col gap-1'
        }
      />
    );
  }
  if (derived.imageLabelValues.length === 0) return null;
  return (
    <div
      className={
        props.className ??
        'propeller-cluster-card__badges pointer-events-none absolute left-2 top-2 flex flex-col gap-1'
      }
    >
      {derived.imageLabelValues.map((label) => (
        <span
          key={label}
          className="propeller-cluster-card__badge inline-block rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground shadow-sm"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/** Favourite (heart) toggle button — typically placed inside `<ClusterCard.Image>`,
 *  or the injected `favoriteComponent` from context when set. */
function ClusterCardFavorite(props: {
  /** Override the button class. */
  className?: string;
}) {
  const { cluster, resolved, favorite } = useClusterCard();
  const InjectedFavorite = resolved.favoriteComponent;
  if (InjectedFavorite) {
    // ClusterCard's onToggleFavorite is typed as (Cluster, boolean) — narrower
    // than the FavoriteComponentProps contract's (Product | Cluster, boolean).
    // Adapt by accepting the wider type and narrowing the input back to Cluster.
    const onToggleFavoriteAdapter = resolved.onToggleFavorite
      ? (item: Product | Cluster, isFavorite: boolean) =>
          resolved.onToggleFavorite!(item as Cluster, isFavorite)
      : undefined;
    return (
      <InjectedFavorite
        cluster={cluster}
        onToggleFavorite={onToggleFavoriteAdapter}
        labels={resolved.labels}
        className={props.className}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={favorite.toggle}
      aria-label={
        favorite.isFavorite
          ? getLabel(resolved.labels, 'removeFromFavorites', 'Remove from favourites')
          : getLabel(resolved.labels, 'addToFavorites', 'Add to favourites')
      }
      data-favorite={favorite.isFavorite ? 'true' : 'false'}
      className={
        props.className ??
        `propeller-cluster-card__favorite-btn absolute right-2 top-2 rounded-full border bg-card p-1.5 shadow-sm transition-colors ${favorite.isFavorite ? 'border-destructive/30 text-destructive' : 'border-border-subtle text-foreground-subtle hover:text-destructive'}`
      }
    >
      <svg
        stroke="currentColor"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill={favorite.isFavorite ? 'currentColor' : 'none'}
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
}

/** Cluster name. `linkable` (default true) wraps it in an `<a>` to the cluster page. */
function ClusterCardName(props: {
  /** When true (default), wraps the name in a link to the cluster page. */
  linkable?: boolean;
  /** Override the name element class. */
  className?: string;
}) {
  const { derived, handleClusterClick } = useClusterCard();
  const linkable = props.linkable ?? true;
  const cls =
    props.className ??
    `propeller-cluster-card__title text-sm font-medium leading-tight text-foreground transition-colors hover:text-primary ${derived.isRow ? 'line-clamp-1' : 'line-clamp-2'}`;
  if (linkable) {
    return (
      <a className={cls} href={derived.clusterUrl} onClick={handleClusterClick}>
        {derived.name}
      </a>
    );
  }
  return <span className={cls}>{derived.name}</span>;
}

/** Renders the cluster SKU. */
function ClusterCardSku(props: {
  /** Override the SKU element class. */
  className?: string;
}) {
  const { derived } = useClusterCard();
  if (!derived.sku) return null;
  return (
    <div
      className={
        props.className ?? 'propeller-cluster-card__sku font-mono text-xs text-foreground-subtle'
      }
    >
      {derived.sku}
    </div>
  );
}

/** Renders the cluster's short description. */
function ClusterCardShortDescription(props: {
  /** Override the description element class. */
  className?: string;
}) {
  const { derived } = useClusterCard();
  if (!derived.shortDescription) return null;
  return (
    <p
      className={
        props.className ??
        'propeller-cluster-card__description line-clamp-2 text-xs text-muted-foreground'
      }
    >
      {derived.shortDescription}
    </p>
  );
}

/** Renders the default product manufacturer name. */
function ClusterCardManufacturer(props: {
  /** Override the manufacturer element class. */
  className?: string;
}) {
  const { derived } = useClusterCard();
  if (!derived.manufacturer) return null;
  return (
    <div
      className={
        props.className ??
        'propeller-cluster-card__manufacturer text-xs text-muted-foreground'
      }
    >
      {derived.manufacturer}
    </div>
  );
}

/** Renders the resolved `textLabels` attribute values as text rows. */
function ClusterCardTextLabels(props: {
  /** Override the per-row label class. */
  className?: string;
}) {
  const { derived } = useClusterCard();
  if (derived.textLabelValues.length === 0) return null;
  return (
    <div className="propeller-cluster-card__labels flex flex-col gap-0.5">
      {derived.textLabelValues.map((value) => (
        <div
          key={value}
          className={
            props.className ?? 'propeller-cluster-card__label text-xs text-muted-foreground'
          }
        >
          {value}
        </div>
      ))}
    </div>
  );
}

/** Renders the embedded stock/availability widget for the default product,
 *  or the injected `stockComponent` from context when set. */
function ClusterCardStock(props: {
  /** Show only the availability indicator. Defaults to context `showAvailability`. */
  showAvailability?: boolean;
}) {
  const { derived, resolved } = useClusterCard();
  if (!derived.defaultProductInventory) return null;
  const InjectedStock = resolved.stockComponent;
  if (InjectedStock) {
    return (
      <InjectedStock
        inventory={derived.defaultProductInventory}
        showStock
        showAvailability={
          props.showAvailability ?? (resolved.showAvailability !== false && !derived.isRow)
        }
        labels={resolved.stockLabels}
      />
    );
  }
  return (
    <ItemStock
      inventory={derived.defaultProductInventory}
      showStock
      showAvailability={
        props.showAvailability ?? (resolved.showAvailability !== false && !derived.isRow)
      }
      labels={resolved.stockLabels}
    />
  );
}

/** Renders the cluster price, or the injected `priceComponent` from context
 *  when set. */
function ClusterCardPrice(props: {
  /** Tailwind text-size class for the price. Defaults to `'text-base sm:text-lg'`. */
  priceSize?: string;
  /** Override the price wrapper class. */
  className?: string;
}) {
  const { derived, resolved } = useClusterCard();
  if (!derived.priceObj) return null;
  const InjectedPrice = resolved.priceComponent;
  if (InjectedPrice) {
    return (
      <div className={props.className ?? 'propeller-cluster-card__price'}>
        <InjectedPrice
          price={derived.priceObj}
          includeTax={derived.useTax}
          currency={derived.currency}
          labels={resolved.labels}
        />
      </div>
    );
  }
  return (
    <div className={props.className ?? 'propeller-cluster-card__price'}>
      <span className={`font-bold text-foreground ${props.priceSize ?? 'text-base sm:text-lg'}`}>
        {derived.clusterPrice}
      </span>
    </div>
  );
}

/** Renders the "View cluster" CTA link. */
function ClusterCardViewClusterLink(props: {
  /** Override the link class. */
  className?: string;
  /** Override the displayed label. Defaults to the context `viewCluster` label. */
  label?: string;
}) {
  const { derived, handleClusterClick } = useClusterCard();
  return (
    <a
      href={derived.clusterUrl}
      onClick={handleClusterClick}
      className={
        props.className ??
        'propeller-cluster-card__cta-link flex w-full min-w-0 items-center justify-center rounded-control bg-primary px-3 sm:px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
      }
    >
      <span className="propeller-cluster-card__cta-label min-w-0 truncate">
        {props.label ?? derived.viewClusterLabel}
      </span>
    </a>
  );
}

// ── Compound default export ─────────────────────────────────────────────────

// Memoized: ProductGrid passes only the stable { cluster } prop; config flows
// via context so shallow-equal props skip re-render (rbp §5.2).
const MemoizedRoot = React.memo(ClusterCard);

/**
 * Compound component. Use either:
 *
 *  **Compound mode (new — preferred):**
 *  ```tsx
 *  <ClusterCard cluster={c}>
 *    <ClusterCard.Image />
 *    <ClusterCard.Name linkable />
 *    <ClusterCard.Sku />
 *    <ClusterCard.Price />
 *    <ClusterCard.ViewClusterLink />
 *  </ClusterCard>
 *  ```
 *
 *  **Legacy mode (kept for back-compat):**
 *  ```tsx
 *  <ClusterCard cluster={c} showName showPrice />
 *  ```
 */
type ClusterCardComponent = typeof MemoizedRoot & {
  Image: typeof ClusterCardImage;
  Badges: typeof ClusterCardBadges;
  Favorite: typeof ClusterCardFavorite;
  Name: typeof ClusterCardName;
  Sku: typeof ClusterCardSku;
  ShortDescription: typeof ClusterCardShortDescription;
  Manufacturer: typeof ClusterCardManufacturer;
  TextLabels: typeof ClusterCardTextLabels;
  Stock: typeof ClusterCardStock;
  Price: typeof ClusterCardPrice;
  ViewClusterLink: typeof ClusterCardViewClusterLink;
};

const ClusterCardExport = MemoizedRoot as ClusterCardComponent;
ClusterCardExport.Image = ClusterCardImage;
ClusterCardExport.Badges = ClusterCardBadges;
ClusterCardExport.Favorite = ClusterCardFavorite;
ClusterCardExport.Name = ClusterCardName;
ClusterCardExport.Sku = ClusterCardSku;
ClusterCardExport.ShortDescription = ClusterCardShortDescription;
ClusterCardExport.Manufacturer = ClusterCardManufacturer;
ClusterCardExport.TextLabels = ClusterCardTextLabels;
ClusterCardExport.Stock = ClusterCardStock;
ClusterCardExport.Price = ClusterCardPrice;
ClusterCardExport.ViewClusterLink = ClusterCardViewClusterLink;

export default ClusterCardExport;
