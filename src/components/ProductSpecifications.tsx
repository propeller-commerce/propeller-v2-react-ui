'use client';
/**
 * @rsc-blocked — Client-only component: side effects (useEffect).
 * Must be rendered inside (or below) a Client Component boundary; cannot be
 * imported directly into a React Server Component. The 'use client' header
 * above marks this boundary to Next.js.
 */
import * as React from 'react';

import { useEffect } from 'react';
import {
  AttributeResult,
  AttributeType,
  GraphQLClient,
  LocalizedString,
} from '@propeller-commerce/propeller-sdk-v2';
import type {
  AttributeTextValue,
  AttributeEnumValue,
  AttributeIntValue,
  AttributeDecimalValue,
  AttributeColorValue,
  AttributeDateTimeValue,
} from '@propeller-commerce/propeller-sdk-v2';
import { useProductSpecs } from '../composables/react/useProductSpecs';
import { useInfraProps } from '../composables/react/useInfraProps';
import { cn } from '../composables/shared/utils/cn';

export interface ProductSpecificationsProps {
  /**
   * Initialised Propeller SDK GraphQL client.
   * Required when `productId` is set — used to fetch public attributes.
   */
  graphqlClient?: GraphQLClient;

  /**
   * Product ID to fetch attributes for.
   */
  productId?: number;

  /**
   * Pre-fetched attribute result items used as fallback when `productId` is not provided.
   * When `productId` is provided the component fetches its own data and this prop is ignored.
   */
  attributes?: AttributeResult[];

  /**
   * Language code used to resolve localised attribute labels.
   * Defaults to 'NL'.
   */
  language?: string;

  /**
   * Display layout for the specifications.
   * 'table' — two-column table (name | value). Default.
   * 'list'  — vertical label + value stacked rows.
   */
  layout?: string;

  /**
   * When true, groups attributes by their group field with a heading per section.
   * When false or omitted, displays a flat ungrouped table/list. Default: false.
   */
  grouping?: boolean;

  /**
   * Optional package-description string (e.g. contents / packaging notes),
   * rendered above the attribute table. Omitted when empty.
   */
  packageDescription?: string;

  /**
   * Render arbitrary content at the START of the specifications, before the
   * fetched attribute rows. Receives the active `layout` so the consumer can
   * return markup that fits the container:
   *  - `'table'` → return one or more `<tr>` (injected inside `<tbody>`), e.g.
   *    a labelled "Unit of measure" row.
   *  - `'list'`  → return block element(s) (injected inside the list stack).
   * In grouped mode it renders once, above the first group. Return
   * `null`/`undefined` to render nothing.
   */
  beforeSpecs?: (ctx: { layout: 'table' | 'list' }) => React.ReactNode;

  /**
   * Render arbitrary content at the END of the specifications, after the
   * fetched attribute rows. Same `layout` contract as {@link beforeSpecs}.
   * In grouped mode it renders once, below the last group.
   */
  afterSpecs?: (ctx: { layout: 'table' | 'list' }) => React.ReactNode;

  /** Extra CSS class applied to the root element. */
  className?: string;
}

/**
 * Renders a product's public attributes as a specifications table or list,
 * optionally grouped by attribute group.
 *
 * @remarks Uses {@link useProductSpecs} to fetch attribute data.
 */
function ProductSpecifications(rawProps: ProductSpecificationsProps) {
  // Explicit props win; otherwise infra is resolved from <PropellerProvider>.
  const props = useInfraProps(rawProps);
  const { attributes: fetchedAttributes, loading, fetchSpecs } = useProductSpecs(
    props.graphqlClient
      ? { graphqlClient: props.graphqlClient, language: props.language }
      : { graphqlClient: {} as GraphQLClient, language: props.language }
  );

  function getAttributes(): AttributeResult[] {
    // Prefer fetched internalAttributes; fall back to props.attributes
    const attrs = fetchedAttributes.length
      ? fetchedAttributes
      : (props.attributes as AttributeResult[]) || [];
    return attrs.filter(
      (a: AttributeResult) =>
        a.attributeDescription?.isPublic === true &&
        getAttributeValue(a) !== '' &&
        getAttributeValue(a) !== null &&
        getAttributeValue(a) !== '0'
    );
  }

  function getGroups(): string[] {
    const attrs = getAttributes();
    const seen: string[] = [];
    attrs.forEach((a: AttributeResult) => {
      const group = a.attributeDescription?.group || '';
      if (!seen.includes(group)) seen.push(group);
    });
    return seen;
  }

  function getAttributesByGroup(group: string): AttributeResult[] {
    return getAttributes().filter(
      (a: AttributeResult) => (a.attributeDescription?.group || '') === group
    );
  }

  /**
   * A localized list carries only the languages someone actually authored, so
   * asking for one nobody wrote returns nothing — it does NOT fall back. On a
   * partially translated catalogue a strict match therefore printed the raw PIM
   * code (`QUANTORE_70001706`) as the label and emptied the whole table, since
   * `getAttributes()` drops rows whose value resolves to ''. Prefer
   * the active language, else any translation that exists.
   */
  function pickLocalized<T extends { language?: string | null }>(
    rows: T[] | null | undefined,
    isUsable: (row: T) => boolean,
  ): T | undefined {
    const list = (rows || []).filter(isUsable);
    const lang = ((props.language as string) || 'NL').toUpperCase();
    // Case-insensitive: the storefront language is uppercase but PIM data is
    // not guaranteed to be.
    return list.find((row) => (row.language || '').toUpperCase() === lang) || list[0];
  }

  function getAttributeLabel(attr: AttributeResult): string {
    const match = pickLocalized<LocalizedString>(
      attr.attributeDescription?.descriptions,
      (d) => !!d.value,
    );
    // Last resort is the attribute's internal name — better than a blank cell,
    // but it is a PIM code, so it should only ever appear for an attribute with
    // no description in any language.
    return match?.value || attr.attributeDescription?.name || '';
  }

  function getAttributeValue(attr: AttributeResult): string {
    const v = attr.value;
    if (!v) return '';
    // AttributeValue is a discriminated union by `type`. The SDK's base
    // interface only types `value: any`; each concrete attribute type adds a
    // field with the type-specific shape. We cast through the corresponding
    // SDK type per branch to get real autocompletion / safety on the field
    // we expect to read.
    if (v.type === AttributeType.TEXT) {
      const tv = v as AttributeTextValue;
      // Same fallback as the label, and `isUsable` skips the empty rows the
      // backend really does return (e.g. `{ language: 'FR', values: [] }`) —
      // without that check the first entry can win and blank the row.
      const entry = pickLocalized(tv.textValues, (row) =>
        (row?.values || []).some(Boolean),
      );
      const vals = (entry?.values || []).filter(Boolean);
      return vals.join(', ');
    }
    if (v.type === AttributeType.ENUM) {
      const ev = v as AttributeEnumValue;
      const vals = (ev.enumValues || []).filter(Boolean);
      return vals.join(', ');
    }
    if (v.type === AttributeType.INT) {
      const iv = v as AttributeIntValue;
      return iv.intValue !== null && iv.intValue !== undefined ? String(iv.intValue) : '';
    }
    if (v.type === AttributeType.DECIMAL) {
      const dv = v as AttributeDecimalValue;
      return dv.decimalValue !== null && dv.decimalValue !== undefined ? String(dv.decimalValue) : '';
    }
    if (v.type === AttributeType.DATETIME) {
      return (v as AttributeDateTimeValue).dateTimeValue || '';
    }
    if (v.type === AttributeType.COLOR) {
      return (v as AttributeColorValue).colorValue || '';
    }
    const fallback = v.value;
    if (fallback === null || fallback === undefined) return '';
    if (typeof fallback === 'boolean') return fallback ? 'Yes' : 'No';
    return String(fallback);
  }

  function hasPublicAttributes(): boolean {
    return getAttributes().length > 0;
  }

  useEffect(() => {
    if (!props.productId || !props.graphqlClient) return;
    fetchSpecs(props.productId);
  }, [props.productId]);

  const layoutMode: 'table' | 'list' = (props.layout as string) === 'list' ? 'list' : 'table';
  const before = props.beforeSpecs?.({ layout: layoutMode });
  const after = props.afterSpecs?.({ layout: layoutMode });
  const hasSlotContent = before != null || after != null;

  return (
    <>
      {!loading && (hasPublicAttributes() || props.packageDescription || hasSlotContent) ? (
        <>
          <div
            className={cn(`propeller-product-specifications ${(props.className as string) || ''}`)}
            data-layout={(props.layout as string) === 'list' ? 'list' : 'table'}
            data-grouped={props.grouping ? 'true' : 'false'}
          >
            {props.packageDescription ? (
              <p className="propeller-product-specifications__package-description mb-4 text-sm text-muted-foreground">
                {props.packageDescription}
              </p>
            ) : null}
            {!props.grouping ? (
              <>
                {(props.layout as string) !== 'list' ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-border">
                        {before}
                        {getAttributes()?.map((attr, i) => (
                          <tr className="propeller-product-specifications__row odd:bg-card even:bg-muted/20" key={i}>
                            <td className="px-4 py-2 font-medium text-foreground w-1/2">
                              {getAttributeLabel(attr)}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {getAttributeValue(attr)}
                            </td>
                          </tr>
                        ))}
                        {after}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {(props.layout as string) === 'list' ? (
                  <div className="space-y-3">
                    {before}
                    {getAttributes()?.map((attr, i) => (
                      <div className="flex flex-col gap-0.5" key={i}>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {getAttributeLabel(attr)}
                        </span>
                        <span className="text-sm text-foreground">{getAttributeValue(attr)}</span>
                      </div>
                    ))}
                    {after}
                  </div>
                ) : null}
              </>
            ) : null}
            {!!props.grouping ? (
              <>
                {before ? (
                  layoutMode === 'table' ? (
                    <div className="mb-6 overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border">{before}</tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mb-6 space-y-3">{before}</div>
                  )
                ) : null}
                {getGroups()?.map((group) => (
                  <div className="mb-6" key={group}>
                    {!!group ? (
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {group}
                      </h4>
                    ) : null}
                    {(props.layout as string) !== 'list' ? (
                      <div className="overflow-hidden rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-border">
                            {getAttributesByGroup(group)?.map((attr, i) => (
                              <tr className="propeller-product-specifications__row odd:bg-card even:bg-muted/20" key={i}>
                                <td className="px-4 py-2 font-medium text-foreground w-1/2">
                                  {getAttributeLabel(attr)}
                                </td>
                                <td className="px-4 py-2 text-muted-foreground">
                                  {getAttributeValue(attr)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {(props.layout as string) === 'list' ? (
                      <div className="space-y-3">
                        {getAttributesByGroup(group)?.map((attr, i) => (
                          <div className="flex flex-col gap-0.5" key={i}>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              {getAttributeLabel(attr)}
                            </span>
                            <span className="text-sm text-foreground">
                              {getAttributeValue(attr)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {after ? (
                  layoutMode === 'table' ? (
                    <div className="mb-6 overflow-hidden rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-border">{after}</tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-3">{after}</div>
                  )
                ) : null}
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}

export default ProductSpecifications;
