'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState/useReducer).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

// Note: useState/useEffect were used for a hydration-gate (`isMounted`) that's
// unnecessary on this 'use client' component — see git history pre-2026-05-20.
import { Contact, Customer, Company, Address } from '@propeller-commerce/propeller-sdk-v2';
import { getCountryName as _getCountryName, getLabel } from '@propeller-commerce/propeller-v2-core-ui';
import { useInfraProps } from '../composables/react/useInfraProps';

export interface UserDetailsProps {
  /** The currently logged in user (Contact or Customer). Resolved from `<PropellerProvider>` when not passed explicitly. */
  user?: Contact | Customer | null;

  /**
   * The currently active company
   */
  activeCompany: Company | null;

  /**
   * Display basic company information for the default company if the user is Contact
   * @default true
   */
  showCompanyInfo?: boolean;

  /**
   * Display a list of all companies if the user is Contact
   * @default false
   */
  listAllContactCompanies?: boolean;

  /**
   * Display details of the user's default invoice address.
   * @default true
   */
  showDefaultInvoiceAddress?: boolean;

  /**
   * Display details of the user's default delivery address.
   * @default false
   */
  showDefaultDeliveryAddress?: boolean;

  /** Country code-to-name mapping for address display */
  countries?: {
    code: string;
    name: string;
  }[];

  /** Translated labels keyed by the slugs used inside the component (see
   * `getLabel` calls). Missing keys fall back to the English defaults. */
  labels?: Record<string, string>;
}
// Pure address helpers — hoisted to module scope; no `props` dependencies.
const getAddressName = (addr: Address): string =>
  [addr.firstName, addr.middleName, addr.lastName].filter(Boolean).join(' ');
const getAddressLine1 = (addr: Address): string =>
  [addr.street, addr.number, addr.numberExtension].filter(Boolean).join(' ');
const getAddressLine2 = (addr: Address): string =>
  [addr.postalCode, addr.city].filter(Boolean).join(' ');

/**
 * Renders a read-only profile panel showing the user's personal information,
 * company details (for Contacts) and default invoice/delivery addresses.
 */
function UserDetails(rawProps: UserDetailsProps) {
  const props = useInfraProps(rawProps);
  const isContact = props.user != null && 'company' in props.user;
  const name = props.user && props.user.firstName
    ? [props.user.firstName, props.user.lastName].filter(Boolean).join(' ')
    : getLabel(props.labels, 'userFallback', 'User');
  const activeCompany: Company | null = isContact ? props.activeCompany : null;
  const companies: Company[] = (() => {
    if (!isContact) return [];
    const contact = props.user as Contact;
    if (contact.companies?.items && contact.companies.items.length > 0) {
      return contact.companies.items;
    }
    return contact.company ? [contact.company] : [];
  })();
  const allAddresses: Address[] = isContact
    ? activeCompany?.addresses || []
    : ((props.user as Customer)?.addresses || []);
  const defaultInvoiceAddress: Address | null =
    allAddresses.find((a: Address) => a.type === 'invoice' && a.isDefault === 'Y') ?? null;
  const defaultDeliveryAddress: Address | null =
    allAddresses.find((a: Address) => a.type === 'delivery' && a.isDefault === 'Y') ?? null;
  const getCountryName = (code: string): string => _getCountryName(code, props.countries);
  const shouldShowCompanyInfo = props.showCompanyInfo !== false && isContact;
  const shouldListCompanies = props.listAllContactCompanies === true && isContact;
  const shouldShowInvoiceAddress = props.showDefaultInvoiceAddress !== false;
  const shouldShowDeliveryAddress = props.showDefaultDeliveryAddress === true;
  return (
    <div className="propeller-user-details space-y-6">
      <div className="propeller-user-details__section propeller-user-details__section--personal rounded-container bg-card text-card-foreground shadow-sm">
            <div className="propeller-user-details__section-header p-6 pb-2">
              <h3 className="propeller-user-details__section-title text-lg font-semibold">{getLabel(props.labels, 'personalInformation', 'Personal Information')}</h3>
            </div>
            <div className="propeller-user-details__section-body p-6 pt-2 space-y-4">
              <div className="propeller-user-details__field grid grid-cols-1 gap-1">
                <label className="propeller-user-details__field-label text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {getLabel(props.labels, 'nameLabel', 'Name')}
                </label>
                <div className="propeller-user-details__field-value font-medium">{name}</div>
              </div>
              <div className="propeller-user-details__field grid grid-cols-1 gap-1">
                <label className="propeller-user-details__field-label text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {getLabel(props.labels, 'emailLabel', 'Email')}
                </label>
                <div className="propeller-user-details__field-value font-medium">{props.user?.email}</div>
              </div>
            </div>
          </div>
          {shouldShowCompanyInfo && activeCompany ? (
            <div className="propeller-user-details__section propeller-user-details__section--company rounded-container bg-card text-card-foreground shadow-sm">
              <div className="propeller-user-details__section-header p-6 pb-2">
                <h3 className="propeller-user-details__section-title text-lg font-semibold">{getLabel(props.labels, 'companyInformation', 'Company Information')}</h3>
              </div>
              <div className="propeller-user-details__section-body p-6 pt-2 space-y-4">
                <div className="propeller-user-details__field grid grid-cols-1 gap-1">
                  <label className="propeller-user-details__field-label text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {getLabel(props.labels, 'companyNameLabel', 'Company Name')}
                  </label>
                  <div className="propeller-user-details__field-value font-medium">{activeCompany?.name}</div>
                </div>
                {activeCompany?.taxNumber ? (
                  <div className="propeller-user-details__field grid grid-cols-1 gap-1">
                    <label className="propeller-user-details__field-label text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {getLabel(props.labels, 'taxNumberLabel', 'Tax Number')}
                    </label>
                    <div className="propeller-user-details__field-value font-medium">{activeCompany?.taxNumber}</div>
                  </div>
                ) : null}
                {activeCompany?.cocNumber ? (
                  <div className="propeller-user-details__field grid grid-cols-1 gap-1">
                    <label className="propeller-user-details__field-label text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {getLabel(props.labels, 'cocNumberLabel', 'CoC Number')}
                    </label>
                    <div className="propeller-user-details__field-value font-medium">{activeCompany?.cocNumber}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {shouldListCompanies && companies.length > 0 ? (
            <div className="propeller-user-details__section propeller-user-details__section--companies rounded-container bg-card text-card-foreground shadow-sm">
              <div className="propeller-user-details__section-header p-6 pb-2">
                <h3 className="propeller-user-details__section-title text-lg font-semibold">{getLabel(props.labels, 'companies', 'Companies')}</h3>
              </div>
              <div className="propeller-user-details__section-body p-6 pt-2">
                <ul className="propeller-user-details__companies space-y-2">
                  {companies?.map((company) => (
                    <li
                      key={String(company.companyId)}
                      data-active={activeCompany?.companyId === company.companyId ? 'true' : 'false'}
                      className={`propeller-user-details__company flex items-center gap-2 py-2 px-3 rounded-control ${activeCompany?.companyId === company.companyId ? 'bg-primary/10 font-semibold text-primary' : 'text-foreground'}`}
                    >
                      <span className="propeller-user-details__company-name truncate">{company.name}</span>
                      {activeCompany?.companyId === company.companyId ? (
                        <span className="propeller-user-details__company-badge text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                          {getLabel(props.labels, 'activeBadge', 'Active')}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          {shouldShowInvoiceAddress || shouldShowDeliveryAddress ? (
            <div className="propeller-user-details__section propeller-user-details__section--addresses rounded-container bg-card text-card-foreground shadow-sm">
              <div className="propeller-user-details__section-header p-6 pb-2">
                <h3 className="propeller-user-details__section-title text-lg font-semibold">{getLabel(props.labels, 'defaultAddresses', 'Default Addresses')}</h3>
              </div>
              <div className="propeller-user-details__section-body p-6 pt-2">
                <div className="propeller-user-details__addresses grid grid-cols-1 md:grid-cols-2 gap-6">
                  {shouldShowInvoiceAddress ? (
                    <div className="propeller-user-details__address-group space-y-3" data-address="invoice">
                      <h4 className="propeller-user-details__address-title text-base font-bold">{getLabel(props.labels, 'invoiceAddress', 'Invoice Address')}</h4>
                      {defaultInvoiceAddress ? (
                        <div className="propeller-user-details__address-card bg-card p-4 rounded-container shadow-sm border border-border">
                          {defaultInvoiceAddress?.company ? (
                            <div className="propeller-user-details__address-company font-bold text-lg mb-1">
                              {defaultInvoiceAddress?.company}
                            </div>
                          ) : null}
                          {getAddressName(defaultInvoiceAddress!) ? (
                            <div className="propeller-user-details__address-name font-medium mb-1">
                              {getAddressName(defaultInvoiceAddress!)}
                            </div>
                          ) : null}
                          <div className="propeller-user-details__address-line text-muted-foreground">
                            {getAddressLine1(defaultInvoiceAddress!)}
                          </div>
                          <div className="propeller-user-details__address-line text-muted-foreground">
                            {getAddressLine2(defaultInvoiceAddress!)}
                          </div>
                          {defaultInvoiceAddress?.country ? (
                            <div className="propeller-user-details__address-country text-muted-foreground">
                              {getCountryName(defaultInvoiceAddress?.country || '')}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {!defaultInvoiceAddress ? (
                        <p className="propeller-user-details__address-empty text-muted-foreground italic">{getLabel(props.labels, 'noInvoiceAddress', 'No invoice address found')}</p>
                      ) : null}
                    </div>
                  ) : null}
                  {shouldShowDeliveryAddress ? (
                    <div className="propeller-user-details__address-group space-y-3" data-address="delivery">
                      <h4 className="propeller-user-details__address-title text-base font-bold">{getLabel(props.labels, 'deliveryAddress', 'Delivery Address')}</h4>
                      {defaultDeliveryAddress ? (
                        <div className="propeller-user-details__address-card bg-card p-4 rounded-container shadow-sm border border-border">
                          {defaultDeliveryAddress?.company ? (
                            <div className="propeller-user-details__address-company font-bold text-lg mb-1">
                              {defaultDeliveryAddress?.company}
                            </div>
                          ) : null}
                          {getAddressName(defaultDeliveryAddress!) ? (
                            <div className="propeller-user-details__address-name font-medium mb-1">
                              {getAddressName(defaultDeliveryAddress!)}
                            </div>
                          ) : null}
                          <div className="propeller-user-details__address-line text-muted-foreground">
                            {getAddressLine1(defaultDeliveryAddress!)}
                          </div>
                          <div className="propeller-user-details__address-line text-muted-foreground">
                            {getAddressLine2(defaultDeliveryAddress!)}
                          </div>
                          {defaultDeliveryAddress?.country ? (
                            <div className="propeller-user-details__address-country text-muted-foreground">
                              {getCountryName(defaultDeliveryAddress?.country || '')}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {!defaultDeliveryAddress ? (
                        <p className="propeller-user-details__address-empty text-muted-foreground italic">{getLabel(props.labels, 'noDeliveryAddress', 'No delivery address found')}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
    </div>
  );
}

export default UserDetails;
