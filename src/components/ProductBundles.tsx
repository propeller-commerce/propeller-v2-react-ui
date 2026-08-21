'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { Bundle, BundleCondition, BundleItem, Cart, Contact, Customer, GraphQLClient, Product } from '@propeller-commerce/propeller-sdk-v2';
import { useProductBundles } from '../composables/react/useProductBundles';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel, getLocalizedValue } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice as formatPriceHelper } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface ProductBundlesProps {
  // === Core ===

  /** GraphQL client instance used to fetch bundle data. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** ID of the product whose bundles should be fetched. */
  productId: number;

  /** Language code used for content (e.g. 'NL', 'EN'). Resolved from PropellerProvider when omitted. */
  language?: string;

  /** Tax zone code used for pricing (e.g. 'NL'). */
  taxZone: string;

  // === Pricing ===

  /**
   * When true, net price (incl. tax) is the leading price.
   * Note: in the Propeller SDK `price.gross` = excl. VAT, `price.net` = incl. VAT.
   */
  includeTax?: boolean;

  // === Portal / visibility ===

  /**
   * Controls portal visibility mode.
   * 'semi-closed' — prices and add-to-cart are hidden for anonymous users.
   * Defaults to 'open'.
   */
  portalMode?: string;

  /** Authenticated user — used for semi-closed visibility check. */
  user?: Contact | Customer | null;

  /** Active company ID from the company switcher.
   * Overrides user's default company for cart creation and lookup.  * If not provided, the user's default company is used.
   */
  companyId?: number;

  /** Cart ID — required when onAddToCart is not provided */
  cartId?: string;

  /**
   * Callback to handle a new cart being created.
   * WARNING: If not provided the component create new carts on every add-to-cart.
   */
  onCartCreated?: (cart: Cart) => void;

  /**
   * If true a new cart is created if no cart ID is provided.
   * Defaults to false.
   */
  createCart?: boolean;

  // === Display options ===

  /** When true, stock availability is validated before adding to cart. */
  stockValidation?: boolean;

  /**
   * When true, the individual bundle items are listed inside each bundle card.
   * Defaults to true.
   */
  showIndividualItems?: boolean;

  /** Additional configuration object passed through to the component. */
  configuration?: any;

  /**
   * Layout variant for the bundle display.
   * - 'vertical' — stacked layout
   * - 'horizontal' — side-by-side (default)
   * - 'compact' — condensed, hides individual items
   */
  layout?: 'vertical' | 'horizontal' | 'compact';

  /**
   * Override any UI string.
   * Available keys: title, condition_ALL, condition_EP, leaderItem,
   * youSave, adding, addToCart, loginToSeePrices, addedToCart,
   * modalTitle, continueShopping, proceedToCheckout, noCartId
   */
  labels?: Record<string, string>;

  /**
   * Show the "log in to see prices" prompt when prices are hidden.
   * Defaults to true; pass false to render nothing in its place.
   */
  showLoginPrompt?: boolean;

  // === Modal / feedback ===

  /**
   * When true a modal popup is shown after a successful add-to-cart
   * with buttons to continue shopping or proceed to checkout.
   * Defaults to false (only a brief inline toast is shown).
   */
  showModal?: boolean;

  /** Callback fired when the "Proceed to checkout" modal button is clicked */
  onProceedToCheckout?: () => void;

  // === Callbacks ===

  /**
   * Callback triggered before adding the bundle to cart.
   */
  beforeBundleAddToCart?: (bundleId: string, quantity: number) => boolean;

  /** Called when the user clicks "Add bundle to cart". Receives bundleId and quantity (always 1). */
  onAddBundleToCart?: (bundleId: string, quantity: number) => void;

  /**
   * Callback triggered after adding the bundle to cart.
   */
  afterBundleAddToCart?: (cart: Cart, bundle?: Bundle) => void;

  /** Extra CSS class applied to the root wrapper element. */
  className?: string;
}

// ── Pure helpers (module scope — created once, not per render) ──────────────────

function getBundlePrice(bundle: Bundle, includeTax: boolean): number {
  return includeTax ? bundle.price?.net || 0 : bundle.price?.gross || 0;
}

function getOriginalPrice(bundle: Bundle, includeTax: boolean): number {
  return includeTax ? bundle.price?.originalNet || 0 : bundle.price?.originalGross || 0;
}

function getItemPrice(item: BundleItem, includeTax: boolean): number {
  return includeTax ? item.price?.net || 0 : item.price?.gross || 0;
}

function getProductImage(product: Product): string {
  return product?.media?.images?.items?.[0]?.imageVariants?.[0]?.url || '';
}

// `names[0]` is the catalog's default-language entry.
function getProductName(product: Product, language?: string): string {
  return getLocalizedValue(product?.names, language, '');
}

/**
 * Renders combo-deal bundles for a product, each with its constituent items,
 * pricing and savings, plus add-to-cart with toast or modal feedback.
 *
 * @remarks Uses {@link useProductBundles} to fetch bundles and add them to a cart.
 */
function ProductBundles(rawProps: ProductBundlesProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const language = props.language as string | undefined;
  const currencySymbol = props.currency ?? '€';
  const money = (value: number): string => formatPriceHelper(value, { symbol: currencySymbol });
  const [isMounted, setIsMounted] = useState(false);
  const [addingBundleId, setAddingBundleId] = useState<string | null>(null);
  const [lastAddedBundle, setLastAddedBundle] = useState<Bundle | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const {
    bundles: fetchedBundles,
    loading: isLoading,
    cartId: composableCartId,
    fetchBundles,
    addBundleToCart: composableAddBundleToCart,
  } = useProductBundles({
    graphqlClient: props.graphqlClient!,
    user: (props.user as Contact | Customer | null) || null,
    language: props.language,
    configuration: props.configuration || {},
    onCartCreated: props.onCartCreated,
  });

  // Cast fetched bundles back to SDK Bundle type for display
  const bundles = fetchedBundles as unknown as Bundle[];

  // Display / pricing flags — resolved once (previously each was a function
  // redefined every render and called from many JSX sites).
  const includeTax = props.includeTax !== undefined ? !!props.includeTax : false;
  const showItems = props.showIndividualItems !== undefined ? !!props.showIndividualItems : true;
  const layout = (props.layout as string) || 'horizontal';
  const isAnonymous = !props.user;
  const hidePrices = (props.portalMode as string) === 'semi-closed' && isAnonymous;

  function hasDiscount(bundle: Bundle): boolean {
    const current = getBundlePrice(bundle, includeTax);
    const original = getOriginalPrice(bundle, includeTax);
    return original > 0 && current < original;
  }

  function showToast(message: string, type: string): void {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 3000);
  }

  function dismissToast(): void {
    setToastVisible(false);
  }

  function closeModal(): void {
    setModalVisible(false);
    setLastAddedBundle(null);
  }

  async function handleAddToCart(bundle: Bundle): Promise<void> {
    if (addingBundleId) return;
    setAddingBundleId(bundle.id);
    try {
      if (props.onAddBundleToCart) {
        props.onAddBundleToCart(bundle.id, 1);
      } else {
        if (!props.graphqlClient) return;
        if (props.beforeBundleAddToCart) {
          props.beforeBundleAddToCart(bundle.id, 1);
        }

        const existingCartId = props.cartId || composableCartId;
        const result = await composableAddBundleToCart(
          bundle.id as unknown as number,
          existingCartId || undefined
        );

        if (!result.success) {
          showToast(
            result.error || getLabel(props.labels, 'noCartId', 'No cart ID provided'),
            'error'
          );
          return;
        }

        if (result.cart && props.afterBundleAddToCart) {
          props.afterBundleAddToCart(result.cart, bundle);
        }
      }
      if (props.showModal) {
        setLastAddedBundle(bundle);
        setModalVisible(true);
      } else {
        const bundleName = bundle.name || getLabel(props.labels, 'title', 'Bundle');
        showToast(
          `${bundleName} ${getLabel(props.labels, 'addedToCart', 'added to cart')}`,
          'success'
        );
      }
    } catch (error) {
      console.error('Error adding bundle to cart:', error);
      showToast(getLabel(props.labels, 'errorAdding', 'Failed to add bundle to cart'), 'error');
    } finally {
      setAddingBundleId(null);
    }
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    fetchBundles(props.productId);
  }, [props.productId]);

  return (
    <>
      {isMounted && !isLoading && bundles.length > 0 ? (
        <div className={cn(`propeller-product-bundles ${props.className || 'mb-12'}`)}>
          {bundles.map((bundle, bundleIdx) => {
            const bundlePrice = getBundlePrice(bundle, includeTax);
            const originalPrice = getOriginalPrice(bundle, includeTax);
            const discounted = hasDiscount(bundle);
            return (
              <div
                className="propeller-product-bundles__bundle border border-border rounded-container bg-card shadow-sm mb-6 p-6"
                key={bundle.id || bundleIdx}
                data-layout={layout}
              >
                <div className="flex flex-col lg:flex-row items-center gap-6">
                  {showItems && layout !== 'compact' && bundle.items && bundle.items.length > 0 ? (
                    <div className="propeller-product-bundles__items flex flex-wrap items-center justify-center gap-2 flex-1">
                      {bundle.items.map((item, idx) => (
                        <div
                          className="propeller-product-bundles__item flex items-center gap-2"
                          key={item.productId + '-' + idx}
                        >
                          {idx > 0 ? (
                            <div className="propeller-product-bundles__plus flex-shrink-0 w-8 h-8 rounded-full bg-success flex items-center justify-center">
                              <svg
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                className="w-5 h-5 text-success-foreground"
                                strokeWidth={2.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 4.5v15m7.5-7.5h-15"
                                />
                              </svg>
                            </div>
                          ) : null}
                          <div className="flex flex-col items-center text-center w-40">
                            <div className="propeller-product-bundles__item-media w-32 h-32 bg-surface-hover rounded-container overflow-hidden flex-shrink-0 mb-2">
                              {getProductImage(item.product) ? (
                                <img
                                  className="propeller-product-bundles__item-image w-full h-full object-contain p-2"
                                  src={getProductImage(item.product)}
                                  alt={getProductName(item.product, language)}
                                />
                              ) : null}
                            </div>
                            <div className="propeller-product-bundles__item-name text-sm font-medium text-muted-foreground leading-tight mb-1">
                              {getProductName(item.product, language) || 'Product ' + item.productId}
                            </div>
                            {!hidePrices && item.price ? (
                              <div className="propeller-product-bundles__item-price text-sm font-semibold text-foreground">
                                {money(getItemPrice(item, includeTax))}
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                  {includeTax
                                    ? getLabel(props.labels, 'inclTax', 'incl. VAT')
                                    : getLabel(props.labels, 'exclTax', 'excl. VAT')}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="propeller-product-bundles__equals flex-shrink-0 w-8 h-8 rounded-full bg-success flex items-center justify-center">
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      className="w-5 h-5 text-success-foreground"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 12h16.5M3.75 7.5h16.5"
                      />
                    </svg>
                  </div>
                  <div className="propeller-product-bundles__summary flex-shrink-0 w-full lg:w-72 pl-0 lg:pl-6">
                    <h3 className="propeller-product-bundles__title text-xl font-bold text-foreground mb-1">
                      {bundle.name || getLabel(props.labels, 'title', 'Combo deal')}
                    </h3>
                    {bundle.description ? (
                      <p className="propeller-product-bundles__description text-sm text-muted-foreground mb-3">
                        {bundle.description}
                      </p>
                    ) : null}
                    {bundle.condition ? (
                      <p className="propeller-product-bundles__condition text-xs text-muted-foreground mb-3">
                        {bundle.condition === BundleCondition.ALL
                          ? getLabel(props.labels, 'condition_ALL', 'Discount on all items')
                          : getLabel(props.labels, 'condition_EP', 'Discount on extra items')}
                      </p>
                    ) : null}
                    {!hidePrices ? (
                      <>
                        <div className="propeller-product-bundles__pricing mb-3">
                          {discounted ? (
                            <span className="propeller-product-bundles__original-price text-foreground-subtle line-through text-sm">
                              {money(originalPrice)}
                            </span>
                          ) : null}
                          <div className="flex items-baseline gap-2">
                            <span className="propeller-product-bundles__price text-2xl font-bold text-foreground">
                              {money(bundlePrice)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {includeTax
                                ? getLabel(props.labels, 'inclTax', 'incl. VAT')
                                : getLabel(props.labels, 'exclTax', 'excl. VAT')}
                            </span>
                          </div>
                          {discounted ? (
                            <div className="propeller-product-bundles__savings mt-2 inline-block bg-success/10 text-success text-sm font-medium px-3 py-1 rounded-control">
                              {getLabel(props.labels, 'youSave', 'Your savings:')}
                              {money(originalPrice - bundlePrice)}
                            </div>
                          ) : null}
                        </div>
                        <button
                          className="propeller-product-bundles__submit w-full px-6 py-3 bg-primary text-primary-foreground rounded-container font-semibold hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed text-base"
                          onClick={() => handleAddToCart(bundle)}
                          disabled={addingBundleId === bundle.id}
                          data-loading={addingBundleId === bundle.id ? 'true' : 'false'}
                        >
                          {addingBundleId === bundle.id
                            ? getLabel(props.labels, 'adding', 'Adding...')
                            : getLabel(props.labels, 'addToCart', 'In cart')}
                        </button>
                      </>
                    ) : props.showLoginPrompt !== false ? (
                      <div className="propeller-product-bundles__login-prompt text-center text-sm text-muted-foreground py-2">
                        {getLabel(
                          props.labels,
                          'loginToSeePrices',
                          'Log in to see prices and add to cart'
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {toastVisible ? (
            <div
              className={`propeller-product-bundles__toast fixed top-4 right-4 z-50 flex items-start gap-3 w-80 rounded-container shadow-lg p-4 ${toastType === 'success' ? 'bg-success border border-success text-success-foreground' : 'bg-destructive border border-destructive text-destructive-foreground'}`}
              data-toast-type={toastType}
            >
              <div
                className={`propeller-product-bundles__toast-icon flex-shrink-0 w-5 h-5 mt-0.5 ${toastType === 'success' ? 'text-success-foreground' : 'text-destructive-foreground'}`}
              >
                {toastType === 'success' ? (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
                {toastType === 'error' ? (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    />
                  </svg>
                ) : null}
              </div>
              <p
                className={`propeller-product-bundles__toast-message flex-1 text-sm font-medium ${toastType === 'success' ? 'text-success-foreground' : 'text-destructive-foreground'}`}
              >
                {toastMessage}
              </p>
              <button
                type="button"
                onClick={() => dismissToast()}
                className={`propeller-product-bundles__toast-close flex-shrink-0 rounded focus:outline-none ${toastType === 'success' ? 'text-success-foreground hover:text-success-foreground/80' : 'text-destructive-foreground hover:text-destructive-foreground/80'}`}
              >
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  className="h-4 w-4"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : null}
          {modalVisible ? (
            <div className="propeller-product-bundles__modal fixed inset-0 z-50 flex items-center justify-center px-4">
              <div
                className="propeller-product-bundles__modal-backdrop fixed inset-0 bg-foreground/20"
                onClick={() => closeModal()}
              />
              <div className="propeller-product-bundles__modal-content relative w-full max-w-lg bg-card rounded-container shadow-2xl overflow-hidden">
                <div className="propeller-product-bundles__modal-header flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
                  <svg
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    className="propeller-product-bundles__modal-success-icon h-5 w-5 flex-shrink-0 text-success"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <h3 className="propeller-product-bundles__modal-title flex-1 text-base font-semibold text-foreground">
                    {getLabel(props.labels, 'modalTitle', 'Added to cart')}
                  </h3>
                  <button
                    type="button"
                    className="propeller-product-bundles__modal-close flex-shrink-0 text-foreground-subtle hover:text-foreground focus:outline-none"
                    onClick={() => closeModal()}
                  >
                    <svg
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      className="h-5 w-5"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="propeller-product-bundles__modal-body px-6 py-5">
                  <div className="propeller-product-bundles__modal-product flex items-start gap-4">
                    {lastAddedBundle &&
                    lastAddedBundle.items &&
                    lastAddedBundle.items.length > 0 &&
                    getProductImage(lastAddedBundle.items[0].product) ? (
                      <img
                        className="propeller-product-bundles__modal-image w-16 h-16 object-contain rounded border border-border-subtle flex-shrink-0"
                        src={
                          lastAddedBundle?.items?.[0]
                            ? getProductImage(lastAddedBundle.items[0].product)
                            : ''
                        }
                        alt={lastAddedBundle?.name || 'Bundle'}
                      />
                    ) : (
                      <div className="propeller-product-bundles__modal-image-placeholder w-16 h-16 flex items-center justify-center rounded border border-border-subtle flex-shrink-0 bg-surface-hover">
                        <svg
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          className="w-8 h-8 text-foreground-subtle"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="propeller-product-bundles__modal-name text-sm font-medium text-foreground">
                        {lastAddedBundle?.name || getLabel(props.labels, 'title', 'Bundle')}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="propeller-product-bundles__modal-quantity text-xs text-muted-foreground">
                        {getLabel(props.labels, 'quantity', 'Quantity')}: 1
                      </p>
                      {!hidePrices && lastAddedBundle ? (
                        <p className="propeller-product-bundles__modal-price text-sm font-semibold text-foreground mt-0.5">
                          {money(getBundlePrice(lastAddedBundle, includeTax))}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {lastAddedBundle && lastAddedBundle.items && lastAddedBundle.items.length > 0 ? (
                    <div className="propeller-product-bundles__modal-children mt-3 ml-20 space-y-1 border-l-2 border-secondary/10 pl-2">
                      {lastAddedBundle.items.map((item, idx) => (
                        <div
                          className="propeller-product-bundles__modal-child flex justify-between items-center text-xs text-muted-foreground"
                          key={item.productId + '-' + idx}
                        >
                          <span className="line-clamp-1">
                            {getProductName(item.product, language) || 'Product'}
                          </span>
                          {!hidePrices && item.price ? (
                            <span className="text-foreground-subtle whitespace-nowrap ml-2">
                              {money(getItemPrice(item, includeTax))}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="propeller-product-bundles__modal-actions flex gap-3 px-6 py-4 border-t border-border-subtle">
                  <button
                    type="button"
                    className="propeller-product-bundles__modal-continue flex-1 inline-flex justify-center rounded-control border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    onClick={() => closeModal()}
                  >
                    {getLabel(props.labels, 'continueShopping', 'Continue shopping')}
                  </button>
                  <button
                    type="button"
                    className="propeller-product-bundles__modal-checkout flex-1 inline-flex justify-center rounded-control border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    onClick={() => {
                      closeModal();
                      if (props.onProceedToCheckout) props.onProceedToCheckout();
                    }}
                  >
                    {getLabel(props.labels, 'proceedToCheckout', 'Proceed to checkout')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export default ProductBundles;
