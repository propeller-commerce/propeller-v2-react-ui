# Changelog

All notable changes to `propeller-v2-react-ui` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once it reaches 1.0. Until then (the `0.x` line) the public API may change
between minor versions; breaking changes are called out below and in
[MIGRATION.md](./MIGRATION.md).

## [0.19.2] - 2026-08-27

### Fixed

- **Money formatted at the Dutch default wherever the host didn't pass
  `language`.** `localeForLanguage(undefined)` is `nl-NL`, so a component that
  reads `props.language` straight off its props prints Dutch separators unless
  every host remembers to thread the prop. `ProductCard` resolved it from
  `<PropellerProvider>`; several others did not, so one English page could show
  `€ 1,42` in its PDP hero price and `€1.70` on the cards beneath it.
  - `ProductPrice` and `ProductBulkPrices` already had provider-resolving
    wrappers on the main entry — but `OrderSummary` and `OrderTotals` did not,
    and are exported from both entries, so a client host got the unresolved
    build with no way to tell. Both now resolve `language` and `currency` from
    the provider on the main entry; `/pure` still exports the context-free
    versions for Server Components, which must pass `language` themselves.
  - `CartCarriers` now resolves its infra props like the rest of the checkout
    components, instead of reading them off its props.

### Internal

- Vitest now uses the automatic JSX runtime, matching the tsup build. It had
  been defaulting to the classic runtime, so any source file importing only
  named hooks — the context providers among them — threw "React is not defined"
  under test while building and shipping perfectly well.

## [0.19.1] - 2026-08-26

### Fixed

- **Order and quote lines whose product is gone from the catalog.** A product
  that is hidden, withdrawn or deleted still appears on every order and quote it
  was sold on, but the API returns no product record for it — `orderItem.product`
  is simply absent. `OrderItemCard` already fell back to the order item's own
  snapshot of the line for the name, sku, thumbnail and link, but not for the
  price: an injected `priceComponent` was handed `product.price`, rendered blank
  on `undefined`, and the line total silently disappeared from the row. Such a
  line now falls through to the order item's `priceTotal`. Rows with a product
  are unaffected — the slot is still used whenever there is a catalog price to
  give it.
- **`OrderShipments` printed `-` for the SKU** of a shipment line whose product
  is missing, having read `product.sku` with no fallback. It now reads the order
  item's own `sku`, which is stored on the order and always there.

## [0.19.0] - 2026-08-26

### Added

- **`useCart().addItems(items)`** — sequential bulk add that threads each add's
  resolved cart id into the next. "Add this whole set to the basket" is a normal
  requirement (kits, re-order, recipe packs) and there was no bulk call, so every
  consumer wrote the loop themselves and hit the bug below.
- **`currency` on `ProductCardProps` / `ProductGridProps`**, resolved from
  `<PropellerProvider>` like `ClusterCard` already did.
- **`className` on `CartSummaryProps`** and **`inputClassName` on
  `SearchBarProps`**, merged over the defaults through `tailwind-merge`.
- **`configuration` on `OrderItemCardProps`** — supply the host's URL builders
  and the item link is generated the way every other link on the storefront is.
- **Bonus items in the add-to-cart modal.** A promotion granting a free product
  said nothing at the moment it fired; the shopper only found it by opening the
  cart later, which is after it can influence them. Only the items *this* add
  earned are shown. `bonusItemsLabels` overrides the block's labels.

### Fixed

- **`addItem` could not add more than one product per tick.** It resolved the
  cart id from React state, which does not update until the next render, so a
  loop sent the same stale id every iteration: the 2nd..nth add failed with
  "No cart ID provided", or — with `createCart` — quietly started a NEW cart per
  product so only the last one survived. Neither failure throws, so both looked
  like the adds had simply vanished. The id now lives in a ref written the
  moment a cart resolves.
- **Cart lines lost their images unless every add path passed `configuration`.**
  The media arguments are optional and nothing warned; the mutation succeeded
  and the returned items carried no `imageVariants` at all, so the shopper saw
  empty tiles for products with perfectly good PIM images — two screens away
  from the call site. The hook now defaults them; an explicit `configuration`
  still wins.
- **A non-euro shop could not change the currency in the catalogue.**
  `ProductGrid` resolved a currency and never forwarded it, so every card fell
  through to the package's `€`. `GridFilters`' price inputs and the active
  price-filter chip hardcoded the glyph too — the chip had no prop and no class,
  so no userland fix existed.
- **Prices used Dutch separators in every language.** Number format now follows
  the storefront language via core-ui's `localeForLanguage`, so an English shop
  renders `£3.45` rather than `£ 3,45`. Components that format money take a
  `language` prop, resolved from the provider where they already read infra.
- **Search autosuggest and order-item links dropped the locale prefix.** Both
  built `/product/:id/:slug` from literals instead of the host's URL builders,
  so on a prefixed storefront they sent the visitor to the default language.
  They now use `configuration.urls` when supplied, with the literals as a bare-
  mount fallback.
- **`ProductBulkPrices` ignored an explicit empty `title`.** The heading is
  resolved with `getLabel`, which treats `''` as missing and substitutes its
  English default — so the component's own "no title, no heading" branch was
  dead code and the block rendered "Volume pricing" on a Dutch page.
- **The mini-cart labelled an excl-VAT figure "Total".** The cart page calls the
  same number "Total excl. VAT" and reserves "Total" for the incl-VAT figure, so
  the first number a shopper saw understated the price by one VAT amount. The
  label now follows the same switch the figure does.
- **`CartSummary` painted a card background with no card.** No padding, radius
  or shadow, directly above a properly styled `ActionCode` in the same column.
- **`SearchBar`'s input was styled for a dark header** (`bg-white/95
  border-white/20`), rendering as a white-on-white ghost on a light one. It now
  uses the themed surface and border tokens.
- **`ProductBundles`' add button read "In cart"**, a status rather than the
  action it performs, where every other cart control in the package says
  "Add to cart".
- **`OrderList` showed a bare line of text while loading**, collapsing the list
  and snapping it back — most visible when switching language on the account
  pages. It renders skeleton rows that hold the layout instead.

### Changed

- `AddToCartProps.onAddToCart` may return a promise, and `useCart` awaits the
  override. Matches the widened slot contract in core-ui 0.7.0.
- Requires `@propeller-commerce/propeller-v2-core-ui` `^0.7.0`.

## [0.18.0] - 2026-08-20

### Added

- **After-hooks now say WHAT happened, not just that something did.** Three
  callbacks reported success with no argument, which made them unusable for
  anything that has to distinguish the outcome — analytics, audit trails, or
  optimistic UI. All three arguments are optional, so existing zero-argument
  callbacks keep working unchanged.
  - `AddToFavorite.onFavoriteChanged(change?)` — `{ action: 'added' | 'removed',
    listId, productId, clusterId }`. It fired identically for an add and a
    removal, so a host could not report "added to wishlist" without inventing
    the direction, and a wishlist metric that also counts removals is worse
    than no metric.
  - `FavoriteLists.onListChanged(change?)` / `useFavorites` — `{ action:
    'created' | 'updated' | 'deleted', listId, name, isDefault }`. Note the
    existing `onCreate` / `onEdit` / `onDelete` props are *overrides* that
    replace the default mutation, so they were never usable as notifications.
  - `QuickOrder.onTemplateDownload()` — the template link was a bare `<a>`, so
    a buyer fetching the spreadsheet left no trace. Navigation is untouched.

### Notes

- `QuoteActions` deliberately gains no `afterReject`: the component has no
  reject action to hook — only accept. A rejection callback would be dead API.
- `PurchaseAuthorizationRequests` needs no new prop either; the existing
  `afterDeleteRequest` already covers the manager rejecting a request, which is
  what "delete" means in that UI.

## [0.17.0] - 2026-08-20

### Fixed

- **A host `className` override could not beat the component's own utility
.** Class lists were built by string-appending the override
  after the package's defaults, which decides nothing — the cascade does, not
  attribute order. `iconClassName="text-cocoa"` on `AccountIconAndMenu` (baked-in
  `text-white`) produced an element carrying both and rendered white, while the
  same override on `CartIconAndSidebar` appeared to work only because its
  default happened to lose anyway. Every override site now merges through
  `tailwind-merge`, so a conflicting utility is replaced rather than raced.
  59 sites across 47 components; BEM hooks and non-conflicting utilities are
  untouched.

- **Anonymous catalog listings were scoped differently on the client than on
  the server.** Listing hooks derived `userId` only from a
  logged-in user and omitted the key entirely for guests, while a server-side
  seed scopes anonymous queries to the channel's `anonymousUserId`. The two
  therefore asked different questions, and the client refetch quietly replaced
  a correctly-scoped product list with a differently-scoped one — assortment
  rules, negative order lists in particular, are applied per user. All five
  listing hooks (`useProductSearch` ×2, `useProductSlider`, `useQuickOrder`,
  `useSpareParts`) now resolve the id through one shared helper. Hosts that
  supply no `anonymousUserId` behave exactly as before.

### Added

- **`configuration.anonymousUserId`** — the channel's guest account, resolved
  server-side and handed to the package so client-side listings can scope to
  it. Same route `baseCategoryId` takes; no module guesses it.

## [0.16.0] - 2026-08-12

### Fixed

- **Localized names and slugs ignored the storefront language.** A localized array carries one entry per authored language in
  catalog order, so `names[0]` / `slugs[0]` is the catalog's DEFAULT language,
  not the storefront's. Thirteen sites read index 0 unconditionally while
  eleven others resolved by language correctly. Now all of them go through
  `getLocalizedValue`, which prefers the active language and falls back to any
  translation that has a value:
  - `ClusterOptions` — option group and option product names
  - `FavoriteListItem`, `FavoriteListDetails` — product and cluster names
  - `ItemsOverview` — item, bundle-leader, bundle-item and child-option names
  - `ProductBundles` — bundle item names
  - `OrderItemCard` — item name, child-item names, and **the cluster/product
    slugs used to build the item's link**
  - `SearchBar` — **the slug used to build each autosuggest result's link**

  The three slug sites are the ones that actually broke: they emitted
  default-language URLs on every non-default locale.
- **`useCart` never adopted a cart id that arrived after mount.** The id was seeded once with `useState(options.cartId || '')` and
  only reassigned from the hook's own cart-creation path, so a component that
  mounted before the cart resolved held `''` permanently. `CartIconAndSidebar`
  renders in the header on the first paint of every page, so its "Request
  authorization" button rendered enabled, fired, and returned `err('No cart')`
  with nothing sent — the reported "cannot submit purchase request". The id is
  now derived from the prop on every render. `processCart` was affected the
  same way.

### Changed

- **BREAKING (behavioural, hosts should act):** `OrderItemCard` gains a
  `language` prop. The component is exported from the RSC-safe `/pure` entry
  and reads no context by design, so a host that renders it directly must pass
  `language` or it keeps resolving in the catalog's default language.
  `OrderBonusItems` forwards its own resolved language automatically.
- `ClusterOptions` resolves `language` from `<PropellerProvider>` via
  `useInfraProps`, like the other catalog components. Passing it explicitly
  still wins.
- The favorites list's add-product button default now reads "Add product to
  favorite list" instead of "Add product directly to this wishlist".
  Hosts that translate `FavoriteListDetails.addProductDirectly` should update
  their own copy — "favorite list" is the agreed term, not "wishlist".

## [0.15.11] - 2026-08-11

### Fixed

- **Checkout step 3 opened with nothing selected on a fresh cart.**
  `CartPaymethods` and `CartCarriers` only ever adopted a value the cart already
  stored, so a cart that had never reached step 3 — every first order, and every
  order after the cart is recreated — rendered both grids blank and refused to
  continue until the user clicked. They now preselect the cart's stored option
  when there is one and otherwise the first option offered, so Continue works
  straight away. A stored value the backend no longer offers also falls back
  instead of leaving an invisible selection.

### Changed

- The active option is now derived from the cart rather than mirrored into state
  by an effect, so it is present in the first render (including SSR) instead of
  appearing after hydration. `onPaymethodSelect` / `onCarrierSelect` still fire
  once for the preselection, so hosts that persist the choice — and price the
  transaction costs off it — keep working unchanged.

## [0.15.10] - 2026-08-11

### Fixed

- **The cart sidebar's "Bonus items" heading stayed English on a localized
  page.** `CartIconAndSidebar` renders `CartBonusItems` itself but passed it no
  `labels`, so the block always fell back to its English defaults — while the
  same component on the cart and checkout pages, where the host passes `labels`
  directly, translated correctly. Same shape as the `cartItemLabels` gap fixed
  in 0.4.24.

### Added

- `CartIconAndSidebar` accepts `cartBonusItemsLabels` (keys: `title`, `sku`),
  forwarded to the embedded bonus-items block. Hosts already translating
  `CartBonusItems` on the cart page can pass the same map.

## [0.15.9] - 2026-08-11

### Fixed

- **The product specifications table emptied out in a language the catalogue is
  only partly translated into**. A localized list carries only the
  languages someone authored, so asking for one nobody wrote returns nothing —
  it does not fall back. `ProductSpecifications` matched strictly on
  `language === props.language`, which failed twice over: the label fell through
  to `attributeDescription.name` and printed the raw PIM code
  (`QUANTORE_70001706`) at the user, and the value resolved to `''` — and since
  `getAttributes()` drops rows with an empty value, the row disappeared
  entirely. On a Dutch-only catalogue browsed in English the whole table went
  blank. Both now prefer the active language and fall back to whichever
  translation exists, matching `GridFilters`, `ProductDescription` and the menu.
  Empty localized rows the backend really does return
  (`{ language: 'FR', values: [] }`) are skipped rather than winning the
  fallback. Language matching is now case-insensitive: with `language="en"` the
  component previously rendered nothing at all.

## [0.15.8] - 2026-08-11

### Fixed

- **Quick order could add products from outside the user's catalogue.** Both the
  row typeahead and the XLSX upload resolved codes through the flat `products`
  resolver with no catalog scope and no user context. Orderlist (contract)
  scoping is honoured by `category.products` but **silently ignored** on the flat
  resolver, so quick order surfaced the full catalogue while the grid and the
  search preview stayed scoped — the same bug fixed for the SearchBar preview in
  0.4.28. `searchProducts` now queries `category.getCategory` over
  `configuration.baseCategoryId` and passes `userId` / `companyId` /
  `applyOrderlists`, plus `hidden: false`, matching `ProductGrid`, the SearchBar
  and the WordPress plugin's quick-order flow. Codes outside the catalogue are
  reported through `onMissingCodes` instead of being added.

### Changed

- **`QuickOrder` needs `configuration.baseCategoryId`.** Without it the
  typeahead and the upload resolve nothing rather than falling back to an
  unscoped search — failing closed is the point of the fix. Apps already
  resolving a base category for `ProductGrid` / `SearchBar` should pass the same
  value.

### Added

- `QuickOrder` accepts `taxZone` (defaults to `'NL'`), `orderlistIds` and
  `applyOrderlists`, forwarded to the scoped search.

## [0.15.7] - 2026-08-10

### Fixed

- **`OrderBonusItems` showed the list price of a free item.** The API models a
  bonus as two order lines: the product line at its list price, plus a sibling
  `class: 'incentive'` line carrying the negative delta and pointing back via
  `parentOrderItemId`. The component rendered the product line and ignored the
  sibling, so a bonus that reads € 0,00 in the cart and at checkout reappeared
  at its list price on the thank-you page and in order details. Bonus lines are
  now netted against their incentive siblings via `getNettedBonusItems()`
  (core-ui 0.6.2); partial discounts keep their remainder instead of collapsing
  to zero. Order totals were already correct — this was display-only.

## [0.15.6] - 2026-08-10

### Fixed

- **Eight user-visible strings could not be translated at all** — they had no
  label key and no prop, so a consumer supplying a full `labels` dictionary
  still shipped English on a Dutch page. Every one now resolves through
  `getLabel` with the previous text as the fallback, so this is additive: a
  consumer that supplies none of the new keys renders exactly as before.

  | Component | Was | New key |
  |---|---|---|
  | `CategoryDescription` | Read more / Read less | `readMore`, `readLess` |
  | `ProductDescription` | Read more / Read less | `readMore`, `readLess` |
  | `MachineGrid` | Loading…, No machines found. | `loading`, `noMachines` |
  | `RegisterForm` | Please select an account type. | `selectUserType` |
  | `AccountIconAndMenu` | Hi, {name} | `greeting` |

  `ProductTabs` now forwards its `labels` to `ProductDescription`, without
  which the two new keys could not be reached on a product page.

  The greeting takes a `{name}` placeholder rather than a bare prefix, so a
  translation can put the name first — matching the existing `{link}`
  convention in `LoginForm.noAccount`.

- **Raw server errors are overridable.** `RegisterForm` rendered
  `result.error` and `PurchaseAuthorizationConfigurator` rendered the
  add-contact failure verbatim — unlocalised upstream text, often cryptic.
  Supplying `registrationFailed` / `addContactFailed` now replaces them
  outright, the same masking `LoginForm` already does with
  `invalidCredentials`. Omit the key to keep the current pass-through.

- **Both authorization modal close buttons had no accessible name.** The
  `✕` glyph and the SVG icon were the only content, so screen readers
  announced punctuation or nothing. Both take an `aria-label` from the
  existing `closeLabel` key, with the glyph/icon marked `aria-hidden`.

## [0.15.5] - 2026-08-10

### Fixed

- `useMenu` no longer drops categories that lack a translation in the active
  language. The query filtered server-side — `names(language: $language)` — so a
  category with no entry for that language came back with `names: []` and
  `slugs: []`. `mapCategory`'s `?? raw.names?.[0]` fallback then had nothing to
  fall back to, and the row rendered with a blank label and an empty slug:
  invisible and unclickable. Switching a bilingual storefront to a language with
  partial translations collapsed the menu to whichever categories happened to be
  translated.

  `names` and `slugs` are now fetched unfiltered — every translation — and
  `mapCategory` picks the active language, falling back to whichever translation
  exists. `slugs` gained a `language` field so the slug follows the same rule as
  the name. `$language` is gone from the query signature (an unused variable is
  a GraphQL validation error); it still keys the cache and drives the pick.

## [0.15.4] - 2026-08-10

### Fixed

- `<ItemsOverview>` follows the Incl./Excl. BTW toggle. It never resolved infra,
  so it printed `item.price × quantity` — always excl. VAT — while `<CartItem>`
  on the cart page printed `totalSumNet` (incl.). The same lines therefore
  appeared on two different tax bases in consecutive checkout steps. It now
  reads `includeTax` (and `currency` / `language`, which also silently fell back
  to `'€'` and no language) from `<PropellerProvider>`, and takes line totals
  from `totalSum` / `totalSumNet` — the same fields `<CartItem>` reads. Bundle,
  bundle-item and child-option prices switch on the same basis.

  Hosts that already render inside `<PropellerProvider>` need no change; pass
  `includeTax` explicitly to override.

## [0.15.3] - 2026-08-10

### Fixed

- `<CartSummary>` renders a **Transaction costs** line when the cart's payment
  method carries a fee. The fee was already inside `total.totalGross`, so the
  panel's own rows never added up to the "Total excl. VAT" it printed — a €7.25
  order with €49.00 shipping showed €56.60. `<OrderTotals>` has always shown
  this row; the cart panel now matches. Label key: `transactionCosts`.

## [0.15.2] - 2026-08-10

### Fixed

- `<GridFilters>` resolves each facet's label in the active language. The title
  came from `descriptions[0]`, so on a bilingual tenant every filter heading
  rendered in whichever language the API returned first (Dutch), regardless of
  the shopper's selection. It now matches on the `language` prop, falling back
  to the first description and then the raw attribute name.

  Hosts must pass `language` to `<GridFilters>` / `<GridFiltersPanel>` for the
  labels to follow the language switcher; omitting it preserves the previous
  behaviour.

## [0.15.1] - 2026-08-10

### Fixed

- `<GridFilters>` shows an unticked option its **own** result total instead of
  the intersection with the group's active selection. Once a group held a
  selection the backend's `count` for a sibling became "products carrying both
  values" — a season facet read "(1)" and added 2 products when ticked. The
  count now comes from `countActive` (the option with its own group's filters
  lifted, other groups still applied), which is what the field is documented
  for. With no selection in the group the backend returns `count ===
  countActive`, so unfiltered listings are unchanged.

## [0.15.0] - 2026-08-06

### Changed

- **BREAKING — the stock filter is a toggle plus a quantity, not two
  checkboxes.** `<GridFilters>` now takes `activeAvailability` as a single
  `Availability` (`'all' | 'in-stock'`) rather than an array, gains
  `activeMinStock`, and its `onAvailabilityChange` fires with both the
  selection and the quantity. `<GridToolbar>` takes `availability` as a single
  value plus `minStock`, and its `onAvailabilityFilterRemove` takes no
  argument. `<ProductGrid>` takes `availability` plus `minStock`. The
  out-of-stock bucket has no replacement. See [MIGRATION.md](./MIGRATION.md).

  Two checkboxes could express "in stock or out of stock" — every product, and
  so a state that looked active but sent no filter. They also could not answer
  what a shopper asks next: not "is it stocked?" but "do you have enough?".

  The section is now a two-state toggle and, once In stock is chosen, an
  editable quantity with stepper buttons. The value can be typed directly or
  stepped, commits on blur or Enter, and is floored and clamped to a minimum
  of 1 — a lower threshold would match zero-stock products and contradict the
  toggle. Switching back to All products clears it.

  Requires `propeller-v2-core-ui` >= 0.6.0.

- **The toolbar shows one stock chip** instead of one per bucket, carrying the
  quantity when it is above the default.

### Added

- Label keys `allProducts`, `atLeast`, `pcs`, `quantityDecrease` and
  `quantityIncrease`. The `outOfStock` key is no longer read.

## [0.14.0] - 2026-08-05

### Added

- **`hideHeader` and `flat` on `<OrderList>` and
  `<PurchaseAuthorizationRequests>`** — for embedding a list inside a host's
  own card. `hideHeader` drops the table's column-header row, redundant once
  a card names what it contains and shows three columns. `flat` drops the
  component's own background, border, shadow and rounded corners, which
  otherwise nest a box inside the host's box. On `<OrderList>` the empty
  state honours `flat` too, so a card with no results does not draw a stray
  panel.

- **`limit`, `columns`, `columnConfig`, `showActions` and `hideTitle` on
  `<PurchaseAuthorizationRequests>`** — the component rendered a fixed
  five-column table (date, quantity, total, requested by, actions) and its
  own heading, so it could not be reduced to a summary. `columns` selects
  which of those render and in what order, `columnConfig` overrides their
  header labels, `showActions` hides the accept/delete buttons, `hideTitle`
  suppresses the component's own `<h2>` when the host already has one, and
  `limit` caps the list to the most recently modified — mirroring the prop
  `<FavoriteLists>` already carries.

### Notes

Every prop above is additive and defaults to current behaviour: an existing
consumer that passes none of them renders exactly as it did in 0.13.0. In
particular `<PurchaseAuthorizationRequests>` still lists requests in the
order the API returned them; the most-recent-first sort applies only when
`limit` is set, so the rows that survive the slice are the newest.

## [0.13.0] - 2026-08-05

### Added

- **Availability filter on `<GridFilters>`** — an opt-in section below the
  price block with two checkboxes, In stock and Out of stock, wired to the
  server-side stock filter the SDK exposes on `CategoryProductSearchInput`.
  New props: `showAvailabilityFilter` (defaults `false`),
  `activeAvailability` and `onAvailabilityChange`. Nothing selected sends no
  filter, so the default listing is unchanged.

  Selecting both buckets means "in stock or out of stock", which is every
  product. The filter has no OR operator and the union is the unfiltered set
  anyway, so both-selected sends no filter — the same as selecting neither.
  The checkboxes stay ticked; only the request collapses.

  The mapping lives in `propeller-v2-core-ui`'s `buildInventoryFilter`, so
  this package never restates the operator semantics. Requires
  `propeller-v2-core-ui` >= 0.5.0 and `propeller-sdk-v2` >= 0.15.0, where the
  inventory filter was added.

- **`availability` and `onAvailabilityFilterRemove` on `<GridToolbar>`** —
  the active-filter row now renders one removable chip per selected bucket,
  so a stock-filtered listing shows why its results are narrowed and can be
  undone from the results area. One chip per bucket, matching the attribute
  chips rather than the price chip which covers a whole range. The row's
  active check accounts for availability, so it appears when availability is
  the only active filter.

- **`availability` on `<ProductGrid>`** — forwards the selection to
  `useProductSearch`, which applies it to both the grid fetch and the
  typeahead preview. Filtering only the grid would let the preview offer
  products the grid then hides.

### Changed

- The availability section is hidden for anonymous visitors in a semi-closed
  portal, the same rule the price filter already follows. Hosts should pass
  their own "show stock" setting through `showAvailabilityFilter`: filtering
  by stock reads as broken when the cards display no stock to filter on.

## [0.12.0] - 2026-07-31

### Added

- **`productTrackAttributes` on `<ProductGrid>`, `<SearchBar>` and
  `useProductSearch`.** Pass the attribute names a card renders — e.g.
  `productTrackAttributes={['MPN']}` — and they arrive on
  `product.attributes` for every item in the result, ready to read from a
  card slot like `belowName`. `useProductInfo` has had an option of this name
  since the PDP work; the grid side simply never forwarded one, so hosts that
  set it in their portal config saw it silently ignored on listings and had
  to fetch attributes themselves in a second request.

  Requires `propeller-sdk-v2` >= 0.16.0, where the `category` and `products`
  operations gained `$attributeResultSearchInput` and `ProductGridFields`
  gained the matching `attributes(input:)` selection.

  Naming the attributes you render is not just a payload optimisation — it is
  the correct behaviour. With no input the server returns the *first page* of
  a product's attributes (12 per product), so on a product carrying more than
  12 the ones on later pages are missing with no error. Filtering to the names
  you need also cut a 24-product category response from ~168 KB to ~124 KB in
  our testing.

## [0.11.4] - 2026-07-31

### Fixed

- **The add-to-cart button overflowed its product card in narrow columns.**
  The submit button is `flex-1`, but a flex item defaults to
  `min-width: auto` and so refuses to shrink below its content width — icon
  plus label plus `px-6` of padding. In a slider or a dense grid the button
  ran past the card's edge instead of fitting inside it. Longer non-English
  labels hit this first: Dutch "Toevoegen" is roughly twice the width of the
  "Add" the padding was sized around. The button now carries `min-w-0`, eases
  its padding to `px-3 sm:px-6`, and wraps its label in a `truncate` span, so
  it shrinks to the column and ellipsises rather than overflowing. Same fix
  for `<ClusterCard>`'s "View cluster" link, which had the identical shape.
- **Hovering a card's CTA lit up the whole card.** The card root is a
  `group` with `hover:shadow-md`, so hovering the button — a descendant —
  raised the card shadow, shifted its border and zoomed the product image at
  the same time as the button's own hover state. Three things answering one
  intent read as the card being clickable rather than the button. While the
  pointer is on a CTA the card-level highlight and the image zoom now stand
  down and the button owns the hover; moving anywhere else on the card is
  unchanged. Browsers without `:has()` keep the previous behaviour.

### Changed

- **`<AddToCart>`'s hover shade now matches the other CTAs.** It darkened to
  `bg-secondary/90` where every other solid button in the package uses `/80`.
  Now `/80` as well.

## [0.11.3] - 2026-07-31

### Fixed

- **`<ProductSlider>` hid add-to-cart from signed-in users in a semi-closed
  portal.** It gated the control on `portalMode === 'open'`, so the whole mode
  lost it rather than just anonymous visitors — the same defect `ProductGrid`
  had before 0.8.0. Sliders now gate on the shared
  `isContentHidden(portalMode, user)` like the grid, so a signed-in shopper
  keeps add-to-cart on cross-sells, up-sells and CMS product blocks.

### Added

- **`allowAddToCart` on `<ProductSlider>`** — lets a host hide the control the
  way `ProductGrid` already allows. Defaults to `true`; a semi-closed portal
  still withholds it from anonymous visitors regardless.

## [0.11.2] - 2026-07-31

### Fixed

- **`<ProductSlider>` dropped `onLoginClick`, so its log-in action did
  nothing.** In a semi-closed portal `ProductCard` replaces add-to-cart with
  `<LoginToOrderButton>`, and the card resolves `onLoginClick` from the grid
  config. `ProductGrid` puts it there; the slider never did — it forwards every
  other card callback (`onProceedToCheckout`, `onRequestQuoteClick`,
  `afterAddToCart`, …) but this one was missed when the semi-closed gating
  landed in 0.8.0. Anonymous visitors got a button that looked clickable and
  went nowhere, on every slider — cross-sells, up-sells and CMS product blocks.
  It is now forwarded like the rest.

## [0.11.1] - 2026-07-30

### Fixed

- **`menuStyle="accordion"` rendered nothing above `md`.** The accordion is the
  mobile drawer for every style, so its `<nav>` carried `md:hidden` and rendered
  unconditionally — while the desktop branches were gated on `menuStyle`.
  Selecting it therefore matched no desktop branch and hid the mobile one,
  leaving an empty panel. It now renders at every breakpoint when chosen
  explicitly, and stays `md:hidden` as the mobile presentation of the others.
  This is what 0.11.0's depth warning already recommended for deep trees.
- **`menuStyle` values with no renderer failed silently.** An unrecognised
  style matched no branch and produced an empty panel with nothing to indicate
  why. It now falls back to `accordion` — the style that can display any tree —
  and warns in development, pointing at `renderMenu`.
- **The accordion's expand control didn't look clickable.** Tailwind v4 resets
  buttons to `cursor: default`, so the chevron — the only control that expands a
  branch — gave no affordance. Added `cursor-pointer` plus a hover colour shift,
  and the same to the jumbotron tabs, which had it too.
- **A deep flyout could run off the viewport with no way to reach it.** The
  columns row now has `max-w-[100vw] overflow-x-auto`, so a tree wider than the
  screen degrades to a scroll instead of being unreachable.

### Added

- **`renderMenu` — render the menu yourself.** The built-in styles are three
  arrangements of the same tree; this is the escape hatch for a fourth. It
  receives a `MenuRenderContext` carrying the categories, the open-path state
  and the same helpers the built-ins use (`getCategoryUrl` honouring
  `getUrl`/`configuration`, `handleItemClick` firing `onMenuItemClick`,
  `openAt`/`toggleAt`/`isOpenAt`), so a custom menu gets working open/close
  behaviour and URL building without reimplementing them and drifting. Return
  `null` to fall through to the `menuStyle` rendering. `MenuStyle` and
  `MenuRenderContext` are exported.
- **First tests for `Menu`** (9 cases), covering the failures above: they all
  passed type-checking and rendered *something*, so only a DOM assertion catches
  them.

### Changed

- **`dropdown-horizontal` removed.** It was referenced only in the depth-cap
  logic and never had a renderer, so it advertised a style that drew nothing.
  Callers using it now hit the unknown-style fallback (accordion + warning); use
  `renderMenu` for a genuinely custom layout.
- **`dropdown-vertical` caps at 5 levels, up from 4.** Each level is a 256px
  column, so five total 1280px — within a 1440px desktop. Paired with the
  overflow guard above for narrower screens.
- **`menuStyle` is typed `MenuStyle | (string & {})`** rather than `string`: the
  built-ins autocomplete while a custom value still type-checks for use with
  `renderMenu`.

## [0.11.0] - 2026-07-30

### Fixed

- **`<Menu depth>` was inert past three levels.** `depth` was threaded into
  `useMenu`, which correctly built a recursive query to any depth, but every
  style rendered exactly three hand-coded levels. `depth={4}` and beyond fetched
  data that was never displayed — extra payload for nothing, with no warning
  that the prop was only half-honoured. All styles now render to `depth`.
- **The expand chevron promised levels that never rendered.** It keyed off "has
  children" alone, so a category at the deepest rendered level showed an
  affordance that did nothing. It is now also gated on the child being within
  `depth`.

### Changed

- **Per-level menu state replaced with a single open path.** The four
  positional state slots (`hoveredL1Id` / `hoveredL2Id` / `expandedL1` /
  `expandedL2`) are now one `openPath: number[]`. "Opening a shallower item
  closes the deeper ones" is structural (`slice(0, level)`) rather than a
  hand-written reset per level, which grew quadratically and was easy to get
  wrong when adding a level.
- **`data-level` is emitted to whatever depth renders** instead of a hardcoded
  `1`/`2`/`3`, so consumer CSS can target arbitrary depth.
- **Flyout styles cap the levels they can lay out** — 4 for
  `dropdown-vertical`, 3 for `dropdown-horizontal`/`jumbotron`, since each level
  is another horizontal column and beyond that they run off-screen. The
  accordion nests vertically and is uncapped. Exceeding a cap logs a
  `console.warn` in development (previously the prop silently did nothing).

`depth` still defaults to 3, and all fifteen `propeller-menu__*` class hooks are
unchanged, so a three-level menu keeps its existing structure and styling. Some
Tailwind utility classes internal to the component differ where per-level
values (`pl-8` / `pl-12` indentation) became a computed `padding-left`; styling
that targets the `propeller-menu__*` hooks is unaffected.

## [0.10.1] - 2026-07-30

### Fixed

- **`<SearchBar>` autosuggest ignored orderlist scoping.** The component
  resolves `user` like every other infra prop but never passed it to
  `useProductSearch`, and the backend drives orderlist scoping off the user id —
  so `orderlistIds` alone had no effect on the autosuggest query. The dropdown
  returned the whole catalogue while the grid below it, which does pass `user`,
  showed only the contract's products. Forwarding `user` makes the two agree.

## [0.10.0] - 2026-07-29

### Added

- **Magic-token authentication in `useAuth`.** `magicLogin(token)` exchanges a
  backend-issued magic token for a session (via
  `MagicTokenService.magicTokenLogin`), sets the in-memory Bearer header — never
  `setAccessToken` — and loads the viewer, mirroring `login()`. This is the
  passwordless / punchout deep-link handoff. `createMagicToken(input)` issues a
  magic token for a contact/customer (`MagicTokenCreateInput`, authenticated).
  Both return the standard `Result` and are exposed on `UseAuthReturn`. No new
  runtime dependency — the SDK's `MagicTokenService` ships in 0.14.0.

## [0.9.0] - 2026-07-29

### Changed

- **Align with `@propeller-commerce/propeller-sdk-v2` 0.14.0**, which removed the
  entire deprecated schema surface. Category reads move to the plural localized
  arrays — `Breadcrumbs` (`category.names` / `slugs`), `CategoryDescription`
  (`descriptions`), `CategoryShortDescription` (`shortDescriptions`) — and the
  hand-written menu query in `useMenu` now selects `names(language:)` /
  `slugs(language:)`. `useClusterConfigurator` / `useProductInfo` read
  `ClusterConfigSetting.attributeName` and `uuid` (were `name` / `id`); the
  public `ConfiguredSetting.id` is now a `string`. Bumped the SDK dev dependency
  to `^0.14.0` and `propeller-v2-core-ui` to `^0.4.0`; the runtime peer stays `*`.

## [0.8.0] - 2026-07-28

### Added

- **`<LoginToOrderButton>`** — a log-in call to action rendered in place of
  add-to-cart for anonymous visitors of a semi-closed portal. Takes an
  `onLoginClick` callback (the host owns navigation, mirroring
  `RegisterForm.onLoginClick`) and a `loginToOrder` label. `ProductCard`,
  `ProductInfo` and `ProductGrid` accept `onLoginClick` and forward it.
- **`showLoginPrompt` on `<ProductPrice>` and `<ProductBundles>`** — set
  `false` to render nothing where the "log in to see prices" text would go.
  Defaults to `true`, so existing behaviour is unchanged.
- **`portalMode` on `<ProductCard>`, `<ClusterCard>` and `<ClusterOptions>`** —
  resolved from `<PropellerProvider>` like the other Tier 1 infra props; an
  explicit prop still wins.

### Fixed

- **Semi-closed portals leaked price and stock in listings.** `ProductCard`
  never received `portalMode`, so the price it renders through `<ProductPrice>`
  and its stock row stayed visible to anonymous visitors even though the toolbar
  and price filter were correctly gated. `ClusterCard` had the same gap, and
  `ClusterOptions` printed option prices in its dropdown labels and selection
  preview. All now gate on the shared `isContentHidden(portalMode, user)`.
- **`ProductGrid` hid add-to-cart from signed-in users of a semi-closed
  portal.** `showAddToCart()` tested `portalMode === 'open'` rather than
  `isContentHidden`, so authenticated shoppers lost the control along with
  anonymous ones. Signed-in users keep add-to-cart.
- **The CTA slot collapsed when content was hidden.** `ProductCard` gated the
  slot on `allowAddToCart`, which `ProductGrid` passes as `false` in that case —
  leaving no room for the log-in action. The slot now renders either control.

## [0.7.1] - 2026-07-28

### Fixed

- **`cartUpdateAddress` rejected a blank email** — optional address fields were
  sent as empty strings when left blank, and the API validates optional fields
  whenever they are present, so a blank email failed with
  `email must be an email` (400). This blocked the address step for a delivery
  address, where the email legitimately lives on the contact / customer record
  rather than the address. Optional fields are now omitted when blank, matching
  how `useAddress` already built its payloads. Affects every optional field
  (`email`, `phone`, `mobile`, `company`, `notes`, …), not just email.
- **`<AddressCard>` required an email on every address** — the edit and create
  forms hardcoded `required` plus a `*` on the email input, contradicting the
  field being optional on the address itself. Email is now optional in both
  forms.
- **`<AddressCard>` accepted undeliverable emails** — `type="email"` alone
  permits dotless domains such as `aa@gg` (valid per the HTML5 spec for
  intranet hosts, but rejected by the API). Both email inputs now carry a
  pattern requiring a dotted top-level domain, so invalid input is caught in
  the form instead of surfacing as a failed mutation. Subdomains
  (`user@sub.co.uk`) and tagged addresses (`user+tag@example.com`) remain
  valid.

## [0.7.0] - 2026-07-27

### Added

- **`<QuickOrder>` component + `useQuickOrder` composable** — a bulk "quick
  order" pad for B2B replenishment. Each row has a debounced SKU/code typeahead
  (`ProductSearch`); selecting a match fills the row's name, net price and
  minimum quantity. Quantities are editable, rows can be added/removed, and
  duplicate SKUs are rejected. "Add to cart" resolves the user's cart (shared
  `initCart` flow) and adds every resolved row in a single `CartItemBulk`
  mutation (`CartService.bulkUpdateCartItems`). Ports the WordPress plugin's
  quick-order/replenish flow.
  - Optional XLSX upload: pass a `parseSpreadsheet(file)` handler (the app owns
    the parser — the package ships no spreadsheet dependency) plus a
    `templateUrl`; parsed code+quantity lines are resolved against the API and
    unresolved codes reported via `onMissingCodes`.
  - Fully label-driven (`labels` prop) and `configuration`-aware (image filters
    so typeahead results carry thumbnails, same as `SearchBar`). Infra props
    (`graphqlClient`/`user`/`companyId`/`language`) resolve from
    `<PropellerProvider>` via `useInfraProps`.
  - A typed code is only ever a *search term* — a row's product identity and
    price always come from the API, never from the typed/uploaded value.

## [0.6.1] - 2026-07-23

### Fixed

- **Login viewer inputs** — `LoginForm` now forwards the resolved `configuration`
  (from `<PropellerDepsProvider>` via `useInfraProps`) into `useAuth`, so the
  login `getViewer` requests the configured track attributes and pagination
  inputs — `companyTrackAttributes` (→ `MY_INSTALLATIONS`),
  `customerTrackAttributes`, `contactPAConfigInput`, and the newly-forwarded
  `contactCompaniesSearchInput`. Previously the header login returned a viewer
  with no companies/attributes until a later `refreshUser`. `useAuth` also now
  guards `contactPAConfigInput` with `isViewerSearchInput` (a non-array object)
  so a misconfigured empty array `[]` is omitted rather than 400-ing the viewer.

## [0.6.0] - 2026-07-21

### Added

- `MachineGrid` — the spare-parts machine tree as one self-contained grid, the
  sibling of `ProductGrid`. Driven by the current URL path (`segments` prop), it
  renders two modes: **root** (empty segments → the company's installations via
  `useMachines`, as `MachineCard`s) and **node** (a machine by its leaf slug via
  `useSpareParts` → child `MachineCard`s above a category-style parts listing —
  facets, toolbar, a permanently-controlled `ProductGrid`, pagination, and the
  qty-in-machine `belowName`). Resolves infra via `useInfraProps`. Navigation
  between levels is via `MachineCard`'s `href` (built from `basePath` + segments);
  the package owns no router. The parts listing is **controlled**: current state
  in via `listing`, every interaction out via `onListingChange`, so the host maps
  it to the URL (shareable/refreshable) — the same contract `ProductGrid` uses.
- `useMachines` — resolves a company's installations in ONE concatenated request
  by aliasing `machine(source:, sourceId:)` per id (`buildRootMachinesQuery`,
  also exported), mirroring the WP reference's `installations()` mega-query. Same
  idle discipline and race guards as `useSpareParts`.
- `MachineListingState` — the controlled listing shape `MachineGrid` accepts
  (page / offset / sort / attribute-filters / price / term), primitives + SDK
  enums only.

## [0.5.0] - 2026-07-17

### Added

- `MachineCard` — a node in the spare-parts machine tree, rendered as a card
  that navigates one level deeper. Takes an explicit `href` rather than deriving
  one from `configuration.urls`: a machine's URL is its ancestor path
  (`/machines/a/b/c`), which only the host route knows.
- `useSpareParts` — the machine-tree sibling of `useProductSearch`, sourced from
  `machine(slug:).sparePartProducts`. Same contract: options in, state + actions
  out, `parts?` controlled sentinel (`!== undefined`, so `[]` is
  controlled-empty), per-instance race guard plus module-level in-flight dedup
  for Strict Mode. Returns the node's `childMachines` alongside its parts so a
  host can render both in one grid.

  Drops two things `useProductSearch` carries: the debounced search-bar path
  (searching within a machine is server-side and scoped to the node, so it is
  just the `term` option) and the language post-filter.

  Requires `@propeller-commerce/propeller-sdk-v2` >= 0.13.0 — earlier versions'
  `machine` query cannot filter/sort/page its spare parts.

### Notes

- Machine data reaches the SDK via `machineService(client)` directly, not
  `createServices(client).machine` — the core-ui `Services` bundle has no machine
  entry. Same seam `useProductSearch` already uses (it builds services from the
  passed client rather than reading `useServices()`).

## [0.4.29] - 2026-07-21

### Fixed

- **`SearchBar` autosuggest now filters results by the active language.**
  Follow-up to 0.4.28's category-search routing: the backend search matches
  across all languages, so FR/ES-only products leaked into an EN preview. The
  autosuggest now drops results with no name in the active language (and
  adjusts the "View all (N)" total by the dropped count), and the result row
  displays the name in the active language (falling back to the first
  available) instead of always the first name in the array. Restores the
  behaviour of the pre-package local search bar.

## [0.4.28] - 2026-07-21

### Fixed

- **`SearchBar` autosuggest orderlist scoping — real fix.** 0.4.27 set
  `orderlistIds`/`applyOrderlists` on the flat `products` search input, but the
  server's `products` resolver does not honour orderlist scoping (only the
  `category.products` resolver does), so the preview still leaked the full
  catalogue inside a contract. The debounced autosuggest now runs the **same
  category term-search the grid uses** (`getCategory` over the base category)
  instead of the flat `getProducts`, so contract scoping is applied server-side
  and the preview matches the grid exactly. Requires
  `configuration.baseCategoryId` (already provided by all consumers); previews
  no-op without it, as before.

## [0.4.27] - 2026-07-21

### Fixed

- **`SearchBar` autosuggest now respects orderlist (contract) scoping.** The
  debounced live-search query built a plain `ProductSearchInput` that never
  passed `orderlistIds`/`applyOrderlists`, so the dropdown previewed the full
  catalogue even inside a B2B contract catalogue (the submitted results were
  already correctly scoped — only the preview leaked). It now threads the same
  orderlist scope as the grid fetch, so previews and results agree and a PDP
  outside the contract is no longer reachable from the preview.

### Added

- **`SearchBar`: `renderPrice` + `showPrice` props.** `renderPrice(result)`
  replaces the price cell of each result with custom content (return any node,
  or `null` to render nothing) — e.g. a "Price by quotation" label for a
  contract catalogue where prices are quote-only; it fully overrides the
  default price rendering. `showPrice` (default `true`) is a simpler boolean to
  hide the price column outright. Both default to the previous behaviour, so
  the change is backward-compatible.

## [0.4.26] - 2026-07-21

### Added

- **`SearchBar`: real anchor links for navigation.** New optional
  `getResultHref(result)` and `getViewAllHref(term)` props. When provided, the
  autosuggest result rows and the "View all results" CTA render as real
  `<a href>` elements — middle-clickable, open-in-new-tab, hover-preview,
  crawlable — while the existing `onResultClick`/`onViewAllClick` callbacks
  still fire for SPA navigation (modified clicks fall through to the browser).
  Omit the props to keep the previous behaviour.
- **`OrderList`: URL-persistable filters.** New optional `initialSearchForm`
  (seed the filter form on mount, e.g. rehydrated from the URL) and
  `onSearchApply(form)` (fires when the user applies/clears filters) props, so
  the consuming page can keep the filter state in the URL — bookmarkable,
  shareable, back-button-friendly. `useOrders` gained the matching
  `initialSearchForm` option.

### Changed

- **`AccountIconAndMenu`: account-menu items are now `<a href>` instead of
  `<button>`** (both the sidebar and dropdown variants). They use each link's
  existing `href`, so they are middle-clickable / new-tab-able / crawlable;
  `onMenuItemClick` still handles plain-click SPA navigation.
- **`SearchBar`: the "View all results" fallback is now a `<button>`** (was a
  non-focusable `<div>`), so it is keyboard-accessible even without the new
  `getViewAllHref` prop.

### Fixed

- **`OrderList`: clickable rows now show `cursor: pointer`.** When
  `rowsClickable` is set, the row cursor matches its behaviour (was `auto`,
  inconsistent with the favourites cards).

## [0.4.25] - 2026-07-20

### Fixed

- **Raw enums no longer leak to the UI.** `OrderList` + `OrderSummary` gained a
  `statusLabels` prop (raw status → localized, e.g. `NEW`→"Nieuw"), and
  `OrderSummary` a `paymethodLabels` prop (raw method → localized, mapping both
  the order-path `REKENING` and quote-path `ACCOUNT` variants to one label).
  Unknown keys fall back to the raw value.
- `AddressCard`: new `showTypeBadge` prop (@default true) — set `false` to hide
  the invoice/delivery chip where a heading already names the type.
- **Concatenated sentences → placeholder interpolation** (fixes broken Dutch
  word order + missing spaces):
  - `FavoriteLists` delete confirm: full-sentence `deleteConfirm` with a
    `{name}` placeholder (the verb was stranded before the object, no space
    before the quote).
  - `CartOverview` / `QuoteActions` terms consent: `termsConsent` with a `{link}`
    placeholder (was "de<a>…", no space, English order).
  - `LoginForm` account-header prompt: `noAccount` with a `{link}` placeholder
    (was "account?Create an Account", no space).
- **Pluralization**: `FavoriteLists` item count uses `itemSingular`/`itemPlural`
  by count ("1 artikel" not "1 artikelen"); `GridToolbar` product count uses
  `productSingular`/`productPlural` (+ a space).

## [0.4.24] - 2026-07-20

### Fixed

- **Date formatting**: `OrderList`, `OrderSummary`, `CartOverview`,
  `OrderShipments`, `PurchaseAuthorizationRequests`, `FavoriteLists` rendered
  dates via locale-less/`'en-US'` `toLocaleDateString` (US M/D/YYYY) or an
  inconsistent `D.M.YYYY` — Dutch readers misparse M/D by months. All now use a
  consistent numeric `DD-MM-YYYY` fallback (still overridable via
  `props.formatDate`).
- `CartIconAndSidebar`: new `cartItemLabels` prop, forwarded to the mini-cart's
  inner `CartItem` rows so the line labels (e.g. the `qtyPrefix` "Aantal:")
  localize; previously they fell back to English ("Qty:").
- `CartPaymethods`: new `paymethodLabels` prop — a code→localized-name map so
  the host can override un-localized backend method names (e.g. "On pickup"→
  "Bij afhalen"). Lookup: `paymethodLabels[code]` → `method.name` → `method.code`.

## [0.4.23] - 2026-07-17

### Fixed

- `SearchBar`: the autosuggest dropdown hardcoded `price.gross` (excl. VAT) and
  ignored the Incl./Excl. toggle, under-quoting every product, and showed no
  tax label. It now carries both net/gross, picks the leading price from
  `includeTax` (resolved from `<PropellerProvider>`), and renders an
  `incl./excl.` label — consistent with `ProductPrice`/PLP/PDP. New optional
  props: `includeTax`, `priceLabels` (keys `inclTax`/`exclTax`).
- `CartIconAndSidebar`: the header mini-cart rendered line items excl. VAT
  (`includeTax={false}`) while the total used `totalNet` (incl. VAT) and bonus
  items were pinned incl. — the lines never reconciled with the total and none
  followed the toggle. All three now share one `useTax` basis (from
  `includeTax`), so lines, total, and bonus items agree and respect the toggle.

### Changed

- `DeliveryDate`: weekday/month names in the quick-pick tiles now resolve via
  `labels` (keys `day_0`…`day_6`, `month_0`…`month_11`; English fallback) so
  they localize with the active locale instead of hardcoded English. New
  optional `language` prop (resolved from `<PropellerProvider>`) sets the
  native date-input's `lang`, localizing the browser calendar chrome
  (month name, weekday headers, Today/Clear).

## [0.4.22] - 2026-07-17

### Fixed

- `DeliveryDate`: when `skipWeekends` is on and the cart's `initialDate`
  (`postageData.requestDate`) is a weekend, it was adopted verbatim — landing
  the selected date in the "Other date" tile (rendered LAST, out of sequence)
  and replacing the "Other date…" entry point with that date's label. Now a
  weekend `initialDate` snaps to the first valid weekday tile, so the selection
  lands on the leading quick-pick and the "Other date…" tile is restored. A
  weekday `initialDate` is still adopted as-is.

## [0.4.21] - 2026-07-16

### Fixed

- `ActionCode`: the panel title now resolves through the `labels` map
  (`labels.title`) instead of only the `title` prop, so the "Action code"
  heading is translatable like every other label. Falls back to `props.title`,
  then `labels.title`, then `'Action code'`. Same fix as `CartSummary` in 0.4.20.

## [0.4.20] - 2026-07-16

### Fixed

- `CartSummary`: the panel title now resolves through the `labels` map
  (`labels.title`) instead of only the `title` prop, so the "Order summary"
  heading is translatable like every other label. Falls back to `props.title`,
  then `labels.title`, then `'Order summary'`.

## [0.4.19] - 2026-07-10

### Fixed

- `CartItem` / `AddToCart`: product, bundle, cluster-option, and crossupsell
  names now resolve for the active `language` (via `getLocalizedValue`) instead
  of always taking `names[0]`. Cart lines, the add-to-cart modal, and the
  "added to cart" toast previously showed the first localised name regardless of
  the cart/page language.

## [0.4.18] - 2026-07-10

### Added

- `ProductSpecifications`: new `beforeSpecs?` / `afterSpecs?` render-prop slots.
  Each receives `{ layout: 'table' | 'list' }` and returns arbitrary content
  injected at the start / end of the specifications — inside `<tbody>` for the
  table layout (return a `<tr>`, e.g. a labelled "Unit of measure" row) or in
  the list stack for the list layout (return a block). In grouped mode they
  render once, above the first group / below the last. General replacement for
  hardcoding extra rows; the existing `packageDescription` prop is unchanged.
- `ProductTabs`: `specificationsBeforeSpecs?` / `specificationsAfterSpecs?`
  passthrough props that forward to the specifications section's new slots.

## [0.4.17] - 2026-07-09

### Added

- `ProductCard` / `ProductGrid`: new `belowName?: (product: Product) => ReactNode`
  render prop. Renders arbitrary host-supplied content directly below the
  product name (and above the short description / price) in both the grid and
  row layouts, without forking the card — e.g. package descriptions or custom
  badges. On `ProductGrid` it cascades to every card via `ProductGridConfig`;
  on `ProductCard` it can also be set per-card (explicit prop wins over grid
  context). Also exposed as the `<ProductCard.BelowName>` compound subcomponent.

## [0.4.16] - 2026-07-09

### Added

- `ProductGrid`, `SearchBar`, `ProductInfo`: new `orderlistIds?: number[]` and
  `applyOrderlists?: boolean` props to scope the product/search fetch to
  specific orderlists (e.g. a chosen B2B contract). When `orderlistIds` is
  non-empty, orderlists are applied (unless `applyOrderlists` is `false`);
  otherwise `applyOrderlists: false` is sent so an authenticated user without a
  contract still sees the full catalogue. Threaded through `useProductSearch`
  and `useProductInfo` (explicit ids override the composable's default
  all-company-orderlists resolution).
- `Menu`: new `getUrl?: (category: Category) => string` prop — a custom URL
  builder that overrides `menuLinkFormat` / `configuration.urls.getCategoryUrl`,
  letting hosts inject dynamic query strings (e.g. `?contract=…`). Mirrors the
  existing `Breadcrumbs.getUrl`.
- `GridToolbar`: new `hidePriceSort?: boolean` prop to hide the price sort
  option entirely (closed B2B portals where prices are "by quotation").
- `ProductTabs` / `ProductSpecifications`: new
  `specificationsPackageDescription?` (ProductTabs) → `packageDescription?`
  (ProductSpecifications) passthrough, rendering an extra package-description
  string above the specifications table.

All additions are additive and backward-compatible.

## [0.4.15] - 2026-07-08

### Changed

- Bumped the `@propeller-commerce/propeller-sdk-v2` dev dependency to `^0.12.0`
  to build and test against the SDK's 0.12.0 release. The runtime peer stays
  `*` — consumers pin the SDK version. No API change.

## [0.4.14] - 2026-06-26

### Added

- **`useCheckout().placeOrder` now supports PSP (deferred-payment) orders.**
  - `orderStatus` accepts `'UNFINISHED'` (and any backend status string), not
    just `'NEW'` / `'REQUEST'` — for an order awaiting an external payment whose
    final status the PSP webhook sets later.
  - New `finalizeOrder?: boolean` option (default `true`). Pass `false` to defer
    the order-confirmation email, confirm event, PDF attachment, **and cart
    deletion** to payment time — so a shopper handed off to a PSP isn't emailed
    and their cart isn't cleared before they've paid.

  Both are backward compatible: existing callers (which omit `finalizeOrder`)
  behave exactly as before — a normal order and a quote still finalize at
  placement.

## [0.4.13] - 2026-06-25

### Added

- **Payment-method logos in `CartPaymethods`.** The component now renders each
  method's `logo` (SDK `CartPaymethod.logo`, available in
  `@propeller-commerce/propeller-sdk-v2` `^0.11.3`) as a square tile — logo on
  top, name below — matching the carrier tiles. Falls back to the method name
  when a method has no logo. New `showPaymethodLogo?: boolean` prop (default
  `true`) mirrors `CartCarriers`' `showCarrierLogo`.

### Changed

- **`CartPaymethods` and `CartCarriers` now lay out as a square logo grid**
  (`grid-cols-2 sm:3 lg:4`, `aspect-square` tiles, centered logo + name, price
  badge in the corner) instead of the previous single-column name rows. Same
  selection behaviour, BEM classes, and `data-selected` hooks.
- **Bumped `@propeller-commerce/propeller-sdk-v2` to `^0.11.3`** — adds the
  `logo` field to `CartPaymethod`.

## [0.4.12] - 2026-06-24

### Changed

- **Bumped the `@propeller-commerce/propeller-v2-core-ui` dependency from
  `^0.2.4` to `^0.3.1`.** core-ui 0.3.0 promoted the rich `CmsProvider`
  contract and the typed CMS block catalog from the Next boilerplate into the
  shared core; 0.3.1 added a docs-site link. Both releases are purely additive
  ("nothing removed or renamed"), so this is a no-runtime-change dependency
  refresh that brings the React package onto the current core. No component
  source changed.

## [0.4.11] - 2026-06-24

### Documentation

- Added a link to the canonical docs site
  (https://propeller-commerce.github.io/propeller-v2-react-ui/) at the top of
  the README, as the source of truth for props and usage.

## [0.4.10] - 2026-06-23

### Fixed

- **`GridFiltersPanel` rendered full-width on desktop, pushing the product
  grid off-screen.** The panel root carries `w-full lg:w-64 lg:flex-shrink-0`
  in the markup, but a consumer's Tailwind sheet re-emits `.w-full`
  (`width: 100%`) and — loading after this package's CSS — won the cascade on
  equal specificity, leaving the panel at full width and causing horizontal
  overflow on category/search pages. The desktop sidebar width is now restated
  on the `.propeller-grid-filters-panel` BEM hook inside the `@media
  (min-width: 64rem)` block (`width: 16rem; flex-shrink: 0`), so the package
  stays authoritative for its own width regardless of sheet order. Same
  cross-Tailwind cascade hardening already applied to the card row layouts in
  0.4.8 — the panel root was the one element it missed.

## [0.4.9] - 2026-06-19

### Added

- **`GridFiltersPanel`** — a responsive wrapper around `GridFilters`. At `lg`
  (1024px) and up it renders the filters as the inline sidebar; below `lg` it
  collapses them behind a "Filters" button that opens a left slide-in drawer
  (dimmed backdrop, close button, "Show results" to dismiss). A single
  `GridFilters` instance backs both layouts — no duplicate fetch or state.
  Replaces the host's `<aside><GridFilters/></aside>`. New label keys:
  `filtersButton`, `applyFilters`, `closeFilters`. Optional `activeFilterCount`
  shows a badge on the button.

## [0.4.8] - 2026-06-19

### Fixed

- **Product card list view broke on desktop after the 0.4.7 mobile
  redesign.** The mobile-first footer (`flex-col`, full-width `AddToCart`
  controls) leaked into the desktop row layout because the `md:` overrides
  lost the cross-Tailwind cascade. The desktop (≥768px) row intent is now
  restated on the BEM hook classes in `styles.css` — footer back to a row,
  `__footer-meta` to `display: contents`, and the `AddToCart` controls back to
  a single nowrap row with a fixed-width quantity input.
- **Price clipped in the mobile grid card.** The stock + price meta row could
  overflow a narrow (~190px) grid card. The row now wraps and the price is
  allowed to shrink (`min-w-0`, right-aligned) instead of being cut off.

### Changed

- **`ClusterCard` gets the same responsive footer as `ProductCard`.** Below
  768px the list view uses a 2-row footer (stock/price, then full-width "View
  cluster" button) and the grid view pairs stock/price in a wrapping meta row;
  desktop (≥768px) is unchanged.

## [0.4.7] - 2026-06-19

### Changed

- **Mobile product card layout (below 768px).** On narrow viewports the
  `ProductCard` action area no longer overflows the card edge — the quantity
  stepper and "Add to cart" button were clipped. Below `md` (768px):
  - **List view** (`columns === 1`): the footer becomes two rows — stock and
    price share the first row (`justify-between`), and the full-width
    `AddToCart` (stepper + button) sits on the second row.
  - **Grid view** (`columns > 1`): the footer becomes three rows — stock ↔
    price, then a full-width stepper, then a full-width button.

  At `md` and up the previous desktop layout is unchanged. This flows through
  every surface that renders `ProductCard` / `ProductGrid` (catalog, search,
  product slider). Implemented purely with responsive Tailwind classes — no
  JavaScript width detection.

### Added

- **Cart icon in the `AddToCart` button.** The submit button now renders a
  built-in cart glyph (`.propeller-add-to-cart__icon`) before its label, drawn
  with `currentColor` and `em` sizing so consumers can restyle its size,
  colour and stroke via CSS.

## [0.4.6] - 2026-06-09

### Fixed

- **`CartItem` cart actions silently no-op (quantity +/-, delete, notes).**
  The compound-API refactor in 0.3.0 (commit 564f8d0) switched `CartItem`
  from `useInfraProps(rawProps)` to
  `useResolvedProps(rawProps, CART_ITEM_RESOLVE_SPEC)`, but the new spec
  only listed the slot-injection keys (`priceComponent`, `stockComponent`,
  `surchargesComponent`) — the Tier 1 infra keys (`graphqlClient`, `user`,
  `language`, `currency`, `configuration`, `companyId`, `includeTax`)
  weren't declared, so they never got filled in from `<PropellerProvider>`.
  The internal `useCart()` call received `graphqlClient: undefined`, every
  service mutation threw inside the SDK, and the consumer saw no spinner,
  no toast, no change — just buttons that did nothing.
  Added the missing infra entries to `CART_ITEM_RESOLVE_SPEC` so resolution
  matches the precedence the rest of the surface uses
  (`ClusterCard.RESOLVE_SPEC`, `ProductCard.RESOLVE_SPEC`).

## [0.4.5] - 2026-06-04

### Fixed

- **List-view / cart row collapse against a consumer's Tailwind cascade.**
  `ProductCard` (row layout), `ClusterCard` (row layout), and `CartItem`
  use responsive override pairs in the markup — `w-full md:w-auto`,
  `border-t md:border-t-0`, `py-2 md:py-0`, `flex-wrap md:flex-nowrap`.
  When a consumer also runs Tailwind v4, its generated stylesheet re-emits
  the base utilities (`.w-full`, `.border-t`, …) but not the `md:` variants
  that only appear inside this package's components. On equal specificity
  the consumer sheet wins, the card footer goes full-width, and the body's
  `flex-1 min-w-0` collapses to zero — title and SKU render at 0px width
  while the placeholder image still occupies space (the symptom looks like
  "missing product name" but the element is actually there).
  Restated the desktop (≥768px) intent on the BEM hook classes scoped under
  the card root in `styles.css` so the selector is specificity (0,2,0) —
  it beats any single-class utility (0,1,0) regardless of sheet order.
  This mirrors the `propeller-v2-vue-ui` fix from May (commit ce7a899).

## [0.4.4] - 2026-06-04

### Changed

- **SDK dependency switched from GitHub tarball to npm.** Both the
  `peerDependencies` entry and the `devDependencies` test pin now point
  at `@propeller-commerce/propeller-sdk-v2@^0.11.1` instead of
  `github:propeller-commerce/propeller-sdk-v2#master`. All 113 source +
  test files renamed accordingly (`from 'propeller-sdk-v2'` →
  `from '@propeller-commerce/propeller-sdk-v2'`).

### Dependencies

- Bumps `propeller-v2-core-ui` to 0.2.4 (its own SDK switch to npm).

### Why

The SDK is now published on npm as a properly scoped package. Pinning
via npm removes the GitLab→GitHub mirror dependency from the install
chain and gives consumers semver ranges instead of a moving master tip.
Behaviour is unchanged.

## [0.4.3] - 2026-06-04

### Fixed

- **`CartItem` now resolves product / bundle / crossupsell names via
  `getLanguageString`** (from `propeller-v2-core-ui@0.2.3`), matching
  the active language and walking the localised entries for the first
  non-empty value before falling back to `'Product'`. Previously each
  helper hard-coded `names?.[0]?.value || 'Product'`, which always
  picked the first SDK entry regardless of language and rendered blank
  when that first entry's `value` was empty. Cart pages now show the
  correct localised name and never collapse to invisible rows on
  datasets with sparse localisation.

### Dependencies

- Bumps `propeller-v2-core-ui` to 0.2.3 (the resolver fix that powers
  the above).

## [0.4.0] - 2026-06-02

Finishes the prop-cascade cleanup started in 0.3.0. Every component on
the main entry now resolves Tier 1 + Tier 2 infra from
`<PropellerProvider>` when not passed explicitly — consumer islands can
drop redundant `graphqlClient` / `user` / `companyId` / `language` /
`includeTax` / `currency` / `configuration` / `portalMode` passes on
every component (not just the 31 retrofitted in 0.3.0).

### Changed

- **6 client components retrofitted** to call `useInfraProps(rawProps)`:
  `CategoryDescription`, `ProductDescription`, `GridFilters`,
  `GridToolbar`, `AddressSelector`, `CartPaymethods`. Same mechanical
  pattern as the 31 already retrofitted in 0.3.0.

### Added

- **Provider-aware client wrappers for the 6 `@rsc-safe` components**:
  `Breadcrumbs`, `GridTitle`, `ProductPrice`, `ProductBulkPrices`,
  `ProductShortDescription`, `CategoryShortDescription`. The pure RSC-safe
  components still exist and are still exported from `/pure` for Server
  Component use. The **main `/` entry now exports the wrapper** under the
  original name (`Breadcrumbs`, etc.), so client islands automatically
  pick up provider-aware versions with no consumer-side import change.
  Server pages that need the pure component should import from
  `propeller-v2-react-ui/pure` (this was already the canonical pattern).

### Migration

Additive. Existing call sites that pass explicit infra props keep
working unchanged. Client islands can now drop those passes. Server
pages importing from `/pure` are unaffected.

### Verification

- `tsc --noEmit` clean.
- 21 / 21 vitest pass.
- `tsup` build emits both client (with `"use client"` banner) and `/pure`
  (without banner) shapes correctly; dts unchanged for the pure entry.

## [0.3.0] - 2026-06-02

Loosens 5 components' required infra props to optional, plus retrofits
`UserDetails` to consume `useInfraProps()` like the other 30 retrofitted
components. Consumers can now drop redundant `:user=` / `:language=`
passes on these components when `<PropellerProvider>` wraps the subtree.

### Changed

- **`UserDetails`** — `user: Contact | Customer` → `user?: Contact |
Customer | null`. Component now calls `useInfraProps(rawProps)` to
  resolve `user` from the provider when omitted. Existing call sites
  that pass `user` keep working unchanged.
- **`AddressSelector`** — `user: Contact | Customer | null` →
  `user?: Contact | Customer | null`.
- **`CartPaymethods`** — `user: Contact | Customer | null` →
  `user?: Contact | Customer | null`.
- **`GridTitle`** — `language: string` → `language?: string`.
- **`CategoryDescription`** — `language: string` → `language?: string`.

### Migration

Same shape as `propeller-v2-vue-ui@0.3.0`. Additive. Existing call sites
keep working. A follow-up cleanup in `propeller-next` will prune ~85
redundant prop-lines from the consumer islands.

### Verification

- `tsc --noEmit` clean.
- 21 / 21 vitest tests pass unchanged.
- `tsup` build emits identical dts shape.

## 0.2.3

### Fixed

- `AccountIconAndMenu` no longer forwards its own `labels` (which contains menu-UI slugs like `accountLabel`, `logoutLabel`) to the embedded `<LoginForm>` — that previously caused LoginForm's `email`, `password`, `forgotPassword` strings to fail translation. Use the new `loginFormLabels?` prop instead.

### Added

- `AccountIconAndMenu`: new `loginFormLabels?: Record<string, string>` prop, forwarded to the embedded `<LoginForm>`. Lets consumers pass the LoginForm namespace's translations through to the dropdown sign-in form.

## 0.2.2

### Added

- `ProductCard` / `ProductGrid` / `ProductSlider`: new `priceLabels?: Record<string, string>` prop, forwarded through to the embedded `<ProductPrice>` display inside each card. Lets consumers translate `inclTax` / `exclTax` / `loginToSeePrices` strings on grid/slider pages without per-card wiring. `ClusterCard` is intentionally unchanged — it builds its own price span and doesn't render `<ProductPrice>`.

## 0.2.1

### Added

- `ProductGrid` / `ProductSlider`: new props `productCardLabels?`, `clusterCardLabels?` for forwarding translations to embedded `<ProductCard>` / `<ClusterCard>`. Mirrors the existing `stockLabels?` / `addToCartLabels?` pattern.
- `PriceToggle`: new `labels?: Record<string, string>` prop with slugs `pricesLabel`, `inclVat`, `exclVat`. Previously these strings were hardcoded.
- `OrderList`: filter column field labels and sort-field dropdown options now route through the `labels` prop. Column labels use slug `col<Capitalized>` (e.g. `colTerm`, `colCreatedAt`); sort-field options use the enum value as the slug (e.g. `createdAt`, `price`); sort-order options (ASC/DESC) and order type options also route through `labels`. All fallbacks preserve existing English behavior, so the change is non-breaking for consumers that don't supply the new keys.

### Fixed

- `ProductSlider` no longer forwards its own `labels` (which contains slider-UI slugs such as `scrollLeft`, `noProducts`) to embedded `ClusterCard` — that previously caused card-level strings to fail translation. Use the new `clusterCardLabels?` prop instead.

## [0.2.0] - 2026-06-01

Adds shop-mode-aware user gating. Existing public API is unchanged; new
fields are optional and default to backward-compatible behaviour.

### Added

- **`shopMode?: ShopMode`** on `PropellerScope`. Declares whether the shop
  is `'b2b'`, `'b2c'`, or `'hybrid'`. Defaults to `'hybrid'` when omitted
  so existing call sites keep their current branching semantics (any
  logged-in Contact treated as B2B).
- **Derived `userMode: UserMode`** on `PropellerInfra`. Computed via
  `deriveUserMode(user, shopMode)` from `propeller-v2-core-ui`. Values:
  `'anonymous' | 'b2b' | 'b2c'`. B2B-gated UI (company switcher, B2B
  side-nav items, quote/authorization affordances) should read this
  instead of re-deriving from `isContact(user)` ad hoc.
- **`useUserMode()` hook**. Direct read of `userMode` for components that
  only need that one signal.

### Why this matters

Hybrid shops need a single, consistent gate that says "is the current
viewer behaving as B2B or B2C?" Previously every B2B-gated component
re-derived this from `isContact(user)` ad hoc, which was correct but
duplicated and ignored the shop's `mode` (a B2C shop that somehow had a
Contact session would still light up the B2B surface). Centralising the
derivation eliminates the duplication and makes the shop mode authoritative.

### Requires

- `propeller-v2-core-ui` ≥ 0.2.0 (for `deriveUserMode`, `ShopMode`,
  `UserMode`).

---

## [0.1.0] — Unreleased

First version of the package. Extracted from the `propeller-next`
boilerplate so the Propeller Commerce React surface can be consumed as a
standalone library. Not yet published to a registry — consumed via a
`file:` link during stabilization.

### Added

- **Initial extraction (Phase E).** 60 components, the React composables
  (hooks), the runtime-agnostic `composables/shared/` layer (utilities and
  domain types), and the two contexts (`PropellerContext`,
  `ProductGridContext`) moved into this package from `propeller-next`.
- **Build pipeline.** `tsup` produces dual ESM + CJS bundles with `.d.ts`
  declarations. The client bundle (`index`) gets a `"use client";` banner
  prepended in a post-build hook; the `shared` and `pure` bundles are
  runtime-agnostic with no banner.
- **Three code entry points.** `propeller-v2-react-ui` (components, hooks,
  contexts, `createServices`, `toPlain`), `propeller-v2-react-ui/pure` (the
  12 pure/presentational components, RSC-safe — see below), and
  `propeller-v2-react-ui/shared` (pure TS — `createServices`, `toPlain`,
  formatters, helpers, all domain types — safe to import from Server
  Components).
- **`/pure` RSC-safe component entry.** A third `tsup` entry exporting the
  12 pure/presentational components (`Breadcrumbs`, `ProductPrice`,
  `ItemStock`, `OrderTotals`, `ProductBulkPrices`, `ProductShortDescription`,
  `ProductDownloads`, `ProductVideos`, `OrderItemCard`, `OrderSummary`,
  `GridTitle`, `CategoryShortDescription`). The `pure` bundle is built
  **without** the `"use client"` banner, so a React Server Component can
  import and render these components directly — server-rendering real
  product/price/order markup — without drawing a client boundary or
  shipping the client bundle. Each is verified to use no hooks, state,
  effects, handlers, browser APIs or context reads. The same components
  remain available from the main entry for use inside client boundaries.
- **Precompiled stylesheet** (`dist/styles.css`). The package's Tailwind v4
  classes are compiled to vanilla CSS at build time and shipped. Consumers
  import it once and do **not** need Tailwind in their own project.
- **Three styling override surfaces** — theme tokens (CSS variables), BEM
  hooks (`.propeller-product-card__price`, …), and per-instance `className`.
  Documented in [STYLING.md](./STYLING.md).
- **`PropellerProvider`** — the single integration point. Takes one value
  object (`PropellerInfra`) carrying `graphqlClient`, `services`, `user`,
  `companyId`, `language`, `includeTax`, `currency`, `portalMode`,
  `configuration`. Imports zero host contexts.
- **`createServices(client)`** — factory that builds the typed `Services`
  bundle (`product`, `cart`, `user`, `order`, …) keyed to a consumer-built
  `GraphQLClient`. Memoized per client via `WeakMap`.
- **`toPlain(value)`** — recursively strips the SDK's underscore-prefixed
  backing fields from class instances.
- **`useServices()`** — reads the `Services` bundle from `PropellerProvider`;
  throws a clear error when used outside a provider.
- Public-grade documentation: [README.md](./README.md), [STYLING.md](./STYLING.md),
  [TECH.md](./TECH.md), [CONTRIBUTING.md](./CONTRIBUTING.md),
  [MIGRATION.md](./MIGRATION.md), [SECURITY.md](./SECURITY.md), and an MIT
  `LICENSE`.
- **Unit tests.** Vitest suite covering the pure-logic surface — `src/lib/`
  (`createServices`, `toPlain`) and the 11 framework-free shared utilities
  (formatters, truncation, inventory/label/visibility helpers, attribute
  extraction, country lookup, language resolution, product helpers, user
  identity, video URL transforms). 183 tests, ~99% statement / 100%
  function coverage of that surface. Scripts: `test`, `test:watch`,
  `test:coverage`.
- **CI pipeline** (`.gitlab-ci.yml`). A `verify` stage (typecheck, unit
  tests + coverage, build) and a `downstream` stage that builds the
  package, installs it into a fresh checkout of propeller-next, and runs
  that repo's full Playwright e2e suite — the package's component
  regression gate. Components are intentionally not unit-tested against a
  mock SDK; the consumer's real e2e suite is the verification layer.
  Required GitLab CI/CD variables are documented in
  [CONTRIBUTING.md](./CONTRIBUTING.md).
- **Storybook** (`.storybook/`). A story per component (60 total),
  rendering each in isolation against fixture data and a mock
  `PropellerProvider`. The "Docs" tab auto-generates each component's
  full `*Props` table from the TypeScript source via
  `react-docgen-typescript`. Mock foundation in `src/__mocks__/`
  (`fixtures.ts`, `mockServices.ts`, `decorators.tsx`). Scripts:
  `storybook`, `build-storybook`.
- **Documentation site** (`docs/`). A self-contained Docusaurus 3 app —
  its own `package.json` / lockfile, not published to npm, not part of
  the package build. Eight guide pages (introduction, getting started,
  the SDK seam, styling, server components, component reference,
  Storybook, contributing) sourced from the package's own markdown.
  The component prop reference is intentionally not duplicated here —
  the site links out to Storybook's auto-generated prop tables.

- **`Menu`: optional pre-fetched `tree` prop.** When the host supplies
  `tree: MenuCategory[]`, `Menu` skips its internal `useMenu` fetch
  entirely and renders the tree directly — mirroring the
  `ProductGrid.products` opt-in. Lets host apps fetch the category tree
  server-side (e.g. in a Next.js layout) and have the menu HTML land in
  the initial response. Omitting the prop preserves the legacy
  client-side fetch behaviour — no breaking change.

### Changed

- **Decoupled the SDK seam from Next.js (breaking, pre-publish).** The
  package no longer ships a module-level `graphqlClient` singleton, a
  hardcoded `/api/graphql` endpoint, or `NEXT_PUBLIC_*` environment reads.
  The consumer now constructs its own `GraphQLClient`, calls
  `createServices(client)`, and passes both into `PropellerProvider`.
  `getServices` (singleton-defaulting accessor) was replaced by
  `createServices` (pure factory). See [MIGRATION.md](./MIGRATION.md).
- **Removed the `/server` entry.** The previous
  `propeller-v2-react-ui/server` subpath (`createServerClient`,
  `getServerInfra`, `fetchProduct`, `fetchCategory`) was deleted —
  server-side GraphQL wiring (endpoint, API keys, cookie names, auth) is
  application-specific. Consumers host their own server module; the package
  exports `createServices` from `/shared` for server-side use.
- **Dropped the `next` peer dependency.** The package has zero `next/*`
  imports. Next.js apps still work out of the box.
- `PropellerInfra` gained a required `services: Services` field.

### Fixed

- **`OrderActions` button layout.** Buttons no longer wrap mid-word when
  `OrderActions` shares a flex row with `OrderTotals` — added
  `flex-shrink-0` to the wrapper and `whitespace-nowrap` to the buttons.
- **`CartItem` alignment.** The product image and footer are top-aligned
  with the title row instead of vertically centering against tall content
  (cross-sells) — root changed from `items-center` to `items-start`.
- **`ProductCard` row layout.** Responsive utilities (`md:flex-nowrap`,
  etc.) buried inside template-literal ternaries were missing from the
  compiled stylesheet; force-included via `@source inline(...)` so list
  view stays single-row at desktop widths.
- **`GridFilters` — active filters now visible on first render.** A filter
  group with a selected value starts expanded even when `collapsed` is
  `true`, and its checkboxes render checked, on the very first render
  (including SSR — previously this depended on a client-only effect that
  never ran server-side). Restoring a filtered URL no longer hides the
  ticked checkboxes. A group the user explicitly toggles still wins, and a
  user collapsing a group with an active filter is not fought.

[0.1.0]: https://github.com/propeller-commerce/propeller-v2-react-ui/releases/tag/v0.1.0
