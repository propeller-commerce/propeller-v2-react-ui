'use client';
/**
 * @rsc-blocked — Client-only component: browser-only APIs (window/document/storage).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { useInfraProps } from '../composables/react/useInfraProps';
import { Cart, Contact, Customer, GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';
import DefaultLoginFormImpl from './LoginForm';
import type { LoginFormProps } from './LoginForm';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface AccountMenuLink {
  /** Display label for the link */
  label: string;
  /** URL path for the link */
  href: string;
  /** Optional icon name */
  icon?: string;
}
export interface AccountIconAndMenuProps {
  /**
   * Contact/Customer that this component will operate with.
   * When present, shows account navigation. When null, shows login form.
   */
  user?: Contact | Customer | null;

  /**
   * Icon for the account icon in header.
   * @default 'default-account-icon'
   */
  icon?: string;

  /**
   * Show account dropdown at the bottom of the icon when account icon is clicked.
   * If false, fires onAccountIconClick() instead.
   * @default true
   */
  showAccountMenuOnClick?: boolean;

  /**
   * Title for the account dropdown menu.
   * @default 'My account'
   */
  accountMenuTitle?: string;

  /**
   * Show login form in dropdown for immediate login when user is not logged in.
   * @default true
   */
  accountHeaderLoginForm?: boolean;

  // ── LoginForm pass-through props ────────────────────────────────────────

  /**
   * GraphQL client for self-contained login.
   * When provided (and onLoginSubmit is not), LoginForm handles authentication internally.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Title displayed inside the login form.
   * @default 'Welcome Back'
   */
  loginFormTitle?: string;

  /** Subtitle displayed inside the login form. */
  loginFormSubtitle?: string;

  /**
   * Label for the login submit button.
   * @default 'Log In'
   */
  loginButtonText?: string;

  /**
   * Show/hide the forgot password link inside the login form.
   * @default true
   */
  displayForgotPasswordLink?: boolean;

  /**
   * Show/hide the register link inside the login form.
   * @default true
   */
  displayRegisterLink?: boolean;

  /**
   * Show/hide the guest checkout link inside the login form.
   * @default false
   */
  displayGuestCheckoutLink?: boolean;

  /** Fires when the guest checkout link is clicked. */
  onGuestCheckoutClick?: () => void;

  /**
   * Error message shown inside the login form.
   * Used in delegation mode (when onLoginSubmit is provided).
   */
  loginError?: string;

  /** Callback fired before the login process starts. */
  beforeLogin?: () => void;

  /**
   * Callback fired after successful self-contained login.
   * Not called in delegation mode — the parent handles the result there.
   */
  afterLogin?: (
    user: Contact | Customer,
    accessToken?: string,
    refreshToken?: string,
    expiresAt?: string,
    anonymousCart?: Cart | null
  ) => void;

  /** Anonymous cart snapshot — forwarded to the embedded `LoginForm` so its `afterLogin` receives it. */
  cart?: Cart | null;

  // ── Existing callbacks ──────────────────────────────────────────────────

  /**
   * Fires when login form is submitted (delegation mode).
   * Parent should handle actual authentication.
   */
  onLoginSubmit?: (email: string, password: string) => void;

  /**
   * Fires when account icon is clicked and showAccountMenuOnClick is false.
   */
  onAccountIconClick?: () => void;

  /**
   * Fires when a menu item is clicked. Receives the href.
   */
  onMenuItemClick?: (href: string) => void;

  /**
   * Fires when logout is clicked.
   */
  onLogoutClick?: () => void;

  /**
   * Fires when "Forgot Password" link is clicked.
   */
  onForgotPasswordClick?: () => void;

  /**
   * Fires when "Register" link is clicked.
   */
  onRegisterClick?: () => void;

  /**
   * Whether login is currently in progress (shows loading state on button).
   * @default false
   */
  loginLoading?: boolean;

  /**
   * Account navigation links shown when user is authenticated.
   * @default [{ label: 'Dashboard', href: '/account' }, ...]
   */
  menuLinks?: AccountMenuLink[];

  /**
   * Labels for the component.
   * Available keys: accountLabel, loginTitle, loginSubtitle, loginButton, signedInAs, logoutLabel.
   */
  labels?: Record<string, string>;

  /** Translated labels forwarded to the embedded `<LoginForm>` shown
   * in the dropdown when no user is signed in.
   * See `LoginFormProps.labels` for slugs (email, password, forgotPassword,
   * registerText, registerLink, noAccount, loggingIn, etc.). */
  loginFormLabels?: Record<string, string>;

  /** Additional class name for the account icon button. */
  iconClassName?: string;

  /** Additional class name for the dropdown menu. */
  menuClassName?: string;

  /**
   * Component variant.
   * - 'dropdown' (default): Header icon with popup menu
   * - 'sidebar': Always-visible vertical navigation for account layout
   */
  variant?: 'dropdown' | 'sidebar';

  /**
   * Current route path, used in sidebar variant to highlight the active link.
   */
  currentPath?: string;

  // ───── Extension API ─────
  // Replaces the embedded <LoginForm> when the consumer is signed out.
  // Receives the same labels/callbacks the default LoginForm would.
  loginFormComponent?: React.ComponentType<LoginFormProps>;
}
/**
 * Header account control: renders an account icon with a dropdown menu (or an
 * always-visible sidebar). Shows account navigation and logout when a user is
 * present, otherwise an embedded {@link LoginForm} or a login call-to-action.
 *
 * @remarks Resolves infra props from `<PropellerProvider>` via `useInfraProps`.
 */
function AccountIconAndMenu(rawProps: AccountIconAndMenuProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const LoginFormImpl = props.loginFormComponent ?? DefaultLoginFormImpl;
  const [menuOpen, setMenuOpen] = useState(() => false);
  function isSidebar() {
    return props.variant === 'sidebar';
  }
  function getUserName() {
    const user = props.user as Contact | Customer;
    if (!user) return '';
    const parts = [user.firstName, user.lastName].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
    if (user.firstName) return user.firstName;
    if (user.email) return user.email;
    return 'User';
  }
  function getMenuTitle() {
    return (
      props.accountMenuTitle ||
      (props.labels as Record<string, string>)?.['accountMenuTitle'] ||
      'My account'
    );
  }
  function isActiveLink(href: string) {
    if (!props.currentPath) return false;
    if (href.endsWith('/account')) return props.currentPath === href;
    return props.currentPath.startsWith(href);
  }
  function getMenuLinks() {
    if (props.menuLinks && (props.menuLinks as AccountMenuLink[]).length > 0) {
      return props.menuLinks as AccountMenuLink[];
    }
    return [
      {
        label: 'Dashboard',
        href: '/account',
      },
      {
        label: 'Orders',
        href: '/account/orders',
      },
      {
        label: 'Addresses',
        href: '/account/addresses',
      },
      {
        label: 'Quotes',
        href: '/account/quotes',
      },
      {
        label: 'Invoices',
        href: '/account/invoices',
      },
      {
        label: 'Favorites',
        href: '/account/favorites',
      },
    ] as AccountMenuLink[];
  }
  function handleIconClick() {
    if (props.showAccountMenuOnClick !== false) {
      setMenuOpen(!menuOpen);
    } else {
      if (props.onAccountIconClick) props.onAccountIconClick();
    }
  }
  function handleMenuItemClick(
    href: string
  ) {
    setMenuOpen(false);
    if (props.onMenuItemClick) props.onMenuItemClick(href);
  }

  // Anchor click handler for menu links. The links are real <a href> so they
  // can be middle-clicked, opened in a new tab, and crawled. A plain left
  // click is intercepted for SPA navigation (via onMenuItemClick); modified
  // clicks (ctrl/cmd/shift/middle) fall through to the browser's native
  // new-tab / new-window behaviour.
  function handleMenuLinkClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    handleMenuItemClick(href);
  }
  function handleLogoutClick() {
    setMenuOpen(false);
    if (props.onLogoutClick) props.onLogoutClick();
  }
  function handleForgotPasswordClick() {
    setMenuOpen(false);
    if (props.onForgotPasswordClick) props.onForgotPasswordClick();
  }
  function handleRegisterClick() {
    setMenuOpen(false);
    if (props.onRegisterClick) props.onRegisterClick();
  }
  function handleGuestCheckoutClick() {
    setMenuOpen(false);
    if (props.onGuestCheckoutClick) props.onGuestCheckoutClick();
  }
  function closeMenu() {
    setMenuOpen(false);
  }
  // Click-outside-to-close. Listener is closed-over in the effect — the
  // previous code stashed it in state (setClickOutsideListener) but nothing
  // ever read that state. Also adds a cleanup so the listener detaches on
  // unmount; the previous code leaked it.
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && !target.closest('[data-account-menu]')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, []);
  // Close the open menu when the user prop changes from null to a logged-in
  // user — login dismisses the dropdown. Intentional external-state sync
  // (the user object is owned by AuthContext, not this component).
  useEffect(() => {
    if (props.user && menuOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.user]);
  return (
    <div
      className="propeller-account-menu relative"
      data-account-menu
      data-variant={isSidebar() ? 'sidebar' : 'dropdown'}
      data-authenticated={props.user ? 'true' : 'false'}
    >
      {isSidebar() ? (
        <div className="propeller-account-menu__sidebar flex flex-col">
          {!!props.user ? (
            <>
              <div className="propeller-account-menu__user px-4 py-3 border-b border-border">
                <p className="propeller-account-menu__user-label text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                  {getLabel(props.labels, 'signedInAs', 'Signed in as')}
                </p>
                <p className="propeller-account-menu__user-name font-medium text-foreground truncate">{getUserName()}</p>
              </div>
              <nav className="propeller-account-menu__nav py-2">
                <ul className="propeller-account-menu__list space-y-0.5">
                  {getMenuLinks()?.map((link) => (
                    <li key={link.href} className="propeller-account-menu__item">
                      <a
                        href={link.href}
                        onClick={(event) => handleMenuLinkClick(event, link.href)}
                        data-active={isActiveLink(link.href) ? 'true' : 'false'}
                        className={`propeller-account-menu__link flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${isActiveLink(link.href) ? 'bg-secondary/5 text-secondary border-l-2 border-secondary' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'}`}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="propeller-account-menu__logout-wrapper px-4 py-3 border-t border-border">
                <button
                  type="button"
                  className="propeller-account-menu__logout-btn flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-primary hover:bg-secondary/5 rounded-control transition-colors"
                  onClick={(event) => handleLogoutClick()}
                >
                  {getLabel(props.labels, 'logoutLabel', 'Log Out')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {!isSidebar() ? (
        <>
          <button
            type="button"
            onClick={(event) => handleIconClick()}
            aria-label={getLabel(props.labels, 'accountLabel', 'Account')}
            data-open={menuOpen ? 'true' : 'false'}
            className={cn(`propeller-account-menu__trigger inline-flex items-center gap-2 px-3 py-2 rounded-control text-sm font-medium transition-colors text-white hover:bg-white/10${props.iconClassName ? ' ' + props.iconClassName : ''}`)}
          >
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              className="propeller-account-menu__icon w-5 h-5"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
            {props.user ? (
              <span className="propeller-account-menu__greeting hidden md:block font-normal">
                {getLabel(props.labels, 'greeting', 'Hi, {name}').replace('{name}', getUserName())}
              </span>
            ) : null}
            {!props.user ? (
              <span className="propeller-account-menu__greeting hidden md:block font-normal">
                {getLabel(props.labels, 'accountLabel', 'Account')}
              </span>
            ) : null}
          </button>
          {menuOpen ? (
            <div
              className={cn(`propeller-account-menu__popover absolute right-0 mt-2 w-80 bg-popover text-foreground rounded-container shadow-lg border border-border py-4 px-5 z-50${props.menuClassName ? ' ' + props.menuClassName : ''}`)}
            >
              {!!props.user ? (
                    <>
                      <div className="propeller-account-menu__user pb-3 mb-3 border-b border-border">
                        <p className="propeller-account-menu__user-label text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                          {getLabel(props.labels, 'signedInAs', 'Signed in as')}
                        </p>
                        <p className="propeller-account-menu__user-name font-medium text-foreground truncate">{getUserName()}</p>
                      </div>
                      <nav className="propeller-account-menu__nav">
                        <ul className="propeller-account-menu__list space-y-0.5">
                          {getMenuLinks()?.map((link) => (
                            <li key={link.href} className="propeller-account-menu__item">
                              <a
                                href={link.href}
                                className="propeller-account-menu__link flex w-full items-center gap-3 px-3 py-2 text-sm font-medium rounded-control text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
                                onClick={(event) => handleMenuLinkClick(event, link.href)}
                              >
                                {link.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </nav>
                      <div className="propeller-account-menu__logout-wrapper mt-3 pt-3 border-t border-border">
                        <button
                          type="button"
                          className="propeller-account-menu__logout-btn flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-primary hover:bg-secondary/5 rounded-control transition-colors"
                          onClick={(event) => handleLogoutClick()}
                        >
                          {getLabel(props.labels, 'logoutLabel', 'Log Out')}
                        </button>
                      </div>
                    </>
                  ) : null}
                  {!props.user ? (
                    <>
                      {props.accountHeaderLoginForm !== false ? (
                        <LoginFormImpl
                          cart={props.cart}
                          title={props.loginFormTitle ?? getLabel(props.labels, 'loginTitle', 'Welcome Back')}
                          subtitle={props.loginFormSubtitle ?? getLabel(props.labels, 'loginSubtitle', '')}
                          buttonText={props.loginButtonText ?? getLabel(props.labels, 'loginButton', 'Log In')}
                          displayForgotPasswordLink={props.displayForgotPasswordLink}
                          displayRegisterLink={props.displayRegisterLink}
                          displayGuestCheckoutLink={props.displayGuestCheckoutLink}
                          labels={props.loginFormLabels}
                          onLoginSubmit={props.onLoginSubmit}
                          loginLoading={props.loginLoading}
                          loginError={props.loginError}
                          beforeLogin={props.beforeLogin}
                          afterLogin={props.afterLogin}
                          onForgotPasswordClick={(event) => handleForgotPasswordClick()}
                          onRegisterClick={(event) => handleRegisterClick()}
                          onGuestCheckoutClick={(event) => handleGuestCheckoutClick()}
                          accountHeaderLoginForm={props.accountHeaderLoginForm}
                        />
                      ) : null}
                      {props.accountHeaderLoginForm === false ? (
                        <div className="propeller-account-menu__login-cta text-center py-4">
                          <h4 className="propeller-account-menu__login-title text-lg font-semibold mb-2">{getMenuTitle()}</h4>
                          <p className="propeller-account-menu__login-subtitle text-sm text-muted-foreground mb-4">
                            {getLabel(props.labels, 'loginSubtitle', 'Login to access your account')}
                          </p>
                          <button
                            type="button"
                            className="propeller-account-menu__login-btn w-full inline-flex justify-center items-center px-4 py-2 rounded-control bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/90 transition-colors"
                            onClick={(event) => {
                              closeMenu();
                              if (props.onAccountIconClick) props.onAccountIconClick();
                            }}
                          >
                            {getLabel(props.labels, 'loginButton', 'Log In')}
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default AccountIconAndMenu;
