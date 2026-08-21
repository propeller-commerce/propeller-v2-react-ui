# Migration Guide

Breaking changes between versions of `propeller-v2-react-ui`, with the steps
to upgrade. The package is pre-1.0, so breaking changes can land in `0.x`
minor versions — each one is documented here.

---

## `GridFilters` / `GridToolbar`: stock filter is a toggle plus a quantity

**When:** `0.15.0`.

The two stock checkboxes (In stock / Out of stock) are now a two-state toggle
plus an editable quantity — "in stock, at least N pcs". The out-of-stock
bucket has no replacement.

Two checkboxes could express "in stock or out of stock", which is every
product and so had to collapse to no filter — a state that looked active and
did nothing. They also could not express a quantity.

**`GridFilters`**

```tsx
// before
<GridFilters
  activeAvailability={['in-stock']}                 // Availability[]
  onAvailabilityChange={(sel) => setAvailability(sel)}
/>

// after
<GridFilters
  activeAvailability={'in-stock'}                   // Availability ('all' | 'in-stock')
  activeMinStock={5}                                // new, optional; undefined = 1
  onAvailabilityChange={(sel, minStock) => { setAvailability(sel); setMinStock(minStock); }}
/>
```

**`GridToolbar`**

```tsx
// before
<GridToolbar
  availability={['in-stock']}                       // Availability[]
  onAvailabilityFilterRemove={(value) => remove(value)}
/>

// after
<GridToolbar
  availability={'in-stock'}                         // Availability
  minStock={5}                                      // new, optional
  onAvailabilityFilterRemove={() => reset()}        // no argument — one chip
/>
```

**`ProductGrid`** takes `availability?: Availability` and `minStock?: number`
in place of `availability?: Availability[]`.

**Steps**

1. Upgrade `@propeller-commerce/propeller-v2-core-ui` to `^0.6.0`, where
   `Availability` becomes `'all' | 'in-stock'` and `buildInventoryFilter`
   takes `(selection, minQuantity?)`.
2. Replace array state with a single value plus a quantity number.
3. Drop any out-of-stock option from your own UI and URL handling.
4. If you serialise the selection into a URL, decide how to carry the
   quantity. The boilerplates use `?availability=in-stock` for the default
   and `?availability=in-stock:5` for a raised quantity, omitting the
   parameter entirely for "all products".
5. Add labels for the new keys: `allProducts`, `atLeast`, `pcs`,
   `quantityDecrease`, `quantityIncrease`. Remove `outOfStock`.

## `Menu`: optional pre-fetched `tree` prop (additive)

**When:** during `0.1.0` stabilization (pre-publish).

`Menu` now accepts an optional `tree?: MenuCategory[]` prop. When supplied,
the component skips its internal `useMenu` fetch and renders the tree
directly — mirroring the long-standing `ProductGrid.products` opt-in.

**No migration required.** Omitting the prop preserves the legacy
client-side fetch behaviour. This is purely opt-in for hosts that want to
move the category tree fetch into a Server Component (e.g. a Next.js
layout) so the menu HTML lands in the initial response and the host can
attach framework cache hints — see also `GraphQLFetchOptions` in
`propeller-sdk-v2` v0.11.0.

### Recommended pattern for Next.js consumers

```tsx
// app/layout.tsx — Server Component
import { fetchMenu, getAnonymousInfra } from '@/lib/server';
import Header from '@/components/layout/Header';

export default async function RootLayout({ children }) {
  const menuTree = await fetchMenu(getAnonymousInfra(), BASE_CATEGORY_ID, lang);
  return (
    <html><body>
      <Header menuTree={menuTree} />
      {children}
    </body></html>
  );
}

// components/layout/Header.tsx — 'use client'
import { Menu } from 'propeller-v2-react-ui';
export default function Header({ menuTree }) {
  return <Menu categoryId={BASE_CATEGORY_ID} tree={menuTree} onMenuItemClick={...} />;
}
```

The internal `useEffect` short-circuits when `tree` is present, so there is
no avoidable client-side round trip after hydration.

See [TECH.md §7 "Pre-fetched data prop pattern"](./TECH.md) for the broader
context and the same pattern as it applies to `ProductGrid`.

---

## Decoupling the SDK seam from Next.js

**When:** during `0.1.0` stabilization (pre-publish).

The package used to ship a module-level GraphQL client singleton with a
hardcoded `/api/graphql` endpoint and `NEXT_PUBLIC_*` environment reads, plus
a `/server` entry for server-side fetching. Both baked a specific app shape
(a Next.js app proxying at exactly that path) into the library. They were
removed.

### What changed

| Before | After |
| ------ | ----- |
| `import { graphqlClient } from 'propeller-v2-react-ui'` | Consumer constructs its own `GraphQLClient` |
| `import { getServices } from 'propeller-v2-react-ui'` | `import { createServices } from 'propeller-v2-react-ui'` |
| `getServices()` (singleton default) | `createServices(client)` — explicit client, required |
| `propeller-v2-react-ui/server` entry | Removed — host your own server module |
| `next` peer dependency | Removed — the package has no `next/*` imports |
| `PropellerInfra` without `services` | `PropellerInfra` requires a `services` field |

### How to upgrade

#### 1. Own your GraphQL client

Create a small module in your app that constructs the client and the
services bundle:

```ts
// lib/api.ts — in YOUR app
import { GraphQLClient } from 'propeller-sdk-v2';
import { createServices } from 'propeller-v2-react-ui';

export const graphqlClient = new GraphQLClient({
  endpoint: '/api/graphql',              // your endpoint / proxy path
  apiKey: '',
  orderEditorApiKey: process.env.NEXT_PUBLIC_ORDER_EDITOR_API_KEY || '',
  timeout: 30_000,
  headers: {},
});

export const services = createServices(graphqlClient);
```

The endpoint, env-var names, and timeout are now **your** decision — pick
whatever fits your app (a route-handler proxy, a direct upstream URL, a
custom rewrite).

#### 2. Pass `graphqlClient` and `services` into `PropellerProvider`

`PropellerInfra` now requires `services`:

```tsx
import { PropellerProvider } from 'propeller-v2-react-ui';
import { graphqlClient, services } from '@/lib/api';

<PropellerProvider value={{
  graphqlClient,
  services,           // ← newly required
  user,
  companyId,
  language: 'NL',
  includeTax: false,
  currency: '€',
  portalMode: 'OPEN',
  configuration: {},
}}>
  {children}
</PropellerProvider>
```

#### 3. Replace `graphqlClient` / `getServices` imports

Anywhere you imported these from the package, import from your own
`lib/api` instead:

```diff
- import { graphqlClient, getServices } from 'propeller-v2-react-ui';
+ import { graphqlClient, services } from '@/lib/api';
```

Call sites collapse — `getServices(graphqlClient).cart` becomes
`services.cart`:

```diff
- await getServices(graphqlClient).cart.deleteCart({ id });
+ await services.cart.deleteCart({ id });
```

Components and composables rendered inside `PropellerProvider` can also use
the `useServices()` hook instead of importing `services` directly.

#### 4. Update the shared cart helpers

`initCart`, `fetchActiveCart`, and `mergeAnonymousCart` previously took a
`graphqlClient` field in their config object. They now take `services`:

```diff
  await fetchActiveCart({
-   graphqlClient,
+   services,
    user,
    language,
    imageSearchFilters,
    imageVariantFilters,
  });
```

#### 5. Replace the `/server` entry

If you imported `createServerClient`, `getServerInfra`, `fetchProduct`, or
`fetchCategory` from `propeller-v2-react-ui/server`, that entry is gone.
Host a server module in your own app instead. The pattern:

```ts
// lib/server.ts — in YOUR app
import 'server-only';
import { cookies } from 'next/headers';        // or your framework's equivalent
import { GraphQLClient } from 'propeller-sdk-v2';
import { createServices, toPlain } from 'propeller-v2-react-ui/shared';

export function createServerClient() {
  return new GraphQLClient({
    endpoint: process.env.PROPELLER_GRAPHQL_ENDPOINT!,  // your env name
    apiKey: process.env.PROPELLER_API_KEY!,
    securityMode: 'direct',
    getAccessToken: async () => (await cookies()).get('access_token')?.value,
  });
}

export async function fetchProduct(productId: number, language = 'NL') {
  const services = createServices(createServerClient());
  const result = await services.product.getProduct({
    productId, language, imageSearchFilters: {},
    imageVariantFilters: { transformations: [] },
  });
  return result ? toPlain(result) : null;
}
```

`createServices` is exported from `propeller-v2-react-ui/shared` precisely so
it can be used server-side without pulling the client bundle into the server
graph. The `propeller-next` repo's `lib/server.ts` is a complete reference
implementation — copy it and adjust the env-var names and cookie name.

#### 6. Drop `next` from your reasoning, not your app

The package no longer peer-depends on `next`. Your Next.js app obviously
still depends on Next — nothing changes there. The point is the package
itself is now framework-neutral; nothing to do on your side beyond noting it.

### Why this change

GraphQL transport — the endpoint URL, whether you proxy, how you resolve
auth tokens, which environment-variable convention you use — is
application-specific. A library that hardcodes `/api/graphql` and
`NEXT_PUBLIC_*` is usable only by an app shaped exactly like the one it was
extracted from. Moving the client construction into the consumer makes the
package usable by any React app (Next.js App Router or Pages Router, Vite,
Remix, CRA) and makes it testable with a mock client.

See [TECH.md](./TECH.md) §6 for the full rationale.
