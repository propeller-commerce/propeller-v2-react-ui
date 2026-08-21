# Contributing to propeller-v2-react-ui

This is the React component library for Propeller Commerce storefronts. It
is its own project — `propeller-next` and any other storefront are
*consumers* of it, not the other way around. Component, composable, context,
and SDK-glue changes happen **here**, in `src/`.

For the deep architectural reference (entry points, build internals, RSC
posture, the SDK seam), read [TECH.md](./TECH.md) first. This file covers
the day-to-day workflow.

---

## Prerequisites

- Node 20+
- npm 10+
- `propeller-sdk-v2` available (the package peer-depends on it; for local
  development it is installed as a dev dependency from GitHub)

## Setup

```bash
npm install
npm run build      # produces dist/{index,shared}.{js,cjs,d.ts} + dist/styles.css
npm run typecheck  # tsc --noEmit, must be clean before any commit
```

## Scripts

| Script                 | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `npm run build`        | Full build — `tsup` then the Tailwind CSS compile      |
| `npm run build:js`     | JS bundles only (`tsup`)                               |
| `npm run build:css`    | Stylesheet only (`tailwindcss` CLI)                    |
| `npm run dev`          | Rebuild JS bundles on change (`tsup --watch`)          |
| `npm run typecheck`    | `tsc --noEmit`                                         |
| `npm test`             | Run the Vitest unit suite once                         |
| `npm run test:watch`   | Run Vitest in watch mode                               |
| `npm run test:coverage`| Run the suite with a v8 coverage report                |
| `npm run storybook`    | Storybook dev server on `:6006` (`build:css` runs first) |
| `npm run build-storybook`| Static Storybook build into `storybook-static/`      |
| `npm run clean`        | Remove `dist/`                                         |

**Build ordering matters.** `npm run build` runs `tsup && npm run build:css`
in that order on purpose: `tsup --clean` wipes `dist/`, so the CSS must be
compiled *after*. Don't reorder it, and don't run `build:css` before `tsup`.

---

## Project layout

```
src/
├── components/        60 components — one file each, default-exported, PascalCase
├── composables/
│   ├── react/         React hooks (useCart, useAuth, …) + react/shared/ helpers
│   └── shared/        NO React. Pure TS — types/ and utils/. Runtime-agnostic.
├── context/           PropellerContext, ProductGridContext
├── lib/
│   ├── createServices.ts   SDK factory: createServices(client) → Services
│   └── toPlain.ts          strips SDK underscore-prefixed backing fields
├── styles.css         Tailwind v4 entry, scanned at build time
├── index.ts           client entry barrel  ("use client" bundle)
└── shared.ts          runtime-agnostic entry barrel  (no banner)
```

Anything pure-TS (no React, no browser API) belongs under
`composables/shared/` and is exported from `shared.ts` — it must be safe to
import from a Server Component.

Two more directories are part of the repo but not part of the published
package:

- **`.storybook/` + `src/**/*.stories.tsx`** — Storybook. One story per
  component, rendering it in isolation against fixture data and a mock
  `PropellerProvider`. The mock foundation lives in `src/__mocks__/`
  (`fixtures.ts`, `mockServices.ts`, `decorators.tsx`). Storybook is the
  visual workbench and the auto-generated prop-table reference; it is not a
  behaviour-test layer (see [Testing](#testing)).
- **`docs/`** — a self-contained Docusaurus 3 site with its own
  `package.json` / lockfile / `node_modules`. It is the guide-level
  documentation; it does not duplicate the component prop tables (it links
  out to Storybook for those). See `docs/README.md`. New guide content is
  an `.mdx` file in `docs/content/` plus an entry in `docs/sidebars.ts`.

Neither directory is in `tsup`'s build graph or shipped to consumers.

---

## Coding rules

These are not style preferences — breaking them breaks the build or the
consumer.

### 1. No `"use client"` reasoning by hand

The client bundle gets a `"use client";` banner prepended by a tsup
`onSuccess` hook (esbuild strips module-level directives during bundling).
You do **not** add `"use client"` to individual files for the consumer's
benefit — the bundle-level banner covers it. Component source files keep
their own `'use client'` for local clarity and the RSC-bucket JSDoc tag,
but the shipped boundary is drawn by the banner.

### 2. No hand-written `useCallback` / `useMemo` on props

The codebase relies on the React Compiler. Manually memoizing a value that
is passed as a prop is flagged by eslint as a build-breaking error. Write
plain values and functions; let the compiler handle memoization. The one
legitimate `useMemo` is the provider value object in a consumer's host
bridge — that lives in the consumer, not here.

### 3. The SDK is reached through `Services`, never `new XxxService()`

Components and composables get SDK access in one of two ways:

- **Provider-driven (preferred):** `const services = useServices();` —
  reads the `Services` bundle from `PropellerProvider`.
- **Explicit client:** the composable takes a `graphqlClient` option and
  derives services internally via `createServices(graphqlClient)`.

Never instantiate an SDK service directly. Never reintroduce a module-level
`graphqlClient` singleton or a hardcoded endpoint — GraphQL transport is the
consumer's concern (see TECH.md §6).

### 4. BEM hooks on every styled element

Every visible element carries a BEM-style class alongside its Tailwind
utilities — `.propeller-product-card`, `.propeller-product-card__price`,
etc. These are the consumer's override surface (see [STYLING.md](./STYLING.md)).
When you add or restructure markup, add the matching BEM class. Don't remove
existing ones — consumers may target them.

### 5. Tailwind v4 `@source inline()` for dynamic classes

Tailwind v4's scanner extracts class names from string literals, but it can
miss classes buried in template-literal ternaries:

```tsx
className={`flex ${isRow ? 'md:flex-nowrap items-center' : 'flex-col'}`}
```

If a class only ever appears inside a dynamic expression, add it to the
`@source inline(...)` directive at the top of `src/styles.css`, then rebuild
the CSS and confirm the class is in `dist/styles.css`. A missing responsive
utility shows up as a layout that collapses at a breakpoint.

### 6. Every component appends `props.className` on its root

One-off overrides are a regular prop. Keep the pattern:
`` className={`propeller-x ...base classes... ${props.className || ''}`} ``.

### 7. Infra props are resolved, not required

Components that need `graphqlClient` / `user` / `language` / `currency` /
etc. call `useInfraProps(rawProps)` — explicit props win, otherwise the
value comes from `PropellerProvider`. New infra-aware components follow the
same pattern; don't make infra props required in the type.

---

## RSC-safety JSDoc tag

Each component carries a one-line JSDoc tag at the top describing its
runtime posture — `@rsc-safe`, `@rsc-mixed`, or `@rsc-blocked` — with a
brief reason. Keep it accurate when you change a component (e.g. adding
`useState` to a previously-pure component flips it to `@rsc-blocked`).

---

## Testing

The package is verified at two levels.

### Unit tests — the pure-logic surface

The package uses [Vitest](https://vitest.dev/). Tests live next to the
code they cover, in `__tests__/` directories, named `*.test.ts`.

Unit-test coverage targets the **pure-logic surface** — `src/lib/`
(`createServices`, `toPlain`) and the framework-free utilities in
`src/composables/shared/utils/` (formatters, truncation, attribute
extraction, language resolution, etc.). These are plain functions with no
React, no DOM, and no SDK network calls, so they run in the fast `node`
environment.

When you change a pure utility, add or update its `__tests__/` file in the
same commit. Aim to cover the documented behaviour, the boundary values,
and the null/undefined paths — not every defensive `catch`.

```bash
npm test              # run once
npm run test:watch    # watch mode while developing
npm run test:coverage # with a coverage report
```

### Component verification — the consumer's e2e suite

Components are **not** unit-tested in isolation. They need a GraphQL
client and a `PropellerProvider` to render meaningfully, so testing them
against a *mock* SDK would be both heavy to maintain and less truthful
than testing them in a real app.

Instead, the components are verified by **propeller-next's Playwright e2e
suite** — it drives the real storefront, against a real backend, in a
real browser, exercising every component (product browsing, cart,
checkout, account, favourites, orders, etc.) plus dedicated
layout-regression specs.

CI wires this up as a gate (see below): a change to this package that
breaks a component fails the *package's* pipeline, via the consumer's
e2e suite. You do not write a parallel component-test suite here.

When your change affects a component's rendered layout, add or update a
Playwright regression spec in propeller-next's `e2e/` directory and ship
it as a paired commit.

---

## Continuous integration

`.gitlab-ci.yml` defines two stages:

- **`verify`** — `typecheck`, `unit-tests` (Vitest + coverage), and
  `build`. Fast, hermetic, no external dependencies.
- **`downstream`** — `downstream-e2e`: builds the package, clones
  propeller-next, installs the freshly-built package into it with
  `npm install file:… --install-links`, and runs that repo's full
  Playwright e2e suite. This is the component regression gate.

The downstream job needs a live backend and test accounts, supplied as
**GitLab CI/CD variables** (Settings → CI/CD → Variables; mark secrets
*Masked* and *Protected*):

| Variable | Purpose |
| --- | --- |
| `CONSUMER_REPO_URL` | Token-authenticated git URL of propeller-next, so CI can clone it. |
| `BOILERPLATE_GRAPHQL_ENDPOINT` | Backend GraphQL endpoint. |
| `BOILERPLATE_API_KEY` | Backend API key (masked). |
| `BOILERPLATE_ORDER_EDITOR_API_KEY` | Order-editor key (masked). |
| `BOILERPLATE_BASE_CATEGORY_ID` / `NEXT_PUBLIC_BASE_CATEGORY_ID` | Catalog root category. |
| `E2E_CONTACT_EMAIL` / `E2E_CONTACT_PASSWORD` | Contact test-account login (masked). |
| `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD` | Customer test-account login (masked). |

Until those variables are configured the `downstream-e2e` job is
`allow_failure: true` and is skipped entirely when `CONSUMER_REPO_URL` is
unset — the `verify` stage still gates every pipeline. Once the variables
are in place, drop `allow_failure` so a downstream e2e failure blocks the
package's pipeline.

---

## Before you commit

1. `npm run typecheck` — must be clean (0 errors).
2. `npm test` — the unit suite must pass.
3. `npm run build` — must succeed; check `dist/styles.css` exists and
   contains any new utility classes you used.
4. If you changed a pure utility, its `__tests__/` file is updated in the
   same commit.
5. If the change affects a component's rendered layout, add or update a
   Playwright regression test **in the consumer** (`propeller-next`'s
   `e2e/` suite). The fix lives here; the test lives where there's a
   running app to measure against. Ship them as paired commits.
6. If the change affects the public API surface (new export, changed prop,
   removed export), update `CHANGELOG.md` and — for breaking changes —
   `MIGRATION.md`.

## Commit messages

Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
`chore:`). Scope is optional but encouraged (`fix(order-actions): …`).
Do not add AI-assistant attribution trailers.

## Versioning

The package is pre-1.0 (`0.x`). Until 1.0 the API may change between minor
versions; breaking changes are documented in `MIGRATION.md`. Once the API
stabilizes the package moves to 1.0 and follows semver strictly.

## The fix-location rule

If you are tempted to fix a component by editing a copy in a consumer app:
don't. The supported customization paths are theme tokens, BEM-hook CSS,
the `className` prop, compound subcomponents, and wrap-and-extend (see
STYLING.md and TECH.md §12). If none fit, the fix is a PR here that adds the
prop / slot / hook that does fit.

## Mirror project

A parallel Vue package (`propeller-v2-vue-ui`) is planned, extracted from
`propeller-vue` with the same architecture. The `composables/shared/` layer
is intentionally pure TS so it can be shared between the two. If you change
something in `composables/shared/`, note that it should be mirrored.
