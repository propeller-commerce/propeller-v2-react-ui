/**
 * RSC-safe component surface for `propeller-v2-react-ui`.
 *
 * The main `/` entry has a `"use client"` banner prepended to its bundled
 * output (see tsup.config.ts) — importing anything from it draws a Client
 * boundary, which poisons React Server Component trees. This `/pure` entry is
 * built WITHOUT that banner: every component re-exported here is a pure,
 * presentational component (no hooks, no state, no effects, no event handlers,
 * no browser APIs, no context reads) and is safe to render directly inside an
 * RSC.
 *
 * Each component is verified `@rsc-safe` in its own source file and imports
 * only `react`, `propeller-sdk-v2` (external peer), and the framework-free
 * helpers under `composables/shared/utils/` — the same helpers exposed by the
 * `/shared` entry.
 *
 * Use this from Next.js Server Components. For the interactive surface
 * (components with state, the composables, the contexts) import from the main
 * `propeller-v2-react-ui` entry inside a `"use client"` boundary instead.
 *
 * NOTE on `Breadcrumbs`: it accepts a `configuration` prop. Consumers that
 * pass an object with function-valued URL builders cannot do so from a Server
 * Component (functions are not serializable across the RSC boundary). Either
 * render `Breadcrumbs` inside a thin client island, or pass only plain data.
 */
export { default as Breadcrumbs, type BreadcrumbsProps } from './components/Breadcrumbs';
export { default as ClusterJsonLd, type ClusterJsonLdProps } from './components/ClusterJsonLd';
export { default as ItemListJsonLd, type ItemListJsonLdProps } from './components/ItemListJsonLd';
export { default as ProductJsonLd, type ProductJsonLdProps } from './components/ProductJsonLd';
export { default as CategoryShortDescription, type CategoryShortDescriptionProps } from './components/CategoryShortDescription';
export { default as GridTitle, type GridTitleProps } from './components/GridTitle';
export { default as ItemStock, type ItemStockProps } from './components/ItemStock';
export { default as OrderItemCard, type OrderItemCardProps } from './components/OrderItemCard';
export { default as OrderSummary, type OrderSummaryProps } from './components/OrderSummary';
export { default as OrderTotals, type OrderTotalsProps } from './components/OrderTotals';
export { default as ProductBulkPrices, type ProductBulkPricesProps } from './components/ProductBulkPrices';
export { default as ProductDownloads, type ProductDownloadsProps } from './components/ProductDownloads';
export { default as ProductPrice, type ProductPriceProps } from './components/ProductPrice';
export { default as ProductShortDescription, type ProductShortDescriptionProps } from './components/ProductShortDescription';
export { default as ProductVideos, type ProductVideosProps } from './components/ProductVideos';
