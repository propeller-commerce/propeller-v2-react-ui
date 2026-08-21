'use client';

import { createContext, useContext, ReactNode, ComponentType } from 'react';
import { Cart, CartMainItem, Product, Cluster } from '@propeller-commerce/propeller-sdk-v2';
import type {
  PriceComponentProps,
  StockComponentProps,
  AddToCartComponentProps,
  ImageComponentProps,
  BadgesComponentProps,
  FavoriteComponentProps,
  ProductBundlesComponentProps,
  ProductBulkPricesComponentProps,
  ProductSurchargesComponentProps,
} from '@propeller-commerce/propeller-v2-core-ui';

/**
 * Tier 2 grid config context. Collapses the feature-flag/display and callback
 * props that ProductGrid otherwise cascades through ProductCard/ClusterCard
 * down to AddToCart/ItemStock. ProductGrid is the provider; the card subtree
 * consumes via useProductGridConfig() instead of receiving ~20 threaded props.
 *
 * Prop-name aliases are resolved here to a single canonical name:
 *   - ProductGrid `stockValidation`  -> `enableStockValidation`
 *   (ProductGrid `addToCartLabels` stays as-is; ProductCard already maps it to
 *    AddToCart's `labels` prop at its existing render site.)
 */
export interface ProductGridConfig {
  // Feature / display
  /** Number of columns the grid renders cards in. */
  columns: number;
  /** When `true`, cards display the product price. */
  showPrice?: boolean;
  /** When `true`, cards display the stock level / status. */
  showStock?: boolean;
  /** When `true`, cards display the availability indicator. */
  showAvailability?: boolean;
  /** When `true`, cards show the add-to-favorites control. */
  enableAddFavorite?: boolean;
  /** When `true`, cards render the add-to-cart control. */
  allowAddToCart?: boolean;
  /** When `true`, adding an item creates a cart if none exists yet. */
  createCart?: boolean;
  /** When `true`, the add-to-cart flow opens a confirmation modal. */
  showModal?: boolean;
  /** When `true`, cards show quantity increment/decrement steppers. */
  allowIncrDecr?: boolean;
  /** When `true`, add-to-cart validates the requested quantity against stock. Aliased from ProductGrid's `stockValidation` prop. */
  enableStockValidation?: boolean;
  /** Target cart ID that add-to-cart actions operate on. */
  cartId?: string;
  /** Child product IDs to add alongside the main product (bundle/cluster children). */
  childItems?: number[];
  /** Free-text note attached to items added to the cart. */
  notes?: string;
  /** Explicit unit price override passed to add-to-cart. */
  price?: number;
  /** Localised label overrides for stock-status text rendered on cards. */
  stockLabels?: Record<string, string>;
  /** Localised label overrides forwarded to each card's `AddToCart` component. */
  addToCartLabels?: Record<string, string>;
  /** Localised label overrides forwarded to the embedded `<ProductPrice>` display inside each card. */
  priceLabels?: Record<string, string>;

  // Callbacks
  /** Called when a new cart is created during an add-to-cart action. */
  onCartCreated?: (cart: Cart) => void;
  /** Called after an item is successfully added to the cart. */
  afterAddToCart?: (cart: Cart, item?: CartMainItem) => void;
  /** Called when the user chooses to proceed to checkout. */
  onProceedToCheckout?: () => void;
  /**
   * Called when an anonymous visitor clicks the log-in action that replaces
   * add-to-cart in a semi-closed portal. The host owns navigation.
   */
  onLoginClick?: () => void;
  /** Called when the user clicks the request-a-quote action. */
  onRequestQuoteClick?: (cart: Cart) => void;
  /** Called when a product/cluster favorite is toggled; `isFavorite` is the new state. */
  onToggleFavorite?: (item: Product | Cluster, isFavorite: boolean) => void;
  /** Called when a product card is clicked. */
  onProductClick?: (product: Product) => void;
  /** Called when a cluster card is clicked. */
  onClusterClick?: (cluster: Cluster) => void;

  // ───── Component-slot injection (extension API) ─────
  // When set on the resolver context, cards/grids/sliders inside render the
  // injected component in place of the default. Explicit per-card
  // props still override; precedence is explicit > grid context > infra > default.
  /** Replaces the default price block in cards / PDP / cart row / order row. */
  priceComponent?: ComponentType<PriceComponentProps>;
  /** Replaces the default stock / availability block. */
  stockComponent?: ComponentType<StockComponentProps>;
  /** Replaces the default add-to-cart control. */
  addToCartComponent?: ComponentType<AddToCartComponentProps>;
  /** Replaces the default product / cluster image block. */
  imageComponent?: ComponentType<ImageComponentProps>;
  /** Replaces the default product / cluster badges block. */
  badgesComponent?: ComponentType<BadgesComponentProps>;
  /** Replaces the default add-to-favorite control. */
  favoriteComponent?: ComponentType<FavoriteComponentProps>;
  /** Replaces the default product-bundles block on a PDP. */
  bundlesComponent?: ComponentType<ProductBundlesComponentProps>;
  /** Replaces the default product-bulk-prices block on a PDP. */
  bulkPricesComponent?: ComponentType<ProductBulkPricesComponentProps>;
  /** Replaces the default surcharges block on a PDP / cart row. */
  surchargesComponent?: ComponentType<ProductSurchargesComponentProps>;

  // Iteration-level: swap the whole ProductCard / ClusterCard rendered by
  // ProductGrid and ProductSlider. The custom component receives the same
  // props that the default would have received.
  /** Replaces the whole ProductCard rendered inside ProductGrid / ProductSlider. */
  productCardComponent?: ComponentType<{ product: Product } & Record<string, unknown>>;
  /** Replaces the whole ClusterCard rendered inside ProductGrid / ProductSlider. */
  clusterCardComponent?: ComponentType<{ cluster: Cluster } & Record<string, unknown>>;

  /**
   * Render arbitrary content directly below each card's product name. Receives
   * the product; return `null`/`undefined` to render nothing. Lets hosts surface
   * extra per-product info (e.g. package descriptions) across the whole grid
   * without swapping the entire card.
   */
  belowName?: (product: Product) => ReactNode;
}

const ProductGridContext = createContext<ProductGridConfig | null>(null);

/**
 * Provider — ProductGrid wraps its card subtree with this so descendant
 * cards read display flags and callbacks via {@link useProductGridConfig}
 * instead of receiving them as threaded props.
 *
 * @param value - The grid config object shared with the card subtree.
 * @param children - The card subtree (ProductCard / ClusterCard and below).
 * @returns The provider element wrapping `children`.
 */
export function ProductGridConfigProvider({
  value,
  children,
}: {
  value: ProductGridConfig;
  children: ReactNode;
}) {
  return (
    <ProductGridContext.Provider value={value}>
      {children}
    </ProductGridContext.Provider>
  );
}

/**
 * Reads the {@link ProductGridConfig} from context.
 *
 * Non-throwing: ProductCard/ClusterCard used outside a grid (ProductSlider,
 * standalone, tests) get null and fall back to explicit props / defaults.
 *
 * @returns The grid config, or `null` when rendered outside a provider.
 */
export function useProductGridConfig(): ProductGridConfig | null {
  return useContext(ProductGridContext);
}
