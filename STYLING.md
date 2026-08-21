# Styling propeller-v2-react-ui

The package ships a precompiled stylesheet (`dist/styles.css`) that bundles
every Tailwind utility class its components reference plus the theme
tokens those utilities resolve against. Consumers import it once:

```ts
// app/layout.tsx (or your root)
import 'propeller-v2-react-ui/styles.css';
```

If you don't want default styling at all, skip the import — every
component will render unstyled (Tailwind classes resolve to nothing) and
you'll be on your own.

## Three override surfaces

All three are verified by the boilerplate's e2e suite
(`e2e/tests/anonymous/styling-overrides.spec.ts`). Pick the one that
matches the scope of your change.

### 1. Theme tokens (most cases)

The package's `:root` block declares CSS variables like `--card`,
`--primary`, `--border`, `--radius-container`, etc. at low specificity.
A consumer that re-declares the same variable anywhere with equal or
higher specificity wins, and every utility that resolved against it
updates instantly.

```css
/* app/globals.css — re-skin the whole package without touching components */
:root {
  --primary:           #ff7043;   /* changes bg-primary, text-primary, …    */
  --primary-foreground: #ffffff;
  --card:              #fafafa;
  --border:            #e1e1e1;
  --radius-container:  12px;
}
```

Scope-limited overrides work too:

```css
.brand-x { --primary: #1e88e5; }
.brand-y { --primary: #43a047; }
```

`<div class="brand-x"> <ProductCard ... /> </div>` and the embedded
`bg-primary`/`text-primary` calls inside the card resolve to blue. Same
component, different scope, no React re-render needed.

Full token list (declared in `src/styles.css`): background, foreground,
foreground-subtle, card, card-foreground, popover, popover-foreground,
surface-hover, primary (+fg), secondary (+fg), muted (+fg), accent (+fg),
destructive (+fg), success (+fg), warning (+fg), border, border-subtle,
input, ring, radius, radius-control, radius-container.

### 2. BEM hooks (component-specific overrides)

Every styled element in every component carries a BEM class alongside its
Tailwind utilities — `.propeller-product-card`, `.propeller-product-card__price`,
`.propeller-breadcrumbs`, `.propeller-cart-summary`, etc. The package emits
its utilities inside `@layer utilities`, so any unlayered consumer rule
that targets a BEM class wins by cascade order regardless of where it
appears in the stylesheet.

```css
/* app/globals.css — fork-free local edits */
.propeller-product-card {
  background: #fff8e1;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.propeller-product-card__price {
  font-weight: 700;
  color: #b45309;
}

.propeller-breadcrumbs__separator { display: none; }
```

The `@layer utilities` vs plain-rule cascade rule is part of the CSS
spec — no `!important` is required, no escalating specificity, no Tailwind
prefix gymnastics.

A short list of available hooks (grep `propeller-` in the package's
source for the full set):

- `.propeller-product-card`, `.propeller-product-card__{image,badges,title,sku,price,manufacturer,description,labels,label,cta,body,footer,favorite-btn,media,image-placeholder}`
- `.propeller-cluster-card`, `.propeller-cluster-card__{image,name,sku,price,…}`
- `.propeller-cart-summary`, `.propeller-cart-icon-and-sidebar__*`
- `.propeller-breadcrumbs`, `.propeller-breadcrumbs__{item,separator}`
- `.propeller-add-to-cart`, `.propeller-add-to-favorite`
- `.propeller-grid-toolbar`, `.propeller-grid-filters`, `.propeller-grid-pagination`
- `.propeller-order-list`, `.propeller-order-item-card`, `.propeller-order-totals`, `.propeller-order-summary`
- `.propeller-account-icon-and-menu`, `.propeller-menu`
- `.propeller-product-tabs`, `.propeller-product-gallery`, `.propeller-product-info`

### 3. Per-instance `className`

Every component appends `props.className` on its root, so a one-off
override is a regular prop:

```tsx
<ProductCard
  product={p}
  className="bg-yellow-100 ring-2 ring-yellow-400"
/>

<Breadcrumbs
  categoryPath={[]}
  currentLabel="Home"
  className="text-sm text-muted-foreground"
/>
```

Because the consumer's class lands at the end of the className list, the
last-defined rule wins in the cascade. `props.className` does NOT replace
the package's base classes — it adds to them. If you need to *strip* a
default (e.g. remove a built-in border), use the BEM hook approach.

## What does NOT work

- **No `dangerouslySetInnerHTML` / no replacing internal markup.** The
  compound API (`ProductCard.Image`, `ProductCard.Price`, ...) is the
  supported way to restructure what's rendered. See
  `app/examples/compound-api/page.tsx` in the boilerplate for a worked
  example.
- **No global `@apply` directives that target package classes from the
  host's Tailwind config.** The package's `bg-card` etc. are not registered
  in your `@apply` resolver — they only exist in `dist/styles.css`. If you
  want a host-side utility, write it as plain CSS targeting the BEM hook.
- **No theme tokens you didn't declare.** Tailwind v4 utility classes that
  reference tokens absent from the cascade resolve to nothing. The package
  declares the full set listed above; if you want, say, `bg-brand-mint`,
  declare `--color-brand-mint` in your own `@theme` block AND add the same
  utility to your own globals.css scan path.

## Tailwind dependency

The package's styles compile to vanilla CSS at build time. **Consumers do
NOT need Tailwind** to use the package — `dist/styles.css` works in any
project. If you happen to also use Tailwind, importing the package's CSS
doesn't conflict; your own Tailwind output is a separate stylesheet with
its own utilities.
