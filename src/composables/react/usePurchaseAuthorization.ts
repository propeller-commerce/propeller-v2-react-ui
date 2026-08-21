/**
 * usePurchaseAuthorization (React) — Purchase Authorization Configurator + Requests.
 *
 * Covers: PurchaseAuthorizationConfigurator, PurchaseAuthorizationRequests.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createServices } from '@propeller-commerce/propeller-v2-core-ui';
import { CartStatus, Gender, PurchaseRole } from '@propeller-commerce/propeller-sdk-v2';
import type {
  GraphQLClient,
  Company,
  Cart,
  CartMainItem,
  Contact,
  Customer,
  PurchaseAuthorizationConfig,
  PurchaseAuthorizationConfigCreateInput,
  RegisterContactInput,
  AttributeResultSearchInput,
  MediaImageProductSearchInput,
  TransformationsInput,
} from '@propeller-commerce/propeller-sdk-v2';
import { useCompany } from './useCompany';

// ── Shared types ──────────────────────────────────────────────────────────────

/** Per-contact editable PAC fields tracked in the configurator table. */
export interface RowEdit {
  /** Selected purchase role for the row's contact. */
  role: string;
  /** Authorization spend limit, or `undefined` when unlimited/unset. */
  limit: number | undefined;
  /** `true` when the row has unsaved changes. */
  dirty: boolean;
}

/** Form state for the "add contact" modal. */
export interface AddContactFormState {
  /** Selected gender. */
  gender: string;
  /** Contact email. */
  email: string;
  /** Contact first name. */
  firstName: string;
  /** Contact middle name / tussenvoegsel. */
  middleName: string;
  /** Contact last name. */
  lastName: string;
  /** Contact phone number. */
  phone: string;
}

const EMPTY_CONTACT_FORM: AddContactFormState = {
  gender: '', email: '', firstName: '', middleName: '', lastName: '', phone: '',
};

/** Checks if a user is an authorization manager for the given company. Works on plain objects from localStorage. */
function checkIsAuthManager(user: Contact | Customer | null | undefined, companyId: number): boolean {
  if (!user || !('contactId' in user)) return false;
  const pacData = (user as Contact).purchaseAuthorizationConfigs;
  const items: PurchaseAuthorizationConfig[] = pacData?.items ?? [];
  return items.some((pac: PurchaseAuthorizationConfig) => {
    const role = pac.purchaseRole;
    const pacCompanyId = pac.company?.companyId;
    return role === PurchaseRole.AUTHORIZATION_MANAGER && Number(pacCompanyId) === Number(companyId);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// usePurchaseAuthorizationConfigurator
// ══════════════════════════════════════════════════════════════════════════════

/** Options for {@link usePurchaseAuthorizationConfigurator}. */
export interface UsePurchaseAuthorizationConfiguratorOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** The signed-in user; used to detect authorization-manager rights. */
  user: Contact | Customer | null;
  /** Company whose contacts and PACs are managed. */
  companyId: number;
  /** Rows per page (default 10) */
  pageOffset?: number;
  /** Fires before a contact is created — receives the register input. */
  beforeContactCreate?: (input: RegisterContactInput) => void;
  /** Override: fires instead of the default `registerContact` call. */
  onContactCreate?: (input: RegisterContactInput) => void;
  /** Fires after a contact is created — receives the new contact. */
  afterContactCreate?: (contact: Contact) => void;
  /** Override: fires instead of the default PAC create call. */
  onPurchaseAuthorizationCreate?: (pac: PurchaseAuthorizationConfigCreateInput) => void;
  /** Fires after a PAC is created. */
  afterPurchaseAuthorizationCreate?: (pac: PurchaseAuthorizationConfig) => void;
  /** Override: fires instead of the default PAC update call. */
  onPurchaseAuthorizationUpdate?: (pac: PurchaseAuthorizationConfig) => void;
  /** Fires after a PAC is updated. */
  afterPurchaseAuthorizationUpdate?: (pac: PurchaseAuthorizationConfig) => void;
  /** Override: fires instead of the default PAC delete call. */
  onPurchaseAuthorizationDelete?: (pac: PurchaseAuthorizationConfig) => void;
  /** Fires after a PAC delete succeeds; receiving it suppresses the default reload. */
  afterPurchaseAuthorizationDelete?: (deleted: boolean) => void;
}

/** State, per-row helpers and handlers returned by {@link usePurchaseAuthorizationConfigurator}. */
export interface UsePurchaseAuthorizationConfiguratorReturn {
  // Data
  /** The loaded company, or `null`. */
  company: Company | null;
  /** `true` while company data is loading. */
  loading: boolean;
  /** Contacts on the current company page. */
  contacts: Contact[];
  /** Total contact pages. */
  totalPages: number;
  /** Current contact page (1-based). */
  currentPage: number;
  // Derived
  /** `true` when the signed-in user is an authorization manager for the company. */
  isAuthManager: boolean;
  // Per-row state
  /** Per-contact unsaved PAC edits, keyed by contact id. */
  rowEdits: Record<number, RowEdit>;
  /** Existing PAC per contact, keyed by contact id. */
  pacMap: Record<number, PurchaseAuthorizationConfig>;
  /** Per-contact in-flight flag for save/create/delete, keyed by contact id. */
  actionLoading: Record<number, boolean>;
  // Add-contact modal state
  /** Whether the add-contact modal is open. */
  showAddContactModal: boolean;
  /** Working form state of the add-contact modal. */
  addContactForm: AddContactFormState;
  /** `true` while a contact is being created. */
  addContactLoading: boolean;
  /** Error message from the add-contact modal, or `''`. */
  addContactError: string;
  // Per-row helpers
  /** `true` when the contact already has a PAC. */
  hasPac: (contactId: number) => boolean;
  /** `true` when the contact id is the signed-in user. */
  isCurrentUser: (contactId: number) => boolean;
  /** `true` when the row has unsaved changes. */
  isRowDirty: (contactId: number) => boolean;
  /** Current (possibly edited) role for the row. */
  getRowRole: (contactId: number) => string;
  /** Current (possibly edited) limit for the row. */
  getRowLimit: (contactId: number) => number | undefined;
  /** `true` while the row has an action in flight. */
  isRowLoading: (contactId: number) => boolean;
  // Handlers
  /** Loads a page of the company's contacts and their PACs. */
  loadCompany: (page: number) => Promise<void>;
  /** Stages a role change for a contact's row. */
  handleRoleChange: (contactId: number, role: string) => void;
  /** Stages a limit change for a contact's row. */
  handleLimitChange: (contactId: number, value: string) => void;
  /** Creates a PAC for the contact from the staged row edit. */
  handleCreate: (contactId: number) => Promise<void>;
  /** Saves the staged row edit to the contact's existing PAC. */
  handleSave: (contactId: number) => Promise<void>;
  /** Deletes the contact's PAC. */
  handleDelete: (contactId: number) => Promise<void>;
  /** Changes the current contact page. */
  handlePageChange: (page: number) => void;
  /** Opens the add-contact modal. */
  openAddContactModal: () => void;
  /** Closes the add-contact modal and resets its form. */
  closeAddContactModal: () => void;
  /** Setter for the add-contact form state. */
  setAddContactForm: React.Dispatch<React.SetStateAction<AddContactFormState>>;
  /** Submits the add-contact form, registering a new company contact. */
  handleAddContactSubmit: () => Promise<void>;
}

/**
 * usePurchaseAuthorizationConfigurator — manages a company's contacts and their
 * Purchase Authorization Configs (roles + spend limits).
 *
 * @param options - see {@link UsePurchaseAuthorizationConfiguratorOptions}.
 * @returns company data, per-row PAC state and handlers — see {@link UsePurchaseAuthorizationConfiguratorReturn}.
 *
 * @remarks
 * GraphQL integration: company data and PAC CRUD are delegated to the {@link useCompany}
 * hook (`fetchCompany` → `CompanyService.getCompany`; `createPac` / `updatePac` /
 * `deletePac` → `PurchaseAuthorizationConfigService`). `handleAddContactSubmit` calls
 * `services.user.registerContact()` (`UserService`) directly, built per-call via
 * `createServices(graphqlClient)`. After a successful create/update/delete the
 * company page is reloaded. All calls require an authenticated session; each `on*`
 * callback fully overrides its default API call.
 */
export function usePurchaseAuthorizationConfigurator(
  options: UsePurchaseAuthorizationConfiguratorOptions,
): UsePurchaseAuthorizationConfiguratorReturn {
  const { graphqlClient, user, companyId, pageOffset = 10 } = options;
  // Keep callbacks in a ref so handlers don't stale-close over them
  const cbRef = useRef(options);
  cbRef.current = options;

  const { company, loading, fetchCompany, createPac, updatePac, deletePac } = useCompany({ graphqlClient });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowEdits, setRowEdits] = useState<Record<number, RowEdit>>({});
  const [pacMap, setPacMap] = useState<Record<number, PurchaseAuthorizationConfig>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [addContactForm, setAddContactForm] = useState<AddContactFormState>(EMPTY_CONTACT_FORM);
  const [addContactLoading, setAddContactLoading] = useState(false);
  const [addContactError, setAddContactError] = useState('');

  const isAuthManager = useMemo(() => checkIsAuthManager(user, companyId), [user, companyId]);

  const contacts = useMemo<Contact[]>(
    () => (company as Company)?.contacts?.items ?? [],
    [company],
  );

  const totalPages = useMemo<number>(
    () => (company as Company)?.contacts?.pages ?? 0,
    [company],
  );

  function buildMaps(contactList: Contact[]): void {
    const newPacMap: Record<number, PurchaseAuthorizationConfig> = {};
    const newRowEdits: Record<number, RowEdit> = {};
    contactList.forEach((contact: Contact) => {
      const cId = contact.contactId;
      const pacItems: PurchaseAuthorizationConfig[] = contact.purchaseAuthorizationConfigs?.items ?? [];
      if (pacItems.length > 0) newPacMap[cId] = pacItems[0];
      const pac = newPacMap[cId];
      newRowEdits[cId] = {
        role: pac ? pac.purchaseRole : '',
        limit: pac ? pac.authorizationLimit : undefined,
        dirty: false,
      };
    });
    setPacMap(newPacMap);
    setRowEdits(newRowEdits);
  }

  const loadCompany = useCallback(async (page: number): Promise<void> => {
    if (!graphqlClient || !companyId) return;
    await fetchCompany(companyId, {
      contactSearchArguments: { page, offset: pageOffset },
      contactPAConfigInput: { companyIds: [companyId], page: 1, offset: 100 },
      companyAttributesInput: {} as AttributeResultSearchInput,
    });
  }, [graphqlClient, companyId, pageOffset, fetchCompany]);

  // Rebuild row maps whenever company data refreshes
  useEffect(() => {
    if (company) {
      buildMaps((company as Company).contacts?.items ?? []);
    }
  }, [company]);

  // Reload when companyId or currentPage changes
  useEffect(() => {
    if (graphqlClient && companyId) {
      loadCompany(currentPage);
    }
  }, [companyId, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPac = useCallback((id: number) => !!pacMap[id], [pacMap]);
  const isCurrentUser = useCallback((id: number) => (user as Contact)?.contactId === id, [user]);
  const isRowDirty = useCallback((id: number) => !!rowEdits[id]?.dirty, [rowEdits]);
  const getRowRole = useCallback((id: number) => rowEdits[id]?.role ?? '', [rowEdits]);
  const getRowLimit = useCallback((id: number) => rowEdits[id]?.limit, [rowEdits]);
  const isRowLoading = useCallback((id: number) => !!actionLoading[id], [actionLoading]);

  const handleRoleChange = useCallback((contactId: number, role: string): void => {
    setRowEdits(prev => ({
      ...prev,
      [contactId]: { ...(prev[contactId] ?? { role: '', limit: undefined, dirty: false }), role, dirty: true },
    }));
  }, []);

  const handleLimitChange = useCallback((contactId: number, value: string): void => {
    const limit = value === '' ? undefined : Number(value);
    setRowEdits(prev => ({
      ...prev,
      [contactId]: { ...(prev[contactId] ?? { role: '', limit: undefined, dirty: false }), limit, dirty: true },
    }));
  }, []);

  const handleCreate = useCallback(async (contactId: number): Promise<void> => {
    setActionLoading(prev => ({ ...prev, [contactId]: true }));
    try {
      const edit = rowEdits[contactId] ?? { role: PurchaseRole.PURCHASER, limit: undefined, dirty: false };
      const input: PurchaseAuthorizationConfigCreateInput = {
        contactId,
        companyId,
        purchaseRole: (edit.role || PurchaseRole.PURCHASER) as PurchaseRole,
        authorizationLimit: edit.limit,
      };
      if (cbRef.current.onPurchaseAuthorizationCreate) {
        cbRef.current.onPurchaseAuthorizationCreate(input);
      } else {
        const result = await createPac(input);
        if (result.success) await loadCompany(currentPage);
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [contactId]: false }));
    }
  }, [rowEdits, companyId, currentPage, createPac, loadCompany]);

  const handleSave = useCallback(async (contactId: number): Promise<void> => {
    const pac = pacMap[contactId];
    if (!pac) return;
    setActionLoading(prev => ({ ...prev, [contactId]: true }));
    try {
      const edit = rowEdits[contactId];
      if (cbRef.current.onPurchaseAuthorizationUpdate) {
        cbRef.current.onPurchaseAuthorizationUpdate(pac);
      } else {
        const result = await updatePac(pac.id, {
          purchaseRole: (edit.role || pac.purchaseRole) as PurchaseRole,
          authorizationLimit: edit.limit,
        });
        if (result.success) await loadCompany(currentPage);
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [contactId]: false }));
    }
  }, [pacMap, rowEdits, currentPage, updatePac, loadCompany]);

  const handleDelete = useCallback(async (contactId: number): Promise<void> => {
    const pac = pacMap[contactId];
    if (!pac) return;
    setActionLoading(prev => ({ ...prev, [contactId]: true }));
    try {
      if (cbRef.current.onPurchaseAuthorizationDelete) {
        cbRef.current.onPurchaseAuthorizationDelete(pac);
      } else {
        const result = await deletePac(pac.id);
        if (result.success) {
          if (cbRef.current.afterPurchaseAuthorizationDelete) {
            cbRef.current.afterPurchaseAuthorizationDelete(true);
          } else {
            await loadCompany(currentPage);
          }
        }
      }
    } finally {
      setActionLoading(prev => ({ ...prev, [contactId]: false }));
    }
  }, [pacMap, currentPage, deletePac, loadCompany]);

  const handlePageChange = useCallback((page: number): void => {
    setCurrentPage(page);
  }, []);

  const openAddContactModal = useCallback((): void => {
    setAddContactError('');
    setShowAddContactModal(true);
  }, []);

  const closeAddContactModal = useCallback((): void => {
    setShowAddContactModal(false);
    setAddContactError('');
    setAddContactForm(EMPTY_CONTACT_FORM);
  }, []);

  const handleAddContactSubmit = useCallback(async (): Promise<void> => {
    setAddContactLoading(true);
    setAddContactError('');
    try {
      const input: RegisterContactInput = {
        parentId: companyId,
        gender: addContactForm.gender as Gender,
        email: addContactForm.email,
        firstName: addContactForm.firstName,
        middleName: addContactForm.middleName,
        lastName: addContactForm.lastName,
        phone: addContactForm.phone,
      };
      if (cbRef.current.beforeContactCreate) cbRef.current.beforeContactCreate(input);
      if (cbRef.current.onContactCreate) {
        cbRef.current.onContactCreate(input);
      } else {
        const userService = createServices(graphqlClient).user;
        const result = await userService.registerContact({ contactRegisterInput: input });
        if (cbRef.current.afterContactCreate) {
          cbRef.current.afterContactCreate(result.contact as unknown as Contact);
        } else {
          await loadCompany(currentPage);
        }
      }
      closeAddContactModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create contact';
      setAddContactError(msg);
    } finally {
      setAddContactLoading(false);
    }
  }, [graphqlClient, companyId, addContactForm, currentPage, loadCompany, closeAddContactModal]);

  return {
    company, loading, contacts, totalPages, currentPage, isAuthManager,
    rowEdits, pacMap, actionLoading,
    showAddContactModal, addContactForm, addContactLoading, addContactError,
    hasPac, isCurrentUser, isRowDirty, getRowRole, getRowLimit, isRowLoading,
    loadCompany, handleRoleChange, handleLimitChange, handleCreate, handleSave, handleDelete,
    handlePageChange, openAddContactModal, closeAddContactModal, setAddContactForm,
    handleAddContactSubmit,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// usePurchaseAuthorizationRequests
// ══════════════════════════════════════════════════════════════════════════════

/** Options for {@link usePurchaseAuthorizationRequests}. */
export interface UsePurchaseAuthorizationRequestsOptions {
  /** GraphQL client the hook derives its Services bundle from. */
  graphqlClient: GraphQLClient;
  /** The signed-in user; the accepting contact and auth-manager check come from here. */
  user: Contact | Customer | null;
  /** Company whose pending authorization requests are listed. */
  companyId: number;
  /** Portal configuration: language plus image search/variant filters. */
  configuration?: {
    language?: string;
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
  };
  /** Override: fires instead of the default accept-request call. */
  onAcceptRequest?: (cartId: string) => void;
  /** Fires after a request is accepted — receives the resulting cart. */
  afterAcceptRequest?: (cart: Cart) => void;
  /**
   * Override: fires instead of the default CartService.deleteCart() call.
   * Receives the cartId string.
   */
  onDeleteRequest?: (cartId: string) => void;
  /** Called AFTER a successful delete. Receives the deleted cart's id. */
  afterDeleteRequest?: (cartId: string) => void;
  /** Fires when any request operation throws. */
  onError?: (err: Error) => void;
}

/** State and request actions returned by {@link usePurchaseAuthorizationRequests}. */
export interface UsePurchaseAuthorizationRequestsReturn {
  /** Carts pending purchase authorization for the company. */
  carts: Cart[];
  /** `true` while the request list is loading. */
  loading: boolean;
  /** The cart open in the detail modal, or `null`. */
  selectedCart: Cart | null;
  /** `true` while the selected cart's full detail is loading. */
  modalLoading: boolean;
  /** `true` while an accept call is in flight. */
  acceptLoading: boolean;
  /** `true` while a delete call is in flight. */
  deleteLoading: boolean;
  /** `true` when the signed-in user is an authorization manager for the company. */
  isAuthManager: boolean;
  /** Sums the quantities of all items in a cart. */
  getTotalQuantity: (cart: Cart) => number;
  /** Formats a contact's full name. */
  getContactName: (contact: Contact | null | undefined) => string;
  /** Returns the line items of the currently selected cart. */
  getModalItems: () => CartMainItem[];
  /** Loads the company's pending authorization-request carts. */
  loadCarts: () => Promise<void>;
  /** Opens a cart in the modal and loads its full detail. */
  handleViewCart: (cart: Cart) => Promise<void>;
  /** Accepts the selected cart's authorization request. */
  handleAcceptRequest: () => Promise<void>;
  /** Deletes (rejects) the selected cart's authorization request. */
  handleDeleteRequest: () => Promise<void>;
  /** Closes the detail modal. */
  closeModal: () => void;
}

/**
 * usePurchaseAuthorizationRequests — review queue for carts awaiting purchase
 * authorization (accept or reject).
 *
 * @param options - see {@link UsePurchaseAuthorizationRequestsOptions}.
 * @returns request list, modal state and handlers — see {@link UsePurchaseAuthorizationRequestsReturn}.
 *
 * @remarks
 * GraphQL integration: all backend calls go through `services.cart` (`CartService`),
 * built per-call via `createServices(graphqlClient)`. `loadCarts` calls `getCarts`
 * filtered by `CartStatus.PENDING_PURCHASE_AUTHORIZATION` and the company id;
 * `handleViewCart` calls `getCart` for the full cart detail; `handleAcceptRequest`
 * calls `acceptPurchaseAuthorizationRequest` (passing the accepting contact id);
 * `handleDeleteRequest` calls `deleteCart`. All calls require an authenticated
 * session; `onAcceptRequest` / `onDeleteRequest` fully override their default calls.
 */
export function usePurchaseAuthorizationRequests(
  options: UsePurchaseAuthorizationRequestsOptions,
): UsePurchaseAuthorizationRequestsReturn {
  const { graphqlClient, user, companyId, configuration } = options;
  const cbRef = useRef(options);
  cbRef.current = options;

  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isAuthManager = useMemo(() => checkIsAuthManager(user, companyId), [user, companyId]);

  const getTotalQuantity = useCallback((cart: Cart): number => {
    return (cart?.items || []).reduce((sum: number, item: CartMainItem) => sum + (item.quantity || 0), 0);
  }, []);

  const getContactName = useCallback((contact: Contact | null | undefined): string => {
    if (!contact) return '';
    return [contact.firstName ?? '', contact.middleName ?? '', contact.lastName ?? ''].filter(Boolean).join(' ');
  }, []);

  const getModalItems = useCallback((): CartMainItem[] => {
    return selectedCart?.items || [];
  }, [selectedCart]);

  const loadCarts = useCallback(async (): Promise<void> => {
    if (!graphqlClient || !companyId) return;
    setLoading(true);
    try {
      const service = createServices(graphqlClient).cart;
      const response = await service.getCarts({
        statuses: [CartStatus.PENDING_PURCHASE_AUTHORIZATION],
        companyIds: [companyId],
      });
      setCarts(response?.items || []);
    } catch (err: unknown) {
      cbRef.current.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [graphqlClient, companyId]);

  const handleViewCart = useCallback(async (cart: Cart): Promise<void> => {
    setSelectedCart(cart);
    setModalLoading(true);
    try {
      const service = createServices(graphqlClient).cart;
      const fullCart = await service.getCart({
        cartId: cart.cartId,
        language: configuration?.language || process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE || 'NL',
        imageSearchFilters: configuration?.imageSearchFiltersGrid ?? {},
        imageVariantFilters: configuration?.imageVariantFiltersSmall,
      });
      setSelectedCart(fullCart);
    } catch (err: unknown) {
      cbRef.current.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setModalLoading(false);
    }
  }, [graphqlClient, configuration]);

  const handleAcceptRequest = useCallback(async (): Promise<void> => {
    if (!selectedCart) return;
    setAcceptLoading(true);
    const cartId = selectedCart.cartId;
    try {
      let cartForCallback: Cart = selectedCart;
      if (cbRef.current.onAcceptRequest) {
        cbRef.current.onAcceptRequest(cartId);
      } else {
        const service = createServices(graphqlClient).cart;
        cartForCallback = await service.acceptPurchaseAuthorizationRequest({
          id: cartId,
          input: { contactId: (user as Contact)?.contactId },
          imageSearchFilters: configuration?.imageSearchFiltersGrid,
          imageVariantFilters: configuration?.imageVariantFiltersSmall,
          language: configuration?.language || 'NL',
        });
      }
      cbRef.current.afterAcceptRequest?.(cartForCallback);
      setSelectedCart(null);
      await loadCarts();
    } catch (err: unknown) {
      cbRef.current.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setAcceptLoading(false);
    }
  }, [graphqlClient, user, selectedCart, configuration, loadCarts]);

  const handleDeleteRequest = useCallback(async (): Promise<void> => {
    if (!selectedCart) return;
    setDeleteLoading(true);
    const cartId = selectedCart.cartId;
    try {
      if (cbRef.current.onDeleteRequest) {
        cbRef.current.onDeleteRequest(cartId);
      } else {
        const service = createServices(graphqlClient).cart;
        await service.deleteCart({ id: cartId });
      }
      cbRef.current.afterDeleteRequest?.(cartId);
      setSelectedCart(null);
      await loadCarts();
    } catch (err: unknown) {
      cbRef.current.onError?.(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setDeleteLoading(false);
    }
  }, [graphqlClient, selectedCart, loadCarts]);

  const closeModal = useCallback((): void => {
    setSelectedCart(null);
  }, []);

  // Load on mount and when companyId changes
  useEffect(() => {
    if (graphqlClient && companyId) {
      loadCarts();
    }
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    carts, loading, selectedCart, modalLoading, acceptLoading, deleteLoading, isAuthManager,
    getTotalQuantity, getContactName, getModalItems,
    loadCarts, handleViewCart, handleAcceptRequest, handleDeleteRequest, closeModal,
  };
}
