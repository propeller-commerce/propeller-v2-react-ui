/**
 * Pure / runtime-agnostic surface for `propeller-v2-react-ui`.
 *
 * Everything exported here is plain TS — no React, no `next/headers`, no
 * `server-only`. Safe to import from **either** a Server Component or a
 * Client Component without forcing a boundary (the main `/` entry has the
 * `"use client"` directive that would poison RSC trees, and `/server` has
 * `server-only` which would poison client trees — this `/shared` entry
 * lives in the middle and is callable from either runtime).
 *
 * Re-exports the pure surface from `propeller-v2-core-ui` so existing
 * downstream import paths (`propeller-v2-react-ui/shared`) keep working.
 * New code may import from `propeller-v2-core-ui` directly.
 */
export * from '@propeller-commerce/propeller-v2-core-ui';

// `MenuCategory` is the serialisable shape `<Menu tree={...} />` consumes.
// Re-exported from `/shared` (type-only) so server modules can build the tree
// without pulling the React composable's runtime into the server bundle.
export type { MenuCategory } from './composables/react/useMenu';
