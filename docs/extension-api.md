# Partner Extension API

This package supports three mechanisms for customising the rendering of
nested components without forking the package.

## Mechanism 1 — Component injection

Pass a partner-built component into a `*Component` prop on any host. The host
renders your component in place of the default. The component must implement
the documented contract (TypeScript interface in `propeller-v2-core-ui`).

### Hosts and their injection slots

| Host | Slots |
| --- | --- |
| `ProductGrid` | `productCardComponent`, `clusterCardComponent`, `priceComponent`, `stockComponent`, `addToCartComponent`, `imageComponent`, `badgesComponent`, `favoriteComponent` |
| `ProductSlider` | Same as `ProductGrid` |
| `ProductCard` | `priceComponent`, `stockComponent`, `addToCartComponent`, `imageComponent`, `badgesComponent`, `favoriteComponent` |
| `ClusterCard` | `priceComponent`, `stockComponent`, `imageComponent`, `badgesComponent`, `favoriteComponent` |
| `ProductInfo` | `imageComponent`, `badgesComponent`, `favoriteComponent`, `priceComponent`, `stockComponent`, `addToCartComponent`, `bundlesComponent`, `bulkPricesComponent`, `surchargesComponent` |
| `CartItem` | `priceComponent`, `stockComponent`, `surchargesComponent` |
| `OrderItemCard` | `priceComponent`, `stockComponent` |
| `AddToCart` | `priceComponent`, `stockComponent` (modal only) |

### Cascade

A slot set on `ProductGrid` or `ProductSlider` flows via React Context to
every nested `ProductCard` / `ClusterCard`. Explicit per-card props override.

Precedence (highest first):

```
explicit prop > grid context > Propeller infra > default
```

### Precedence rule (compound mode)

When a consumer provides BOTH a compound child / slot AND a `*Component`
injection, the slot default content delegates to the injection:

- If `priceComponent` is set, `<ProductCard.Price>` renders the injected component
- If `priceComponent` is not set, `<ProductCard.Price>` renders the default markup
- A consumer who composes `<ProductCard.Price>` always honors the injection cascade

To force the default render in compound mode, the consumer composes
`<DefaultProductPrice price={product.price} />` explicitly instead of
`<ProductCard.Price>`.

### Example: brand the price everywhere

```tsx
import { ProductGrid, type PriceComponentProps } from 'propeller-v2-react-ui';

const MyPrice: React.FC<PriceComponentProps> = ({ price, includeTax, currency }) => (
  <strong className="my-price">
    {currency ?? '€'}{(includeTax ? price?.gross : price?.net) ?? 0}
  </strong>
);

<ProductGrid categoryId={17} priceComponent={MyPrice} />
```

Every `ProductCard` inside the grid now uses `MyPrice` for its price block —
no per-card prop needed.

### Example: decorate the default

Import the `Default*` component and wrap it instead of rebuilding from scratch:

```tsx
import { DefaultProductPrice, type PriceComponentProps } from 'propeller-v2-react-ui';

const MyPriceWithBadge: React.FC<PriceComponentProps> = (props) => (
  <div>
    <PromoBadge product={props.price} />
    <DefaultProductPrice {...props} />
  </div>
);
```

### Example: swap the whole card

```tsx
import { ProductGrid, useProductGridConfig } from 'propeller-v2-react-ui';
import type { Product } from '@propeller-commerce/propeller-sdk-v2';

function MyCard({ product }: { product: Product }) {
  // Honor cascaded sub-component slots from the grid context.
  const grid = useProductGridConfig();
  const PriceComp = grid?.priceComponent;
  return (
    <article className="my-card">
      <img src={product.media?.images?.items?.[0]?.imageVariants?.[0]?.url} />
      <h3>{product.name?.[0]?.value}</h3>
      {PriceComp ? <PriceComp price={product.price} /> : null}
    </article>
  );
}

<ProductGrid categoryId={17} productCardComponent={MyCard} />
```

**Trade-off**: swapping the whole card opts you out of automatic
sub-component injection unless you explicitly read `useProductGridConfig()`
inside your card. Most partners prefer per-section injection (Mechanism 1
above) — the whole-card swap is the escape hatch for fully different layouts.

## Mechanism 2 — Before / after iteration slots

`ProductGrid`, `ProductSlider`, and `ProductInfo` accept render-prop slots
for content added between iterated items or before/after the PDP content.

### ProductGrid / ProductSlider

```tsx
<ProductGrid
  categoryId={17}
  beforeItem={(item, index) => index === 0 ? <FreeShippingBanner /> : null}
  afterItem={(item) => <CompareCheckbox item={item} />}
/>
```

### ProductInfo

```tsx
<ProductInfo
  productId={42}
  showPrice
  beforeContent={(product) => <CategoryBreadcrumb product={product} />}
  afterContent={(product) => <RelatedProductsSlider productId={product.productId} />}
/>
```

## Mechanism 3 — Compound API (inside-card structural extension)

Each of the seven cards below renders its monolithic layout by default.
When the consumer provides `children`, the card switches to compound mode
and renders the consumer's subtree instead. Subcomponents are exposed as
static properties of the card (`<ProductCard.Image />`, etc.).

Subcomponent default content delegates to the matching `*Component`
injection from Mechanism 1 — see [Precedence rule (compound mode)](#precedence-rule-compound-mode).

### ProductCard compound API

Compound mode is opt-in. When you provide `children` to `<ProductCard>`,
the card renders the compound subtree instead of its monolithic layout.

**React subcomponents:**

- `ProductCard.Image` — primary image
- `ProductCard.Badges` — image-label badges
- `ProductCard.Favorite` — add-to-favorite-list button
- `ProductCard.Name` — product name
- `ProductCard.Sku` — SKU line
- `ProductCard.ShortDescription` — short description
- `ProductCard.Manufacturer` — manufacturer name
- `ProductCard.TextLabels` — text-label badges
- `ProductCard.Stock` — stock indicator
- `ProductCard.Price` — price block
- `ProductCard.AddToCart` — add-to-cart control

**Example:**

```tsx
<ProductCard product={data}>
  <ProductCard.Image />
  <MyBranding />
  <ProductCard.Name />
  <ProductCard.Price />
  <ProductCard.AddToCart />
</ProductCard>
```

**Slot delegation:** each subcomponent's default content delegates to the
matching `*Component` injection from Mechanism 1 when set. Example:
`<ProductGrid priceComponent={MyPrice}><ProductCard.Price /></ProductGrid>`
renders MyPrice via the cascade.

### ClusterCard compound API

Compound mode is opt-in. When you provide `children` to `<ClusterCard>`,
the card renders the compound subtree instead of its monolithic layout.

**React subcomponents:**

- `ClusterCard.Image` — primary image
- `ClusterCard.Badges` — image-label badges
- `ClusterCard.Favorite` — add-to-favorite-list button
- `ClusterCard.Name` — cluster name
- `ClusterCard.Sku` — SKU line
- `ClusterCard.ShortDescription` — short description
- `ClusterCard.Manufacturer` — manufacturer name
- `ClusterCard.TextLabels` — text-label badges
- `ClusterCard.Stock` — stock indicator
- `ClusterCard.Price` — price block
- `ClusterCard.ViewClusterLink` — "view cluster" call-to-action

**Example:**

```tsx
<ClusterCard cluster={data}>
  <ClusterCard.Image />
  <ClusterCard.Name />
  <ClusterCard.Price />
  <ClusterCard.ViewClusterLink />
</ClusterCard>
```

**Slot delegation:** each subcomponent's default content delegates to the
matching `*Component` injection from Mechanism 1 when set.

### ProductInfo compound API

Compound mode is opt-in. When you provide `children` to `<ProductInfo>`,
the component renders the compound subtree instead of its monolithic
layout.

**React subcomponents:**

- `ProductInfo.Image` — primary image
- `ProductInfo.Badges` — image-label badges
- `ProductInfo.Favorite` — add-to-favorite-list button
- `ProductInfo.Title` — product title
- `ProductInfo.Sku` — SKU line
- `ProductInfo.Price` — price block
- `ProductInfo.Stock` — stock indicator
- `ProductInfo.AddToCart` — add-to-cart control
- `ProductInfo.Bundles` — product bundles
- `ProductInfo.BulkPrices` — bulk-price table
- `ProductInfo.Surcharges` — surcharges list

**Example:**

```tsx
<ProductInfo productId={42}>
  <ProductInfo.Image />
  <ProductInfo.Title />
  <ProductInfo.Price />
  <ProductInfo.Surcharges />
  <ProductInfo.AddToCart />
</ProductInfo>
```

**Slot delegation:** each subcomponent's default content delegates to the
matching `*Component` injection from Mechanism 1 when set.

### CartItem compound API

Compound mode is opt-in. When you provide `children` to `<CartItem>`,
the card renders the compound subtree instead of its monolithic layout.

**React subcomponents:**

- `CartItem.Image` — line-item image
- `CartItem.Title` — line-item title
- `CartItem.Sku` — SKU line
- `CartItem.Surcharges` — surcharges list
- `CartItem.Stock` — stock indicator
- `CartItem.BundleItems` — child items of a bundle line
- `CartItem.ChildItems` — child cart items
- `CartItem.Notes` — per-line notes input
- `CartItem.Crossupsells` — inline cross-sell suggestions
- `CartItem.Price` — line-item price
- `CartItem.Quantity` — quantity control
- `CartItem.Delete` — delete button (returns null when `showDelete={false}`)

**Example:**

```tsx
<CartItem cartItem={item}>
  <CartItem.Image />
  <div>
    <CartItem.Title />
    <CartItem.Sku />
    <CartItem.Price />
  </div>
  <CartItem.Quantity />
  <CartItem.Delete />
</CartItem>
```

**Slot delegation:** each subcomponent's default content delegates to the
matching `*Component` injection from Mechanism 1 when set.

### CartItem variant props

Four optional props that adapt CartItem's rendering for non-default contexts
(cart drawer, summary widgets):

| Prop | Default | Effect |
| --- | --- | --- |
| `cardFrame` | `true` | When false, strips `bg-card p-4 rounded-container shadow-sm border border-border` from root |
| `showDelete` | `true` | When false, `<CartItem.Delete>` returns null and inline delete hidden |
| `readOnlyQuantity` | `false` | When true, quantity renders as `Qty: {n}` text |
| `onTitleClick` | `undefined` | Fires `(event, item)` on title click; consumer may `preventDefault()` |

All four work in both monolithic and compound modes.

### Customising cart-drawer rows

`<CartIconAndSidebar>` composes `<CartItem>` with `cardFrame={false}`,
`showDelete={false}`, `readOnlyQuantity`, and `onTitleClick` wired to close
the sidebar. The drawer accepts a `cartItemComponent` prop that lets the
consumer replace each row.

**Replace each cart row entirely:**

```tsx
<CartIconAndSidebar cart={cart} cartItemComponent={MyCustomCartItem} />
```

**Customise individual sections via the compound API:**

```tsx
function DrawerCartItem(props) {
  return (
    <CartItem {...props}>
      <CartItem.Image />
      <div>
        <CartItem.Title />
        <MyCustomDetails item={props.cartItem} />
        <CartItem.Price />
      </div>
    </CartItem>
  );
}

<CartIconAndSidebar cart={cart} cartItemComponent={DrawerCartItem} />
```

### AddressCard compound API

Compound mode is opt-in. When you provide `children` to `<AddressCard>`,
the card renders the compound subtree instead of its monolithic layout.

**React subcomponents:**

- `AddressCard.TypeBadge` — address-type badge (billing / shipping / etc.)
- `AddressCard.Name` — contact name
- `AddressCard.AddressLines` — street / postcode / city block
- `AddressCard.Country` — country line
- `AddressCard.Actions` — edit / delete / set-default buttons
- `AddressCard.DefaultBadge` — "default address" badge (gated by `showDefaultBadge`)

**Example:**

```tsx
<AddressCard address={address}>
  <AddressCard.TypeBadge />
  <AddressCard.Name />
  <AddressCard.AddressLines />
  <AddressCard.Country />
  <AddressCard.Actions />
</AddressCard>
```

### LoginForm compound API

Compound mode is opt-in. When you provide `children` to `<LoginForm>`,
the form renders the compound subtree instead of its monolithic layout.

**React subcomponents:**

- `LoginForm.EmailField` — email input
- `LoginForm.PasswordField` — password input
- `LoginForm.SubmitButton` — submit button
- `LoginForm.ForgotPasswordLink` — forgot-password link
- `LoginForm.RegisterLink` — register link
- `LoginForm.GuestCheckoutButton` — guest-checkout button
- `LoginForm.ErrorMessage` — server / validation error block

**Example:**

```tsx
<LoginForm onSubmit={handleLogin}>
  <LoginForm.ErrorMessage />
  <LoginForm.EmailField />
  <LoginForm.PasswordField />
  <LoginForm.SubmitButton />
  <LoginForm.ForgotPasswordLink />
</LoginForm>
```

### FavoriteListItem compound API

Compound mode is opt-in. When you provide `children` to
`<FavoriteListItem>`, the row renders the compound subtree instead of its
monolithic layout.

**React subcomponents:**

- `FavoriteListItem.Image` — product image
- `FavoriteListItem.Sku` — SKU line
- `FavoriteListItem.Name` — product name
- `FavoriteListItem.Stock` — stock indicator
- `FavoriteListItem.Price` — price block
- `FavoriteListItem.Actions` — move / remove / add-to-cart controls

**Example:**

```tsx
<FavoriteListItem item={favoriteItem}>
  <FavoriteListItem.Image />
  <div>
    <FavoriteListItem.Name />
    <FavoriteListItem.Sku />
    <FavoriteListItem.Price />
  </div>
  <FavoriteListItem.Actions />
</FavoriteListItem>
```

## ProductInfo expanded shell

`ProductInfo` now renders a full PDP layout when ANY of the new `show*` props
or injection components is passed. When none is passed, the legacy minimal
title+SKU output is preserved (backward compat).

To opt into the new shell:

```tsx
<ProductInfo productId={42} showPrice />
```

Once opted in, all sections default to `true`. Hide individual sections by
passing `false`:

```tsx
<ProductInfo
  productId={42}
  showPrice
  showBundles={false}
  showSurcharges={false}
/>
```

Available toggles:
`showImage`, `showBadges`, `showFavorite`, `showPrice`, `showStock`,
`showAddToCart`, `showBundles`, `showBulkPrices`, `showSurcharges`,
plus pre-existing `showTitle` and `showSku`.

## Contract types

All slot contracts live in `propeller-v2-core-ui`:

- `PriceComponentProps`
- `StockComponentProps`
- `AddToCartComponentProps`
- `ImageComponentProps`
- `BadgesComponentProps`
- `FavoriteComponentProps`
- `ProductBundlesComponentProps`
- `ProductBulkPricesComponentProps`
- `ProductSurchargesComponentProps`

Import directly:

```tsx
import type { PriceComponentProps } from 'propeller-v2-react-ui';
// or
import type { PriceComponentProps } from 'propeller-v2-core-ui';
```

(`propeller-v2-react-ui` re-exports them from `propeller-v2-core-ui` for
convenience.)

## Default sub-component exports

For decorate-don't-replace:

- `DefaultProductPrice` (alias of `ProductPrice`)
- `DefaultItemStock` (alias of `ItemStock`)
- `DefaultAddToCart` (alias of `AddToCart`)
- `DefaultAddToFavorite` (alias of `AddToFavorite`)
- `DefaultProductBundles` (alias of `ProductBundles`)
- `DefaultProductBulkPrices` (alias of `ProductBulkPrices`)
- `DefaultProductImage` (new — language-aware image picker)
- `DefaultProductBadges` (new — reads `imageLabel` attributes)
- `DefaultProductSurcharges` (new — formats `product.surcharges` / `cartItem.surcharges`)
