import { defineConfig } from 'tsup';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Three entry points:
 *   - `src/index.ts`  → React client surface (components, composables, contexts,
 *                       `createServices`, `toPlain`). Bundled output gets a
 *                       `"use client"` banner (see the `onSuccess` hook below).
 *   - `src/shared.ts` → Runtime-agnostic surface — pure TS, no React, no
 *                       `server-only`. Safe to import from either Server or
 *                       Client Components. Contains the SDK factory
 *                       (`createServices`, `toPlain`) and the framework-free
 *                       utilities (`formatPrice`, `getLanguageString`, etc).
 *   - `src/pure.ts`   → RSC-safe component surface — the 12 pure/presentational
 *                       components (no hooks/state/effects/handlers). Built
 *                       WITHOUT the `"use client"` banner, so a Server
 *                       Component can render them directly. See src/pure.ts.
 *
 * 2026-05-20 decoupling: the previous `src/server.ts` entry (which shipped
 * `createServerClient`, `getServerInfra`, `fetchProduct`, etc.) was deleted
 * because server-side GraphQL wiring (endpoint, API keys, cookie names) is
 * application-specific. Consumers host that code themselves; the package
 * exports `createServices` and consumers can call it server-side with a
 * server-built `GraphQLClient` if they want.
 *
 * The `onSuccess` hook prepends `"use client";` to the `index` bundle outputs
 * after the build completes. We do this in a post-build step rather than via
 * tsup's `banner` because esbuild strips module-level "use client" directives
 * during bundling — see https://github.com/evanw/esbuild/issues/2840. The
 * `pure` and `shared` bundles deliberately do NOT get this banner.
 */
function prependUseClient(filePath: string): void {
  if (!existsSync(filePath)) return;
  const original = readFileSync(filePath, 'utf8');
  const directive = '"use client";\n';
  if (original.startsWith(directive)) return;
  writeFileSync(filePath, directive + original, 'utf8');
}

const SHARED_EXTERNAL = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@propeller-commerce/propeller-sdk-v2',
];

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    treeshake: true,
    // Use the automatic JSX runtime so the bundled output emits `jsx()` /
    // `jsxs()` calls from `react/jsx-runtime` instead of `React.createElement`.
    // The classic runtime breaks when esbuild renames the per-file
    // `import * as React from 'react'` namespace (each file becomes
    // `React2`, `React3`, ...) but leaves the in-source `React.createElement`
    // call sites referencing the bare name. Automatic runtime sidesteps that.
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
    external: SHARED_EXTERNAL,
    async onSuccess() {
      const distDir = join(process.cwd(), 'dist');
      prependUseClient(join(distDir, 'index.js'));
      prependUseClient(join(distDir, 'index.cjs'));
    },
  },
  {
    // Pure / runtime-agnostic utilities — no React, no `"use client"` banner.
    // Importable from either Server or Client Components without forcing a
    // boundary. See src/shared.ts for the rationale.
    entry: { shared: 'src/shared.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    treeshake: true,
    external: SHARED_EXTERNAL,
  },
  {
    // RSC-safe components — the 12 pure/presentational components. NO
    // `"use client"` banner (no `onSuccess` hook), so a Server Component can
    // render them directly without drawing a Client boundary. This entry has
    // JSX, so — unlike `shared` — it needs the automatic JSX runtime. See
    // src/pure.ts for the rationale and the audited component list.
    entry: { pure: 'src/pure.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    treeshake: true,
    esbuildOptions(options) {
      options.jsx = 'automatic';
    },
    external: SHARED_EXTERNAL,
  },
]);
