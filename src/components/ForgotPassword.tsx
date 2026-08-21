'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import { GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';
import { useAuth } from '../composables/react/useAuth';
import { useInfraProps } from '../composables/react/useInfraProps';

export interface ForgotPasswordProps {
  /** GraphQL client for the Propeller SDK. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** Title of the forgot password form
   * @default "Forgot password?"
   */
  title?: string;

  /** Subtitle of the forgot password form
   * @default ""
   */
  subtitle?: string;

  /** Label for the submit button
   * @default "Reset"
   */
  buttonText?: string;

  /** Message displayed after successful submission
   * @default "If an account exists with this email, you will receive a password reset link shortly."
   */
  responseMessage?: string;

  /**
   * Labels for the forgot password form fields.
   *
   * Available keys:
   * - email: Email field label (default: "Email")
   * - emailPlaceholder: Email input placeholder (default: "name@example.com")
   */
  labels?: Record<string, string>;

  /** Callback before the forgot password process starts */
  beforeForgotPassword?: () => void;

  /** Callback after the user has requested a password reset */
  afterForgotPassword?: (result: boolean) => void;
}

/**
 * Forgot-password form: collects an email address, requests a reset link and
 * shows a confirmation message.
 *
 * @remarks Uses {@link useAuth} for the forgot-password request.
 */
function ForgotPassword(rawProps: ForgotPasswordProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { loading, error, forgotPassword } = useAuth({
    graphqlClient: props.graphqlClient!,
  });

  // Surface a friendly fixed message for any forgot-password failure — server
  // errors can be cryptic (HTTP 4xx / GraphQL "Unauthorized" / etc.) and aren't
  // safe to show to end users. Override via `labels.emailNotFound` if needed.
  function errorMessage(): string {
    if (!error) return '';
    return (
      props.labels?.emailNotFound ||
      "We couldn't find an account with that email address. Please double-check and try again. If you don't receive an email within a few minutes, please check that you entered the correct email address and try again."
    );
  }

  function resolvedTitle(): string {
    return props.title !== undefined ? props.title : 'Forgot password?';
  }
  function resolvedButtonText(): string {
    return props.buttonText || 'Reset';
  }
  function resolvedResponseMessage(): string {
    return (
      props.responseMessage ||
      'If an account exists with this email, you will receive a password reset link shortly.'
    );
  }
  function emailLabel(): string {
    return props.labels?.email || 'Email';
  }
  function emailPlaceholder(): string {
    return props.labels?.emailPlaceholder || 'name@example.com';
  }
  async function handleSubmit(e: any): Promise<void> {
    e.preventDefault();
    if (loading) return;
    if (props.beforeForgotPassword) {
      props.beforeForgotPassword();
    }
    const result = await forgotPassword(email);
    if (result.ok) {
      setSubmitted(true);
      if (props.afterForgotPassword) {
        props.afterForgotPassword(true);
      }
    } else {
      if (props.afterForgotPassword) {
        props.afterForgotPassword(false);
      }
    }
  }
  return (
    <div className="propeller-forgot-password" data-loading={loading ? 'true' : 'false'} data-submitted={submitted ? 'true' : 'false'}>
      {resolvedTitle() ? (
        <div className="propeller-forgot-password__header space-y-1 text-center mb-6">
          <h2 className="propeller-forgot-password__title text-2xl font-bold">{resolvedTitle()}</h2>
          {props.subtitle ? <p className="propeller-forgot-password__subtitle text-sm text-muted-foreground">{props.subtitle}</p> : null}
        </div>
      ) : null}
      {!submitted ? (
        <form className="propeller-forgot-password__form space-y-4" onSubmit={(e) => handleSubmit(e)}>
          <div className="propeller-forgot-password__field space-y-2">
            <label htmlFor="forgot-password-email" className="propeller-forgot-password__label text-sm font-medium leading-none">
              {emailLabel()}
            </label>
            <input
              type="email"
              id="forgot-password-email"
              name="email"
              className="propeller-forgot-password__input flex h-10 w-full rounded-control border border-input bg-card px-3 py-2 text-sm placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              value={email}
              onChange={(e) => {
                setEmail((e.target as HTMLInputElement).value);
              }}
              placeholder={emailPlaceholder()}
              required
              disabled={loading}
            />
          </div>
          {errorMessage() ? (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-control">
              {errorMessage()}
            </div>
          ) : null}
          <button
            type="submit"
            className="propeller-forgot-password__submit inline-flex items-center justify-center w-full h-10 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-control hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                className="propeller-forgot-password__spinner animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="opacity-25"
                />
                <path
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  className="opacity-75"
                />
              </svg>
            ) : null}
            {loading ? <>{props.labels?.sending || 'Sending...'}</> : <>{resolvedButtonText()}</>}
          </button>
        </form>
      ) : null}
      {submitted ? (
        <div className="propeller-forgot-password__success text-center space-y-4">
          <div className="flex justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              className="propeller-forgot-password__success-icon h-12 w-12 text-success"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="propeller-forgot-password__success-message text-sm text-muted-foreground">{resolvedResponseMessage()}</p>
        </div>
      ) : null}
    </div>
  );
}

export default ForgotPassword;
