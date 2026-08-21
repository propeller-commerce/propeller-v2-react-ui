'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useEffect } from 'react';
import { Address, CartAddress, Contact, Customer, Gender, GraphQLClient, OrderAddress, WarehouseAddress, YesNo } from '@propeller-commerce/propeller-sdk-v2';
import { useAddress } from '../composables/react/useAddress';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { getCountryName as _getCountryName } from '@propeller-commerce/propeller-v2-core-ui';

/**
 * Email pattern requiring a dotted top-level domain.
 *
 * `type="email"` alone accepts dotless domains such as `aa@gg` — valid per the
 * HTML5 spec (intranet hosts like `user@localhost`), but not a deliverable
 * address here, and rejected by the API. Email is optional on an address; this
 * only constrains the value once something has been typed.
 */
const EMAIL_PATTERN = '[^@\\s]+@[^@\\s.]+(?:\\.[^@\\s.]+)*\\.[A-Za-z]{2,}';

export interface AddressCardProps {
  /** GraphQL client for the Propeller SDK (only needed when editing) */
  graphqlClient?: GraphQLClient;

  /** The address to display (Address | CartAddress | WarehouseAddress | OrderAddress) */
  address: Address | CartAddress | WarehouseAddress | OrderAddress | null;

  /** Display company name @default true */
  showCompanyName?: boolean;

  /** Display salutation (Mr./Mrs.) @default true */
  showSalutation?: boolean;

  /** Display full name @default true */
  showFullName?: boolean;

  /** Display street @default true */
  showStreet?: boolean;

  /** Display house number and extension @default true */
  showNumberExtension?: boolean;

  /** Display postal code @default true */
  showPostalCode?: boolean;

  /** Display city @default true */
  showCity?: boolean;

  /** Display country name @default true */
  showCountry?: boolean;

  /** Display email @default false */
  showEmail?: boolean;

  /** Display phone @default false */
  showPhone?: boolean;

  /** Display action buttons (edit, delete, set default) @default true */
  enableActions?: boolean;

  /** Display Edit button @default true */
  enableEdit?: boolean;

  /** Display Delete button @default true */
  enableDelete?: boolean;

  /** Display Set Default button @default true */
  enableSetDefault?: boolean;

  /** Display the "Default ... Address" badge @default false */
  showDefaultBadge?: boolean;

  /**
   * Display the address-type badge (invoice/delivery chip) @default true.
   * Set to `false` where the surrounding heading already names the address
   * type, to avoid a redundant raw-looking chip.
   */
  showTypeBadge?: boolean;

  /** Called when address is edited; receives the updated address object */
  onEdit?: (address: Address) => void | Promise<void>;

  /** Called after address edit completes */
  afterEdit?: (address: Address) => void | Promise<void>;

  /** Called when address is deleted; receives the address ID */
  onDelete?: (addressId: Address) => void;

  /** Called after address deletion completes */
  afterDelete?: (addressId: Address) => void;

  /** Called when address is set as default */
  onSetDefault?: (address: Address) => void;

  /** Called after address is set as default */
  afterSetDefault?: (address: Address) => void;

  /** List of countries for the country dropdown [{code: 'NL', name: 'Netherlands'}, ...] */
  countries?: {
    code: string;
    name: string;
  }[];

  /** When true, renders in "new address" mode: auto-opens the edit form, hides the card body */
  isNew?: boolean;

  /** Called when the form is cancelled in new mode */
  onCancel?: () => void;

  /** When true, renders the form inline instead of in a modal overlay. @default false */
  inline?: boolean;

  /** Address type for new addresses (e.g., 'DELIVERY', 'INVOICE'). Used when creating, not editing. */
  addressType?: string;

  /** Show ICP/ICS (intra-community supply) checkbox. @default false */
  showIcp?: boolean;

  /** Title for the form or section */
  title?: string;

  /** Labels for form fields and buttons */
  labels?: Record<string, string>;

  /** Called before save starts */
  beforeSave?: () => void;

  /** The authenticated user (needed by useAddress for SDK operations) */
  user?: Contact | Customer | null;

  /** Compound mode opt-in for the read-only card region. When provided,
   *  the read-only card renders the compound subtree (using <AddressCard.X>
   *  subcomponents) instead of the default layout. Edit forms / modals
   *  stay monolithic regardless. */
  children?: React.ReactNode;
}

interface AddressCardContextValue {
  address: NonNullable<AddressCardProps['address']>;
  resolved: AddressCardProps;
  derived: {
    fullName: string;
    streetLine: string;
    cityLine: string;
    countryName: string;
    isDefault: boolean;
    addressType: string;
    addressTypeLabel: string;
    company: string;
    email: string;
    phone: string;
  };
  actions: {
    onEdit: () => void;
    onDelete: () => void;
    onSetDefault: () => void;
    isSaving: boolean;
  };
}

const AddressCardContext = React.createContext<AddressCardContextValue | null>(null);

function useAddressCardContext(): AddressCardContextValue {
  const ctx = React.useContext(AddressCardContext);
  if (!ctx) {
    throw new Error(
      'AddressCard compound subcomponents must be rendered inside <AddressCard>.',
    );
  }
  return ctx;
}

/**
 * Displays a single address with configurable fields and edit/delete/set-default
 * actions. Also renders the address edit form (inline or in a modal) and a
 * "new address" mode.
 *
 * @remarks Uses {@link useAddress} for SDK-backed update/delete/set-default
 * operations; in callback-only mode (`onEdit`/`onDelete`) the hook is unused.
 */
function AddressCard(rawProps: AddressCardProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  // Hook MUST be called unconditionally (Rules of Hooks). It tolerates null
  // graphqlClient/user — its CRUD methods short-circuit with an error result
  // until both are present. The component also supports callback-only mode
  // (onEdit/onDelete props), in which case `addressHook` is never invoked.
  const addressHook = useAddress({
    graphqlClient: props.graphqlClient,
    user: props.user,
  });
  // Whether the hook is "live" for SDK calls. Used downstream to gate
  // addressHook usage in handlers (so we don't fire a no-op SDK call).
  const hookReady = !!props.graphqlClient && !!props.user;

  const [showEditModal, setShowEditModal] = useState(() => false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(() => false);
  const [saving, setSaving] = useState(() => false);
  const [localAddress, setLocalAddress] = useState<any>(() => null);
  const [editCompany, setEditCompany] = useState(() => '');
  const [editGender, setEditGender] = useState<Gender>(() => Gender.U);
  const [editFirstName, setEditFirstName] = useState(() => '');
  const [editMiddleName, setEditMiddleName] = useState(() => '');
  const [editLastName, setEditLastName] = useState(() => '');
  const [editStreet, setEditStreet] = useState(() => '');
  const [editNumber, setEditNumber] = useState(() => '');
  const [editNumberExtension, setEditNumberExtension] = useState(() => '');
  const [editPostalCode, setEditPostalCode] = useState(() => '');
  const [editCity, setEditCity] = useState(() => '');
  const [editCountry, setEditCountry] = useState(() => '');
  const [editEmail, setEditEmail] = useState(() => '');
  const [editPhone, setEditPhone] = useState(() => '');
  const [editNotes, setEditNotes] = useState(() => '');
  const [editIcp, setEditIcp] = useState<YesNo>(() => YesNo.N);

  const isSaving = hookReady ? addressHook.loading : saving;

  

  function getCountryName(code: string): string {
    return _getCountryName(code, props.countries);
  }

  // The address shape is a union of Address|CartAddress|WarehouseAddress|
  // OrderAddress|null|local edited form, and the JSX reads dozens of fields
  // via `addr?.()?.x ? push(addr().x) : null` where the narrowing doesn't
  // carry to the second call. Typing this strictly would force ~40 line
  // edits to use a single local const per call instead of double-invocation.
  // Out of scope here — flagged for the AddressCard compound-primitive
  // rework in Phase C.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addr(): any {
    return localAddress || props.address;
  }

  function showCard(): boolean {
    if (props.isNew) return false;
    if (props.inline && !props.address) return false;
    return true;
  }

  function salutation(): string {
    const g = addr?.()?.gender;
    if (g === 'M') return 'Mr.';
    if (g === 'F') return 'Mrs.';
    return '';
  }

  function fullName(): string {
    const parts: string[] = [];
    if (props.showSalutation !== false && salutation()) {
      parts.push(salutation());
    }
    if (addr?.()?.firstName) parts.push(addr().firstName);
    if (addr?.()?.middleName) parts.push(addr().middleName);
    if (addr?.()?.lastName) parts.push(addr().lastName);
    return parts.join(' ');
  }

  function streetLine(): string {
    const parts: string[] = [];
    if (addr?.()?.street) parts.push(addr().street);
    if (props.showNumberExtension !== false) {
      if (addr?.()?.number) parts.push(addr().number);
      if (addr?.()?.numberExtension) parts.push(addr().numberExtension);
    }
    return parts.join(' ');
  }

  function cityLine(): string {
    const parts: string[] = [];
    if (props.showPostalCode !== false && addr?.()?.postalCode) {
      parts.push(addr().postalCode);
    }
    if (props.showCity !== false && addr?.()?.city) {
      parts.push(addr().city);
    }
    return parts.join(' ');
  }

  function formTitle(): string {
    if (props.title) return props.title;
    if (props.isNew) return getLabel(props.labels, 'newTitle', 'New Address');
    return getLabel(props.labels, 'editTitle', 'Edit Address');
  }

  function openEditModal() {
    const a = addr();
    setEditCompany(a?.company || '');
    setEditGender(a?.gender || 'M');
    setEditFirstName(a?.firstName || '');
    setEditMiddleName(a?.middleName || '');
    setEditLastName(a?.lastName || '');
    setEditStreet(a?.street || '');
    setEditNumber(a?.number || '');
    setEditNumberExtension(a?.numberExtension || '');
    setEditPostalCode(a?.postalCode || '');
    setEditCity(a?.city || '');
    setEditCountry(a?.country || '');
    setEditEmail(a?.email || '');
    setEditPhone(a?.phone || '');
    setEditNotes(a?.notes || '');
    setEditIcp(a?.icp || YesNo.N);
    setShowEditModal(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    if (props.beforeSave) {
      props.beforeSave();
    }
    const editedAddress = {
      id: addr?.()?.id,
      type: addr?.()?.type || props.addressType || '',
      isDefault: addr?.()?.isDefault,
      company: editCompany,
      gender: editGender,
      firstName: editFirstName,
      middleName: editMiddleName,
      lastName: editLastName,
      street: editStreet,
      number: editNumber,
      numberExtension: editNumberExtension,
      postalCode: editPostalCode,
      city: editCity,
      country: editCountry,
      email: editEmail,
      phone: editPhone,
      notes: editNotes,
      icp: editIcp as YesNo,
    } as unknown as Address;
    setLocalAddress(editedAddress);
    setSaving(true);
    try {
      if (props.onEdit) {
        await props.onEdit(editedAddress);
      } else if (hookReady && addr?.()?.id) {
        await addressHook.updateAddress(addr().id, editedAddress);
      }
      setShowEditModal(false);
      if (props.afterEdit) {
        await props.afterEdit(editedAddress);
      }
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    const id = addr?.()?.id;
    if (id != null) {
      if (props.onDelete) {
        props.onDelete(addr());
      } else if (hookReady) {
        addressHook.deleteAddress(id);
      }
      setShowDeleteConfirm(false);
      if (props.afterDelete) {
        props.afterDelete(addr());
      }
    } else {
      setShowDeleteConfirm(false);
    }
  }

  function handleSetDefault() {
    if (props.onSetDefault) {
      props.onSetDefault(addr());
    } else if (hookReady && addr?.()?.id) {
      addressHook.setDefaultAddress(addr().id);
    }
    if (props.afterSetDefault) {
      props.afterSetDefault(addr());
    }
  }

  function closeEditModal() {
    setShowEditModal(false);
    if (props.isNew && props.onCancel) {
      props.onCancel();
    }
  }

  useEffect(() => {
    if (props.isNew || (props.inline && !props.address)) {
      openEditModal();
    }
  }, []);

  useEffect(() => {
    setLocalAddress(null);
  }, [props.address]);

  // Build the compound context value when there is an address to render. The
  // derived fields mirror the inline helpers used by the default read-only
  // layout so subcomponents and the default layout share a single source of
  // truth.
  const currentAddr = addr();
  const addrType: string = currentAddr?.type || '';
  const contextValue: AddressCardContextValue | null = currentAddr
    ? {
        address: currentAddr as NonNullable<AddressCardProps['address']>,
        resolved: props,
        derived: {
          fullName: fullName(),
          streetLine: streetLine(),
          cityLine: cityLine(),
          countryName: currentAddr?.country ? getCountryName(currentAddr.country) : '',
          isDefault: currentAddr?.isDefault === 'Y',
          addressType: addrType,
          addressTypeLabel: getLabel(props.labels, 'addressType:' + addrType, addrType),
          company: currentAddr?.company || '',
          email: currentAddr?.email || '',
          phone: currentAddr?.phone || '',
        },
        actions: {
          onEdit: openEditModal,
          onDelete: () => setShowDeleteConfirm(true),
          onSetDefault: handleSetDefault,
          isSaving,
        },
      }
    : null;

  return (
    <div className="propeller-address-card">
      {showCard() && contextValue ? (
        rawProps.children !== undefined ? (
          <AddressCardContext.Provider value={contextValue}>
            <div
              className="propeller-address-card__card bg-card p-4 rounded-container shadow-sm border border-border h-full flex flex-col"
              data-default={currentAddr?.isDefault === 'Y' ? 'true' : 'false'}
              data-type={addrType}
            >
              {rawProps.children}
            </div>
          </AddressCardContext.Provider>
        ) : (
          <AddressCardContext.Provider value={contextValue}>
            <div
              className="propeller-address-card__card bg-card p-4 rounded-container shadow-sm border border-border h-full flex flex-col"
              data-default={currentAddr?.isDefault === 'Y' ? 'true' : 'false'}
              data-type={addrType}
            >
              <div className="propeller-address-card__body flex-grow">
                <AddressCardTypeBadge />
                <AddressCardCompany />
                <AddressCardName />
                <AddressCardAddressLines />
                <AddressCardCountry />
                <AddressCardEmail />
                <AddressCardPhone />
                <AddressCardDefaultBadge />
              </div>
              <AddressCardActions />
            </div>
          </AddressCardContext.Provider>
        )
      ) : null}
      {props.inline && showEditModal ? (
        <div className="propeller-address-card__form bg-card p-6 rounded-container border border-border">
          <form onSubmit={(e) => handleSaveEdit(e)}>
            {!!formTitle() ? <h3 className="text-xl font-bold mb-4">{formTitle()}</h3> : null}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'gender', 'Gender')}
                  </label>
                  <select
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input bg-card"
                    value={editGender}
                    onChange={(e) => {
                      setEditGender(e.target.value as Gender);
                    }}
                  >
                    <option value="M">{getLabel(props.labels, 'genderMale', 'Male')}</option>
                    <option value="F">{getLabel(props.labels, 'genderFemale', 'Female')}</option>
                    <option value="U">{getLabel(props.labels, 'genderOther', 'Other')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'company', 'Company')}
                  </label>
                  <input
                    type="text"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editCompany}
                    onChange={(e) => {
                      setEditCompany(e.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'firstName', 'First Name')} *
                  </label>
                  <input
                    type="text"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editFirstName}
                    onChange={(e) => {
                      setEditFirstName(e.target.value);
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'middleName', 'Middle Name')}
                  </label>
                  <input
                    type="text"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editMiddleName}
                    onChange={(e) => {
                      setEditMiddleName(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'lastName', 'Last Name')} *
                  </label>
                  <input
                    type="text"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editLastName}
                    onChange={(e) => {
                      setEditLastName(e.target.value);
                    }}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-8">
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'street', 'Street')} *
                  </label>
                  <input
                    type="text"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editStreet}
                    onChange={(e) => {
                      setEditStreet(e.target.value);
                    }}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'number', 'Number')} *
                  </label>
                  <input
                    type="text"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editNumber}
                    onChange={(e) => {
                      setEditNumber(e.target.value);
                    }}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'numberExtension', 'Ext')}
                  </label>
                  <input
                    type="text"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editNumberExtension}
                    onChange={(e) => {
                      setEditNumberExtension(e.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'postalCode', 'Postal Code')} *
                  </label>
                  <input
                    type="text"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editPostalCode}
                    onChange={(e) => {
                      setEditPostalCode(e.target.value);
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'city', 'City')} *
                  </label>
                  <input
                    type="text"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editCity}
                    onChange={(e) => {
                      setEditCity(e.target.value);
                    }}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {getLabel(props.labels, 'country', 'Country')} *
                </label>
                <select
                  className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input bg-card"
                  value={editCountry}
                  onChange={(e) => {
                    setEditCountry(e.target.value);
                  }}
                  required
                >
                  <option value="">{getLabel(props.labels, 'selectCountry', 'Select country')}</option>
                  {(props.countries || []).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'email', 'Email')}
                  </label>
                  <input
                    type="email"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editEmail}
                    onChange={(e) => {
                      setEditEmail(e.target.value);
                    }}
                    pattern={EMAIL_PATTERN}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'phone', 'Phone')}
                  </label>
                  <input
                    type="tel"
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                    value={editPhone}
                    onChange={(e) => {
                      setEditPhone(e.target.value);
                    }}
                  />
                </div>
              </div>
              {!!props.showIcp ? (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="icp-inline"
                    className="propeller-address-card__checkbox h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    checked={editIcp === YesNo.Y}
                    onChange={(e) => {
                      setEditIcp(e.target.checked ? YesNo.Y : YesNo.N);
                    }}
                  />
                  <label htmlFor="icp-inline" className="text-sm font-medium">
                    {getLabel(props.labels, 'icp', 'ICP/ICS (Intra-Community Supply)')}
                  </label>
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
              {!props.isNew ? (
                <button
                  type="button"
                  className="propeller-address-card__cancel-btn px-4 py-2 border border-border rounded-control hover:bg-surface-hover disabled:opacity-50"
                  onClick={(event) => closeEditModal()}
                  disabled={isSaving}
                >
                  {getLabel(props.labels, 'cancel', 'Cancel')}
                </button>
              ) : null}
              {props.isNew && !!props.onCancel ? (
                <button
                  type="button"
                  className="propeller-address-card__cancel-btn px-4 py-2 border border-border rounded-control hover:bg-surface-hover disabled:opacity-50"
                  onClick={(event) => closeEditModal()}
                  disabled={isSaving}
                >
                  {getLabel(props.labels, 'cancel', 'Cancel')}
                </button>
              ) : null}
              <button
                type="submit"
                className="propeller-address-card__submit-btn px-4 py-2 bg-primary text-primary-foreground rounded-control hover:bg-primary/90 disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? <>{getLabel(props.labels, 'saving', 'Saving...')}</> : <>{getLabel(props.labels, 'save', 'Save')}</>}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {!props.inline && showEditModal ? (
        <div className="propeller-address-card__modal fixed inset-0 bg-foreground/50 flex items-center justify-center z-50 overflow-y-auto py-10">
          <div className="propeller-address-card__modal-content bg-card p-6 rounded-container max-w-2xl w-full mx-4 shadow-xl">
            <form onSubmit={(e) => handleSaveEdit(e)}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">{formTitle()}</h3>
                <button
                  type="button"
                  className="propeller-address-card__modal-close text-muted-foreground hover:text-foreground text-xl leading-none"
                  onClick={(event) => closeEditModal()}
                >
                  &times;
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'gender', 'Gender')}
                    </label>
                    <select
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input bg-card"
                      value={editGender}
                      onChange={(e) => {
                        setEditGender(e.target.value as Gender);
                      }}
                    >
                      <option value="M">{getLabel(props.labels, 'genderMale', 'Male')}</option>
                      <option value="F">{getLabel(props.labels, 'genderFemale', 'Female')}</option>
                      <option value="U">{getLabel(props.labels, 'genderOther', 'Other')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'company', 'Company')}
                    </label>
                    <input
                      type="text"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editCompany}
                      onChange={(e) => {
                        setEditCompany(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'firstName', 'First Name')} *
                    </label>
                    <input
                      type="text"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editFirstName}
                      onChange={(e) => {
                        setEditFirstName(e.target.value);
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'middleName', 'Middle Name')}
                    </label>
                    <input
                      type="text"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editMiddleName}
                      onChange={(e) => {
                        setEditMiddleName(e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'lastName', 'Last Name')} *
                    </label>
                    <input
                      type="text"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editLastName}
                      onChange={(e) => {
                        setEditLastName(e.target.value);
                      }}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-8">
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'street', 'Street')} *
                    </label>
                    <input
                      type="text"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editStreet}
                      onChange={(e) => {
                        setEditStreet(e.target.value);
                      }}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'number', 'Number')} *
                    </label>
                    <input
                      type="text"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editNumber}
                      onChange={(e) => {
                        setEditNumber(e.target.value);
                      }}
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'numberExtension', 'Ext')}
                    </label>
                    <input
                      type="text"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editNumberExtension}
                      onChange={(e) => {
                        setEditNumberExtension(e.target.value);
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'postalCode', 'Postal Code')} *
                    </label>
                    <input
                      type="text"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editPostalCode}
                      onChange={(e) => {
                        setEditPostalCode(e.target.value);
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'city', 'City')} *
                    </label>
                    <input
                      type="text"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editCity}
                      onChange={(e) => {
                        setEditCity(e.target.value);
                      }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {getLabel(props.labels, 'country', 'Country')} *
                  </label>
                  <select
                    className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input bg-card"
                    value={editCountry}
                    onChange={(e) => {
                      setEditCountry(e.target.value);
                    }}
                    required
                  >
                    <option value="">{getLabel(props.labels, 'selectCountry', 'Select country')}</option>
                    {(props.countries || []).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'email', 'Email')}
                    </label>
                    <input
                      type="email"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editEmail}
                      onChange={(e) => {
                        setEditEmail(e.target.value);
                      }}
                      pattern={EMAIL_PATTERN}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {getLabel(props.labels, 'phone', 'Phone')}
                    </label>
                    <input
                      type="tel"
                      className="propeller-address-card__input w-full h-10 px-3 rounded-control border border-input"
                      value={editPhone}
                      onChange={(e) => {
                        setEditPhone(e.target.value);
                      }}
                    />
                  </div>
                </div>
                {!!props.showIcp ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="icp-modal"
                      className="propeller-address-card__checkbox h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      checked={editIcp === YesNo.Y}
                      onChange={(e) => {
                        setEditIcp(e.target.checked ? YesNo.Y : YesNo.N);
                      }}
                    />
                    <label htmlFor="icp-modal" className="text-sm font-medium">
                      {getLabel(props.labels, 'icp', 'ICP/ICS (Intra-Community Supply)')}
                    </label>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-4 border-t">
                <button
                  type="button"
                  className="propeller-address-card__cancel-btn px-4 py-2 border border-border rounded-control hover:bg-surface-hover disabled:opacity-50"
                  onClick={(event) => closeEditModal()}
                  disabled={isSaving}
                >
                  {getLabel(props.labels, 'cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="propeller-address-card__submit-btn px-4 py-2 bg-primary text-primary-foreground rounded-control hover:bg-primary/90 disabled:opacity-50"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>{getLabel(props.labels, 'saving', 'Saving...')}</>
                  ) : (
                    <>{getLabel(props.labels, 'save', 'Save')}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {showDeleteConfirm ? (
        <div className="propeller-address-card__delete-modal fixed inset-0 bg-foreground/50 flex items-center justify-center z-50">
          <div className="propeller-address-card__delete-modal-content bg-card p-6 rounded-container max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4">
              {getLabel(props.labels, 'confirmDeleteTitle', 'Confirm Delete')}
            </h3>
            <p className="propeller-address-card__delete-message mb-6 text-muted-foreground">
              {getLabel(props.labels, 'confirmDeleteMessage', 'Are you sure you want to delete this address?')}
            </p>
            <div className="flex justify-end gap-4">
              <button
                className="propeller-address-card__cancel-btn px-4 py-2 border border-border rounded-control hover:bg-surface-hover"
                onClick={(event) => {
                  setShowDeleteConfirm(false);
                }}
              >
                {getLabel(props.labels, 'cancel', 'Cancel')}
              </button>
              <button
                className="propeller-address-card__confirm-btn px-4 py-2 bg-primary text-primary-foreground rounded-control hover:bg-primary/80"
                onClick={(event) => confirmDelete()}
              >
                {getLabel(props.labels, 'delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Optional type badge. Renders nothing when no `addressType` prop is set
 * (the surrounding parent — e.g. AddressSelector — typically renders a
 * type heading instead). When `addressType` is provided, renders a small
 * pill labelled via `labels['addressType:' + addressType]`.
 */
function AddressCardTypeBadge(props: { className?: string }) {
  const { derived, resolved } = useAddressCardContext();
  // Hidden when the host opts out (e.g. the heading already names the type).
  if (resolved.showTypeBadge === false) return null;
  if (!derived.addressType) return null;
  return (
    <span
      className={
        props.className ??
        'propeller-address-card__type-badge inline-block rounded bg-secondary/10 text-secondary text-xs px-2 py-1 mb-2'
      }
    >
      {derived.addressTypeLabel}
    </span>
  );
}

/**
 * Internal — renders the company name line. Kept private (not on the
 * compound API surface) to keep the public compound API focused on the
 * six sections listed in the spec. Honours `showCompanyName` (default true).
 */
function AddressCardCompany() {
  const { derived, resolved } = useAddressCardContext();
  if (resolved.showCompanyName === false) return null;
  if (!derived.company) return null;
  return <div className="propeller-address-card__company font-bold text-lg mb-1">{derived.company}</div>;
}

function AddressCardName(props: { className?: string }) {
  const { derived, resolved } = useAddressCardContext();
  if (resolved.showFullName === false) return null;
  if (!derived.fullName) return null;
  return (
    <div className={props.className ?? 'propeller-address-card__name font-medium mb-1'}>
      {derived.fullName}
    </div>
  );
}

function AddressCardAddressLines(props: { className?: string }) {
  const { derived, resolved } = useAddressCardContext();
  const showStreet = resolved.showStreet !== false && !!derived.streetLine;
  const showCity = !!derived.cityLine;
  if (!showStreet && !showCity) return null;
  if (props.className !== undefined) {
    return (
      <div className={props.className}>
        {showStreet ? <div>{derived.streetLine}</div> : null}
        {showCity ? <div>{derived.cityLine}</div> : null}
      </div>
    );
  }
  return (
    <>
      {showStreet ? (
        <div className="propeller-address-card__street text-muted-foreground">{derived.streetLine}</div>
      ) : null}
      {showCity ? (
        <div className="propeller-address-card__city text-muted-foreground">{derived.cityLine}</div>
      ) : null}
    </>
  );
}

function AddressCardCountry(props: { className?: string }) {
  const { derived, resolved } = useAddressCardContext();
  if (resolved.showCountry === false) return null;
  if (!derived.countryName) return null;
  return (
    <div className={props.className ?? 'propeller-address-card__country text-muted-foreground'}>
      {derived.countryName}
    </div>
  );
}

/**
 * Internal — renders the email line. Kept private; honours `showEmail`
 * (default false).
 */
function AddressCardEmail() {
  const { derived, resolved } = useAddressCardContext();
  if (!resolved.showEmail) return null;
  if (!derived.email) return null;
  return <div className="propeller-address-card__email text-muted-foreground">{derived.email}</div>;
}

/**
 * Internal — renders the phone line. Kept private; honours `showPhone`
 * (default false).
 */
function AddressCardPhone() {
  const { derived, resolved } = useAddressCardContext();
  if (!resolved.showPhone) return null;
  if (!derived.phone) return null;
  return <div className="propeller-address-card__phone text-muted-foreground">{derived.phone}</div>;
}

function AddressCardActions(props: { className?: string }) {
  const { resolved, actions, derived } = useAddressCardContext();
  if (resolved.enableActions === false) return null;
  return (
    <div
      className={
        props.className ??
        'propeller-address-card__actions mt-4 pt-4 border-t border-border-subtle flex flex-wrap gap-2'
      }
    >
      {resolved.enableEdit !== false ? (
        <button
          className="propeller-address-card__edit-btn text-primary hover:text-primary/80 text-sm font-medium"
          onClick={() => actions.onEdit()}
        >
          {getLabel(resolved.labels, 'edit', 'Edit')}
        </button>
      ) : null}
      {resolved.enableDelete !== false ? (
        <button
          className="propeller-address-card__delete-btn text-muted-foreground hover:text-foreground text-sm font-medium"
          onClick={() => actions.onDelete()}
        >
          {getLabel(resolved.labels, 'delete', 'Delete')}
        </button>
      ) : null}
      {resolved.enableSetDefault !== false && !derived.isDefault ? (
        <button
          className="propeller-address-card__default-btn text-primary hover:text-primary/80 text-sm font-medium ml-auto"
          onClick={() => actions.onSetDefault()}
        >
          {getLabel(resolved.labels, 'setDefault', 'Set Default')}
        </button>
      ) : null}
    </div>
  );
}

function AddressCardDefaultBadge(props: { className?: string }) {
  const { derived, resolved, address } = useAddressCardContext();
  if (resolved.showDefaultBadge !== true) return null;
  if (!derived.isDefault) return null;
  if (props.className !== undefined) {
    return (
      <div className={props.className}>
        Default {(address as { type?: string }).type} Address
      </div>
    );
  }
  return (
    <div className="mt-2">
      <span className="propeller-address-card__default-badge bg-secondary/10 text-secondary text-xs px-2 py-1 rounded-full">
        Default {(address as { type?: string }).type} Address
      </span>
    </div>
  );
}

type AddressCardComponent = typeof AddressCard & {
  TypeBadge: typeof AddressCardTypeBadge;
  Name: typeof AddressCardName;
  AddressLines: typeof AddressCardAddressLines;
  Country: typeof AddressCardCountry;
  Actions: typeof AddressCardActions;
  DefaultBadge: typeof AddressCardDefaultBadge;
};

const AddressCardExport = AddressCard as AddressCardComponent;
AddressCardExport.TypeBadge = AddressCardTypeBadge;
AddressCardExport.Name = AddressCardName;
AddressCardExport.AddressLines = AddressCardAddressLines;
AddressCardExport.Country = AddressCardCountry;
AddressCardExport.Actions = AddressCardActions;
AddressCardExport.DefaultBadge = AddressCardDefaultBadge;

export default AddressCardExport;
