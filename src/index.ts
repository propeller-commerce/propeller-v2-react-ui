/**
 * Client surface for `propeller-v2-react-ui`.
 *
 * Everything here is safe to import from Next.js Client Components, and the
 * tsup build prepends `"use client";` to the bundled output so re-exporting
 * one of these components in a Server Component will automatically draw the
 * Client boundary at that import.
 *
 * For the server-only counterpart (`createServerClient`, `getServerInfra`,
 * `fetchProduct`, `fetchCategory`), import from `'propeller-v2-react-ui/server'`.
 */

// ── SDK seam + pure utilities + domain types (re-exported from core) ──────
// The package no longer ships a `graphqlClient` singleton or a hardcoded
// `/api/graphql` URL. Consumers construct their own `GraphQLClient` (with
// whatever endpoint, headers and auth resolver fits their app), call
// `createServices(client)` once at startup, and pass BOTH into
// `<PropellerProvider value={{ graphqlClient, services, ... }}>`.
//
// All pure-TS utilities (formatPrice, getCountryName, etc.), domain types,
// and the SDK seam (createServices, toPlain) now live in propeller-v2-core-ui
// and are re-exported here so the public surface of this package is unchanged.
export * from '@propeller-commerce/propeller-v2-core-ui';

// ── Context ─────────────────────────────────────────────────────────────────
export {
  PropellerDepsProvider,
  PropellerProvider,
  usePropellerContext,
  usePropellerDeps,
  useRequiredPropellerDeps,
  usePropellerScope,
  useUserMode,
  type PropellerDeps,
  type PropellerDepsProviderProps,
  type PropellerScope,
  type PropellerInfra,
  type PropellerProviderProps,
} from './context/PropellerContext';
export {
  ProductGridConfigProvider,
  useProductGridConfig,
  type ProductGridConfig,
} from './context/ProductGridContext';

// ── Composables (React) ─────────────────────────────────────────────────────
export { useAddress, type AddressInput, type UseAddressOptions, type UseAddressReturn } from './composables/react/useAddress';
export {
  useAuth,
  type LoginResult as UseAuthLoginResult,
  type RegisterContactInput as UseAuthRegisterContactInput,
  type RegisterCustomerInput as UseAuthRegisterCustomerInput,
  type UseAuthOptions,
  type UseAuthReturn,
} from './composables/react/useAuth';
export {
  useCart,
  type UseCartOptions,
  type UseCartReturn,
  type AddItemOptions,
  type GetCrossupsellsOptions,
} from './composables/react/useCart';
export {
  useCheckout,
  type UseCheckoutOptions,
  type UseCheckoutReturn,
  type PlaceOrderOptions,
} from './composables/react/useCheckout';
export {
  useClusterConfigurator,
  type ConfiguredSetting,
  type UseClusterConfiguratorOptions,
  type UseClusterConfiguratorReturn,
} from './composables/react/useClusterConfigurator';
export {
  useCompany,
  type UseCompanyOptions,
  type UseCompanyReturn,
} from './composables/react/useCompany';
export {
  useFavorites,
  type FavoriteListFormData,
  type UseFavoritesOptions,
  type UseFavoritesReturn,
} from './composables/react/useFavorites';
export { useInfraProps } from './composables/react/useInfraProps';
export {
  useMenu,
  type MenuCategory,
  type UseMenuOptions,
  type UseMenuReturn,
} from './composables/react/useMenu';
export {
  useOrders,
  type OrderSearchForm,
  type UseOrdersOptions,
  type UseOrdersReturn,
} from './composables/react/useOrders';
export {
  useProductBundles,
  type BundleItem as UseProductBundlesBundleItem,
  type UseProductBundlesOptions,
  type UseProductBundlesReturn,
} from './composables/react/useProductBundles';
export {
  useProductInfo,
  type UseProductInfoOptions,
  type UseProductInfoReturn,
} from './composables/react/useProductInfo';
export {
  useProductSearch,
  type UseProductSearchOptions,
  type UseProductSearchReturn,
} from './composables/react/useProductSearch';
export {
  useQuickOrder,
  type QuickOrderMatch,
  type QuickOrderLine,
  type QuickOrderSubmitResult,
  type UseQuickOrderOptions,
  type UseQuickOrderReturn,
} from './composables/react/useQuickOrder';
export {
  useSpareParts,
  type UseSparePartsOptions,
  type UseSparePartsReturn,
} from './composables/react/useSpareParts';
export {
  useMachines,
  buildRootMachinesQuery,
  type UseMachinesOptions,
  type UseMachinesReturn,
} from './composables/react/useMachines';
export {
  useProductSlider,
  type FetchCrossupsellsInput,
  type UseProductSliderOptions,
  type UseProductSliderReturn,
} from './composables/react/useProductSlider';
export {
  useProductSpecs,
  type AttributeGroup,
  type AttributeDisplayItem,
  type UseProductSpecsOptions,
  type UseProductSpecsReturn,
} from './composables/react/useProductSpecs';
export {
  usePurchaseAuthorizationConfigurator,
  usePurchaseAuthorizationRequests,
  type RowEdit,
  type AddContactFormState,
  type UsePurchaseAuthorizationConfiguratorOptions,
  type UsePurchaseAuthorizationConfiguratorReturn,
  type UsePurchaseAuthorizationRequestsOptions,
  type UsePurchaseAuthorizationRequestsReturn,
} from './composables/react/usePurchaseAuthorization';
export { useResolvedProps, type ResolveSpec } from './composables/react/useResolvedProps';
export { useServices } from './composables/react/useServices';

// ── React-package-local cart helpers (not in core) ─────────────────────────
// These three use SDK services and are framework-agnostic but live here while
// they have callers in this package. They could move to core in a later pass.
export { initCart, type CartInitConfig } from './composables/shared/utils/cartInit';
export {
  fetchActiveCart,
  type FetchActiveCartConfig,
} from './composables/shared/utils/fetchActiveCart';
export { mergeAnonymousCart } from './composables/shared/utils/mergeAnonymousCart';

// ── Components ──────────────────────────────────────────────────────────────
// Each component is exported as a default, alongside its `*Props` type so
// consumers (and the generated API reference) get the full prop contract.
export { default as AccountIconAndMenu, type AccountIconAndMenuProps } from './components/AccountIconAndMenu';
export { default as ActionCode, type ActionCodeProps } from './components/ActionCode';
export { default as AddToCart, type AddToCartProps } from './components/AddToCart';
export { default as AddToFavorite, type AddToFavoriteProps } from './components/AddToFavorite';
export { default as AddressCard, type AddressCardProps } from './components/AddressCard';
export { default as AddressSelector, type AddressSelectorProps } from './components/AddressSelector';
// Main entry re-exports the provider-aware wrapper as `Breadcrumbs`. The
// pure RSC-safe component remains available from the `/pure` entry.
export { default as Breadcrumbs, type BreadcrumbsProps } from './components/BreadcrumbsWithProvider';
export { default as CartBonusItems, type CartBonusItemsProps } from './components/CartBonusItems';
export { default as CartCarriers, type CartCarriersProps } from './components/CartCarriers';
export { default as CartIconAndSidebar, type CartIconAndSidebarProps } from './components/CartIconAndSidebar';
export { default as CartItem, type CartItemProps } from './components/CartItem';
export { default as CartOverview, type CartOverviewProps } from './components/CartOverview';
export { default as CartPaymethods, type CartPaymethodsProps } from './components/CartPaymethods';
export { default as CartSummary, type CartSummaryProps } from './components/CartSummary';
export { default as CategoryDescription, type CategoryDescriptionProps } from './components/CategoryDescription';
export { default as CategoryShortDescription, type CategoryShortDescriptionProps } from './components/CategoryShortDescriptionWithProvider';
export { default as ClusterCard, type ClusterCardProps } from './components/ClusterCard';
export { default as MachineCard, type MachineCardProps } from './components/MachineCard';
export { default as MachineGrid, type MachineGridProps, type MachineListingState } from './components/MachineGrid';
export { default as ClusterConfigurator, type ClusterConfiguratorProps } from './components/ClusterConfigurator';
export { default as ClusterInfo, type ClusterInfoProps } from './components/ClusterInfo';
export { default as ClusterOptions, type ClusterOptionsProps } from './components/ClusterOptions';
export { default as CompanySwitcher, type CompanySwitcherProps } from './components/CompanySwitcher';
export { default as DeliveryDate, type DeliveryDateProps } from './components/DeliveryDate';
export { default as FavoriteListDetails, type FavoriteListDetailsProps } from './components/FavoriteListDetails';
export { default as FavoriteListItem, type FavoriteListItemProps } from './components/FavoriteListItem';
export { default as FavoriteLists, type FavoriteListsProps } from './components/FavoriteLists';
export { default as ForgotPassword, type ForgotPasswordProps } from './components/ForgotPassword';
export { default as GridFilters, type GridFiltersProps } from './components/GridFilters';
export { default as GridFiltersPanel, type GridFiltersPanelProps } from './components/GridFiltersPanel';
export { default as GridPagination, type GridPaginationProps } from './components/GridPagination';
export { default as GridTitle, type GridTitleProps } from './components/GridTitleWithProvider';
export { default as GridToolbar, type GridToolbarProps } from './components/GridToolbar';
export { default as ItemStock, type ItemStockProps } from './components/ItemStock';
export {
  default as LoginToOrderButton,
  type LoginToOrderButtonProps,
} from './components/LoginToOrderButton';
export { default as ItemsOverview, type ItemsOverviewProps } from './components/ItemsOverview';
export { default as LoginForm, type LoginFormProps } from './components/LoginForm';
export {
  default as Menu,
  type MenuProps,
  type MenuStyle,
  type MenuRenderContext,
} from './components/Menu';
export { default as OrderActions, type OrderActionsProps } from './components/OrderActions';
export { default as OrderBonusItems, type OrderBonusItemsProps } from './components/OrderBonusItems';
export { default as OrderItemCard, type OrderItemCardProps } from './components/OrderItemCard';
export { default as OrderList, type OrderListProps } from './components/OrderList';
export {
  default as QuickOrder,
  type QuickOrderProps,
  type QuickOrderUploadLine,
} from './components/QuickOrder';
export { default as OrderShipments, type OrderShipmentsProps } from './components/OrderShipments';
export { default as OrderSummary, type OrderSummaryProps } from './components/OrderSummary';
export { default as OrderTotals, type OrderTotalsProps } from './components/OrderTotals';
export { default as PriceToggle, type PriceToggleProps } from './components/PriceToggle';
export { default as ProductBulkPrices, type ProductBulkPricesProps } from './components/ProductBulkPricesWithProvider';
export { default as ProductBundles, type ProductBundlesProps } from './components/ProductBundles';
export { default as ProductCard, type ProductCardProps } from './components/ProductCard';
export { default as ProductDescription, type ProductDescriptionProps } from './components/ProductDescription';
export { default as ProductDownloads, type ProductDownloadsProps } from './components/ProductDownloads';
export { default as ProductGallery, type ProductGalleryProps } from './components/ProductGallery';
export { default as ProductGrid, type ProductGridProps } from './components/ProductGrid';
export { default as ProductInfo, type ProductInfoProps } from './components/ProductInfo';
export { default as ProductPrice, type ProductPriceProps } from './components/ProductPriceWithProvider';
export { default as ProductShortDescription, type ProductShortDescriptionProps } from './components/ProductShortDescriptionWithProvider';
export { default as ProductSlider, type ProductSliderProps } from './components/ProductSlider';
export { default as ProductSpecifications, type ProductSpecificationsProps } from './components/ProductSpecifications';
export { default as ProductTabs, type ProductTabsProps } from './components/ProductTabs';
export { default as ProductVideos, type ProductVideosProps } from './components/ProductVideos';
export { default as PurchaseAuthorizationConfigurator, type PurchaseAuthorizationConfiguratorProps } from './components/PurchaseAuthorizationConfigurator';
export { default as PurchaseAuthorizationRequests, type PurchaseAuthorizationRequestsProps } from './components/PurchaseAuthorizationRequests';
export { default as QuoteActions, type QuoteActionsProps } from './components/QuoteActions';
export { default as RegisterForm, type RegisterFormProps } from './components/RegisterForm';
export { default as SearchBar, type SearchBarProps } from './components/SearchBar';
export { default as UserDetails, type UserDetailsProps } from './components/UserDetails';

// ───── Default sub-components for the extension API ─────────────────────────
// Consumers can wrap-and-call these inside their own custom *Component to
// decorate the default markup instead of rebuilding sub-components from
// scratch. Aliases of existing standalone components plus three extractions
// (Image / Badges / Surcharges) of markup that previously lived inline.
export { default as DefaultProductPrice } from './components/ProductPrice';
export { default as DefaultItemStock } from './components/ItemStock';
export { default as DefaultAddToCart } from './components/AddToCart';
export { default as DefaultAddToFavorite } from './components/AddToFavorite';
export { default as DefaultProductBundles } from './components/ProductBundles';
export { default as DefaultProductBulkPrices } from './components/ProductBulkPrices';
export { DefaultProductImage } from './components/defaults/DefaultProductImage';
export { DefaultProductBadges } from './components/defaults/DefaultProductBadges';
export { DefaultProductSurcharges } from './components/defaults/DefaultProductSurcharges';
