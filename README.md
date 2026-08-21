# propeller-v2-react-ui

A React component library for **Propeller Commerce** storefronts. It ships
ready-made e-commerce UI — product cards, grids, carts, checkout, account
pages — together with a set of headless hooks ("composables") that talk to
the Propeller GraphQL API, plus the shared utilities and types those parts
build on.

📖 **Docs (canonical reference for props & usage):** https://propeller-commerce.github.io/propeller-v2-react-ui/

The package is framework-agnostic. It runs in any React 18+ app — Next.js
(App Router or Pages Router), Vite/CRA SPAs, Remix — and ships its own
precompiled stylesheet, so you do **not** need Tailwind in your project to
use it.

---

## Table of contents

- [Installation](#installation)
- [Peer dependencies](#peer-dependencies)
- [Entry points](#entry-points)
- [Core concept: the SDK seam](#core-concept-the-sdk-seam)
- [Quick start (Next.js App Router)](#quick-start-nextjs-app-router)
- [Quick start (Vite / CRA / SPA)](#quick-start-vite--cra--spa)
- [The PropellerProvider](#the-propellerprovider)
- [Using components](#using-components)
- [Using composables (hooks)](#using-composables-hooks)
- [Server Components & data fetching](#server-components--data-fetching)
- [Styling](#styling)
- [API reference](#api-reference)
- [TypeScript](#typescript)
- [Building from source](#building-from-source)

---

## Installation

```bash
npm install propeller-v2-react-ui propeller-sdk-v2
# or
pnpm add propeller-v2-react-ui propeller-sdk-v2
# or
yarn add propeller-v2-react-ui propeller-sdk-v2
```

`propeller-sdk-v2` is a peer dependency — install it yourself so the package
and your application share a single SDK instance.

## Peer dependencies

| Package            | Version    | Required                                  |
| ------------------ | ---------- | ----------------------------------------- |
| `react`            | `>=18`     | Yes                                       |
| `react-dom`        | `>=18`     | Yes                                       |
| `propeller-sdk-v2` | `*`        | Yes — provides the GraphQL client & types |

There is **no dependency on Next.js**. Next.js apps work out of the box, but
nothing in the package imports `next/*`.

## Entry points

The package exposes four import paths — three code entries and the stylesheet:

```ts
// 1. Main entry — React components, hooks, contexts.
//    The bundle is marked "use client", so in Next.js every re-export is a
//    Client Component and the boundary is drawn automatically.
import { PropellerProvider, ProductCard, useCart } from 'propeller-v2-react-ui';

// 2. Pure entry — the RSC-safe presentational components ONLY.
//    Built WITHOUT the "use client" banner, so a Server Component can
//    render these directly without drawing a client boundary.
import { ProductPrice, ItemStock, Breadcrumbs } from 'propeller-v2-react-ui/pure';

// 3. Shared entry — pure, runtime-agnostic TS. No React, no "use client".
//    Safe to import from a Server Component OR a Client Component.
//    Contains createServices, toPlain, formatters, helpers and all types.
import { createServices, formatPrice, getLanguageString } from 'propeller-v2-react-ui/shared';

// 4. Stylesheet — precompiled CSS, import once at your app root.
import 'propeller-v2-react-ui/styles.css';
```

| Import path                        | Contents                                                       | Runtime         |
| ----------------------------------- | -------------------------------------------------------------- | --------------- |
| `propeller-v2-react-ui`            | Components, hooks, contexts, `createServices`, `toPlain`, types | Client only     |
| `propeller-v2-react-ui/pure`       | The pure/presentational components only (RSC-safe)              | Server & Client |
| `propeller-v2-react-ui/shared`     | `createServices`, `toPlain`, formatters, helpers, types         | Server & Client |
| `propeller-v2-react-ui/styles.css` | Precompiled stylesheet                                          | —               |

> **Why three code entries?** In Next.js App Router, the main entry carries a
> `"use client"` directive (it bundles interactive components), so importing
> it into a Server Component pulls that whole tree client-side. The `/shared`
> entry is plain TypeScript — import the pure helpers and `createServices`
> from there when you want them in a Server Component without forcing a
> client boundary. The `/pure` entry is the same idea for *components*: the
> presentational components (no hooks, state, effects or browser APIs —
> `ProductPrice`, `ItemStock`, `OrderTotals`, `Breadcrumbs`, …) re-exported
> from a bundle built without the `"use client"` banner, so a Server
> Component can render real product/price/order markup server-side.

### The `/pure` entry — RSC-safe components

These components are pure: they render entirely from their props, with no
hooks, state, effects, event handlers, browser APIs or context reads. They
are re-exported from `/pure`, whose bundle has **no** `"use client"` banner,
so a React Server Component can import and render them directly:

`Breadcrumbs`, `CategoryShortDescription`, `GridTitle`, `ItemStock`,
`OrderItemCard`, `OrderSummary`, `OrderTotals`, `ProductBulkPrices`,
`ProductDownloads`, `ProductPrice`, `ProductShortDescription`,
`ProductVideos`.

The same component is also available from the main `propeller-v2-react-ui`
entry — use that inside a `"use client"` boundary, and `/pure` from a Server
Component.

> **`Breadcrumbs` caveat.** `Breadcrumbs` accepts a `configuration` prop. If
> the object you pass holds function-valued URL builders, it cannot cross the
> RSC → client serialization boundary — render `Breadcrumbs` inside a client
> island in that case, or pass only plain data.

## Core concept: the SDK seam

The package does **not** ship a GraphQL client or a hardcoded API endpoint.
GraphQL transport is application-specific — a Next.js app may proxy through
a route handler, a Vite SPA may call the API directly, another app may use a
custom rewrite or auth resolver. Baking a URL into the library would lock it
to one app shape.

Instead, **you** own the client. The contract is three steps:

1. Construct a `GraphQLClient` from `propeller-sdk-v2` with your endpoint,
   headers and auth resolver.
2. Call `createServices(client)` once to build a `Services` bundle — a typed
   object of all SDK services (`product`, `cart`, `user`, `order`, …) keyed
   to that client.
3. Pass **both** `graphqlClient` and `services` into `<PropellerProvider>`.

Everything inside the provider then reads services via `useServices()`; no
component or hook ever instantiates the SDK itself.

```ts
import { GraphQLClient } from 'propeller-sdk-v2';
import { createServices } from 'propeller-v2-react-ui';

export const graphqlClient = new GraphQLClient({
  endpoint: '/api/graphql',           // your endpoint or proxy route
  headers: { /* auth, locale, … */ },
});

export const services = createServices(graphqlClient);
```

`createServices` is memoized per client (via a `WeakMap`), so calling it
repeatedly with the same client returns the same bundle. The `GraphQLClient`
mutates its own config in place — when you update auth headers after a
login, cached service instances pick up the change automatically.

---

## Quick start (Next.js App Router)

### 1. Create the client

Create a single shared module so the client is constructed once.

```ts
// lib/propeller.ts
import { GraphQLClient } from 'propeller-sdk-v2';
import { createServices } from 'propeller-v2-react-ui';

export const graphqlClient = new GraphQLClient({
  endpoint: '/api/graphql',
});

export const services = createServices(graphqlClient);
```

### 2. Add a providers component

`PropellerProvider` reads a `value` object — the `PropellerInfra` shape. Wire
in your own auth / company / language / price state.

```tsx
// app/providers.tsx
'use client';

import { useMemo, type ReactNode } from 'react';
import { PropellerProvider, type PropellerInfra } from 'propeller-v2-react-ui';
import { graphqlClient, services } from '@/lib/propeller';

export function Providers({ children }: { children: ReactNode }) {
  // Replace these with your real auth/company/language stores.
  const user = null;          // Contact | Customer | null
  const companyId = undefined;
  const language = 'NL';
  const includeTax = false;

  const value = useMemo<PropellerInfra>(
    () => ({
      graphqlClient,
      services,
      user,
      companyId,
      language,
      includeTax,
      currency: '€',
      configuration: {},
      portalMode: 'open',
    }),
    [user, companyId, language, includeTax],
  );

  return <PropellerProvider value={value}>{children}</PropellerProvider>;
}
```

### 3. Wire the root layout

```tsx
// app/layout.tsx
import 'propeller-v2-react-ui/styles.css';
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### 4. Use components and hooks anywhere

```tsx
// app/cart/page.tsx
'use client';

import { CartOverview } from 'propeller-v2-react-ui';

export default function CartPage() {
  return <CartOverview />;
}
```

---

## Quick start (Vite / CRA / SPA)

There is no `"use client"` concern outside Next.js — import everything from
the main entry directly.

```tsx
// main.tsx
import { createRoot } from 'react-dom/client';
import { GraphQLClient } from 'propeller-sdk-v2';
import { PropellerProvider, createServices, type PropellerInfra } from 'propeller-v2-react-ui';
import 'propeller-v2-react-ui/styles.css';
import App from './App';

const graphqlClient = new GraphQLClient({
  endpoint: 'https://your-store.example.com/graphql',
});
const services = createServices(graphqlClient);

const value: PropellerInfra = {
  graphqlClient,
  services,
  user: null,
  companyId: undefined,
  language: 'NL',
  includeTax: false,
  currency: '€',
  configuration: {},
  portalMode: 'open',
};

createRoot(document.getElementById('root')!).render(
  <PropellerProvider value={value}>
    <App />
  </PropellerProvider>,
);
```

---

## The PropellerProvider

`PropellerProvider` supplies the **infrastructure context** every component
and hook depends on. It collects the values that would otherwise be drilled
through ~20 components as repeated props. You construct one `value` object
and pass it once.

### `PropellerInfra` fields

| Field           | Type                          | Description                                                                 |
| --------------- | ----------------------------- | --------------------------------------------------------------------------- |
| `graphqlClient` | `GraphQLClient`               | The client you constructed. Used by hooks that accept it explicitly.        |
| `services`      | `Services`                    | The bundle from `createServices(graphqlClient)`. Required.                  |
| `user`          | `Contact \| Customer \| null` | The signed-in user, or `null` when anonymous.                               |
| `companyId`     | `number \| undefined`         | Active company (B2B) — affects pricing, authorization, addresses.           |
| `language`      | `string`                      | Locale code used to resolve localized content (e.g. `'NL'`, `'EN'`).        |
| `includeTax`    | `boolean`                     | Whether displayed prices include tax.                                       |
| `currency`      | `string`                      | Currency symbol for price formatting. Default: `'€'`.                       |
| `configuration` | `unknown`                     | Config bag forwarded to components. Recognized keys: `baseCategoryId`, `anonymousUserId` (see below), image filters — plus anything of your own. |
| `portalMode`    | `string`                      | Storefront mode (e.g. `'open'`, `'closed'`).                                |

**`configuration.anonymousUserId`** — the channel's guest account. Listing
hooks scope logged-out catalog queries to it, so the client asks the same
question your server-rendered seed did. Resolve it server-side (only the
server can reach the channel) and pass it in; when it's absent, anonymous
queries send no `userId` and the backend falls back to the api key's own
scope. Getting this wrong is invisible — the grid renders, just with the
wrong assortment.

The `value` object is reactive — when your auth/company/language state
changes, recompute it (memoize on those dependencies) and the provider
propagates the new value. Components re-render with fresh infra; service
instances are stable across the change.

> **Make the value reactive.** Wrap `value` in `useMemo` keyed on your
> auth/company/language/price state so it only changes when something
> meaningful changes — not on every render.

### Accessing the context

- `useServices()` — returns the `Services` bundle. **Throws** when called
  outside a provider; that's an integration error, not something to paper
  over. Use this inside your own components/hooks to talk to the API.
- `usePropellerContext()` — returns the full `PropellerInfra` or `null` when
  outside a provider. Non-throwing, for components that should still render
  standalone (e.g. in isolation tests or Storybook).

---

## Using components

Import any component from the main entry and render it inside the provider.

```tsx
'use client';

import {
  ProductGrid,
  ProductCard,
  Breadcrumbs,
  CartIconAndSidebar,
} from 'propeller-v2-react-ui';

export function CategoryPage({ products }) {
  return (
    <>
      <Breadcrumbs categoryPath={[]} currentLabel="Catalog" />
      <CartIconAndSidebar />
      <ProductGrid products={products} columns={4} />
    </>
  );
}
```

### Compound API

Layout-heavy components such as `ProductCard` support a **compound API** —
provide subcomponents as children to control exactly what renders and in
what order. When you omit children, the component falls back to its
monolithic layout driven by `show*` / `allow*` prop toggles.

```tsx
<ProductCard product={product}>
  <ProductCard.Image variant="grid" />
  <ProductCard.Name linkable />
  <ProductCard.Price />
  <ProductCard.AddToCart />
</ProductCard>
```

### Available components

Catalog & product:
`ProductGrid`, `ProductCard`, `ClusterCard`, `ProductInfo`,
`ProductPrice`, `ProductBulkPrices`, `ProductGallery`, `ProductVideos`,
`ProductDownloads`, `ProductSpecifications`, `ProductDescription`,
`ProductShortDescription`, `ProductTabs`, `ProductSlider`, `ProductBundles`,
`ItemStock`, `PriceToggle`, `DeliveryDate`.

Clusters / configurators:
`ClusterConfigurator`, `ClusterInfo`, `ClusterOptions`.

Grid & navigation:
`GridToolbar`, `GridFilters`, `GridPagination`, `GridTitle`, `Breadcrumbs`,
`Menu`, `SearchBar`, `CategoryDescription`, `CategoryShortDescription`.

Cart & checkout:
`AddToCart`, `CartIconAndSidebar`, `CartItem`, `CartOverview`,
`CartSummary`, `CartCarriers`, `CartPaymethods`, `ActionCode`,
`ItemsOverview`.

Orders:
`OrderList`, `OrderActions`, `OrderItemCard`, `OrderSummary`,
`OrderTotals`, `OrderShipments`, `QuoteActions`.

Account, auth & B2B:
`LoginForm`, `RegisterForm`, `ForgotPassword`, `UserDetails`,
`AccountIconAndMenu`, `AddressCard`, `AddressSelector`, `CompanySwitcher`,
`AddToFavorite`, `FavoriteLists`, `FavoriteListItem`, `FavoriteListDetails`,
`PurchaseAuthorizationConfigurator`, `PurchaseAuthorizationRequests`.

Every component appends `props.className` on its root element, so a one-off
style override is a regular prop. See [Styling](#styling).

## Partner extension API

Customise nested components (price, stock, add-to-cart, whole card) without
forking. See [docs/extension-api.md](docs/extension-api.md) for the full
guide covering injection slots, cascade rules, before/after iteration slots,
whole-card swap, ProductInfo expanded shell, and contract types.

---

## Using composables (hooks)

The composables are **headless** — they hold state and talk to the API, but
render nothing. Use them to build your own UI, or to drive the supplied
components.

Hooks that hit the API take an **options object** containing a
`graphqlClient` (and other inputs). Read the client from the provider via
`usePropellerContext()`, or import your shared client module directly.

```tsx
'use client';

import { useCart } from 'propeller-v2-react-ui';
import { graphqlClient } from '@/lib/propeller';

export function MiniCart({ user }) {
  const cart = useCart({
    graphqlClient,
    user,
    language: 'NL',
  });

  if (cart.loading) return <span>Loading…</span>;

  return (
    <div>
      <span>{cart.cart?.items?.length ?? 0} items</span>
      <button onClick={() => cart.resolveCart()}>Refresh</button>
    </div>
  );
}
```

`useProductSearch` example — searching the catalog:

```tsx
'use client';

import { useProductSearch } from 'propeller-v2-react-ui';
import { graphqlClient } from '@/lib/propeller';

export function Search() {
  const search = useProductSearch({ graphqlClient });
  // search exposes results, loading state and a query setter — drive
  // your own input + result list from it.
  return null;
}
```

### Available composables

| Hook                                 | Purpose                                              |
| ------------------------------------- | ---------------------------------------------------- |
| `useAuth`                             | Login, registration, forgot-password flows           |
| `useCart`                             | Cart resolution, line items, action codes, checkout gate |
| `useCheckout`                         | Carriers, pay methods, placing an order               |
| `useCompany`                          | Company switching and company data (B2B)              |
| `useAddress`                          | Address CRUD                                          |
| `useOrders`                           | Order history search and detail                       |
| `useFavorites`                        | Favorite lists and list items                         |
| `useMenu`                             | Category navigation tree                              |
| `useProductInfo`                      | Single-product detail data                            |
| `useProductSearch`                    | Catalog search and filtering                          |
| `useProductSlider`                    | Cross-sell / up-sell sliders                           |
| `useProductSpecs`                     | Product attribute groups for spec tables               |
| `useProductBundles`                   | Product bundle composition                             |
| `useClusterConfigurator`              | Configurable-product (cluster) selection state         |
| `usePurchaseAuthorizationConfigurator`| B2B purchase-authorization configuration               |
| `usePurchaseAuthorizationRequests`    | B2B purchase-authorization request handling            |
| `useServices`                         | Read the `Services` bundle from the provider           |
| `useResolvedProps` / `useInfraProps`  | Merge explicit props with provider infra defaults      |

Each hook exports its own `Use*Options` and `Use*Return` types — import them
for fully typed integration.

---

## Server Components & data fetching

In Next.js App Router you can fetch Propeller data on the server. Build a
`GraphQLClient` server-side (with your server endpoint, API keys, cookie
handling), call `createServices`, and use the SDK services directly. Import
`createServices` and the pure helpers from `propeller-v2-react-ui/shared` so
no client boundary is forced.

```tsx
// app/product/[id]/page.tsx — a Server Component
import { GraphQLClient } from 'propeller-sdk-v2';
import { createServices, getLanguageString } from 'propeller-v2-react-ui/shared';
import { ProductInfo } from 'propeller-v2-react-ui'; // Client Component

async function getServerClient() {
  return new GraphQLClient({
    endpoint: process.env.PROPELLER_GRAPHQL_ENDPOINT!,
    headers: { /* server API key, etc. */ },
  });
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const services = createServices(await getServerClient());
  const product = await services.product /* …fetch by id… */;

  return (
    <article>
      <h1>{getLanguageString(product.names, 'NL')}</h1>
      {/* ProductInfo is interactive — it renders client-side */}
      <ProductInfo product={product} />
    </article>
  );
}
```

The `/shared` entry is the safe surface for Server Components: it has no
React and no `"use client"` directive, so importing `formatPrice`,
`getLanguageString`, `getStockStatus`, `createServices`, etc. from it does
**not** pull interactive code into the server bundle.

---

## Styling

The package ships a precompiled stylesheet (`dist/styles.css`) that bundles
every utility class its components reference plus the theme tokens they
resolve against. Import it once at your app root:

```ts
import 'propeller-v2-react-ui/styles.css';
```

You do **not** need Tailwind in your project — the CSS is plain compiled
CSS. If you do use Tailwind, the import doesn't conflict; your own output is
a separate stylesheet.

Skip the import entirely and components render unstyled.

### Three override surfaces

**1. Theme tokens** — the package declares CSS variables (`--primary`,
`--card`, `--border`, `--radius-container`, …) at low specificity. Redeclare
any of them and every utility resolving against it updates:

```css
/* your globals.css — reskin the whole package */
:root {
  --primary: #ff7043;
  --primary-foreground: #ffffff;
  --card: #fafafa;
  --border: #e1e1e1;
  --radius-container: 12px;
}
```

Scope-limited overrides work too — declare the variable on a wrapper class
and only that subtree changes.

**2. BEM hooks** — every styled element carries a BEM class alongside its
utilities (`.propeller-product-card`, `.propeller-product-card__price`,
`.propeller-breadcrumbs__separator`, …). The package emits utilities inside
`@layer utilities`, so any plain consumer rule targeting a BEM class wins by
cascade order — no `!important` needed:

```css
.propeller-product-card {
  background: #fff8e1;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
.propeller-breadcrumbs__separator { display: none; }
```

**3. Per-instance `className`** — every component merges `props.className`
into its root classes, so a one-off override is a regular prop:

```tsx
<ProductCard product={p} className="ring-2 ring-yellow-400" />
```

The merge runs through [`tailwind-merge`](https://github.com/dcastil/tailwind-merge)
(since 0.17.0), so an override **replaces** the base utility it conflicts with
rather than racing it in the cascade — `iconClassName="text-cocoa"` on a
component whose default is `text-white` now renders cocoa. Non-conflicting
utilities and the BEM hooks are left untouched. To remove a default outright
(rather than override it), use a BEM hook.

See [STYLING.md](./STYLING.md) for the full token list, the complete BEM
hook catalog, and the cascade rationale.

---

## API reference

### From `propeller-v2-react-ui`

- **SDK glue** — `createServices`, `toPlain`
- **Contexts** — `PropellerProvider`, `usePropellerContext`,
  `ProductGridConfigProvider`, `useProductGridConfig`
- **Composables** — all `use*` hooks listed above
- **Components** — all components listed above
- **Helpers** — `formatPrice`, `formatDate`, `calcDiscountPercent`,
  `getStockStatus`, `getLabel`, `getLanguageString`, `getCountryName`,
  `getProductImageUrl`, `getClusterImageUrl`, `getProductSku`,
  `getClusterSku`, `getLocalizedValue`, `stripHtml`, `shouldTruncate`,
  `truncateAt`, `isContact`, `isCustomer`, `getUserId`, `getCompany`,
  `getCompanyId`, `getAddresses`, `getDefaultInvoiceAddress`,
  `getDefaultDeliveryAddress`, `isEmbeddable`, `normalizeVideoUrl`,
  `isContentHidden`, `attributeNameMatches`, `getAttributeDisplayName`,
  `extractAttributeValues`, `collectAttributeValues`,
  `filterProductsBySelections`, `initCart`, `fetchActiveCart`,
  `mergeAnonymousCart`, `COUNTRIES`
- **Types** — `Services`, `PropellerInfra`, `PropellerProviderProps`,
  `ProductGridConfig`, `Country`, `AnyUser`, all `Use*Options` /
  `Use*Return` hook types, and the full domain type set (`auth`, `cart`,
  `company`, `favorites`, `orders`, `pagination`, `product`).

### From `propeller-v2-react-ui/shared`

A subset of the above with **no React dependency** — `createServices`,
`toPlain`, all formatters and helpers, `COUNTRIES`, and every domain type.
Use it from Server Components or any non-React code.

## TypeScript

The package is written in TypeScript and ships full `.d.ts` declarations.
Every hook exports its `Use*Options` and `Use*Return` types, every component
its `*Props` type, and all domain types (`Cart`, `Product`, `Order`, …) flow
through from `propeller-sdk-v2`.

```ts
import type {
  PropellerInfra,
  UseCartReturn,
  ProductCardProps,
} from 'propeller-v2-react-ui';
```

## Building from source

```bash
npm install
npm run build
```

Outputs to `./dist`:

- `index.js` / `index.cjs` — client bundle (prefixed with `"use client"`)
- `shared.js` / `shared.cjs` — runtime-agnostic bundle (no directive)
- `styles.css` — precompiled, minified stylesheet
- `*.d.ts` — type declarations

Other scripts:

| Script              | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Rebuild the JS bundle on change       |
| `npm run build:js`  | Build JS bundles only                 |
| `npm run build:css` | Compile the stylesheet only           |
| `npm run typecheck` | Type-check without emitting           |
| `npm run clean`     | Remove the `dist` directory           |
