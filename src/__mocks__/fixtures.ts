/**
 * Fixture data for Storybook stories (and any future component tests).
 *
 * The Propeller SDK domain types (`Product`, `Cart`, `Order`, …) are large,
 * with many required fields most components never read. Hand-constructing a
 * fully-typed instance for every story would be enormous and brittle.
 *
 * These builders instead construct the *realistic core* — the fields the
 * components actually render — and cast to the SDK type at the boundary.
 * The `as` is honest: it says "this object stands in for a Product for the
 * purpose of rendering a component," not "this is a complete Product."
 * Stories render against these; they never reach a real backend.
 *
 * Every builder takes an optional overrides object so a story can tweak one
 * field (out of stock, on discount, no image, …) without rebuilding the
 * whole fixture.
 */
import type {
  Product,
  Cluster,
  Cart,
  CartMainItem,
  Order,
  OrderItem,
  Category,
  Contact,
  Customer,
  ProductPrice,
  LocalizedString,
} from '@propeller-commerce/propeller-sdk-v2';

// ── Primitives ──────────────────────────────────────────────────────────────

/**
 * Override bag for the builders. The SDK domain types are large and the
 * builders carry a few non-SDK convenience fields (a string `id`, a flat
 * `total`) that components read via permissive access. A loose record lets a
 * story tweak one field without re-stating the full SDK shape; the single
 * `as unknown as T` at each builder's return is the honest type boundary.
 */
type Loose = Record<string, unknown>;

/** Build a LocalizedString list — defaults to an EN + NL pair. */
export function localized(value: string, language = 'EN'): LocalizedString[] {
  return [{ language, value } as LocalizedString];
}

// A stable placeholder image (data-URI SVG — no network, always renders).
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">` +
      `<rect width="400" height="400" fill="#e5e7eb"/>` +
      `<text x="200" y="210" font-family="sans-serif" font-size="22" ` +
      `fill="#6b7280" text-anchor="middle">Product image</text></svg>`
  );

// ── ProductPrice ────────────────────────────────────────────────────────────

export function makeProductPrice(overrides: Loose = {}): ProductPrice {
  return {
    productId: 1001,
    type: 'DEFAULT' as ProductPrice['type'],
    discountType: 'NET_PRICE' as ProductPrice['discountType'],
    list: 49.95,
    cost: 20,
    // SDK convention: gross = excl. VAT, net = incl. VAT.
    gross: 49.95,
    net: 60.44,
    quantity: 1,
    ...overrides,
  } as ProductPrice;
}

/** A price carrying a discount — `list` is the was-price, `gross` the now-price. */
export function makeDiscountedPrice(overrides: Loose = {}): ProductPrice {
  return makeProductPrice({
    // PriceDiscountType has no "percentage" member; LIST_PRICE_MIN is the
    // discount-off-list kind a was/now price represents.
    discountType: 'LIST_PRICE_MIN' as ProductPrice['discountType'],
    list: 49.95,
    gross: 39.95,
    net: 48.34,
    ...overrides,
  });
}

// ── Product ─────────────────────────────────────────────────────────────────

export function makeProduct(overrides: Loose = {}): Product {
  const base = {
    id: 1001,
    productId: 1001,
    categoryId: 17,
    sku: 'DRL-1001',
    manufacturerCode: 'BD-DRL-18V',
    eanCode: '8712345678901',
    manufacturer: 'BlackDecker',
    supplier: 'ToolSupplier BV',
    supplierCode: 'TS-9981',
    class: 'product',
    hidden: 'N',
    status: 'ACTIVE',
    defaultLanguage: 'EN',
    names: localized('Cordless Drill 18V'),
    shortNames: localized('Cordless Drill'),
    descriptions: localized(
      '<p>A powerful 18V cordless drill with two-speed gearbox, ' +
        'LED work light and a 13mm keyless chuck.</p>'
    ),
    shortDescriptions: localized('Powerful 18V cordless drill, two-speed gearbox.'),
    slugs: localized('cordless-drill-18v'),
    categoryPath: [] as Category[],
    price: makeProductPrice(),
    media: {
      images: {
        page: 1,
        offset: 10,
        count: 1,
        items: [
          {
            // Components read media.images.items[].imageVariants[].url.
            imageVariants: [{ url: PLACEHOLDER_IMAGE, name: 'large' }],
          },
        ],
      },
    },
    inventory: {
      productId: 1001,
      totalQuantity: 42,
      supplierQuantity: 100,
      localQuantity: 42,
    },
  };
  return { ...base, ...overrides } as unknown as Product;
}

/** A product with no stock — for ItemStock / AddToCart "out of stock" stories. */
export function makeOutOfStockProduct(overrides: Loose = {}): Product {
  return makeProduct({
    inventory: {
      productId: 1001,
      totalQuantity: 0,
      supplierQuantity: 0,
      localQuantity: 0,
    },
    ...overrides,
  });
}

// ── Cluster ─────────────────────────────────────────────────────────────────

export function makeCluster(overrides: Loose = {}): Cluster {
  const base = {
    id: 2001,
    clusterId: 2001,
    sku: 'CLU-2001',
    names: localized('Drill & Driver Set'),
    shortDescriptions: localized('Cordless drill plus impact driver, one battery platform.'),
    slugs: localized('drill-driver-set'),
    defaultProduct: makeProduct(),
    options: [],
  };
  return { ...base, ...overrides } as unknown as Cluster;
}

// ── Cart ────────────────────────────────────────────────────────────────────

export function makeCartItem(overrides: Loose = {}): CartMainItem {
  return {
    id: 'item-1',
    itemId: 'item-1',
    cartItemId: 'item-1',
    productId: 1001,
    quantity: 2,
    name: 'Cordless Drill 18V',
    sku: 'DRL-1001',
    price: { gross: 49.95, net: 60.44 },
    total: { totalGross: 99.9, totalNet: 120.88 },
    media: {
      images: { items: [{ imageVariants: [{ url: PLACEHOLDER_IMAGE }] }] },
    },
    ...overrides,
  } as unknown as CartMainItem;
}

export function makeCart(overrides: Loose = {}): Cart {
  const base = {
    id: 'cart-9001',
    cartId: 'cart-9001',
    status: 'OPEN',
    language: 'EN',
    items: [
      makeCartItem(),
      makeCartItem({ id: 'item-2', itemId: 'item-2', cartItemId: 'item-2', quantity: 1 }),
    ],
    total: {
      totalGross: 149.85,
      totalNet: 181.32,
    },
    payMethods: [
      { code: 'ideal', name: 'iDEAL', price: 0, logo: 'https://www.ideal.nl/img/logo/ideal-logo.svg' },
      { code: 'paypal', name: 'PayPal', price: 0, logo: 'https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg' },
      { code: 'creditcard', name: 'Credit card', price: 1.5, logo: '' },
      { code: 'on_account', name: 'On account', price: 0, logo: '' },
    ],
    carriers: [
      { id: 1, name: 'DHL', price: 4.95, logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ac/DHL_Logo.svg', deliveryDeadline: '' },
      { id: 2, name: 'PostNL', price: 5.95, logo: '', deliveryDeadline: '' },
    ],
  };
  return { ...base, ...overrides } as unknown as Cart;
}

// ── Order ───────────────────────────────────────────────────────────────────

export function makeOrderItem(overrides: Loose = {}): OrderItem {
  return {
    id: 'oi-1',
    orderItemId: 'oi-1',
    productId: 1001,
    quantity: 2,
    name: 'Cordless Drill 18V',
    sku: 'DRL-1001',
    class: 'product',
    isBonus: 'N',
    price: { gross: 49.95, net: 60.44 },
    total: { totalGross: 99.9, totalNet: 120.88 },
    ...overrides,
  } as unknown as OrderItem;
}

export function makeOrder(overrides: Loose = {}): Order {
  const base = {
    id: 'order-5001',
    orderId: 'order-5001',
    orderNumber: 'ORD-2026-5001',
    status: 'COMPLETE',
    orderDate: '2026-05-14T10:30:00Z',
    language: 'EN',
    items: [makeOrderItem(), makeOrderItem({ id: 'oi-2', orderItemId: 'oi-2', quantity: 1 })] as OrderItem[],
    total: {
      totalGross: 149.85,
      totalNet: 181.32,
      totalItems: 3,
    },
  };
  return { ...base, ...overrides } as unknown as Order;
}

// ── Category ────────────────────────────────────────────────────────────────

export function makeCategory(overrides: Loose = {}): Category {
  // Category uses singular localized fields — name / description /
  // shortDescription / slug (components read cat.name etc.).
  const base = {
    id: 17,
    categoryId: 17,
    name: localized('Power Tools'),
    shortDescription: localized('Drills, drivers, saws and more.'),
    description: localized(
      '<p>Everything for the workshop — corded and cordless power tools ' +
        'from the brands professionals trust.</p>'
    ),
    slug: localized('power-tools'),
    categoryPath: [] as Category[],
  };
  return { ...base, ...overrides } as unknown as Category;
}

/** A category path (breadcrumb trail) — Home > Tools > Power Tools. */
export function makeCategoryPath(): Category[] {
  return [
    makeCategory({ categoryId: 1, name: localized('Tools'), slug: localized('tools') }),
    makeCategory({ categoryId: 17, name: localized('Power Tools'), slug: localized('power-tools') }),
  ];
}

// ── Users ───────────────────────────────────────────────────────────────────

export function makeContact(overrides: Loose = {}): Contact {
  const base = {
    id: 7001,
    contactId: 7001,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    primaryLanguage: 'EN',
    company: {
      id: 3001,
      companyId: 3001,
      name: 'Analytical Engines Ltd',
      addresses: [],
    },
  };
  return { ...base, ...overrides } as unknown as Contact;
}

export function makeCustomer(overrides: Loose = {}): Customer {
  const base = {
    id: 8001,
    customerId: 8001,
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    primaryLanguage: 'EN',
    addresses: [],
  };
  return { ...base, ...overrides } as unknown as Customer;
}

// ── Inventory / media (smaller leaf shapes some components take directly) ────

/** A ProductInventory — `totalQuantity` drives stock-status display. */
export function makeInventory(totalQuantity = 42): import('@propeller-commerce/propeller-sdk-v2').ProductInventory {
  return {
    productId: 1001,
    totalQuantity,
    supplierQuantity: 100,
    localQuantity: totalQuantity,
  } as import('@propeller-commerce/propeller-sdk-v2').ProductInventory;
}

/** A document-media response — for ProductDownloads. */
export function makeDocuments(
  overrides: Loose = {}
): import('@propeller-commerce/propeller-sdk-v2').PaginatedMediaDocumentResponse {
  return {
    page: 1,
    pages: 1,
    offset: 10,
    itemsFound: 2,
    start: 1,
    end: 2,
    items: [
      {
        names: localized('Datasheet (PDF)'),
        uri: 'https://example.com/datasheet.pdf',
        type: 'pdf',
      },
      {
        names: localized('User manual (PDF)'),
        uri: 'https://example.com/manual.pdf',
        type: 'pdf',
      },
    ],
    ...overrides,
  } as unknown as import('@propeller-commerce/propeller-sdk-v2').PaginatedMediaDocumentResponse;
}

/** A video-media response — for ProductVideos. */
export function makeVideos(
  overrides: Loose = {}
): import('@propeller-commerce/propeller-sdk-v2').PaginatedMediaVideoResponse {
  return {
    page: 1,
    pages: 1,
    offset: 10,
    itemsFound: 1,
    start: 1,
    end: 1,
    items: [
      {
        names: localized('Product overview'),
        uri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
    ],
    ...overrides,
  } as unknown as import('@propeller-commerce/propeller-sdk-v2').PaginatedMediaVideoResponse;
}

// ── Cluster options ─────────────────────────────────────────────────────────

/** A cluster-option list — for ClusterOptions / ClusterConfigurator. */
export function makeClusterOptions(): import('@propeller-commerce/propeller-sdk-v2').ClusterOption[] {
  return [
    {
      id: 'opt-color',
      name: 'Colour',
      names: localized('Colour'),
      required: true,
      values: [
        { id: 'v1', value: 'Black' },
        { id: 'v2', value: 'Blue' },
      ],
    },
    {
      id: 'opt-size',
      name: 'Battery',
      names: localized('Battery'),
      required: false,
      values: [
        { id: 'v3', value: '2.0Ah' },
        { id: 'v4', value: '4.0Ah' },
      ],
    },
  ] as unknown as import('@propeller-commerce/propeller-sdk-v2').ClusterOption[];
}

// ── Address ─────────────────────────────────────────────────────────────────

/** An Address — defaults to a default delivery address. */
export function makeAddress(
  overrides: Loose = {}
): import('@propeller-commerce/propeller-sdk-v2').Address {
  return {
    id: 4001,
    type: 'delivery',
    isDefault: 'Y',
    firstName: 'Ada',
    lastName: 'Lovelace',
    company: 'Analytical Engines Ltd',
    street: 'Baker Street',
    number: '221',
    postalCode: '1011 AB',
    city: 'Amsterdam',
    country: 'NL',
    email: 'ada@example.com',
    phone: '+31 20 123 4567',
    ...overrides,
  } as unknown as import('@propeller-commerce/propeller-sdk-v2').Address;
}

// ── Grid: filters & product-response ────────────────────────────────────────

/** An attribute-filter list — for GridFilters (a colour facet + a brand facet). */
export function makeFilters(): import('@propeller-commerce/propeller-sdk-v2').AttributeFilter[] {
  return [
    {
      id: 'color',
      type: 'TEXT',
      attributeDescription: { name: 'Colour', descriptions: localized('Colour') },
      textFilters: [
        { value: 'Black', count: 12 },
        { value: 'Blue', count: 7 },
        { value: 'Red', count: 3 },
      ],
    },
    {
      id: 'brand',
      type: 'TEXT',
      attributeDescription: { name: 'Brand', descriptions: localized('Brand') },
      textFilters: [
        { value: 'BlackDecker', count: 9 },
        { value: 'Makita', count: 6 },
      ],
    },
  ] as unknown as import('@propeller-commerce/propeller-sdk-v2').AttributeFilter[];
}

/** A ProductsResponse page — for GridPagination / ProductGrid. */
export function makeProductsResponse(
  overrides: Loose = {}
): import('@propeller-commerce/propeller-sdk-v2').ProductsResponse {
  // ProductsResponse pagination fields: itemsFound / offset / page / pages /
  // start / end (no `count`). Components read `pages` and `page`.
  return {
    page: 1,
    pages: 5,
    offset: 12,
    itemsFound: 60,
    start: 1,
    end: 12,
    minPrice: 0,
    maxPrice: 0,
    items: [
      makeProduct({ productId: 1001 }),
      makeProduct({ productId: 1002, names: localized('Impact Driver 18V') }),
      makeProduct({ productId: 1003, names: localized('Circular Saw 18V') }),
    ],
    ...overrides,
  } as unknown as import('@propeller-commerce/propeller-sdk-v2').ProductsResponse;
}
