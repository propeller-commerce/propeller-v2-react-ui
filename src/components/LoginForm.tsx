'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState } from 'react';
import {
  Cart,
  Contact,
  Customer,
  GraphQLClient,
  MediaImageProductSearchInput,
  TransformationsInput,
} from '@propeller-commerce/propeller-sdk-v2';
import { useAuth } from '../composables/react/useAuth';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';

export interface LoginFormProps {
  /**
   * GraphQL client for self-contained login.
   * When provided (and onLoginSubmit is not), the component handles
   * authentication internally via LoginService + UserService.
   */
  graphqlClient?: GraphQLClient;

  /** Title of the login form
   * @default "Log in"
   */
  title?: string;

  /** Subtitle of the login form
   * @default ""
   */
  subtitle?: string;

  /** Show/hide the password reset link
   * @default true
   */
  displayForgotPasswordLink?: boolean;

  /** Action for the password reset link click */
  onForgotPasswordClick?: (event?: React.MouseEvent) => void;

  /** Show/hide the registration link
   * @default true
   */
  displayRegisterLink?: boolean;

  /** Action for the registration link click */
  onRegisterClick?: (event?: React.MouseEvent) => void;

  /** Show/hide the guest checkout link
   * @default true
   */
  displayGuestCheckoutLink?: boolean;

  /** Action for the guest checkout link click */
  onGuestCheckoutClick?: (event?: React.MouseEvent) => void;

  /** Label for the submit button
   * @default "Login"
   */
  buttonText?: string;

  /**
   * Labels for the login form fields.
   *
   * Available keys:
   * - email: Email field label (default: "Email")
   * - password: Password field label (default: "Password")
   * - emailPlaceholder: Email input placeholder (default: "name@example.com")
   * - passwordPlaceholder: Password input placeholder (default: "••••••••")
   * - forgotPassword: Forgot password link text (default: "Forgot password?")
   * - registerText: Text before register link (default: "Don't have an account?")
   * - registerLink: Register link text (default: "Create an Account")
   * - guestCheckoutLink: Guest checkout link text (default: "Continue as Guest")
   */
  labels?: Record<string, string>;

  /**
   * Fires when login form is submitted (delegation mode).
   * When provided, the component does NOT call the SDK — the parent handles authentication.
   * When absent and graphqlClient is provided, the component handles login internally.
   */
  onLoginSubmit?: (email: string, password: string) => void;

  /** Whether login is currently in progress (shows loading state on button).
   * Used in delegation mode. Ignored in self-contained mode.
   * @default false
   */
  loginLoading?: boolean;

  /** Error message to display in the form.
   * Used in delegation mode. In self-contained mode the component manages its own error.
   */
  loginError?: string;

  /** Callback before the login process starts */
  beforeLogin?: () => void;

  /** Callback after successful login with user data.
   * `anonymousCart` is the cart held in the parent's state at the moment of submission,
   * forwarded so the parent can merge it into the authenticated user's cart.
   */
  afterLogin?: (
    user: Contact | Customer,
    accessToken?: string,
    refreshToken?: string,
    expiresAt?: string,
    anonymousCart?: Cart | null
  ) => void;

  /** Anonymous cart snapshot from the parent's state — forwarded to `afterLogin`. */
  cart?: Cart | null;

  /**
   * Show login form in dropdown for immediate login when user is not logged in.
   * @default true
   */
  accountHeaderLoginForm?: boolean;

  /** Config object providing imageSearchFiltersGrid and imageVariantFiltersSmall. */
  configuration?: {
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
  };

  /** Compound mode opt-in. When provided, LoginForm renders the compound
   *  subtree (using <LoginForm.X> subcomponents) instead of the default
   *  layout. Subcomponents share form state via context. */
  children?: React.ReactNode;
}

interface LoginFormContextValue {
  resolved: LoginFormProps;
  form: {
    email: string;
    password: string;
    isLoading: boolean;
    error: string;
    onEmailChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
  };
}

const LoginFormContext = React.createContext<LoginFormContextValue | null>(null);

function useLoginFormContext(): LoginFormContextValue {
  const ctx = React.useContext(LoginFormContext);
  if (!ctx) {
    throw new Error(
      'LoginForm compound subcomponents must be rendered inside <LoginForm>.',
    );
  }
  return ctx;
}

/**
 * Renders an email/password login form supporting both self-contained mode
 * (handles authentication internally) and delegation mode (parent handles it).
 *
 * @remarks Uses {@link useAuth} for self-contained authentication.
 */
function LoginForm(rawProps: LoginFormProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { loading, error: authError, login } = useAuth({
    graphqlClient: props.graphqlClient as GraphQLClient,
    // Resolved from <PropellerDepsProvider> by useInfraProps (the app's full
    // `config`), so the login viewer requests the configured track attributes +
    // pagination inputs (companyTrackAttributes → MY_INSTALLATIONS,
    // contactCompaniesSearchInput, contactPAConfigInput). Without this the header
    // login returns a viewer with no companies/attributes until a later refresh.
    configuration: props.configuration,
  });

  // Labels / flags resolved once (previously each was a one-line function
  // redefined every render and called from the JSX).
  const emailLabel = getLabel(props.labels, 'email', 'Email');
  const passwordLabel = getLabel(props.labels, 'password', 'Password');
  const emailPlaceholder = getLabel(props.labels, 'emailPlaceholder', 'name@example.com');
  const passwordPlaceholder = getLabel(props.labels, 'passwordPlaceholder', '••••••••');
  const forgotPasswordText = getLabel(props.labels, 'forgotPassword', 'Forgot password?');
  const registerText = getLabel(props.labels, 'registerText', "Don't have an account?");
  const registerLinkText = getLabel(props.labels, 'registerLink', 'Create an Account');
  const guestCheckoutLinkText = getLabel(props.labels, 'guestCheckoutLink', 'Continue as Guest');
  const resolvedTitle = props.title !== undefined ? props.title : 'Log in';
  const resolvedButtonText = props.buttonText || 'Login';
  const showForgotPassword = props.displayForgotPasswordLink !== false;
  const showRegister = props.displayRegisterLink !== false;
  const showGuestCheckout = props.displayGuestCheckoutLink !== false;

  const isLoading = props.onLoginSubmit ? props.loginLoading === true : loading;

  // Surface a friendly fixed message for any login failure — server-side error
  // strings can be cryptic ("HTTP 401", GraphQL "Unauthorized", etc.) and
  // aren't safe to show to end users. Override via `labels.invalidCredentials`.
  const rawError = props.onLoginSubmit ? props.loginError : authError;
  const errorMessage = rawError
    ? getLabel(
        props.labels,
        'invalidCredentials',
        "The credentials you entered don't match our records. Please try again.",
      )
    : '';

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (props.beforeLogin) {
      props.beforeLogin();
    }
    if (props.onLoginSubmit) {
      // Delegation mode: parent handles authentication
      props.onLoginSubmit(email, password);
      return;
    }

    // Self-contained mode: handle login via composable
    if (!props.graphqlClient) {
      return;
    }
    if (loading) return;

    const result = await login(email, password);
    if (result.ok && result.data.user) {
      setEmail('');
      setPassword('');
      if (props.afterLogin) {
        props.afterLogin(
          result.data.user as Contact | Customer,
          result.data.accessToken,
          result.data.refreshToken,
          result.data.expiresAt,
          props.cart ?? null,
        );
      }
    }
  }

  const contextValue: LoginFormContextValue = {
    resolved: props,
    form: {
      email,
      password,
      isLoading,
      error: errorMessage,
      onEmailChange: (value) => setEmail(value),
      onPasswordChange: (value) => setPassword(value),
      onSubmit: handleSubmit,
    },
  };

  // Compound mode: consumer composes the layout from <LoginForm.X> subcomponents.
  if (rawProps.children !== undefined) {
    return (
      <LoginFormContext.Provider value={contextValue}>
        <div
          className="propeller-login-form"
          data-loading={isLoading ? 'true' : 'false'}
          data-variant={props.accountHeaderLoginForm ? 'compact' : 'full'}
        >
          <form
            className="propeller-login-form__form space-y-4"
            onSubmit={(e) => handleSubmit(e)}
          >
            {rawProps.children}
          </form>
        </div>
      </LoginFormContext.Provider>
    );
  }

  return (
    <LoginFormContext.Provider value={contextValue}>
      <div
        className="propeller-login-form"
        data-loading={isLoading ? 'true' : 'false'}
        data-variant={props.accountHeaderLoginForm ? 'compact' : 'full'}
      >
        {resolvedTitle ? (
          <div className="propeller-login-form__header space-y-1 text-center mb-6">
            <h2 className="propeller-login-form__title text-2xl font-bold">{resolvedTitle}</h2>
            {props.subtitle ? (
              <p className="propeller-login-form__subtitle text-sm text-muted-foreground">
                {props.subtitle}
              </p>
            ) : null}
          </div>
        ) : null}
        <form className="propeller-login-form__form space-y-4" onSubmit={(e) => handleSubmit(e)}>
          <LoginFormEmailField />
          <LoginFormPasswordField />
          <LoginFormErrorMessage />
          <LoginFormSubmitButton />
        </form>
        {(showRegister || showGuestCheckout) && !props.accountHeaderLoginForm ? (
          <div className="propeller-login-form__footer mt-6 border-t border-border pt-6 space-y-3">
            <LoginFormRegisterLink />
            <LoginFormGuestCheckoutButton />
          </div>
        ) : null}
        {props.accountHeaderLoginForm ? (
          <div className="propeller-login-form__footer flex flex-col gap-2 text-sm pt-3 text-center">
            <LoginFormForgotPasswordLink />
            <div className="propeller-login-form__register text-xs text-muted-foreground">
              {(() => {
                // Full prompt with a {link} placeholder so the translation owns
                // the wording AND the spacing around the register link. The old
                // "{noAccount}<LoginFormRegisterLink/>" concat produced
                // "…account?Create an Account" (no space). Fallback puts a
                // trailing space before the link.
                const tpl = getLabel(props.labels, 'noAccount', "Don't have an account? {link}");
                const [before, after = ''] = tpl.split('{link}');
                return (
                  <>
                    {before}
                    <LoginFormRegisterLink />
                    {after}
                  </>
                );
              })()}
            </div>
          </div>
        ) : null}
      </div>
    </LoginFormContext.Provider>
  );
}

function LoginFormEmailField(_props: { className?: string } = {}) {
  const { resolved, form } = useLoginFormContext();
  const emailLabel = getLabel(resolved.labels, 'email', 'Email');
  const emailPlaceholder = getLabel(
    resolved.labels,
    'emailPlaceholder',
    'name@example.com',
  );
  return (
    <div className={_props.className ?? 'propeller-login-form__field space-y-2'}>
      <label
        htmlFor="login-email"
        className="propeller-login-form__label text-sm font-medium leading-none"
      >
        {emailLabel}
      </label>
      <input
        type="email"
        id="login-email"
        name="email"
        className="propeller-login-form__input flex h-10 w-full rounded-control border border-input bg-card px-3 py-2 text-sm placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
        value={form.email}
        onChange={(e) => form.onEmailChange(e.target.value)}
        placeholder={emailPlaceholder}
        required
        disabled={form.isLoading}
      />
    </div>
  );
}

function LoginFormPasswordField(_props: {
  className?: string;
  showInlineForgotPassword?: boolean;
} = {}) {
  const { resolved, form } = useLoginFormContext();
  const passwordLabel = getLabel(resolved.labels, 'password', 'Password');
  const passwordPlaceholder = getLabel(
    resolved.labels,
    'passwordPlaceholder',
    '••••••••',
  );
  const showForgotPassword = resolved.displayForgotPasswordLink !== false;
  // Preserves the existing inline placement when no override is given.
  const showInline =
    _props.showInlineForgotPassword !== undefined
      ? _props.showInlineForgotPassword
      : showForgotPassword && !resolved.accountHeaderLoginForm;
  return (
    <div className={_props.className ?? 'propeller-login-form__field space-y-2'}>
      <div className="flex items-center justify-between">
        <label
          htmlFor="login-password"
          className="propeller-login-form__label text-sm font-medium leading-none"
        >
          {passwordLabel}
        </label>
        {showInline ? <LoginFormForgotPasswordLink /> : null}
      </div>
      <input
        type="password"
        id="login-password"
        name="password"
        className="propeller-login-form__input flex h-10 w-full rounded-control border border-input bg-card px-3 py-2 text-sm placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
        value={form.password}
        onChange={(e) => form.onPasswordChange(e.target.value)}
        placeholder={passwordPlaceholder}
        required
        disabled={form.isLoading}
      />
    </div>
  );
}

function LoginFormSubmitButton(_props: { className?: string } = {}) {
  const { resolved, form } = useLoginFormContext();
  const resolvedButtonText = resolved.buttonText || 'Login';
  return (
    <button
      type="submit"
      className={
        _props.className ??
        'propeller-login-form__submit inline-flex items-center justify-center w-full h-10 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-control hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
      }
      disabled={form.isLoading}
    >
      {form.isLoading ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="propeller-login-form__spinner animate-spin -ml-1 mr-2 h-4 w-4 text-primary-foreground"
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
      {form.isLoading ? (
        <>{getLabel(resolved.labels, 'loggingIn', 'Logging in...')}</>
      ) : (
        <>{resolvedButtonText}</>
      )}
    </button>
  );
}

function LoginFormForgotPasswordLink(_props: { className?: string } = {}) {
  const { resolved } = useLoginFormContext();
  if (resolved.displayForgotPasswordLink === false) return null;
  // Two visual variants: compact (header dropdown) and full (inline label row).
  const isCompact = !!resolved.accountHeaderLoginForm;
  const className =
    _props.className ??
    (isCompact
      ? 'propeller-login-form__forgot-link text-secondary hover:underline text-xs'
      : 'propeller-login-form__forgot-link text-sm text-primary hover:underline');
  const text = isCompact
    ? getLabel(resolved.labels, 'forgotPassword', 'Forgot Password?')
    : getLabel(resolved.labels, 'forgotPassword', 'Forgot password?');
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (resolved.onForgotPasswordClick) resolved.onForgotPasswordClick();
      }}
    >
      {text}
    </button>
  );
}

function LoginFormRegisterLink(_props: { className?: string } = {}) {
  const { resolved } = useLoginFormContext();
  if (resolved.displayRegisterLink === false) return null;
  const isCompact = !!resolved.accountHeaderLoginForm;
  if (isCompact) {
    return (
      <button
        type="button"
        className={
          _props.className ??
          'propeller-login-form__register-btn text-secondary hover:underline font-medium'
        }
        onClick={() => {
          if (resolved.onRegisterClick) resolved.onRegisterClick();
        }}
      >
        {getLabel(resolved.labels, 'registerLink', 'Register')}
      </button>
    );
  }
  const registerText = getLabel(
    resolved.labels,
    'registerText',
    "Don't have an account?",
  );
  const registerLinkText = getLabel(
    resolved.labels,
    'registerLink',
    'Create an Account',
  );
  return (
    <div className={_props.className ?? 'propeller-login-form__register text-center'}>
      <p className="propeller-login-form__register-prompt text-sm text-muted-foreground mb-2">
        {registerText}
      </p>
      <button
        type="button"
        className="propeller-login-form__register-btn inline-flex items-center justify-center w-full h-10 px-4 py-2 text-sm font-medium border border-border rounded-control hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        onClick={() => {
          if (resolved.onRegisterClick) resolved.onRegisterClick();
        }}
      >
        {registerLinkText}
      </button>
    </div>
  );
}

function LoginFormGuestCheckoutButton(_props: { className?: string } = {}) {
  const { resolved } = useLoginFormContext();
  if (resolved.displayGuestCheckoutLink === false) return null;
  // Compact mode historically omits the guest-checkout link; preserve that.
  if (resolved.accountHeaderLoginForm) return null;
  const guestCheckoutLinkText = getLabel(
    resolved.labels,
    'guestCheckoutLink',
    'Continue as Guest',
  );
  return (
    <div className={_props.className ?? 'propeller-login-form__guest text-center'}>
      <button
        type="button"
        className="propeller-login-form__guest-btn text-sm text-primary hover:underline"
        onClick={() => {
          if (resolved.onGuestCheckoutClick) resolved.onGuestCheckoutClick();
        }}
      >
        {guestCheckoutLinkText}
      </button>
    </div>
  );
}

function LoginFormErrorMessage(_props: { className?: string } = {}) {
  const { form } = useLoginFormContext();
  if (!form.error) return null;
  return (
    <div
      className={
        _props.className ??
        'propeller-login-form__error text-sm text-destructive bg-destructive/10 p-3 rounded-control'
      }
    >
      {form.error}
    </div>
  );
}

type LoginFormComponent = typeof LoginForm & {
  EmailField: typeof LoginFormEmailField;
  PasswordField: typeof LoginFormPasswordField;
  SubmitButton: typeof LoginFormSubmitButton;
  ForgotPasswordLink: typeof LoginFormForgotPasswordLink;
  RegisterLink: typeof LoginFormRegisterLink;
  GuestCheckoutButton: typeof LoginFormGuestCheckoutButton;
  ErrorMessage: typeof LoginFormErrorMessage;
};

const LoginFormExport = LoginForm as LoginFormComponent;
LoginFormExport.EmailField = LoginFormEmailField;
LoginFormExport.PasswordField = LoginFormPasswordField;
LoginFormExport.SubmitButton = LoginFormSubmitButton;
LoginFormExport.ForgotPasswordLink = LoginFormForgotPasswordLink;
LoginFormExport.RegisterLink = LoginFormRegisterLink;
LoginFormExport.GuestCheckoutButton = LoginFormGuestCheckoutButton;
LoginFormExport.ErrorMessage = LoginFormErrorMessage;

export default LoginFormExport;
