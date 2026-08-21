'use client';
/**
 * @rsc-blocked — Client-only component: browser-only APIs (window/document/storage).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useState, useRef, useEffect } from 'react';
import { Contact, Company, GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';
import { useCompany } from '../composables/react/useCompany';
import { getLabel } from '@propeller-commerce/propeller-v2-core-ui';

export interface CompanySwitcherProps {
  /** The contact to whom the companies are assigned. Default company is user.company, all companies are in user.companies. */
  user: Contact;

  /** GraphQL client for the Propeller SDK */
  graphqlClient?: GraphQLClient;

  /** Icon identifier for the company switcher trigger button. @default 'default-company-switch-icon' */
  icon?: string;

  /** Currently selected company ID (from CompanyContext). Syncs the switcher with external state. */
  selectedCompanyId?: number;

  /** Callback fired when the user selects a company. */
  onCompanyChange: (company: Company) => void;

  /** Translated labels keyed by the slugs used inside the component (see
   * `getLabel` calls). Missing keys fall back to the English defaults. */
  labels?: Record<string, string>;
}

/**
 * Dropdown for switching the active company of a multi-company contact.
 *
 * @remarks Uses {@link useCompany} for SDK access; the company list is derived
 * from the `user` prop.
 */
function CompanySwitcher(props: CompanySwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(() => false);
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(() => null);

  // useCompany provides SDK methods; company list is derived from user prop.
  // graphqlClient is allowed to be null/undefined — useCompany's CRUD methods
  // short-circuit until the client is ready.
  useCompany({ graphqlClient: props.graphqlClient });

  function getCompanies(): Company[] {
    // AuthContext now runs the cached user through toPlain(), so the SDK
    // CompaniesResponse shape is canonical (.items, not ._items).
    const items = props.user.companies?.items;
    if (Array.isArray(items) && items.length > 0) {
      return items;
    }
    const defaultCompany = props.user.company;
    if (defaultCompany) {
      return [defaultCompany];
    }
    return [];
  }

  function getActiveCompany(): Company | null {
    const idToUse = activeCompanyId ?? (props.selectedCompanyId as number | undefined) ?? null;
    if (idToUse !== null) {
      const companies = getCompanies();
      const found = companies.find((c: Company) => c.companyId === idToUse);
      return found ?? null;
    }
    return (props.user.company as Company | undefined) ?? null;
  }

  function getActiveCompanyName(): string {
    const company = getActiveCompany();
    return company ? company.name : 'Select company';
  }

  function getIcon(): string {
    return props.icon ?? 'default-company-switch-icon';
  }

  function isActive(company: Company): boolean {
    const active = getActiveCompany();
    return active !== null && active.companyId === company.companyId;
  }

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function selectCompany(company: Company) {
    setActiveCompanyId(company.companyId);
    setIsOpen(false);
    props.onCompanyChange(company);
  }

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div
      className="propeller-company-switcher relative inline-block"
      ref={containerRef}
      data-open={isOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-label={getLabel(props.labels, 'switchCompanyAriaLabel', 'Switch company')}
        className="propeller-company-switcher__trigger flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-white/10"
        onClick={(event) => toggleDropdown()}
        aria-expanded={isOpen}
      >
        <span
          aria-hidden="true"
          className={`propeller-company-switcher__icon icon-${getIcon()} flex-shrink-0`}
        />
        <span className="propeller-company-switcher__label truncate max-w-[160px]">
          {getActiveCompanyName()}
        </span>
        <span
          aria-hidden="true"
          className={`propeller-company-switcher__chevron flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'}`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </span>
      </button>
      {isOpen ? (
        <ul
          role="listbox"
          aria-label={getLabel(props.labels, 'companiesAriaLabel', 'Companies')}
          className="propeller-company-switcher__dropdown absolute left-0 top-full z-[60] mt-1 min-w-[220px] rounded-md border border-border bg-popover text-popover-foreground shadow-lg py-1 animate-in fade-in zoom-in-95 duration-150"
        >
          {getCompanies()?.map((company) => (
            <li
              role="option"
              key={String(company.companyId)}
              aria-selected={isActive(company)}
              onClick={(event) => selectCompany(company)}
              className={`propeller-company-switcher__option flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground ${isActive(company) ? 'font-semibold text-primary' : 'font-normal text-foreground'}`}
            >
              <span className="propeller-company-switcher__option-name flex-1 truncate">{company.name}</span>
              {isActive(company) ? (
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="propeller-company-switcher__option-check flex-shrink-0 w-4 h-4 text-primary"
                >
                  <path d="M2.5 8l4 4 7-7" />
                </svg>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default CompanySwitcher;
