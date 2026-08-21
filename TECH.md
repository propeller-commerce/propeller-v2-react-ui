# propeller-v2-react-ui — Technical Reference

React component library for Propeller Commerce. Extracted from the
`propeller-next` boilerplate on 2026-05-20 (Phase E of the React hardening
plan) and treated as its own project from that point on.

This document is the engineering reference: how the package is laid out,
how it builds, how consumers wire into it, and the non-obvious decisions
that landed during the extraction.

---

## 1. What ships

A **drop-in npm package** that gives any React 18+/19 app the full
Propeller Commerce surface (product browsing, cart, checkout, account,
favorites, orders, quotes, purchase authorization, CMS-driven product
sliders/grids). Consumers wire:

```ts
import { GraphQLClient } from 'propeller-sdk-v2';
import {
  PropellerProvider,
  ProductCard,
  AddToCart,
  createServices,
} from 'propeller-v2-react-ui';
import 'propeller-v2-react-ui/styles.css';

// The consumer constructs the GraphQL client with whatever endpoint /
// auth / headers fit its app. The package itself has no opinion about
// transport — see §6 for the rationale.
const graphqlClient = new GraphQLClient({
  endpoint: '/api/graphql',          // consumer's own proxy / direct URL
  apiKey: '',
  timeout: 30_000,
});
const services = createServices(graphqlClient);

<PropellerProvider value={{
  graphqlClient, services, user, companyId,
  language: 'NL', includeTax: false, currency: '€',
  portalMode: 'OPEN', configuration: {},
}}>
  {children}
</PropellerProvider>
```

…and the components render, talk to the Propeller GraphQL API via the
SDK, and respect the consumer's theme tokens. No codegen, no Mitosis, no
build-time component generation in the consumer — the package is plain
compiled React.

### Public peer dependencies

| Dep | Range | Notes |
|---|---|---|
| `react` | `>=18` | Hooks the package uses are all 18-compatible (no React 19-only APIs in the bundle). |
| `react-dom` | `>=18` | matches `react` |
| `propeller-sdk-v2` | `*` | The SDK is the data layer; the package is intentionally a thin wrapper. Re-export of SDK types is part of the public API surface. |

Note: there is **no Next.js peer dep**. The package ships zero
Next-specific imports (no `next/link`, `next/headers`, `next/image`).
Consumers using Next.js wire the package the same way as any other
React app.

### Bundled (non-peer) deps

`class-variance-authority`, `clsx`, `tailwind-merge` (class composition);
`lucide-react` (icons); `lodash.debounce`, `qs`, `marked`, `swiper`
(feature helpers); `react-hot-toast` (toast UI).

---

## 2. Directory layout

```
propeller-v2-react-ui/
├── src/
│   ├── components/                  # 60 components — the public UI surface
│   │   ├── ProductCard.tsx          # one component per file, default export
│   │   ├── ProductGrid.tsx          # PascalCase filenames match component names
│   │   ├── CartItem.tsx
│   │   ├── OrderActions.tsx
│   │   └── …
│   ├── composables/
│   │   ├── react/                   # React hooks (useCart, useAuth, useFavorites, …)
│   │   │   └── shared/              # Cross-hook React helpers (usePagination, …)
│   │   └── shared/                  # NO React. Pure TS — works in Vue, Node, RSC.
│   │       ├── types/               # auth/cart/company/favorites/orders/pagination/product types
│   │       └── utils/               # formatPrice, getLabel, productHelpers, languageResolver, …
│   ├── context/
│   │   ├── PropellerContext.tsx     # Single value-object provider for infra
│   │   └── ProductGridContext.tsx   # Resolved product-grid config for ProductCard family
│   ├── lib/
│   │   ├── createServices.ts        # SDK factory: createServices(client) → Services bundle
│   │   └── toPlain.ts               # Strips SDK underscore-prefixed backing fields
│   ├── styles.css                   # Tailwind v4 entry — scanned by build:css
│   ├── index.ts                     # Client entry barrel
│   ├── pure.ts                      # RSC-safe component entry barrel
│   └── shared.ts                    # Runtime-agnostic entry barrel
├── dist/                            # Build output — NOT in source control
│   ├── index.{js,cjs,d.ts}          # Client bundle (banner: "use client";)
│   ├── pure.{js,cjs,d.ts}           # Pure-component bundle (no boundary)
│   ├── shared.{js,cjs,d.ts}         # Pure-TS bundle (no boundary)
│   └── styles.css                   # Precompiled Tailwind CSS
├── package.json
├── tsup.config.ts
├── tsconfig.json
├── README.md
├── STYLING.md                       # Consumer-facing styling guide
└── TECH.md                          # ← this file
```

### Naming and one-file-per-component

Every component is one file, default-exported, PascalCase filename. The
barrel `src/index.ts` re-exports as a named export
(`export { default as ProductCard } from './components/ProductCard';`).
This keeps tree-shaking clean.

---

## 3. Three entry points

The package exports three code entry points because some components and
utilities need to be callable from either a Client Component or a Server
Component without forcing the import site to commit to a runtime.

| Export | Subpath | Runtime | Banner / guard |
|---|---|---|---|
| Client | `propeller-v2-react-ui` | Browser + RSC-client islands | `"use client";` prepended to the bundle |
| Pure | `propeller-v2-react-ui/pure` | Either runtime — the pure/presentational components only | None (no banner) |
| Shared | `propeller-v2-react-ui/shared` | Either runtime — no React, no `"use client"` banner | None (genuinely portable) |

### When to import from where

- **Components, hooks, contexts, `createServices`** → `propeller-v2-react-ui`.
  Importing a component into a Server Component implicitly draws the
  client boundary thanks to the `"use client"` banner.
- **The 12 pure/presentational components** (`Breadcrumbs`, `ProductPrice`,
  `ItemStock`, `OrderTotals`, …) → `propeller-v2-react-ui/pure` when you
  want to render them inside a Server Component. The `pure` bundle has no
  `"use client"` banner, so an RSC can server-render real product/price/
  order markup. The same components are also on the main entry — use that
  inside a client boundary. (See §3.1.)
- **`formatPrice`, `getLabel`, `getLanguageString`, `getProductImageUrl`,
  `createServices`, `toPlain`, type helpers** → `propeller-v2-react-ui/shared`.
  A Server Component rendering a product name needs
  `getLanguageString(product.names, lang)` — pulling this from `/` would
  force-import the entire client bundle (with all its `'use client'`
  machinery) into the server module graph. `/shared` is the escape
  hatch. Note that `createServices` is exported from both `/` and `/shared`
  so server-side code (a Route Handler, a Server Component fetching data)
  can build a `Services` bundle around a server-built `GraphQLClient`
  without paying for the client bundle.

### 3.1. The `/pure` entry — RSC-safe components

The `/pure` barrel (`src/pure.ts`) re-exports the 12 components that are
**pure**: they render entirely from props, with no hooks, state, effects,
event handlers, browser APIs or context reads — `Breadcrumbs`,
`CategoryShortDescription`, `GridTitle`, `ItemStock`, `OrderItemCard`,
`OrderSummary`, `OrderTotals`, `ProductBulkPrices`, `ProductDownloads`,
`ProductPrice`, `ProductShortDescription`, `ProductVideos`.

`tsup` builds `pure` as its own entry and — unlike `index` — the
`onSuccess` hook does **not** prepend the `"use client"` banner to it. So a
React Server Component can `import { ProductPrice } from
'propeller-v2-react-ui/pure'` and render it directly, server-side, without
drawing a client boundary or pulling the client bundle into the server
graph.

Adding a component to `/pure` is gated: it must use none of the above
client-only features, and must not transitively import a `"use client"`
sibling — only `react`, `propeller-sdk-v2` (external peer) and the
framework-free `composables/shared/utils/` helpers. The build will not
warn if this is violated; an RSC import smoke test is the check.

> **`Breadcrumbs` caveat.** `Breadcrumbs` takes a `configuration` prop. If
> the consumer passes an object holding function-valued URL builders, it
> cannot cross the RSC → client serialization boundary — the consumer must
> render `Breadcrumbs` inside a client island or pass plain data only.

### Why `/shared` exists

Importing `getLanguageString` from the main `/` entry into a Server
Component produced **"Attempted to call getLanguageString() from the
server but it's a client function"** — because the `"use client"`
banner on the main bundle poisons every export inside it. We added a
second entry to give the genuinely-portable utilities a home that's
neither marked client nor marked server. Anything pure TS goes there.

### What is NOT in this package

There used to be a third entry, `propeller-v2-react-ui/server`, which
shipped `createServerClient`, `getServerInfra`, `fetchProduct`, and
`fetchCategory` for Server Components. **It was removed on 2026-05-20**
along with the client-side `graphqlClient` singleton (see §6). The
reasoning: server-side GraphQL wiring (endpoint URL, API-key env-var
names, cookie names, refresh-token handling) is application-specific.
A component library can't make those decisions for the consumer without
forcing every adopter into the same shape as propeller-next.

Consumers that want server-side fetching host their own
`createServerClient` + `fetchProduct` module (propeller-next does
exactly this in [`lib/server.ts`](../propeller-next/lib/server.ts) — a
small file that imports `createServices` + `toPlain` from this
package's `/shared` entry and composes them with the consumer's own env
contract). See §6 for the full rationale.

---

## 4. Build system (tsup + Tailwind v4 CLI)

### tsup configuration

Two parallel build definitions in `tsup.config.ts`:

```ts
export default defineConfig([
  { entry: { index: 'src/index.ts' },  /* + onSuccess prepends "use client"; */ },
  { entry: { shared: 'src/shared.ts' } },
]);
```

Each definition:

- Emits both ESM (`.js`) and CJS (`.cjs`).
- Generates `.d.ts` declarations.
- Uses the **automatic JSX runtime** (`esbuildOptions: { jsx: 'automatic' }`)
  — see "JSX runtime gotcha" below.
- Marks `react`, `react-dom`, `react/jsx-runtime`, `propeller-sdk-v2`
  as **external** so the consumer's versions are used.
- `splitting: false` (one file per entry — predictable output, no chunks).

### The `"use client"` banner hack

esbuild strips module-level string directives (`"use client";`) during
bundling. tsup's `banner` option can't be used because it injects
*after* `"use strict";` which means the directive is no longer at byte
0 of the file.

**Solution:** a post-build `onSuccess` hook in the client entry's tsup
definition. After the bundle is written, we read it, prepend the
`"use client";\n` directive, and write it back:

```ts
async onSuccess() {
  prependUseClient('dist/index.js');
  prependUseClient('dist/index.cjs');
}
```

This is brittle in principle (one tsup major version away from
breaking), but it's the only known way to get a real string directive
at byte 0 of the output. Watch the esbuild issue tracker.

### JSX runtime gotcha

The classic JSX runtime breaks under esbuild bundling because esbuild
renames per-file `import * as React from 'react'` namespaces (each file
becomes `React2`, `React3`, …) but doesn't rewrite in-source
`React.createElement` calls. Result: `ReferenceError: React is not defined`.

Switching to `jsx: 'automatic'` emits `jsx()` / `jsxs()` calls from
`react/jsx-runtime` instead of `React.createElement`, sidestepping the
rename entirely. **Don't switch back.**

### CSS pipeline

`tailwindcss -i ./src/styles.css -o ./dist/styles.css --minify`

The Tailwind v4 CLI scans `src/styles.css`, follows its `@source`
directives to find class names in the component source files, and emits
a self-contained CSS bundle. Consumers `import 'propeller-v2-react-ui/styles.css'`
once; no Tailwind required on the consumer side.

### The `@source inline()` escape hatch

Tailwind v4's source scanner extracts class names from string literals
in the source code, but it has a blind spot for some template-literal
ternaries:

```tsx
className={`flex ${isRow ? 'md:flex-nowrap items-center' : 'flex-col'}`}
```

**Workaround:** list the affected utilities in an
`@source inline(...)` directive at the top of `src/styles.css`. When a
layout-bug regression report mentions a responsive utility, **first
check whether it's in the inline list**. If not, add it.

### Build ordering

`npm run build` runs `tsup && npm run build:css`. The order matters
**only because `tsup --clean` would otherwise delete `dist/styles.css`**.
tsup runs first, clears `dist/`, then the Tailwind CLI writes
`dist/styles.css` afterwards.

---

## 5. PropellerProvider — the single integration point

Consumers configure the package via one provider at the root:

```tsx
import { GraphQLClient } from 'propeller-sdk-v2';
import {
  PropellerProvider, createServices, type PropellerInfra,
} from 'propeller-v2-react-ui';

// Once at app startup
const graphqlClient = new GraphQLClient({ endpoint: '/api/graphql', ... });
const services = createServices(graphqlClient);

function App() {
  const value: PropellerInfra = useMemo(() => ({
    graphqlClient,         // the client the consumer built
    services,              // bundle keyed to that client
    user, companyId,       // wired from host's auth/company stores
    language: 'NL',
    includeTax: false,
    currency: '€',
    portalMode: 'OPEN',
    configuration: {},     // free-form bag — consumers stuff app config here
  }), [user, companyId, includeTax, language]);

  return (
    <PropellerProvider value={value}>
      <YourApp />
    </PropellerProvider>
  );
}
```

`graphqlClient` and `services` are both required on the `value` object.
Composables read `services` via `useServices()` (which throws with a
clear message if the provider is missing or `services` is undefined),
or accept an explicit `graphqlClient` option and derive a local
services bundle internally via `createServices(graphqlClient)`.

### The two patterns composables use

1. **Provider-driven (preferred for new code).** Composable calls
   `useServices()` → reads `services` from `PropellerProvider`. No
   `graphqlClient` argument in the composable's options. Works for
   components rendered inside the provider tree.
2. **Explicit client (legacy / standalone).** Composable takes
   `graphqlClient` in its options, builds services internally via
   `createServices(graphqlClient)`. Works for callers that don't (or
   can't) mount a provider — tests, Storybook stories, throw-away
   scripts. `createServices` memoizes per-client via WeakMap so this is
   cheap.

Both patterns coexist in the package today: most hooks accept
`graphqlClient` as an option for backward compatibility with
pre-extraction call sites, but `useServices()` is the supported way to
write new code.

### Why a single value object instead of N providers

The pre-extraction code had a tower of providers
(AuthContext → CompanyContext → PriceContext → LanguageContext → …),
each owning a slice of state. The package would have had to either
ship all of them (huge surface, opinionated) or import them from the
host (extraction-blocker). The value-object pattern flattens this: the
host can compose any number of internal contexts and feed the resolved
values into one place.

`propeller-next/components/layout/PropellerHostBridge.tsx` does exactly
this: it reads from the host's own AuthContext, CompanyContext, etc.,
and assembles the `PropellerProvider` value, including the
`graphqlClient` and `services` from the consumer's `lib/api.ts`.

### `ProductGridContext`

A second, narrower provider used inside `<ProductGrid>`. It carries
resolved grid configuration (image variants, attribute extraction
rules, filter defaults) down to `<ProductCard>` / `<ClusterCard>` so
they don't need a 60-prop API. Wired automatically when ProductGrid
renders; consumers wrapping ProductCard standalone pass the config as
props or use the provider directly.

---

## 6. The SDK seam — `createServices(client)` only

The package exports a single SDK factory and **no client instances**:

```ts
// src/lib/createServices.ts
export function createServices(client: GraphQLClient): Services { ... }

// src/lib/toPlain.ts
export function toPlain<T>(value: T): T { ... }
```

That's the whole seam. The consumer owns the `GraphQLClient` instance.

### Why the package ships no `graphqlClient` singleton

Before 2026-05-20 the package had `src/lib/api.ts` that exported a
module-level `graphqlClient` instance hardcoded to:

```ts
const config = {
  endpoint: '/api/graphql',                                  // ← Next.js convention
  orderEditorApiKey: process.env.NEXT_PUBLIC_ORDER_EDITOR_API_KEY,  // ← Next.js convention
  timeout: parseInt(process.env.NEXT_PUBLIC_TIMEOUT || '30000', 10),
};
```

Three things were baked in:

1. **A specific URL** (`/api/graphql`) — assumed the consumer hosts a
   Next.js Route Handler at that path. A Vite-only SPA, a Remix app, a
   non-Next React app, a consumer that proxies at a different path —
   all of them got a broken client.
2. **Next-specific env var names** (`NEXT_PUBLIC_*`) — Next.js-only
   prefix. A Vite consumer uses `VITE_*`.
3. **A module-level singleton** — the package was *implicitly bound to
   one specific client at import time*. Multi-tenant, multi-instance,
   and test-with-mock scenarios were all blocked.

The 2026-05-20 decoupling deleted `src/lib/api.ts` outright. Now:

- Consumer constructs its `GraphQLClient` in **its own code** (e.g.
  propeller-next's [`lib/api.ts`](../propeller-next/lib/api.ts) — a
  ~60-line file the consumer owns).
- Consumer calls `createServices(graphqlClient)` once → gets the
  `Services` bundle (`{ product, cart, user, order, … }`).
- Consumer passes BOTH into `<PropellerProvider value={{ graphqlClient,
  services, ... }}>`.
- Composables read `services` via `useServices()` or accept a
  `graphqlClient` option and derive services locally.

### `Services` shape

```ts
interface Services {
  product: ProductService;
  cart: CartService;
  user: UserService;
  category: CategoryService;
  order: OrderService;
  payMethod: PayMethodService;
  login: LoginService;
  address: AddressService;
  company: CompanyService;
  crossupsell: CrossupsellService;
  bundle: BundleService;
  favoriteList: FavoriteListService;
  purchaseAuthConfig: PurchaseAuthorizationConfigService;
  cluster: ClusterService;
  orderlist: OrderlistService;
}
```

Memoization is per client via WeakMap, so repeat calls to
`createServices(sameClient)` return the same bundle. After
login/logout the SDK mutates `client.config.headers` in place; the
cached services keep working without rebuilding.

### `toPlain<T>(value)`

Recursively strips the SDK's leading-underscore backing fields
(`_items` → `items`, `_firstName` → `firstName`). Apply once at the
service boundary (e.g. right after `getViewer`) so downstream code
sees the clean SDK type shape.

---

## 7. Server-side rendering

The package no longer ships server helpers (see §3 and §6). Consumers
that want to fetch data in Server Components host their own server
module that:

1. Builds a `GraphQLClient` configured for the **upstream** endpoint
   (not their proxy) using `securityMode: 'direct'` and a server-only
   API key from their env.
2. Reads the auth token from a cookie (e.g. via `next/headers` in
   Next.js).
3. Calls `createServices(serverClient)` from
   `propeller-v2-react-ui/shared` to get the Services bundle.
4. Exposes thin async helpers like `fetchProduct(productId)` that wrap
   the SDK calls and run results through `toPlain`.

propeller-next's [`lib/server.ts`](../propeller-next/lib/server.ts) is
the canonical implementation — copy it into your own app, adjust the
env var names and cookie name to your convention.

### Pre-fetched data prop pattern

Several client components accept an optional `<data>` prop that, when
present, **skips the component's internal fetch**. This is the bridge
between server-side data resolution and the client component:

| Component | Prop | Type |
|---|---|---|
| `ProductGrid` | `products` | `ProductsResponse` |
| `Menu` | `tree` | `MenuCategory[]` |

Pattern: the host's Server Component fetches the data once (and gets to
attach framework cache hints — e.g. Next.js `next: { revalidate, tags }`
via the SDK's `GraphQLFetchOptions`), then passes the result into the
client component as a serialisable prop. The component renders it
directly on first paint; the internal fetch hook is short-circuited so
there is no avoidable client-side round trip after hydration.

If the prop is omitted, the component falls back to its legacy
client-side fetch — no breaking change for consumers that haven't
migrated to server-side data resolution.

When adding a new fetching component to the package, prefer this shape:
expose an optional `<data>` prop with the same name/type as the
internal hook's primary return value, branch the effect on its presence,
and document the dual mode in the component's JSDoc.

### Per-component RSC compatibility (audit, unenforced)

Per the Phase C0 audit, each component falls into one of three buckets:

| Bucket | Behavior | Count |
|---|---|---|
| **A. Hard client** | Uses `useState`/event handlers/`window`/portals | ~44 |
| **B. RSC-ready display** | Pure render from props, no hooks | 11 |
| **C. Splittable mixed** | Client-only today, has a clean display-only inner | ~5 |

**But:** the `"use client"` banner on the bundle currently flattens
this distinction at runtime — every consumer that imports from
`propeller-v2-react-ui` gets a client boundary. The bucket labels are a
**roadmap** for a future refactor: ship Bucket-B from a separate
sub-entry (`propeller-v2-react-ui/server-components`?) without the
banner, so they render server-side natively.

### Serialization gotcha

If a prop passed across the server→client boundary contains a function
(e.g. `config.urls.getProductUrl`), Next.js throws "Functions cannot be
passed directly to Client Components". Workarounds: pass the value, not
the function (resolve the URL on the server), or move that subtree into
a deeper client island that reads the function from a context inside
the client tree.

---

## 8. Styling — three override surfaces

See `STYLING.md` for the consumer guide. Engineering summary:

### Surface 1: theme tokens

`src/styles.css` declares `:root { --primary: #7f22fe; --card: #fff; … }`
at low specificity. The `@theme inline { --color-primary: var(--primary); }`
block maps the tokens into Tailwind v4's color system. Consumers
re-declare any variable in their own `:root` and every utility instantly
re-skins.

### Surface 2: BEM hooks

Every styled element carries a BEM class
(`.propeller-product-card__price`). The package emits its utilities
inside `@layer utilities` (Tailwind v4 default), so any unlayered
consumer rule targeting a BEM class wins by CSS cascade order — no
`!important` needed.

### Surface 3: per-instance `className`

Every component's root accepts `props.className` and appends it after
the package's base classes.

**All three are verified by an e2e test** in the consumer
(`e2e/tests/anonymous/styling-overrides.spec.ts`). When a styling
change ships, that test is the contract.

---

## 9. Layout regression tests

When a visual regression is reported, the fix lands in
`src/components/<Component>.tsx` and the regression is pinned with a
Playwright test in the consumer's e2e suite. Examples currently in
place:

- **ProductCard row layout** —
  `e2e/tests/anonymous/product-card-row-layout.spec.ts`
- **CartItem alignment** — `e2e/tests/anonymous/cart-item-layout.spec.ts`
- **OrderActions button layout** —
  `e2e/tests/contact/order-actions-layout.spec.ts`
- **Styling overrides** — `e2e/tests/anonymous/styling-overrides.spec.ts`

**Pattern:** the test lives in the consumer (which has Playwright
config and a real running app), the fix lives in the package. Both
commits land in the same logical change.

---

## 10. Consumer wiring (propeller-next, the reference adopter)

The propeller-next repo consumes the package via a `file:` link in
`package.json`:

```json
"dependencies": {
  "propeller-v2-react-ui": "file:../propeller-ui/propeller-v2-react-ui"
}
```

Installed with `npm install --install-links` on Windows. The
`--install-links` flag **materializes a copy** instead of creating a
symlink — symlinks break Node's walk-up resolution for nested
dependencies (`propeller-sdk-v2` can't be found through a symlinked
`node_modules`).

After rebuilding the package (no version bump), the consumer must
**remove and reinstall** for npm to pick up the new dist:

```bash
rm -rf node_modules/propeller-v2-react-ui
npm install file:../propeller-ui/propeller-v2-react-ui --install-links
```

(npm doesn't compare file mtimes when the version is unchanged.)

Other required consumer settings in `next.config.ts`:

```ts
transpilePackages: ['propeller-v2-react-ui'],
outputFileTracingRoot: resolve(__dirname, '..', '..'),
```

`transpilePackages` tells Next.js to run the package through its
SWC/Turbopack pipeline. `outputFileTracingRoot` widens the trace root
so the production build correctly bundles the file-linked package.

### Three consumer-side files do the integration:

1. **[`lib/api.ts`](../propeller-next/lib/api.ts)** — constructs
   `graphqlClient` with propeller-next's app-specific endpoint
   (`/api/graphql`) and env vars (`NEXT_PUBLIC_*`), then builds and
   exports `services = createServices(graphqlClient)`.
2. **[`lib/server.ts`](../propeller-next/lib/server.ts)** —
   server-only counterpart: `createServerClient`, `getServerInfra`,
   `fetchProduct`, `fetchCategory`. Hosts the env-var contract
   (`BOILERPLATE_GRAPHQL_ENDPOINT`, `BOILERPLATE_API_KEY`, etc.) and
   the cookie-name convention.
3. **[`components/layout/PropellerHostBridge.tsx`](../propeller-next/components/layout/PropellerHostBridge.tsx)**
   — reads from propeller-next's own AuthContext / CompanyContext /
   PriceContext / LanguageContext, plus the `graphqlClient` and
   `services` from `lib/api.ts`, and assembles the
   `<PropellerProvider value={...}>` value object.

A different consumer (Vite SPA, Remix app, plain CRA) writes the
equivalent three files with its own conventions. The package itself
makes no demands beyond "build a `GraphQLClient`, build `Services`,
hand both to the provider."

---

## 11. Versioning, releases, and known gaps

- **Version:** currently `0.1.0`, `private: true`. Not published to any
  registry yet. The plan is `0.x` until the API is stable, then `1.0`.
- **No CHANGELOG yet.** Phase F (docs + changesets) is the next planned
  iteration.
- **No unit tests in this repo.** All coverage today is via the
  consumer's Playwright e2e suite (112 pass / 9 skip / 0 fail at the
  2026-05-20 SDK-decoupling checkpoint). Phase G adds Vitest +
  React Testing Library here.
- **No Storybook.** Phase F.
- **No automated visual regression** — the layout regression tests in
  the consumer cover the *measurable* layout invariants; pixel-diff is
  not done yet.

---

## 12. The fix-location rule

Component bugs are fixed in `src/components/`, **not** in the consumer.
Consumers that copy a component into their own codebase to "fix" it
lose all future updates and accumulate divergence. The supported
customization paths are:

1. **Theme tokens** (re-skin) — change CSS variables.
2. **BEM hooks** (per-component CSS) — write CSS targeting
   `.propeller-product-card__price` etc.
3. **`className` prop** (per-instance) — pass extra classes.
4. **Compound subcomponents** (rare, when supported) — use
   `<ProductCard.Image/>` etc.
5. **Wrap-and-extend** — render the package component inside your own
   component and pass through props.

If none of those fit, the answer is a PR to this package adding the
prop/slot/hook that does fit.

---

## 13. Mirror project: propeller-vue

A parallel Vue 3 package needs to be extracted from `propeller-vue`
using the same pattern. Don't replicate the work here; do it in
propeller-vue and follow the playbook in the corresponding memory note
in the consumer's memory directory
(`project-vue-package-extraction-playbook.md`). The shared/types layer
is intentionally pure TS so it can be lifted directly between the two
packages.
