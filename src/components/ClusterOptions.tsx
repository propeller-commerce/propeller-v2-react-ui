'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import { ClusterOption, Contact, Customer, Product, YesNo } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, getLocalizedValue, isContentHidden } from '@propeller-commerce/propeller-v2-core-ui';
import { formatPrice as formatPriceHelper } from '@propeller-commerce/propeller-v2-core-ui';

import { useInfraProps } from '../composables/react/useInfraProps';
import { cn } from '../composables/shared/utils/cn';

/**
 * Flattened render model for one product inside an option dropdown.
 */
interface RenderedOptionProduct {
  /** Numeric product ID. */
  productId: number;
  /** String form of `productId`, used as the option element value. */
  productIdStr: string;
  /** Combined display label, e.g. "Product Name — €10.00" */
  label: string;
}

/**
 * Flattened render model for one cluster option group, precomputed
 * to avoid calling state methods with arguments inside JSX.
 */
/**
 * Flattened render model for one product inside an option dropdown.
 */

/**
 * Flattened render model for one cluster option group, precomputed
 * to avoid calling state methods with arguments inside JSX.
 */
interface RenderedOption {
  /** Numeric ID of the cluster option group. */
  id: number;
  /** String form of `id`, used as the select element value key. */
  idStr: string;
  /** Display name of the option group. */
  name: string;
  /** Whether a selection is mandatory for this option. */
  isRequired: boolean;
  /** Product ID currently selected in this option's dropdown (empty if none). */
  selectedProductId: string;
  /** Whether the user has selected a product for this option. */
  hasSelection: boolean;
  /** Whether to show a validation error (required, unselected, and `showErrors` set). */
  hasError: boolean;
  /** Image URL of the currently selected product (empty string if none). */
  previewImageUrl: string;
  /** Name of the currently selected product. */
  previewName: string;
  /** Formatted price of the currently selected product. */
  previewPrice: string;
  /** Selectable products for this option, as flattened render models. */
  products: RenderedOptionProduct[];
}
/**
 * Flattened render model for one product inside an option dropdown.
 */

/**
 * Flattened render model for one cluster option group, precomputed
 * to avoid calling state methods with arguments inside JSX.
 */

export interface ClusterOptionsProps {
  /** The cluster ID this options selector belongs to. Required. */
  clusterId: number;

  /**
   * An array of options that belong to the cluster. Required.
   * Hidden options (`option.hidden === 'Y'`) are automatically filtered out.
   */
  options: ClusterOption[];

  /**
   * Fired whenever the user selects a product within any option group.
   * Receives the full Product object of the chosen option product.
   * Usually used to trigger a price update on the parent page.
   */
  onOptionSelect?: (optionProduct: Product) => void;

  /**
   * Fired whenever the user clears an option (picks the empty/default entry
   * in a non-required dropdown). Receives the option's `id`. Parents should
   * remove that key from their `selectedOptionProducts` map so the price
   * display drops the option's add-on price.
   */
  onOptionClear?: (optionId: number) => void;

  /** Override any UI string. Available keys: required, selectRequired, selectOptional, requiredError */
  labels?: Record<string, string>;

  /** When true, required options with no selection are highlighted with a validation error. */
  showErrors?: boolean;

  /** Currency symbol for prices. Defaults to '€'. */
  currency?: string;

  /** Authenticated user. Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer | null;

  /**
   * Language used to resolve option and product names. Resolved from
   * PropellerProvider when omitted.
   */
  language?: string;

  /**
   * Portal access mode. In `'semi-closed'` option prices are omitted from the
   * dropdown labels and preview for anonymous visitors. Resolved from
   * PropellerProvider when omitted.
   */
  portalMode?: string;

  /** Extra CSS class applied to the root element. */
  className?: string;
}
/**
 * Flattened render model for one product inside an option dropdown.
 */

/**
 * Flattened render model for one cluster option group, precomputed
 * to avoid calling state methods with arguments inside JSX.
 */

function formatPrice(price: number, currency: string): string {
  return formatPriceHelper(price, { symbol: currency });
}

// `names[0]` is the catalog's default-language entry, so reading it directly
// showed Dutch option names on every other storefront even where a translation
// existed. `getLocalizedValue` prefers the active language and only
// then falls back to any translation that has a value.
function getProductName(product: Product, language?: string): string {
  return getLocalizedValue(product.names, language, `Product ${product.productId}`);
}

function getProductImageUrl(product: Product): string {
  const media = product.media;
  if (
    media?.images?.items &&
    Array.isArray(media.images.items) &&
    media.images.items.length > 0
  ) {
    const firstImage = media.images.items[0];
    if (firstImage?.imageVariants?.[0]?.url) return firstImage.imageVariants[0].url;
  }
  return '';
}

/**
 * Renders selectable add-on option groups for a cluster as dropdowns, each
 * with a preview of the chosen product. Surfaces validation errors for unset
 * required options when `showErrors` is enabled.
 */
function ClusterOptions(rawProps: ClusterOptionsProps) {
  // Explicit props win; otherwise infra (language, user, portalMode) is
  // resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, string>>({});
  function getOptionsForRender(): RenderedOption[] {
    const language = props.language as string | undefined;
    const options = props.options || [];
    const sel = selectedProductIds;
    const hidePrices = isContentHidden(props.portalMode, props.user);
    return options
      .filter((option: ClusterOption) => option.hidden !== YesNo.Y)
      .map((option: ClusterOption) => {
        const idStr = option.id.toString();
        const selectedProductId = sel[idStr] || '';
        const products = (option.products || []).map((p: Product) => ({
          productId: p.productId,
          productIdStr: p.productId.toString(),
          label: hidePrices
            ? getProductName(p, language)
            : `${getProductName(p, language)} \u2014 ${formatPrice(p.price?.gross || 0, props.currency ?? '\u20ac')}`,
        }));
        let previewImageUrl = '';
        let previewName = '';
        let previewPrice = '';
        if (selectedProductId) {
          const selectedProduct = (option.products || []).find(
            (p: Product) => p.productId.toString() === selectedProductId
          );
          if (selectedProduct) {
            previewImageUrl = getProductImageUrl(selectedProduct);
            previewName = getProductName(selectedProduct, language);
            previewPrice = hidePrices
              ? ''
              : formatPrice(selectedProduct.price?.gross || 0, props.currency ?? '€');
          }
        }
        const isRequired = option.isRequired === YesNo.Y;
        return {
          id: option.id,
          idStr,
          name: getLocalizedValue(option.names, language, `Option ${option.id}`),
          isRequired,
          selectedProductId,
          hasSelection: !!selectedProductId,
          hasError: isRequired && !selectedProductId && !!(props.showErrors as boolean),
          previewImageUrl,
          previewName,
          previewPrice,
          products,
        };
      });
  }
  function handleOptionChange(optionIdStr: string, productIdStr: string): void {
    const newIds: Record<string, string> = { ...selectedProductIds };
    if (productIdStr) newIds[optionIdStr] = productIdStr;
    else delete newIds[optionIdStr];
    setSelectedProductIds(newIds);
    if (productIdStr && props.onOptionSelect) {
      const options = props.options || [];
      const option = options.find((o: ClusterOption) => o.id.toString() === optionIdStr);
      const product = (option?.products || []).find(
        (p: Product) => p.productId.toString() === productIdStr,
      );
      if (product) props.onOptionSelect(product);
    } else if (!productIdStr && props.onOptionClear) {
      props.onOptionClear(parseInt(optionIdStr, 10));
    }
  }
  const renderedOptions = getOptionsForRender();
  return (
    <div className={cn(`propeller-cluster-options ${props.className || ''}`)}>
      {renderedOptions.length > 0 ? (
        <div className="propeller-cluster-options__content flex flex-col gap-6">
          {renderedOptions.map((option) => (
            <div
              className="propeller-cluster-options__group"
              key={option.id}
              data-required={option.isRequired ? 'true' : 'false'}
              data-error={option.hasError ? 'true' : 'false'}
            >
              <div className="propeller-cluster-options__label-row flex items-center gap-2 mb-2">
                <h4 className="propeller-cluster-options__label font-semibold text-sm text-muted-foreground">{option.name}</h4>
                {option.isRequired ? (
                  <span className="propeller-cluster-options__required-badge inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/10">
                    {getLabel(props.labels, 'required', 'Required')}
                  </span>
                ) : null}
              </div>
              <select
                value={option.selectedProductId}
                onChange={(e) => handleOptionChange(option.idStr, e.target.value)}
                className={`propeller-cluster-options__select w-full rounded-control border px-3 py-2 text-sm focus:outline-none focus:ring-2 cursor-pointer ${option.hasError ? 'border-destructive focus:ring-destructive' : option.isRequired ? 'border-input focus:ring-secondary' : 'border-border focus:ring-secondary'}`}
              >
                <option value="">
                  {option.isRequired ? (
                    <>{getLabel(props.labels, 'selectRequired', '— Select an option —')}</>
                  ) : (
                    <>{getLabel(props.labels, 'selectOptional', '— None (Optional) —')}</>
                  )}
                </option>
                {option.products?.map((product) => (
                  <option key={product.productId} value={product.productIdStr}>
                    {product.label}
                  </option>
                ))}
              </select>
              {option.hasError ? (
                <p className="propeller-cluster-options__error mt-1 text-xs text-destructive">
                  {getLabel(props.labels, 'requiredError', 'This option is required')}
                </p>
              ) : null}
              {option.hasSelection ? (
                <div className="propeller-cluster-options__preview mt-3 flex items-center gap-3 rounded-container border border-border-subtle bg-surface-hover p-3">
                  {!!option.previewImageUrl ? (
                    <img
                      className="propeller-cluster-options__preview-image h-12 w-12 flex-shrink-0 rounded border border-border-subtle bg-card object-contain"
                      src={option.previewImageUrl}
                      alt={option.previewName}
                    />
                  ) : null}
                  {!option.previewImageUrl ? (
                    <div className="propeller-cluster-options__preview-image-placeholder flex h-12 w-12 flex-shrink-0 items-center justify-center rounded border border-border bg-surface-hover">
                      <svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        className="h-5 w-5 text-foreground-subtle"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          strokeWidth={1.5}
                        />
                      </svg>
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="propeller-cluster-options__preview-name truncate text-sm font-medium text-foreground">
                      {option.previewName}
                    </p>
                    <p className="propeller-cluster-options__preview-price text-sm font-semibold text-secondary">{option.previewPrice}</p>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ClusterOptions;
