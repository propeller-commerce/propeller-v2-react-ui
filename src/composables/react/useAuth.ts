/**
 * useAuth (React) — Login, registration, and forgot-password flows.
 *
 * Responsibilities:
 * - login: LoginService + getViewer for session token + user
 * - registerContact: createCompany → registerContact (ContactRegisterInput wrapper) → createCompanyAddress
 * - registerCustomer: registerCustomer (CustomerRegisterInput wrapper) → login → createCustomerAddress
 * - forgotPassword: UserService.sendPasswordResetEmail
 */

import { useState, useCallback } from 'react';
import { createServices, isCustomer, ok, err, type Result } from '@propeller-commerce/propeller-v2-core-ui';
import { AddressType, Gender, YesNo, MagicTokenService } from '@propeller-commerce/propeller-sdk-v2';
import type {
  GraphQLClient,
  Contact,
  Customer,
  CreateCompanyInput,
  CompanyAddressCreateInput,
  CustomerAddressCreateInput,
} from '@propeller-commerce/propeller-sdk-v2';
import type {
  ViewerInput,
  ContactRegisterInput,
  CustomerRegisterInput,
  PasswordResetInput,
  MagicToken,
  MagicTokenCreateInput,
} from '@propeller-commerce/propeller-sdk-v2';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Success payload for login / registerContact / registerCustomer.
 *
 * `user` + tokens are optional: the `autoLogin: false` branches of the
 * register flows complete server-side but deliberately drop the session,
 * yielding an `ok({})`.
 */
export interface AuthSuccess {
  /** The authenticated viewer (Contact or Customer) when resolved. */
  user?: Contact | Customer;
  /** Session JWT bearer token, when issued. */
  accessToken?: string;
  /** Refresh token, when issued. */
  refreshToken?: string;
  /** ISO timestamp at which `accessToken` expires. */
  expiresAt?: string;
}

/** Backwards-friendly alias kept for the public `UseAuth*` type re-exports. */
export type LoginResult = Result<AuthSuccess, string>;

/** Form payload for B2B (company contact) registration. */
export interface RegisterContactInput {
  /** Login email for the new contact. */
  email: string;
  /** Initial account password. */
  password: string;
  /** Contact's first name. */
  firstName: string;
  /** Contact's middle name / tussenvoegsel. */
  middleName?: string;
  /** Contact's last name. */
  lastName: string;
  /** Contact phone number. */
  phone?: string;
  /** Contact gender. */
  gender?: Gender;
  /** Company name — when present a company is created and the contact attached to it. */
  companyName?: string;
  /** Company VAT / tax number. */
  vatNumber?: string;
  /** Company Chamber-of-Commerce number. */
  cocNumber?: string;
  /** Billing address street. */
  street?: string;
  /** Billing address house number. */
  number?: string;
  /** Billing address house-number suffix. */
  numberExtension?: string;
  /** Billing address postal code. */
  postalCode?: string;
  /** Billing address city. */
  city?: string;
  /** Billing address ISO country code. */
  country?: string;
  /** Delivery address street. */
  deliveryStreet?: string;
  /** Delivery address house number. */
  deliveryNumber?: string;
  /** Delivery address house-number suffix. */
  deliveryNumberExtension?: string;
  /** Delivery address postal code. */
  deliveryPostalCode?: string;
  /** Delivery address city. */
  deliveryCity?: string;
  /** Delivery address ISO country code. */
  deliveryCountry?: string;
  /** When `true`, the billing address is copied into a delivery-typed record. */
  sameDeliveryAsBilling?: boolean;
}

/** Form payload for B2C (customer) registration. */
export interface RegisterCustomerInput {
  /** Login email for the new customer. */
  email: string;
  /** Initial account password. */
  password: string;
  /** Customer's first name. */
  firstName: string;
  /** Customer's middle name / tussenvoegsel. */
  middleName?: string;
  /** Customer's last name. */
  lastName: string;
  /** Customer phone number. */
  phone?: string;
  /** Customer gender. */
  gender?: Gender;
  /** Billing address street. */
  street?: string;
  /** Billing address house number. */
  number?: string;
  /** Billing address house-number suffix. */
  numberExtension?: string;
  /** Billing address postal code. */
  postalCode?: string;
  /** Billing address city. */
  city?: string;
  /** Billing address ISO country code. */
  country?: string;
  /** Delivery address street. */
  deliveryStreet?: string;
  /** Delivery address house number. */
  deliveryNumber?: string;
  /** Delivery address house-number suffix. */
  deliveryNumberExtension?: string;
  /** Delivery address postal code. */
  deliveryPostalCode?: string;
  /** Delivery address city. */
  deliveryCity?: string;
  /** Delivery address ISO country code. */
  deliveryCountry?: string;
  /** When `true`, the billing address is copied into a delivery-typed record. */
  sameDeliveryAsBilling?: boolean;
}

/** Options for {@link useAuth}. */
export interface UseAuthOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** Default primary language for registration / reset emails. Defaults to `'NL'`. */
  language?: string;
  /** Fires whenever the in-memory Bearer header changes — receives the token, or `''` when cleared. */
  onAuthHeaderUpdate?: (token: string) => void;
  /** Portal configuration: track-attribute names, PA config input, channelId, etc. */
  configuration?: any;
}

/** State and auth actions returned by {@link useAuth}. */
export interface UseAuthReturn {
  /** `true` while a login or registration call is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** Authenticates by email/password; pass `onLoginSubmit` to fully override the SDK login. */
  login: (
    email: string,
    password: string,
    onLoginSubmit?: (email: string, password: string) => Promise<Contact | Customer>,
  ) => Promise<Result<AuthSuccess, string>>;
  /** Passwordless login: exchanges a backend-issued magic token for a session (then loads the viewer). */
  magicLogin: (token: string) => Promise<Result<AuthSuccess, string>>;
  /** Issues a magic token for a contact/customer (authenticated); its `id` is embedded in a magic-login link. */
  createMagicToken: (input: MagicTokenCreateInput) => Promise<Result<MagicToken, string>>;
  /** Registers a B2B contact (and optionally a company + addresses); `autoLogin` keeps the session. */
  registerContact: (
    input: RegisterContactInput,
    preferredLanguage?: string,
    autoLogin?: boolean,
  ) => Promise<Result<AuthSuccess, string>>;
  /** Registers a B2C customer (and optionally addresses); `autoLogin` keeps the session. */
  registerCustomer: (
    input: RegisterCustomerInput,
    preferredLanguage?: string,
    autoLogin?: boolean,
  ) => Promise<Result<AuthSuccess, string>>;
  /** Triggers a password-reset email for the given address. */
  forgotPassword: (email: string) => Promise<Result<void, string>>;
}

// ── Composable ────────────────────────────────────────────────────────────────

/**
 * useAuth — login, registration, and forgot-password flows.
 *
 * @param options - see {@link UseAuthOptions}.
 * @returns loading/error state plus async auth actions — see {@link UseAuthReturn}.
 *
 * @remarks
 * GraphQL integration: services are built per-call via `createServices(graphqlClient)`.
 * `login` calls `services.login.login()` (`LoginService`) then `services.user.getViewer()`
 * (`UserService`) to fetch the Contact/Customer; the JWT is set as an in-memory Bearer
 * header via `graphqlClient.updateConfig()` only — never persisted (cross-reload auth
 * relies on an httpOnly cookie). `registerContact` runs `company.createCompany` →
 * `user.registerContact` → implicit `login` → `address.createCompanyAddress` →
 * `user.triggerContactSendWelcomeEmailEvent`. `registerCustomer` runs
 * `user.registerCustomer` → `login` → `address.createCustomerAddress` →
 * `user.triggerCustomerSendWelcomeEmailEvent`, re-fetching the viewer afterward.
 * When `autoLogin` is `false` the session is dropped via `clearAccessToken()`.
 * `forgotPassword` calls `user.sendPasswordResetEmail()`.
 */
/**
 * A viewer search/pagination input (contactPAConfigInput /
 * contactCompaniesSearchInput) must be a GraphQL *input object*. A truthiness
 * guard isn't enough: an empty array `[]` is truthy yet the backend rejects it
 * ("Expected type ContactPurchaseAuthorizationConfigSearchInput to be an
 * object"). Only spread genuine non-array objects so a host that configures `[]`
 * (or anything non-object) is safely omitted instead of erroring the viewer.
 */
const isViewerSearchInput = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function useAuth(options: UseAuthOptions): UseAuthReturn {
  const { graphqlClient, language = 'NL', onAuthHeaderUpdate, configuration } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (
    email: string,
    password: string,
    onLoginSubmit?: (email: string, password: string) => Promise<Contact | Customer>,
  ): Promise<Result<AuthSuccess, string>> => {
    setLoading(true);
    setError(null);
    try {
      if (onLoginSubmit) {
        const user = await onLoginSubmit(email, password);
        return ok({ user });
      }
      const loginService = createServices(graphqlClient).login;
      const loginResult = await loginService.login({ email, password });
      const session = loginResult?.session;
      const accessToken = session?.accessToken;
      const refreshToken = session?.refreshToken;
      const expiresAt = session?.expirationTime;
      if (accessToken) {
        // Set the Bearer header IN MEMORY only for the rest of this page
        // session — do NOT call graphqlClient.setAccessToken(), whose SDK
        // default resolver persists the JWT to localStorage['access_token']
        // (the XSS hole Phase 5 closed). Cross-reload auth is handled by the
        // httpOnly cookie: the caller's afterLogin POSTs the token to
        // /api/auth/session and the /api/graphql proxy injects Bearer
        // server-side from that cookie.
        const cfg = graphqlClient.getConfig();
        graphqlClient.updateConfig({
          headers: { ...cfg.headers, Authorization: `Bearer ${accessToken}` },
        });
        onAuthHeaderUpdate?.(accessToken);
      }
      const userService = createServices(graphqlClient).user;
      const viewerInput: ViewerInput = {
        ...(configuration?.contactTrackAttributes?.length && {
          contactAttributesInput: { attributeDescription: { names: configuration.contactTrackAttributes } },
        }),
        ...(configuration?.customerTrackAttributes?.length && {
          customerAttributesInput: { attributeDescription: { names: configuration.customerTrackAttributes } },
        }),
        ...(configuration?.companyTrackAttributes?.length && {
          companyAttributesInput: { attributeDescription: { names: configuration.companyTrackAttributes } },
        }),
        // Contact-scoped pagination inputs — only when the host supplies a real
        // input object (an empty array `[]` is truthy but 400s the viewer). See
        // isViewerSearchInput.
        ...(isViewerSearchInput(configuration?.contactPAConfigInput) && {
          contactPAConfigInput: configuration.contactPAConfigInput,
        }),
        ...(isViewerSearchInput(configuration?.contactCompaniesSearchInput) && {
          contactCompaniesSearchInput: configuration.contactCompaniesSearchInput,
        }),
      };
      const viewer = await userService.getViewer(viewerInput);
      const user = viewer as Contact | Customer;
      // Phase D.3: no longer dispatches `userLoggedIn` to coordinate
      // host-side state. The caller receives `user` in the return value and
      // is responsible for updating its own auth store.
      return ok({ user, accessToken, refreshToken, expiresAt });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setError(msg);
      return err(msg);
    } finally {
      setLoading(false);
    }
  }, [graphqlClient, language, onAuthHeaderUpdate, configuration]);

  // ── Magic-token login ───────────────────────────────────────────────────────
  // Passwordless: exchange a backend-issued magic token for a session, then run
  // the IDENTICAL tail as login() (in-memory Bearer + getViewer). The token is
  // single-use/expiring and typically arrives in a deep link (ERP / punchout
  // handoff). See MagicTokenService.magicTokenLogin.

  const magicLogin = useCallback(async (
    token: string,
  ): Promise<Result<AuthSuccess, string>> => {
    setLoading(true);
    setError(null);
    try {
      const loginResult = await new MagicTokenService(graphqlClient).magicTokenLogin(token);
      const session = loginResult?.session;
      const accessToken = session?.accessToken;
      const refreshToken = session?.refreshToken;
      const expiresAt = session?.expirationTime;
      if (accessToken) {
        // In-memory Bearer only — never graphqlClient.setAccessToken(), whose SDK
        // default resolver persists the JWT to localStorage['access_token'] (the
        // XSS hole Phase 5 closed). Same channel login() uses; cross-reload auth
        // is the httpOnly cookie (host afterLogin → /api/auth/session → proxy).
        const cfg = graphqlClient.getConfig();
        graphqlClient.updateConfig({
          headers: { ...cfg.headers, Authorization: `Bearer ${accessToken}` },
        });
        onAuthHeaderUpdate?.(accessToken);
      }
      const userService = createServices(graphqlClient).user;
      const viewerInput: ViewerInput = {
        ...(configuration?.contactTrackAttributes?.length && {
          contactAttributesInput: { attributeDescription: { names: configuration.contactTrackAttributes } },
        }),
        ...(configuration?.customerTrackAttributes?.length && {
          customerAttributesInput: { attributeDescription: { names: configuration.customerTrackAttributes } },
        }),
        ...(configuration?.companyTrackAttributes?.length && {
          companyAttributesInput: { attributeDescription: { names: configuration.companyTrackAttributes } },
        }),
        // See isViewerSearchInput — an empty array `[]` is truthy but 400s the viewer.
        ...(isViewerSearchInput(configuration?.contactPAConfigInput) && {
          contactPAConfigInput: configuration.contactPAConfigInput,
        }),
        ...(isViewerSearchInput(configuration?.contactCompaniesSearchInput) && {
          contactCompaniesSearchInput: configuration.contactCompaniesSearchInput,
        }),
      };
      const viewer = await userService.getViewer(viewerInput);
      const user = viewer as Contact | Customer;
      return ok({ user, accessToken, refreshToken, expiresAt });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Magic-token login failed';
      setError(msg);
      return err(msg);
    } finally {
      setLoading(false);
    }
  }, [graphqlClient, onAuthHeaderUpdate, configuration]);

  // ── Create magic token ────────────────────────────────────────────────────
  // Issue a magic token for a contact/customer (authenticated call). Returns the
  // MagicToken whose `id` is embedded in a magic-login link. The real caller is
  // punchout link-generation; exposed here as the auth-adjacent capability.

  const createMagicToken = useCallback(async (
    input: MagicTokenCreateInput,
  ): Promise<Result<MagicToken, string>> => {
    setLoading(true);
    setError(null);
    try {
      const token = await new MagicTokenService(graphqlClient).createMagicToken(input);
      return ok(token);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create magic token';
      setError(msg);
      return err(msg);
    } finally {
      setLoading(false);
    }
  }, [graphqlClient]);

  // ── Register contact ──────────────────────────────────────────────────────
  // Contact registration path:
  // createCompany → registerContact (ContactRegisterInput) → createCompanyAddress(es)

  const registerContact = useCallback(async (
    input: RegisterContactInput,
    preferredLanguage = language,
    autoLogin = true,
  ): Promise<Result<AuthSuccess, string>> => {
    setLoading(true);
    setError(null);
    try {
      const userService = createServices(graphqlClient).user;
      const companyService = createServices(graphqlClient).company;
      const addressService = createServices(graphqlClient).address;

      let companyId: number | undefined;
      if (input.companyName) {
        const companyInput: CreateCompanyInput = {
          name: input.companyName,
          ...(input.vatNumber && { taxNumber: input.vatNumber }),
          ...(input.cocNumber && { cocNumber: input.cocNumber }),
          email: input.email,
          ...(input.phone && { phone: input.phone }),
        };
        const company = await companyService.createCompany({
          input: companyInput,
          contactPAConfigInput: { page: 1, offset: 10 },
          companyAttributesInput: {},
          contactSearchArguments: { page: 1, offset: 10 },
        });
        companyId = company.companyId;
      }

      const contactInput: ContactRegisterInput = {
        contactRegisterInput: {
          email: input.email,
          password: input.password,
          firstName: input.firstName,
          ...(input.middleName && { middleName: input.middleName }),
          lastName: input.lastName,
          ...(input.phone && { phone: input.phone }),
          ...(input.gender && { gender: input.gender }),
          primaryLanguage: preferredLanguage,
          parentId: companyId as number,
        },
        companyAttributesInput: {},
        contactAttributesInput: {},
        contactPAConfigInput: { page: 1, offset: 10 },
      };
      // The contact-register response carries the new contact's id AND a freshly
      // issued `session` (accessToken/refreshToken/expirationTime) — the backend
      // logs the contact in as part of registration. We capture both here.
      //
      // The response also includes a `favoriteLists` sub-selection that the
      // FavoriteListsV2 service rejects with FORBIDDEN for newly-created contacts.
      // That's a *partial* error: the SDK's executeMutation returns `data`
      // alongside the error (it only throws when `data` is null), so
      // `registerResult` — including `session` — is still returned. The try/catch
      // is defensive in case a future SDK change starts throwing on partials.
      let registeredContactId: number | undefined;
      let registerAccessToken: string | undefined;
      try {
        const registerResult = await userService.registerContact(contactInput);
        registeredContactId = (registerResult?.contact as unknown as Contact | undefined)?.contactId;
        registerAccessToken = registerResult?.session?.accessToken;
      } catch {
        // Swallow: contact creation succeeded server-side; the only failing
        // sub-selection is the favoriteLists field, which is empty for new users.
      }

      // Authenticate company-address creation with the token from the register
      // response — NOT with a separate login(). `companyAddressCreate` is a
      // company-scoped mutation the backend authorizes against the logged-in
      // contact; called anonymously (API key only) it returns FORBIDDEN. Set the
      // register-session token as the in-memory Bearer header (the same channel
      // login() uses); we deliberately do NOT call graphqlClient.setAccessToken(),
      // whose SDK default resolver would persist the JWT to
      // localStorage['access_token'] (the XSS hole Phase 5 closed). login() below
      // is a separate concern, run only to establish the real user session.
      if (registerAccessToken) {
        const cfg = graphqlClient.getConfig();
        graphqlClient.updateConfig({
          headers: { ...cfg.headers, Authorization: `Bearer ${registerAccessToken}` },
        });
      }

      if (input.street && companyId) {
        const invoiceAddress: CompanyAddressCreateInput = {
          firstName: input.firstName,
          lastName: input.lastName,
          ...(input.gender && { gender: input.gender }),
          street: input.street,
          number: input.number,
          numberExtension: input.numberExtension,
          postalCode: input.postalCode ?? '',
          city: input.city ?? '',
          country: input.country ?? 'NL',
          type: AddressType.invoice,
          isDefault: YesNo.Y,
          companyId,
        };
        await addressService.createCompanyAddress(invoiceAddress);

        // Determine the delivery-address payload:
        // - If "same as billing" is checked, copy the billing fields and only
        //   change `type` to `delivery` so Propeller has a dedicated delivery
        //   record for the contact.
        // - Otherwise, use the separately-entered delivery fields (skip if the
        //   user left them empty).
        if (input.sameDeliveryAsBilling) {
          const deliveryAddress: CompanyAddressCreateInput = {
            ...invoiceAddress,
            type: AddressType.delivery,
          };
          await addressService.createCompanyAddress(deliveryAddress);
        } else if (input.deliveryStreet) {
          const deliveryAddress: CompanyAddressCreateInput = {
            firstName: input.firstName,
            lastName: input.lastName,
            ...(input.gender && { gender: input.gender }),
            street: input.deliveryStreet,
            number: input.deliveryNumber,
            numberExtension: input.deliveryNumberExtension,
            postalCode: input.deliveryPostalCode ?? '',
            city: input.deliveryCity ?? '',
            country: input.deliveryCountry ?? 'NL',
            type: AddressType.delivery,
            isDefault: YesNo.Y,
            companyId,
          };
          await addressService.createCompanyAddress(deliveryAddress);
        }
      }

      if (registeredContactId) {
        try {
          await userService.triggerContactSendWelcomeEmailEvent({
            contactId: registeredContactId,
            language: preferredLanguage,
            ...(configuration?.channelId && { channelId: configuration.channelId }),
          });
        } catch (e) {
          console.error('Failed to send welcome email to contact', e);
        }
      }

      if (!autoLogin) {
        // Address creation used the register-session token (set as the in-memory
        // Bearer header above). The caller asked not to stay logged in, so strip
        // that header and notify the host. Nothing was persisted to localStorage,
        // so there's no setAccessToken/localStorage cleanup to do.
        const cfg = graphqlClient.getConfig();
        const headers = { ...cfg.headers };
        delete headers['Authorization'];
        graphqlClient.updateConfig({ headers });
        onAuthHeaderUpdate?.('');
        return ok({});
      }

      // Separate concern: establish the real user session. login() re-issues a
      // session (overwriting the in-memory register-session header) and returns
      // the viewer + token for the host to persist via its afterLogin/afterRegistration.
      return await login(input.email, input.password);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      setError(msg);
      return err(msg);
    } finally {
      setLoading(false);
    }
  }, [graphqlClient, language, login, onAuthHeaderUpdate, configuration]);

  // ── Register customer ──────────────────────────────────────────────────
  // Customer registration path:
  // registerCustomer (CustomerRegisterInput) → login → createCustomerAddress

  const registerCustomer = useCallback(async (
    input: RegisterCustomerInput,
    preferredLanguage = language,
    autoLogin = true,
  ): Promise<Result<AuthSuccess, string>> => {
    setLoading(true);
    setError(null);
    try {
      const userService = createServices(graphqlClient).user;
      const addressService = createServices(graphqlClient).address;

      const customerInput: CustomerRegisterInput = {
        customerRegisterInput: {
          email: input.email,
          password: input.password,
          firstName: input.firstName,
          ...(input.middleName && { middleName: input.middleName }),
          lastName: input.lastName,
          ...(input.phone && { phone: input.phone }),
          ...(input.gender && { gender: input.gender }),
          primaryLanguage: preferredLanguage,
        },
        customerAttributesInput: {},
      };
      await userService.registerCustomer(customerInput);

      const loginResult = await login(input.email, input.password);
      if (!loginResult.ok) return loginResult;
      const loggedInUser = loginResult.data.user;

      let addressesCreated = false;
      if (input.street && isCustomer(loggedInUser ?? null)) {
        const customer = loggedInUser as Customer;
        const invoiceAddress: CustomerAddressCreateInput = {
          firstName: input.firstName,
          lastName: input.lastName,
          ...(input.gender && { gender: input.gender }),
          street: input.street,
          number: input.number,
          numberExtension: input.numberExtension,
          postalCode: input.postalCode ?? '',
          city: input.city ?? '',
          country: input.country ?? 'NL',
          type: AddressType.invoice,
          isDefault: YesNo.Y,
          customerId: customer.customerId,
        };
        await addressService.createCustomerAddress(invoiceAddress);
        addressesCreated = true;

        // Match the contact flow: when "same as billing" is checked, copy the
        // billing fields into a delivery-typed record so Propeller has a
        // dedicated default delivery address. Otherwise, use the separately
        // entered delivery fields (skip if the user left them empty).
        if (input.sameDeliveryAsBilling) {
          const deliveryAddress: CustomerAddressCreateInput = {
            ...invoiceAddress,
            type: AddressType.delivery,
          };
          await addressService.createCustomerAddress(deliveryAddress);
        } else if (input.deliveryStreet) {
          const deliveryAddress: CustomerAddressCreateInput = {
            firstName: input.firstName,
            lastName: input.lastName,
            ...(input.gender && { gender: input.gender }),
            street: input.deliveryStreet,
            number: input.deliveryNumber,
            numberExtension: input.deliveryNumberExtension,
            postalCode: input.deliveryPostalCode ?? '',
            city: input.deliveryCity ?? '',
            country: input.deliveryCountry ?? 'NL',
            type: AddressType.delivery,
            isDefault: YesNo.Y,
            customerId: customer.customerId,
          };
          await addressService.createCustomerAddress(deliveryAddress);
        }
      }

      if (isCustomer(loggedInUser ?? null)) {
        try {
          await userService.triggerCustomerSendWelcomeEmailEvent({
            customerId: (loggedInUser as Customer).customerId,
            language: preferredLanguage,
            ...(configuration?.channelId && { channelId: configuration.channelId }),
          });
        } catch (e) {
          console.error('Failed to send welcome email to customer', e);
        }
      }

      if (!autoLogin) {
        // Address creation needed the customerId from login(); now drop the
        // session so the caller doesn't see this as a logged-in flow.
        // clearAccessToken() removes localStorage['access_token']; also strip
        // the in-memory Bearer header set during the implicit login above.
        graphqlClient.clearAccessToken();
        const cfg = graphqlClient.getConfig();
        const headers = { ...cfg.headers };
        delete headers['Authorization'];
        graphqlClient.updateConfig({ headers });
        onAuthHeaderUpdate?.('');
        return ok({});
      }

      // Re-fetch the viewer so the returned user includes the just-created
      // addresses. The user object captured by login() above is a snapshot
      // taken before the addresses existed, and consumers that store it
      // (auth context, dashboard, /account/addresses) would otherwise see no
      // addresses until the next page load.
      if (addressesCreated) {
        try {
          const viewerInput: ViewerInput = {
            ...(configuration?.customerTrackAttributes?.length && {
              customerAttributesInput: { attributeDescription: { names: configuration.customerTrackAttributes } },
            }),
          };
          const refreshedViewer = await userService.getViewer(viewerInput);
          const refreshedUser = refreshedViewer as Contact | Customer;
          return ok({ ...loginResult.data, user: refreshedUser });
        } catch {
          // Fall through to original loginResult — addresses still exist
          // server-side; only the local snapshot is stale.
        }
      }
      return loginResult;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      setError(msg);
      return err(msg);
    } finally {
      setLoading(false);
    }
  }, [graphqlClient, language, login, onAuthHeaderUpdate, configuration]);

  // ── Forgot password ─────────────────────────────────────────────────────

  const forgotPassword = useCallback(async (email: string): Promise<Result<void, string>> => {
    setLoading(true);
    setError(null);
    try {
      const userService = createServices(graphqlClient).user;
      const resetInput: PasswordResetInput = { email };
      await userService.sendPasswordResetEmail(resetInput);
      return ok(undefined);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to send reset email';
      setError(msg);
      return err(msg);
    } finally {
      setLoading(false);
    }
  }, [graphqlClient]);

  return { loading, error, login, magicLogin, createMagicToken, registerContact, registerCustomer, forgotPassword };
}
