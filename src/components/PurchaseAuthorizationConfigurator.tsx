'use client';
/**
 * @rsc-blocked — Client-only component: context reads (useAuth/useCart/useInfraProps/etc.).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { Contact, Customer, Gender, GraphQLClient, PurchaseAuthorizationConfig, PurchaseAuthorizationConfigCreateInput, PurchaseRole, RegisterContactInput } from '@propeller-commerce/propeller-sdk-v2';
import { usePurchaseAuthorizationConfigurator } from '../composables/react/usePurchaseAuthorization';
import { useInfraProps } from '../composables/react/useInfraProps';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { cn } from '../composables/shared/utils/cn';

export interface PurchaseAuthorizationConfiguratorProps {
  /** GraphQL client for the Propeller SDK. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;

  /** The logged-in user. Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer;

  /** The companyId of the current selected company. Resolved from PropellerProvider when omitted. */
  companyId?: number;

  /**
   * Adds a button "Add contact" above the contacts list and enables registering contacts
   * @default true
   */
  allowContactCreate?: boolean;

  /** Fires before a contact is added to the company */
  beforeContactCreate?: (input: RegisterContactInput) => void;

  /** Override: fires instead of the default UserService.registerContact() call */
  onContactCreate?: (input: RegisterContactInput) => void;

  /** Fires after a contact is registered. If not provided, refreshes contacts list. */
  afterContactCreate?: (contact: Contact) => void;

  /** Override: fires instead of the default PurchaseAuthorizationConfigCreateInput() call */
  onPurchaseAuthorizationCreate?: (pac: PurchaseAuthorizationConfigCreateInput) => void;

  /** Fires after a PAC is created. If not provided, refreshes contacts list. */
  afterPurchaseAuthorizationCreate?: (pac: PurchaseAuthorizationConfig) => void;

  /** Override: fires instead of the default updatePurchaseAuthorizationConfig() call */
  onPurchaseAuthorizationUpdate?: (pac: PurchaseAuthorizationConfig) => void;

  /** Fires after a PAC is updated. If not provided, refreshes contacts list. */
  afterPurchaseAuthorizationUpdate?: (pac: PurchaseAuthorizationConfig) => void;

  /** Override: fires instead of the default deletePurchaseAuthorizationConfig() call */
  onPurchaseAuthorizationDelete?: (pac: PurchaseAuthorizationConfig) => void;

  /** Fires after a PAC is deleted. If not provided, refreshes contacts list. */
  afterPurchaseAuthorizationDelete?: (deleted: boolean) => void;

  /** Labels for the component */
  labels?: Record<string, string>;

  /** Custom CSS class for the component */
  className?: string;

  /** Configuration object from the application */
  configuration?: Record<string, any>;
}

/**
 * Renders the authorization-manager table for assigning purchase roles and
 * spending limits to company contacts, with an "Add contact" modal.
 *
 * @remarks Uses {@link usePurchaseAuthorizationConfigurator} for contact and
 * purchase-authorization-config data and mutations.
 */
function PurchaseAuthorizationConfigurator(rawProps: PurchaseAuthorizationConfiguratorProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const {
    company, loading, contacts, totalPages, currentPage, isAuthManager,
    showAddContactModal, addContactForm, addContactLoading, addContactError,
    hasPac, isCurrentUser, isRowDirty, getRowRole, getRowLimit, isRowLoading,
    handleRoleChange, handleLimitChange, handleCreate, handleSave, handleDelete,
    handlePageChange, openAddContactModal, closeAddContactModal, setAddContactForm,
    handleAddContactSubmit,
  } = usePurchaseAuthorizationConfigurator({
    graphqlClient: props.graphqlClient!,
    user: props.user ?? null,
    companyId: props.companyId!,
    beforeContactCreate: props.beforeContactCreate,
    onContactCreate: props.onContactCreate,
    afterContactCreate: props.afterContactCreate,
    onPurchaseAuthorizationCreate: props.onPurchaseAuthorizationCreate,
    afterPurchaseAuthorizationCreate: props.afterPurchaseAuthorizationCreate,
    onPurchaseAuthorizationUpdate: props.onPurchaseAuthorizationUpdate,
    afterPurchaseAuthorizationUpdate: props.afterPurchaseAuthorizationUpdate,
    onPurchaseAuthorizationDelete: props.onPurchaseAuthorizationDelete,
    afterPurchaseAuthorizationDelete: props.afterPurchaseAuthorizationDelete,
  });

  

  return (
    <div className={cn(`propeller-purchase-authorization-configurator ${props.className || ''}`)}>
      {isAuthManager ? (
        <>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {getLabel(props.labels, 'title', 'Purchase Authorization Settings')}
              </h2>
              {props.allowContactCreate !== false ? (
                <button
                  type="button"
                  className="propeller-purchase-authorization-configurator__add-btn flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-container hover:bg-primary/80 transition text-sm font-medium"
                  onClick={() => openAddContactModal()}
                >
                  {getLabel(props.labels, 'addContact', 'Add contact')}
                </button>
              ) : null}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : null}
            {!loading ? (
              <>
                <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {getLabel(props.labels, 'colId', 'ID')}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {getLabel(props.labels, 'colName', 'Name')}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {getLabel(props.labels, 'colRole', 'Role')}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {getLabel(props.labels, 'colLimit', 'Limit')}
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                          {getLabel(props.labels, 'colActions', 'Actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {contacts.map((contact) => (
                        <tr className="hover:bg-muted/30 transition-colors" key={contact.contactId}>
                          <td className="px-4 py-3 text-muted-foreground">{contact.contactId}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium">
                              {[contact.firstName, contact.middleName, contact.lastName]
                                .filter(Boolean)
                                .join(' ')}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">{contact.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="border border-input rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                              value={getRowRole(contact.contactId)}
                              disabled={isCurrentUser(contact.contactId)}
                              onChange={(e) => handleRoleChange(contact.contactId, e.target.value)}
                            >
                              <option value="">{getLabel(props.labels, 'selectRole', '— Select role —')}</option>
                              <option value={PurchaseRole.PURCHASER}>
                                {getLabel(props.labels, 'rolePurchaser', 'Purchaser')}
                              </option>
                              <option value={PurchaseRole.AUTHORIZATION_MANAGER}>
                                {getLabel(props.labels, 'roleManager', 'Authorization Manager')}
                              </option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            {getRowRole(contact.contactId) === PurchaseRole.PURCHASER ? (
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="w-28 border border-input rounded-md px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                value={getRowLimit(contact.contactId) ?? ''}
                                disabled={isCurrentUser(contact.contactId)}
                                onChange={(e) => handleLimitChange(contact.contactId, e.target.value)}
                                placeholder={getLabel(props.labels, 'limitPlaceholder', '0.00')}
                              />
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {hasPac(contact.contactId) && isRowDirty(contact.contactId) ? (
                                <button
                                  type="button"
                                  className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-control hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={isRowLoading(contact.contactId)}
                                  onClick={() => handleSave(contact.contactId)}
                                >
                                  {isRowLoading(contact.contactId) ? (
                                    <span className="inline-block w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1" />
                                  ) : null}
                                  {getLabel(props.labels, 'save', 'Save')}
                                </button>
                              ) : null}
                              {!hasPac(contact.contactId) ? (
                                <button
                                  type="button"
                                  className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-control hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={isRowLoading(contact.contactId) || !getRowRole(contact.contactId)}
                                  onClick={() => handleCreate(contact.contactId)}
                                >
                                  {isRowLoading(contact.contactId) ? (
                                    <span className="inline-block w-3 h-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-1" />
                                  ) : null}
                                  {getLabel(props.labels, 'create', 'Create')}
                                </button>
                              ) : null}
                              {hasPac(contact.contactId) ? (
                                <button
                                  type="button"
                                  className="text-xs border border-border px-3 py-1.5 rounded-control hover:bg-surface-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={isRowLoading(contact.contactId) || isCurrentUser(contact.contactId)}
                                  onClick={() => handleDelete(contact.contactId)}
                                >
                                  {isRowLoading(contact.contactId) ? (
                                    <span className="inline-block w-3 h-3 border-2 border-foreground border-t-transparent rounded-full animate-spin mr-1" />
                                  ) : null}
                                  {getLabel(props.labels, 'delete', 'Delete')}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 ? (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={currentPage <= 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                    >
                      {getLabel(props.labels, 'previous', 'Previous')}
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {getLabel(props.labels, 'page', 'Page')} {currentPage} {getLabel(props.labels, 'of', 'of')} {totalPages}
                    </span>
                    <button
                      type="button"
                      className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={currentPage >= totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                    >
                      {getLabel(props.labels, 'next', 'Next')}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
          {showAddContactModal ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50"
              onClick={() => closeAddContactModal()}
            >
              <div
                className="bg-background rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{getLabel(props.labels, 'addContactTitle', 'Add Contact')}</h3>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition"
                    aria-label={getLabel(props.labels, 'closeLabel', 'Close')}
                    onClick={() => closeAddContactModal()}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{getLabel(props.labels, 'companyName', 'Company')}</label>
                  <input
                    type="text"
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-muted cursor-not-allowed"
                    readOnly
                    value={(company as any)?.name ?? ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{getLabel(props.labels, 'gender', 'Gender')}</label>
                  <select
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={addContactForm.gender}
                    onChange={(e) => setAddContactForm({ ...addContactForm, gender: e.target.value })}
                  >
                    <option value="">{getLabel(props.labels, 'selectGender', '— Select —')}</option>
                    <option value={Gender.M}>{getLabel(props.labels, 'genderM', 'Male')}</option>
                    <option value={Gender.F}>{getLabel(props.labels, 'genderF', 'Female')}</option>
                    <option value={Gender.U}>{getLabel(props.labels, 'genderU', 'Unspecified')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{getLabel(props.labels, 'email', 'Email')} *</label>
                  <input
                    type="email"
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={addContactForm.email}
                    onChange={(e) => setAddContactForm({ ...addContactForm, email: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">{getLabel(props.labels, 'firstName', 'First name')}</label>
                    <input
                      type="text"
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      value={addContactForm.firstName}
                      onChange={(e) => setAddContactForm({ ...addContactForm, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{getLabel(props.labels, 'middleName', 'Middle')}</label>
                    <input
                      type="text"
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      value={addContactForm.middleName}
                      onChange={(e) => setAddContactForm({ ...addContactForm, middleName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{getLabel(props.labels, 'lastName', 'Last name')}</label>
                    <input
                      type="text"
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      value={addContactForm.lastName}
                      onChange={(e) => setAddContactForm({ ...addContactForm, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{getLabel(props.labels, 'phone', 'Phone')}</label>
                  <input
                    type="tel"
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={addContactForm.phone}
                    onChange={(e) => setAddContactForm({ ...addContactForm, phone: e.target.value })}
                  />
                </div>
                {addContactError ? (
                  <p className="text-sm text-destructive">
                    {/* Server errors are unlocalised; `addContactFailed` replaces
                        them outright when supplied. */}
                    {props.labels?.addContactFailed || addContactError}
                  </p>
                ) : null}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition"
                    onClick={() => closeAddContactModal()}
                  >
                    {getLabel(props.labels, 'cancel', 'Cancel')}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-control hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={addContactLoading || !addContactForm.email}
                    onClick={() => handleAddContactSubmit()}
                  >
                    {addContactLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : null}
                    {getLabel(props.labels, 'addContactSubmit', 'Add Contact')}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default PurchaseAuthorizationConfigurator;
