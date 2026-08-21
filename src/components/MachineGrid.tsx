'use client';
/**
 * @rsc-blocked — Client-only component: hooks + effects (via useSpareParts /
 * useMachines) and event handlers. Render inside a Client boundary.
 */

/**
 * MachineGrid — the spare-parts machine tree, as one self-contained grid.
 *
 * The machine-tree sibling of `ProductGrid`. Driven by the current URL path
 * (`segments`), it renders one of two modes:
 *
 *  - **Root** (`segments` empty): resolves the company's installations in ONE
 *    concatenated request via `useMachines(source, sourceIds)` and renders them
 *    as `MachineCard`s.
 *  - **Node** (`segments` non-empty): fetches that machine by its leaf slug via
 *    `useSpareParts`, and renders its child machines (`MachineCard`s) above a
 *    category-style spare-parts listing (facets + toolbar + a permanently
 *    controlled `ProductGrid` + pagination, with the qty-in-machine `belowName`).
 *
 * Navigation between levels is via `MachineCard`'s `href` (built from `basePath`
 * + segments + child slug) — the package owns no router. The parts listing is
 * **controlled**: the current state comes in via `listing`, and every filter /
 * sort / page / search interaction emits the next state via `onListingChange`.
 * The host route maps that to the URL (so a filtered view is shareable), exactly
 * as `ProductGrid` + the category island already do.
 */

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  AttributeFilter,
  AttributeType,
  Cluster,
  Product,
  ProductSortField,
  SortOrder,
  type Cart,
  type CartMainItem,
  type SparePartsMachine,
  type ProductTextFilterInput,
  type Contact,
  type Customer,
  type GraphQLClient,
} from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import { useSpareParts } from '../composables/react/useSpareParts';
import { useMachines } from '../composables/react/useMachines';
import { useInfraProps } from '../composables/react/useInfraProps';
import ProductGrid from './ProductGrid';
import MachineCard from './MachineCard';
import GridFiltersPanel from './GridFiltersPanel';
import GridToolbar from './GridToolbar';
import GridPagination from './GridPagination';

/**
 * The controlled listing state for the spare-parts view — mirrors what the host
 * derives from the URL (`page`/`offset`/`sort`/attribute-`filters`/`price`/`term`).
 * Primitives + SDK enums only, so no app type leaks into the package.
 */
export interface MachineListingState {
  page: number;
  offset: number;
  sortField: ProductSortField | string;
  sortOrder: SortOrder | string;
  /** Attribute name → selected facet values. */
  filters: Record<string, string[]>;
  minPrice?: number;
  maxPrice?: number;
  term: string;
}

export interface MachineGridProps {
  // ── Identity / navigation ────────────────────────────────────────────────
  /** Current URL path under the machines root, e.g. `['mixer','frame']`. `[]` = root. */
  segments: string[];
  /** Localized machines base path (e.g. `/nl/machines`) — used to build hrefs. */
  basePath: string;

  // ── Root query ───────────────────────────────────────────────────────────
  /** External system the installation ids belong to (root mode). */
  source?: string;
  /** Installation ids from `MY_INSTALLATIONS` (root mode). */
  sourceIds?: string[];
  /** Title for the root list. Defaults to `'Machines'`. */
  rootTitle?: string;

  // ── Tree ─────────────────────────────────────────────────────────────────
  /** Language the machine tree is authored in (usually EN). Defaults to `'EN'`. */
  machineLanguage?: string;

  // ── Controlled listing (parts) ───────────────────────────────────────────
  listing: MachineListingState;
  onListingChange: (next: MachineListingState) => void;

  // ── Infra (resolved via useInfraProps; explicit wins) ────────────────────
  graphqlClient?: GraphQLClient;
  user?: Contact | Customer | null;
  companyId?: number;
  /** Storefront language (parts). */
  language?: string;
  taxZone?: string;
  configuration?: { imageSearchFiltersGrid?: unknown; imageVariantFiltersMedium?: unknown };
  portalMode?: string;

  // ── Parts card pass-through (to the inner ProductGrid) ────────────────────
  cartId?: string;
  createCart?: boolean;
  onCartCreated?: (cart: Cart) => void;
  /**
   * Fired after every successful add-to-cart (adds into an EXISTING cart too, not
   * just the first create). Forward this to `CartContext.saveCart` or the cart
   * icon/sidebar/page won't reflect parts added from the grid — `onCartCreated`
   * alone only fires when a brand-new cart is created.
   */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;
  allowAddToCart?: boolean;
  showPrice?: boolean;
  showStock?: boolean;
  showAvailability?: boolean;
  onProductClick?: (product: Product) => void;

  // ── Labels ────────────────────────────────────────────────────────────────
  paginationLabels?: Record<string, string>;
  filtersLabels?: Record<string, string>;
  toolbarLabels?: Record<string, string>;
  machineCardLabels?: Record<string, string>;

  className?: string;
}

const SORT_FIELD_DEFAULT: ProductSortField = ProductSortField.NAME;
const SORT_ORDER_DEFAULT: SortOrder = SortOrder.ASC;

/** Title-case a URL slug for a breadcrumb ancestor (no fetched name available). */
function slugToLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function MachineGrid(rawProps: MachineGridProps) {
  // Explicit props win; otherwise infra resolves from <PropellerProvider>.
  const props = useInfraProps(rawProps);

  const { segments, basePath, listing, onListingChange } = rawProps;
  const isRoot = segments.length === 0;
  const currentSlug = segments[segments.length - 1] ?? '';
  const currentPath = [basePath, ...segments].join('/');
  const machineLanguage = rawProps.machineLanguage ?? 'EN';
  const language = props.language ?? 'NL';

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [clearSignal, setClearSignal] = useState(0);

  // Facets / bounds / the fetched node arrive from the parts hook.
  const [gridFilters, setGridFilters] = useState<AttributeFilter[]>([]);
  const [priceBoundsMin, setPriceBoundsMin] = useState<number | undefined>();
  const [priceBoundsMax, setPriceBoundsMax] = useState<number | undefined>();
  const [itemsFound, setItemsFound] = useState(0);
  const [machine, setMachine] = useState<SparePartsMachine | undefined>();

  const { filters, minPrice, maxPrice, offset, sortField, sortOrder, term } = listing;

  const activeTextFilters = useMemo<ProductTextFilterInput[]>(
    () =>
      Object.entries(filters)
        .filter(([, values]) => values.length > 0)
        .map(([name, values]) => {
          const def = gridFilters.find((f) => f.attributeDescription?.name === name);
          return { name, values, exclude: false, type: def?.type ?? AttributeType.TEXT };
        }),
    [filters, gridFilters]
  );

  // ── Root: the installations, one concatenated request ──────────────────────
  const configuration = rawProps.configuration ?? (props.configuration as MachineGridProps['configuration']);
  const { machines: rootMachines, isLoading: rootLoading } = useMachines({
    graphqlClient: props.graphqlClient,
    source: rawProps.source,
    // Only fetch the root list at the root — idle while drilled in.
    sourceIds: isRoot ? rawProps.sourceIds : [],
    language: machineLanguage,
    // Required TransformationsInput! on imageVariants(input:) — same value the
    // node query threads through useSpareParts.
    imageVariantFilters: configuration?.imageVariantFiltersMedium,
  });

  // ── Node: this machine's parts + direct children ───────────────────────────
  const { displayParts, childMachines, isLoading: partsLoading, currentPage, totalPages, goToPage } =
    useSpareParts({
      graphqlClient: props.graphqlClient,
      // Idle at the root (no slug).
      slug: isRoot ? undefined : currentSlug,
      term: term || undefined,
      language,
      machineLanguage,
      taxZone: props.taxZone,
      user: props.user,
      companyId: props.companyId,
      textFilters: activeTextFilters,
      priceFilterMin: minPrice,
      priceFilterMax: maxPrice,
      sortField,
      sortOrder,
      pageSize: offset,
      configuration: rawProps.configuration ?? (props.configuration as never),
      onFiltersChange: setGridFilters,
      onPriceBoundsChange: (min, max) => {
        setPriceBoundsMin(min);
        setPriceBoundsMax(max);
      },
      onItemsFoundChange: setItemsFound,
      onMachineChange: setMachine,
    });

  // The parts hook owns its own page counter; feed the controlled URL page into
  // it or pagination writes the page to the URL but never refetches (the hook
  // stays on page 1). Mirrors ProductGrid's page sync. Also resets to 1 when a
  // filter/sort emit sets listing.page = 1.
  useEffect(() => {
    goToPage(listing.page);
  }, [listing.page, goToPage]);

  const machineName = machine ? getLocalizedValue(machine.name, machineLanguage) : slugToLabel(currentSlug);

  const partProducts = useMemo(
    () =>
      displayParts
        .map((p) => p.product)
        .filter(Boolean) as unknown as (Product | Cluster)[],
    [displayParts]
  );

  const quantityBySku = useMemo(() => {
    const map = new Map<string, number>();
    for (const part of displayParts) {
      const sku = (part.product as { sku?: string } | undefined)?.sku ?? part.sku;
      if (sku && typeof part.quantity === 'number') map.set(sku, part.quantity);
    }
    return map;
  }, [displayParts]);

  // ── Listing intent → onListingChange (host maps to the URL) ─────────────────
  const emit = (
    nextFilters: Record<string, string[]>,
    page = 1,
    nextMin?: number,
    nextMax?: number,
    nextOffset?: number,
    nextSortField?: ProductSortField | string,
    nextSortOrder?: SortOrder | string,
    nextTerm?: string
  ) => {
    onListingChange({
      filters: nextFilters,
      page,
      minPrice: nextMin,
      maxPrice: nextMax,
      offset: nextOffset ?? offset,
      sortField: nextSortField ?? sortField,
      sortOrder: (nextSortOrder as SortOrder) ?? sortOrder,
      term: nextTerm ?? term,
    });
  };

  const handleFilterChange = (filter: AttributeFilter, value: string | number) => {
    const name = filter.attributeDescription?.name || '';
    const current = filters[name] || [];
    const valueStr = String(value);
    const next = current.includes(valueStr)
      ? current.filter((v) => v !== valueStr)
      : [...current, valueStr];
    const nextFilters = { ...filters, [name]: next };
    if (next.length === 0) delete nextFilters[name];
    emit(nextFilters, 1, minPrice, maxPrice, offset, sortField, sortOrder);
  };

  const handlePriceRangeChange = (newMin?: number, newMax?: number) =>
    emit(filters, 1, newMin, newMax, offset, sortField, sortOrder);

  const clearAllFilters = () => {
    setClearSignal((n) => n + 1);
    emit({}, 1, undefined, undefined, offset, sortField, sortOrder, '');
  };

  const handleSortChange = (field: string, order: 'ASC' | 'DESC') =>
    emit(filters, 1, minPrice, maxPrice, offset, field, order);

  const handleOffsetChange = (newOffset: number) =>
    emit(filters, 1, minPrice, maxPrice, newOffset, sortField, sortOrder);

  const handlePageChange = (page: number) =>
    emit(filters, page, minPrice, maxPrice, offset, sortField, sortOrder);

  const handleFilterRemove = (filterName: string, value: string) => {
    const current = filters[filterName] || [];
    const newVals = current.filter((v) => v !== value);
    const nextFilters = { ...filters, [filterName]: newVals };
    if (newVals.length === 0) delete nextFilters[filterName];
    emit(nextFilters, 1, minPrice, maxPrice, offset, sortField, sortOrder);
  };

  const submitSearch = (value: string) =>
    emit(filters, 1, minPrice, maxPrice, offset, sortField, sortOrder, value);

  const defaultSort = useMemo(
    () => [{ field: sortField as string, order: sortOrder as string }],
    [sortField, sortOrder]
  );

  const childSlugHref = (child: SparePartsMachine): string | null => {
    const slug = getLocalizedValue(child.slug, machineLanguage);
    if (!slug) return null;
    return `${currentPath}/${slug}`;
  };

  // ── Root render ─────────────────────────────────────────────────────────────
  if (isRoot) {
    const cards = rootMachines
      .map((m) => ({ machine: m, href: childSlugHref(m) }))
      .filter((c): c is { machine: SparePartsMachine; href: string } => c.href !== null);

    return (
      <div className={rawProps.className}>
        <h1 className="propeller-grid-title mb-6 text-2xl font-semibold">
          {rawProps.rootTitle ?? 'Machines'}
        </h1>
        {rootLoading ? (
          <p className="py-12 text-center text-foreground-subtle">
            {getLabel(rawProps.machineCardLabels, 'loading', 'Loading…')}
          </p>
        ) : cards.length === 0 ? (
          <p className="py-12 text-center text-foreground-subtle">
            {getLabel(rawProps.machineCardLabels, 'noMachines', 'No machines found.')}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ machine: m, href }) => (
              <MachineCard
                key={m.id}
                machine={m}
                href={href}
                language={machineLanguage}
                labels={rawProps.machineCardLabels}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Node render ─────────────────────────────────────────────────────────────
  const hasParts = itemsFound > 0 || partProducts.length > 0;

  return (
    <div className={rawProps.className}>
      {/* Breadcrumbs from the URL segments — leaf name from the fetched machine,
          ancestors title-cased from their slug (backend only knows the leaf). */}
      <nav aria-label="Breadcrumb" className="propeller-breadcrumbs mb-6">
        <ol className="flex flex-wrap items-center gap-2 text-sm text-foreground-subtle">
          <li>
            <a href={basePath} className="hover:text-primary">
              {rawProps.rootTitle ?? 'Machines'}
            </a>
          </li>
          {segments.map((segment, i) => {
            const href = `${basePath}/${segments.slice(0, i + 1).join('/')}`;
            const isLast = i === segments.length - 1;
            const label = isLast ? machineName : slugToLabel(segment);
            return (
              <li key={href} className="flex items-center gap-2">
                <span aria-hidden="true">/</span>
                {isLast ? (
                  <span aria-current="page" className="text-foreground">
                    {label}
                  </span>
                ) : (
                  <a href={href} className="hover:text-primary">
                    {label}
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <h1 className="propeller-grid-title mb-6 text-2xl font-semibold">{machineName}</h1>

      {/* Child machines — their own section above the parts. A node with zero
          parts still shows its children. */}
      {childMachines.length > 0 && (
        <div className="propeller-machine-children mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {childMachines.map((child) => {
            const href = childSlugHref(child);
            if (!href) return null;
            return (
              <MachineCard
                key={`machine-${child.id}`}
                machine={child}
                href={href}
                language={machineLanguage}
                labels={rawProps.machineCardLabels}
              />
            );
          })}
        </div>
      )}

      {hasParts && (
        <div className="flex flex-col gap-8 lg:flex-row">
          <GridFiltersPanel
            filters={gridFilters}
            priceMin={priceBoundsMin}
            priceMax={priceBoundsMax}
            onFilterChange={handleFilterChange}
            onPriceChange={handlePriceRangeChange}
            onClearFilters={clearAllFilters}
            collapsed={true}
            clearSignal={clearSignal}
            activeTextFilters={filters}
            activePriceMin={minPrice}
            activePriceMax={maxPrice}
            isLoading={partsLoading}
            labels={rawProps.filtersLabels}
          />

          <div className="w-full flex-1">
            <MachinePartsSearch
              key={term}
              defaultValue={term}
              onSubmit={submitSearch}
              labels={rawProps.toolbarLabels}
            />

            <div className="sticky top-[80px] z-30 mb-2 bg-background/95 py-2 backdrop-blur lg:static lg:bg-transparent lg:py-0">
              <GridToolbar
                itemsFound={itemsFound}
                page={currentPage}
                pageSize={offset}
                pageItemCount={partProducts.length}
                activeTextFilters={filters}
                priceFilterMin={minPrice}
                priceFilterMax={maxPrice}
                defaultSort={defaultSort}
                onSortChange={(field, order) => handleSortChange(field, order as 'ASC' | 'DESC')}
                onOffsetChange={handleOffsetChange}
                viewMode={viewMode}
                onViewChange={(mode) => setViewMode(mode as 'grid' | 'list')}
                onFilterRemove={handleFilterRemove}
                onPriceFilterRemove={() => handlePriceRangeChange(undefined, undefined)}
                onClearFilters={clearAllFilters}
                labels={rawProps.toolbarLabels}
              />
            </div>

            {/* Always controlled: `useSpareParts` owns fetching, the grid renders. */}
            <ProductGrid
              products={partProducts}
              isLoading={partsLoading}
              onProductClick={rawProps.onProductClick}
              allowAddToCart={rawProps.allowAddToCart ?? true}
              showPrice={rawProps.showPrice ?? true}
              showModal={true}
              createCart={rawProps.createCart ?? true}
              cartId={rawProps.cartId}
              onCartCreated={rawProps.onCartCreated}
              afterAddToCart={rawProps.afterAddToCart}
              columns={viewMode === 'list' ? 1 : 3}
              showAvailability={rawProps.showAvailability ?? false}
              showStock={rawProps.showStock ?? true}
              belowName={(product: Product) => {
                const qty = quantityBySku.get(product.sku);
                if (!qty) return null;
                return (
                  <span className="propeller-spare-part__quantity text-sm text-foreground-subtle">
                    {(rawProps.toolbarLabels?.quantityInMachine ?? 'Qty in machine')}: {qty}
                  </span>
                );
              }}
            />

            <div className="mt-8">
              <GridPagination
                products={{ page: currentPage, pages: totalPages } as never}
                onPageChange={handlePageChange}
                labels={rawProps.paginationLabels}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Uncontrolled in-node search box: `defaultValue` + a `key={term}` remount reset
 * it to the URL term on back/forward/clear, read on submit — no draft state, no
 * effect (which the React Compiler lint forbids).
 */
function MachinePartsSearch(props: {
  defaultValue: string;
  onSubmit: (value: string) => void;
  labels?: Record<string, string>;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const submit = () => props.onSubmit(ref.current?.value ?? '');
  return (
    <div className="mb-4 flex gap-2">
      <input
        ref={ref}
        type="search"
        defaultValue={props.defaultValue}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder={props.labels?.searchParts ?? 'Search parts…'}
        aria-label={props.labels?.searchParts ?? 'Search parts'}
        className="w-full rounded border border-border bg-background px-3 py-2"
      />
      <button
        type="button"
        onClick={submit}
        className="rounded bg-primary px-4 py-2 text-primary-foreground"
      >
        {props.labels?.search ?? 'Search'}
      </button>
    </div>
  );
}
