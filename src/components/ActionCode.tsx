'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import { GraphQLClient, Cart } from '@propeller-commerce/propeller-sdk-v2';
import { useCart } from '../composables/react/useCart';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';

export interface ActionCodeProps {
  /** GraphQL client for the Propeller SDK. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** The shopping cart used to populate the cart summary data */
  cart: Cart;

  /** Action code block title */
  title?: string;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Display the option to remove the action code of the shopping cart. Defaults to true. */
  showRemoveCode?: boolean;

  /** Action handler when action code is added to the cart */
  onActionCodeApply?: (code: string, cart: Cart) => void;

  /** Action handler when action code is removed from the cart */
  onActionCodeRemove?: (code: string, cart: Cart) => void;

  /** Action callback method after action code is applied */
  afterActionCodeApply?: (cart: Cart) => void;

  /** Action callback method after action code is removed */
  afterActionCodeRemove?: (cart: Cart) => void;

  /** Configuration object for image filters */
  configuration?: any;

  /** Language code for CartService operations. Defaults to 'NL'. */
  language?: string;
}

/**
 * Action-code (coupon) input for the shopping cart: applies or removes a
 * promotional code and surfaces a friendly error message on failure.
 *
 * @remarks Uses {@link useCart} for the apply/remove cart operations.
 */
function ActionCode(rawProps: ActionCodeProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  // --- composable ---
  const { addActionCode, removeActionCode, loading, error } = useCart({
    graphqlClient: props.graphqlClient!,
    user: null,
    cartId: props.cart?.cartId,
    configuration: props.configuration,
  });

  // --- local UI state ---
  const [code, setCode] = useState<string>(() => '');
  const [fallbackError, setFallbackError] = useState<string>(() => '');

  // --- display helpers ---

  // Surface a friendly fixed message for any action-code failure — server-side
  // error strings can be cryptic ("Code not found", GraphQL "Bad Request", etc.)
  // and aren't safe to show to end users. Override via `labels.invalidActionCode`
  // if a specific copy is needed.
  function errorMessage(): string {
    if (!error && !fallbackError) return '';
    return getLabel(
      props.labels,
      'invalidActionCode',
      'This action code is not found. Please add a valid action code.',
    );
  }
  function title(): string {
    return props.title || getLabel(props.labels, 'title', 'Action code');
  }
  function showRemoveCode(): boolean {
    return props.showRemoveCode !== undefined ? props.showRemoveCode : true;
  }
  function appliedCode(): string {
    return props.cart?.actionCode || '';
  }
  function hasAppliedCode(): boolean {
    return !!props.cart?.actionCode;
  }

  // --- actions via composable ---
  async function handleApply(): Promise<void> {
    if (!code.trim() || loading) return;
    setFallbackError('');
    if (props.onActionCodeApply) {
      props.onActionCodeApply(code.trim(), props.cart);
      setCode('');
      return;
    }
    const updatedCart = await addActionCode(code.trim());
    if (updatedCart) {
      setCode('');
      if (props.afterActionCodeApply) props.afterActionCodeApply(updatedCart);
    } else if (!error) {
      setFallbackError(getLabel(props.labels, 'errorApply', 'Failed to apply action code. Please try again.'));
    }
  }

  async function handleRemove(): Promise<void> {
    if (loading || !hasAppliedCode()) return;
    setFallbackError('');
    const currentCode = appliedCode();
    if (props.onActionCodeRemove) {
      props.onActionCodeRemove(currentCode, props.cart);
      return;
    }
    const updatedCart = await removeActionCode(currentCode);
    if (updatedCart) {
      if (props.afterActionCodeRemove) props.afterActionCodeRemove(updatedCart);
    } else if (!error) {
      setFallbackError(getLabel(props.labels, 'errorRemove', 'Failed to remove action code. Please try again.'));
    }
  }

  function handleKeyDown(e: any): void {
    if (e.key === 'Enter') {
      handleApply();
    }
  }

  return (
    <div className="propeller-action-code w-full bg-card p-6 rounded-container shadow space-y-3">
      <h2 className="text-lg font-bold">{title()}</h2>
      <>
          {hasAppliedCode() ? (
            <div className="flex items-center justify-between bg-secondary/5 border border-secondary/20 rounded-md px-3 py-2">
              <div className="flex items-center gap-2">
                <svg
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  className="w-4 h-4 text-secondary"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-secondary">{appliedCode()}</span>
              </div>
              {showRemoveCode() ? (
                <button
                  type="button"
                  className="text-secondary hover:text-secondary text-sm font-medium transition-colors disabled:opacity-50"
                  onClick={(event) => handleRemove()}
                  disabled={loading}
                >
                  {getLabel(props.labels, 'remove', 'Remove')}
                </button>
              ) : null}
            </div>
          ) : null}
          {!hasAppliedCode() ? (
            <div className="flex gap-2">
              <input
                type="text"
                className="propeller-action-code__input flex-1 text-sm border border-input rounded-control px-3 py-2 focus:ring-2 focus:ring-secondary focus:border-transparent disabled:opacity-50"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                }}
                onKeyDown={(e) => handleKeyDown(e)}
                placeholder={getLabel(props.labels, 'placeholder', 'Enter action code')}
                disabled={loading}
              />
              <button
                type="button"
                className="propeller-action-code__submit bg-secondary text-secondary-foreground text-sm font-medium px-4 py-2 rounded-control hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                onClick={(event) => handleApply()}
                disabled={loading || !code.trim()}
              >
                {loading ? <>{getLabel(props.labels, 'applying', 'Applying...')}</> : null}
                {!loading ? <>{getLabel(props.labels, 'apply', 'Apply')}</> : null}
              </button>
            </div>
          ) : null}
          {(!!error || !!fallbackError) ? <p className="propeller-action-code__error text-sm text-destructive">{errorMessage()}</p> : null}
        </>
    </div>
  );
}

export default ActionCode;
