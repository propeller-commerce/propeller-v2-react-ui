'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import { Cart, CartAddress, GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { getCountryName as _getCountryName } from '@propeller-commerce/propeller-v2-core-ui';

export interface CartOverviewProps {
  /** GraphQL client for the Propeller SDK. Optional — currently unused internally; kept for API/Vue parity. */
  graphqlClient?: GraphQLClient;

  /** Shopping cart object from which the cart overview will be displayed */
  cart: Cart;

  /** The CSS class for the cart overview container */
  overviewContainerClass?: string;

  /** Title of the cart overview */
  title?: string;

  /** Labels for the cart overview form fields and buttons */
  labels?: Record<string, string>;

  /** Show the notes field for the cart */
  showNotes?: boolean;

  /** Show the reference field for the cart */
  showReference?: boolean;

  /** Show the terms and conditions acceptance */
  showTermsAndConditions?: boolean;

  /** Action when the "Terms and conditions" link is clicked */
  onTermsAndConditionsClick?: () => void;

  /** Show the "Purchase" button for placing an order */
  showPurchaseButton?: boolean;

  /** Action when the purchase button is clicked. Receives cart, reference, and notes */
  onPurchaseButtonClick?: (cart: Cart, reference: string, notes: string) => void;

  /**
   * Optional list of countries used to resolve ISO codes (e.g. 'NL') to display
   * names (e.g. 'Netherlands') in the address blocks. When omitted, the shared
   * built-in COUNTRIES list is used as a fallback.
   */
  countries?: { code: string; name: string }[];
}
/**
 * Final cart review panel: shows invoice/delivery addresses, payment, carrier
 * and delivery date, with optional reference, notes, terms acceptance and a
 * place-order button.
 */
function CartOverview(props: CartOverviewProps) {
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerClass = props.overviewContainerClass || 'cart-overview';
  const showNotes = props.showNotes !== false;
  const showReference = props.showReference !== false;
  const showTermsAndConditions = props.showTermsAndConditions !== false;
  const showPurchaseButton = props.showPurchaseButton !== false;
  const invoiceAddress: CartAddress | undefined = props.cart?.invoiceAddress;
  const deliveryAddress: CartAddress | undefined = props.cart?.deliveryAddress;
  const getCountryName = (code: string) => _getCountryName(code, props.countries);
  const paymentMethod = props.cart?.paymentData?.method || '';
  const carrierName = props.cart?.postageData?.carrier || '';
  function requestDate(): string {
    const date = props.cart?.postageData?.requestDate;
    if (!date) return '';
    // Numeric day-first DD-MM-YYYY. `toLocaleDateString()` with no locale used
    // the runtime default (US M/D/YYYY on many hosts). Fixed, locale-neutral.
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${d.getFullYear()}`;
  }
  function handleTermsLinkClick(event: React.MouseEvent): void {
    event.preventDefault();
    if (props.onTermsAndConditionsClick) props.onTermsAndConditionsClick();
  }
  const isPurchaseDisabled = (showTermsAndConditions && !termsAccepted) || loading;
  function handlePurchaseClick(): void {
    if (isPurchaseDisabled) return;
    setLoading(true);
    if (props.onPurchaseButtonClick) {
      props.onPurchaseButtonClick(props.cart, reference, notes);
    }
  }
  return (
    <div className={`propeller-cart-overview ${containerClass}`}>
      {props.title ? <h2 className="propeller-cart-overview__title text-xl font-bold mb-4">{props.title}</h2> : null}
      <div className="propeller-cart-overview__addresses grid grid-cols-1 md:grid-cols-2 gap-6 pb-5">
        <div className="propeller-cart-overview__address space-y-2" data-address="invoice">
          <h3 className="propeller-cart-overview__address-title text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {getLabel(props.labels, 'invoiceAddress', 'Invoice Address')}
          </h3>
          {invoiceAddress && invoiceAddress.street ? (
            <div className="text-sm space-y-1">
              {invoiceAddress.company ? (
                <p className="font-medium">{invoiceAddress.company}</p>
              ) : null}
              <p>
                {[
                  invoiceAddress.firstName,
                  invoiceAddress.middleName,
                  invoiceAddress.lastName,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              <p>
                {[
                  invoiceAddress.street,
                  invoiceAddress.number,
                  invoiceAddress.numberExtension,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              <p>
                {[invoiceAddress.postalCode, invoiceAddress.city].filter(Boolean).join(' ')}
              </p>
              {invoiceAddress.country ? <p>{getCountryName(invoiceAddress.country!)}</p> : null}
              {invoiceAddress.email ? (
                <p className="propeller-cart-overview__address-email text-muted-foreground">{invoiceAddress.email}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="propeller-cart-overview__address space-y-2" data-address="delivery">
          <h3 className="propeller-cart-overview__address-title text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {getLabel(props.labels, 'deliveryAddress', 'Delivery Address')}
          </h3>
          {deliveryAddress && deliveryAddress.street ? (
            <div className="text-sm space-y-1">
              {deliveryAddress.company ? (
                <p className="font-medium">{deliveryAddress.company}</p>
              ) : null}
              <p>
                {[
                  deliveryAddress.firstName,
                  deliveryAddress.middleName,
                  deliveryAddress.lastName,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              <p>
                {[
                  deliveryAddress.street,
                  deliveryAddress.number,
                  deliveryAddress.numberExtension,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </p>
              <p>
                {[deliveryAddress.postalCode, deliveryAddress.city].filter(Boolean).join(' ')}
              </p>
              {deliveryAddress.country ? <p>{getCountryName(deliveryAddress.country!)}</p> : null}
              {deliveryAddress.email ? (
                <p className="propeller-cart-overview__address-email text-muted-foreground">{deliveryAddress.email}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="propeller-cart-overview__info-panel bg-surface-hover p-4 rounded-control border border-border space-y-2 text-sm">
        {paymentMethod ? (
          <div className="flex justify-between">
            <span className="font-medium">{getLabel(props.labels, 'payment', 'Payment:')}</span>
            <span>{paymentMethod}</span>
          </div>
        ) : null}
        {carrierName ? (
          <div className="flex justify-between">
            <span className="font-medium">{getLabel(props.labels, 'carrier', 'Carrier:')}</span>
            <span>{carrierName}</span>
          </div>
        ) : null}
        {requestDate() ? (
          <div className="flex justify-between">
            <span className="font-medium">{getLabel(props.labels, 'deliveryDate', 'Delivery Date:')}</span>
            <span>{requestDate()}</span>
          </div>
        ) : null}
      </div>
      <div className="space-y-4 mt-6">
        {showReference ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {getLabel(props.labels, 'referenceLabel', 'Reference (Optional)')}
            </label>
            <input
              type="text"
              className="propeller-cart-overview__input flex w-full rounded-control border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-foreground-subtle focus:outline-none focus:ring-1 focus:ring-secondary"
              value={reference}
              onChange={(event) => setReference(event.target.value.slice(0, 255))}
              placeholder={getLabel(props.labels, 'referencePlaceholder', 'Your reference number')}
              maxLength={255}
            />
          </div>
        ) : null}
        {showNotes ? (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {getLabel(props.labels, 'notesLabel', 'Order Notes (Optional)')}
            </label>
            <textarea
              className="propeller-cart-overview__textarea flex w-full rounded-control border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-foreground-subtle focus:outline-none focus:ring-1 focus:ring-secondary min-h-[80px]"
              value={notes}
              onChange={(event) => setNotes(event.target.value.slice(0, 255))}
              placeholder={getLabel(props.labels, 'notesPlaceholder', 'Special instructions or comments')}
              maxLength={255}
            />
          </div>
        ) : null}
        {showTermsAndConditions ? (
          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="cart-overview-terms"
              className="propeller-cart-overview__checkbox h-4 w-4 rounded border-input text-primary focus:ring-primary"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
            />
            <label htmlFor="cart-overview-terms" className="text-sm leading-none">
              {(() => {
                // Full sentence with a {link} placeholder so the translation owns
                // the wording AND the spacing around the link. The old
                // prefix+anchor concat produced "de<a>…" (no space) and locked in
                // English word order. Split around {link}; the anchor sits in its
                // place. Fallback keeps a trailing space before the link.
                const tpl = getLabel(props.labels, 'termsConsent', 'I agree to the {link}');
                const [before, after = ''] = tpl.split('{link}');
                return (
                  <>
                    {before}
                    <a
                      href="#"
                      className="text-primary hover:underline font-medium"
                      onClick={handleTermsLinkClick}
                    >
                      {getLabel(props.labels, 'termsLink', 'Terms and Conditions')}
                    </a>
                    {after}
                  </>
                );
              })()}
            </label>
          </div>
        ) : null}
        {showPurchaseButton ? (
          <button
            type="button"
            className="propeller-cart-overview__submit flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground text-center py-3 rounded-container hover:bg-primary/80 transition font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            onClick={handlePurchaseClick}
            disabled={isPurchaseDisabled}
          >
            {loading ? (
              <div className="propeller-cart-overview__spinner w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : null}
            {loading ? <>{getLabel(props.labels, 'processing', 'Processing...')}</> : null}
            {!loading ? <>{getLabel(props.labels, 'purchaseButton', 'Place Order')}</> : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default CartOverview;
