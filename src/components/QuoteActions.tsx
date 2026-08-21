'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import { Order, GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';
import { useOrders } from '../composables/react/useOrders';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';

export interface QuoteActionsProps {
  /** GraphQL client for the Propeller SDK */
  graphqlClient?: GraphQLClient;

  /** The quotation for which the actions will take place */
  quote: Order;

  /** Labels used in the quote actions component */
  labels?: Record<string, string>;

  /** Action function triggered when the "Accept quotation" button is clicked.
   *  If not provided, the base implementation calls setOrderStatus on the SDK. */
  onAccept?: (quote: Order) => void;

  /** Action function triggered after the quote is accepted. Usually for navigating towards the thank you page. */
  afterAccept?: (quote: Order) => void;

  /** Show the terms and conditions acceptance */
  showTermsAndConditions?: boolean;

  /** Action when the "Terms and conditions" link is clicked */
  onTermsAndConditionsClick?: () => void;
}

/**
 * Renders the accept-quotation action for a quote, with optional terms-and-
 * conditions consent and an expired-quote notice.
 *
 * @remarks Uses {@link useOrders} to set the quote status on acceptance.
 */
function QuoteActions(rawProps: QuoteActionsProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const { setQuoteStatus } = useOrders({
    graphqlClient: props.graphqlClient!,
    user: null,
  });

  function showTermsAndConditions(): boolean {
    return props.showTermsAndConditions !== undefined ? props.showTermsAndConditions : true;
  }

  function isExpired(): boolean {
    const validUntil = (props.quote as any)?.validUntil;
    if (!validUntil) return false;
    const validUntilDate = new Date(validUntil);
    if (Number.isNaN(validUntilDate.getTime())) return false;
    return validUntilDate.getTime() < Date.now();
  }

  function isAcceptDisabled(): boolean {
    if (showTermsAndConditions() && !termsAccepted) return true;
    if (loading) return true;
    return false;
  }

  

  function handleTermsChange(checked: boolean) {
    setTermsAccepted(checked);
  }

  function handleTermsLinkClick(event: Event) {
    event.preventDefault();
    if (props.onTermsAndConditionsClick) {
      props.onTermsAndConditionsClick();
    }
  }

  async function handleAcceptClick() {
    if (isAcceptDisabled()) return;
    setLoading(true);
    try {
      if (props.onAccept) {
        props.onAccept(props.quote);
      } else if (props.graphqlClient && props.quote?.id) {
        await setQuoteStatus(props.quote.id, { status: 'NEW' });
      }
      if (props.afterAccept) {
        props.afterAccept(props.quote);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="quote-actions space-y-4">
      {isExpired() ? (
        <div className="propeller-quote-actions__expired text-sm text-muted-foreground bg-surface-hover/50 border border-border rounded-container p-3">
          {getLabel(props.labels, 'expiredMessage', 'This quote has expired.')}
        </div>
      ) : (
        <>
          {showTermsAndConditions() ? (
            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="quote-actions-terms"
                className="propeller-quote-actions__checkbox h-4 w-4 rounded border-input text-primary focus:ring-primary"
                checked={termsAccepted}
                onChange={(event) => handleTermsChange(event.target.checked)}
              />
              <label htmlFor="quote-actions-terms" className="text-sm leading-none">
                {(() => {
                  // Full sentence with a {link} placeholder — see CartOverview.
                  const tpl = getLabel(props.labels, 'termsConsent', 'I agree to the {link}');
                  const [before, after = ''] = tpl.split('{link}');
                  return (
                    <>
                      {before}
                      <a
                        href="#"
                        className="text-primary hover:underline font-medium"
                        onClick={(event) => handleTermsLinkClick(event as unknown as Event)}
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
          <button
            type="button"
            className="propeller-quote-actions__submit flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground text-center py-3 rounded-container hover:bg-primary/80 transition font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            onClick={(event) => handleAcceptClick()}
            disabled={isAcceptDisabled()}
          >
            {loading ? (
              <div className="propeller-quote-actions__spinner w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : null}
            {loading ? <>{getLabel(props.labels, 'processing', 'Processing...')}</> : null}
            {!loading ? <>{getLabel(props.labels, 'acceptButton', 'Accept Quotation')}</> : null}
          </button>
        </>
      )}
    </div>
  );
}

export default QuoteActions;
