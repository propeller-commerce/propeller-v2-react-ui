'use client';
/**
 * @rsc-blocked — Client-only component: interactive state (useState), typeahead,
 * file upload. Must render inside (or below) a Client Component boundary; cannot
 * be imported directly into a React Server Component.
 *
 * <QuickOrder> — a bulk "quick order" pad. Each row has a SKU/code typeahead;
 * selecting a match fills the row's name / net price / min-quantity / line total.
 * "Add to cart" resolves the user's cart and bulk-adds every resolved row in a
 * single `CartItemBulk` mutation (via {@link useQuickOrder}). Optionally accepts
 * a spreadsheet parser so users can upload an XLSX of code+quantity pairs.
 *
 * The typed code is only ever a *search term* — a row's product identity, name
 * and price always come from the API, never from the typed/uploaded value.
 */
import * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  Cart,
  Contact,
  Customer,
  GraphQLClient,
  MediaImageProductSearchInput,
  TransformationsInput,
} from '@propeller-commerce/propeller-sdk-v2';
import { getLabel, formatPrice as formatPriceHelper, localeForLanguage } from '@propeller-commerce/propeller-v2-core-ui';
import type { AnyUser } from '@propeller-commerce/propeller-v2-core-ui';
import { useInfraProps } from '../composables/react/useInfraProps';
import { useQuickOrder, type QuickOrderMatch } from '../composables/react/useQuickOrder';

// ── Row model ──────────────────────────────────────────────────────────────────

interface Row {
  /** Stable key for React lists (survives add/remove). */
  key: string;
  /** The typed/entered code. */
  code: string;
  /** Resolved product id — set once a match is chosen. */
  productId: number | null;
  clusterId?: number;
  name: string;
  netPrice: number;
  /** Editable quantity. */
  quantity: number;
  /** Minimum order quantity for the resolved product. */
  minQuantity: number;
  /** Typeahead candidates for this row (open dropdown). */
  matches: QuickOrderMatch[];
  /** `true` while this row's search is in flight. */
  searching: boolean;
  /** `true` once a search has completed for the current input (drives the
   *  "no results found" state — distinct from "not searched yet"). */
  searched: boolean;
}

let ROW_SEQ = 0;
function blankRow(): Row {
  ROW_SEQ += 1;
  return {
    key: `qo-${ROW_SEQ}`,
    code: '',
    productId: null,
    name: '',
    netPrice: 0,
    quantity: 1,
    minQuantity: 1,
    matches: [],
    searching: false,
    searched: false,
  };
}

// ── Props ──────────────────────────────────────────────────────────────────────

/** A parsed spreadsheet line: a product code and a desired quantity. */
export interface QuickOrderUploadLine {
  code: string;
  quantity: number;
}

export interface QuickOrderProps {
  /** The authenticated user. Resolved from PropellerProvider when omitted. */
  user?: Contact | Customer | null;
  /** GraphQL client. Resolved from PropellerProvider when omitted. */
  graphqlClient?: GraphQLClient;
  /** Active company id — scopes cart + pricing for B2B users. */
  companyId?: number;
  /** Language for search/cart queries. Defaults to `'NL'`. */
  language?: string;
  /** Currency symbol/code shown next to prices. Defaults to `'€'`. */
  currency?: string;
  /**
   * Image filters forwarded to the typeahead + cart queries so results carry
   * thumbnails. Pass the app's `imageSearchFiltersGrid` / `imageVariantFiltersSmall`
   * (the same values the SearchBar uses) — without them the API returns no image
   * variants and the dropdown shows no product images.
   */
  configuration?: {
    imageSearchFiltersGrid?: MediaImageProductSearchInput;
    imageVariantFiltersSmall?: TransformationsInput;
    /**
     * Catalog root the code search is scoped to. Required: without it the
     * typeahead and the upload resolve nothing, since searching outside a
     * category ignores orderlist scoping and would surface products the user
     * has no access to.
     */
    baseCategoryId?: number;
    /** The channel's anonymous user, seeded by the host. Scopes logged-out
     *  listings exactly like the SSR seed does. */
    anonymousUserId?: number;
  };
  /** Tax zone for price calculation. Defaults to `'NL'`. */
  taxZone?: string;
  /** Orderlist (contract) ids to scope the catalogue by. */
  orderlistIds?: number[];
  /** Set `false` to ignore `orderlistIds`. Defaults to true when ids are given. */
  applyOrderlists?: boolean;
  /** Number of blank rows to start with. Defaults to 5. */
  initialRows?: number;
  /** Minimum characters before the typeahead fires. Defaults to 3. */
  searchThreshold?: number;
  /** Typeahead debounce in ms. Defaults to 300. */
  debounceMs?: number;

  /**
   * Optional spreadsheet parser. When supplied, the XLSX upload panel is shown;
   * the app parses the file (e.g. via SheetJS) and returns code+quantity lines.
   * Kept as a prop so the package stays free of a heavy xlsx dependency — the
   * app owns the parser and loads it only on this page.
   */
  parseSpreadsheet?: (file: File) => Promise<QuickOrderUploadLine[]>;
  /** URL to a downloadable XLSX template (shown next to the upload control). */
  templateUrl?: string;

  /**
   * Called when the template link is clicked. Navigation is untouched — this is
   * a notification, not a handler: a buyer fetching the template is a
   * quick-order intent signal that otherwise leaves no trace at all.
   */
  onTemplateDownload?: () => void;
  /** Max upload file size in bytes. Defaults to 2 MB. */
  maxUploadBytes?: number;
  /** Max rows accepted from an upload. Defaults to 500. */
  maxUploadRows?: number;

  /** Format a price. Defaults to the shared `formatPrice` helper. */
  formatPrice?: (price: number) => string;
  /** Fires when the bulk add creates a fresh cart — persist the cart id. */
  onCartCreated?: (cart: Cart) => void;
  /** Fires after a successful add — receives the resulting cart. */
  afterAddToCart?: (cart: Cart) => void;
  /** Fires when some uploaded/entered codes could not be resolved. */
  onMissingCodes?: (codes: string[]) => void;
  /** Override base container styles. */
  className?: string;

  /** Localization label overrides. */
  labels?: {
    title?: string;
    uploadTitle?: string;
    uploadHint?: string;
    downloadTemplate?: string;
    selectFile?: string;
    upload?: string;
    colCode?: string;
    colName?: string;
    colPrice?: string;
    colQuantity?: string;
    colTotal?: string;
    addRow?: string;
    addToCart?: string;
    adding?: string;
    noResults?: string;
    alreadyInList?: string;
    noItems?: string;
    missingCodes?: string;
    remove?: string;
  };
}

// ── Component ───────────────────────────────────────────────────────────────────

function QuickOrderInner(props: QuickOrderProps) {
  const {
    companyId,
    language = 'NL',
    currency = '€',
    configuration,
    initialRows = 5,
    searchThreshold = 3,
    debounceMs = 300,
    parseSpreadsheet,
    templateUrl,
    maxUploadBytes = 2 * 1024 * 1024,
    maxUploadRows = 500,
    onCartCreated,
    afterAddToCart,
    onMissingCodes,
    className,
    labels,
  } = props;

  const user = (props.user ?? null) as AnyUser;
  const graphqlClient = props.graphqlClient!;
  // Price formatter — a consumer-supplied `formatPrice` wins (it owns its own
  // symbol); otherwise the shared helper renders the symbol via `symbol:
  // currency`. Either way the returned string already contains the symbol, so
  // call sites render `displayPrice(n)` directly (no manual `currency` prefix).
  const displayPrice = (n: number) =>
    props.formatPrice ? props.formatPrice(n) : formatPriceHelper(n, { symbol: currency, locale: localeForLanguage(props.language) });
  const L = (key: keyof NonNullable<QuickOrderProps['labels']>, fallback: string) =>
    getLabel(labels, key, fallback);

  const { submitting, searchProducts, submit } = useQuickOrder({
    graphqlClient,
    user,
    companyId,
    language,
    configuration,
    taxZone: props.taxZone,
    orderlistIds: props.orderlistIds,
    applyOrderlists: props.applyOrderlists,
    onCartCreated,
    afterAddToCart,
  });

  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: Math.max(1, initialRows) }, blankRow)
  );
  const [missing, setMissing] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const patchRow = useCallback((key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  // ── Typeahead ────────────────────────────────────────────────────────────
  const onCodeInput = useCallback(
    (key: string, value: string) => {
      // Typing invalidates any prior resolution for this row.
      patchRow(key, { code: value, productId: null, name: '', netPrice: 0, searched: false });
      setNotice(null);
      const timers = searchTimers.current;
      if (timers[key]) clearTimeout(timers[key]);
      if (value.trim().length < searchThreshold) {
        patchRow(key, { matches: [], searching: false, searched: false });
        return;
      }
      patchRow(key, { searching: true });
      timers[key] = setTimeout(async () => {
        const results = await searchProducts(value);
        // `searched: true` lets the dropdown show "No results found" for an
        // invalid code (matches is empty but a search actually ran).
        patchRow(key, { matches: results, searching: false, searched: true });
      }, debounceMs);
    },
    [patchRow, searchProducts, searchThreshold, debounceMs]
  );

  const selectMatch = useCallback(
    (key: string, match: QuickOrderMatch) => {
      // Reject duplicate SKUs already resolved in another row.
      const dup = rows.some((r) => r.key !== key && r.productId && r.code === match.sku);
      if (dup) {
        setNotice(L('alreadyInList', 'Product is already in the list'));
        patchRow(key, { code: '', matches: [], productId: null, name: '', netPrice: 0, searched: false });
        return;
      }
      patchRow(key, {
        code: match.sku,
        productId: match.productId,
        clusterId: match.clusterId,
        name: match.name,
        netPrice: match.netPrice,
        quantity: match.minQuantity,
        minQuantity: match.minQuantity,
        matches: [],
        searching: false,
        searched: false,
      });
    },
    [rows, patchRow, L]
  );

  const setQuantity = useCallback(
    (key: string, raw: string) => {
      const n = parseInt(raw, 10);
      setRows((prev) =>
        prev.map((r) =>
          r.key === key
            ? { ...r, quantity: Number.isFinite(n) && n > 0 ? Math.max(r.minQuantity, n) : r.minQuantity }
            : r
        )
      );
    },
    []
  );

  const addRow = useCallback(() => setRows((prev) => [...prev, blankRow()]), []);
  const removeRow = useCallback(
    (key: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev)),
    []
  );

  // Number of rows resolved to a product — gates the submit button.
  const resolvedCount = useMemo(() => rows.filter((r) => r.productId).length, [rows]);

  // ── XLSX upload ─────────────────────────────────────────────────────────────
  const onFileChosen = useCallback(
    async (file: File | undefined) => {
      if (!file || !parseSpreadsheet) return;
      setUploadError(null);
      setMissing([]);
      if (file.size > maxUploadBytes) {
        setUploadError(`File too large (max ${Math.round(maxUploadBytes / 1024 / 1024)} MB)`);
        return;
      }
      setUploading(true);
      try {
        let lines = await parseSpreadsheet(file);
        // Bound + sanitize: cap rows, coerce quantity to a positive int, drop empties.
        lines = lines
          .slice(0, maxUploadRows)
          .map((l) => ({ code: String(l.code ?? '').trim(), quantity: Math.max(1, parseInt(String(l.quantity), 10) || 1) }))
          .filter((l) => l.code.length > 0);
        if (!lines.length) {
          setUploadError('No valid rows found in the file');
          return;
        }
        // Resolve each code via search; take the first exact-SKU match, else the
        // top result. Codes with no match are reported, never silently dropped.
        const resolved: Row[] = [];
        const notFound: string[] = [];
        for (const line of lines) {
          const matches = await searchProducts(line.code);
          const exact =
            matches.find((m) => m.sku.toLowerCase() === line.code.toLowerCase()) || matches[0];
          if (!exact) {
            notFound.push(line.code);
            continue;
          }
          if (resolved.some((r) => r.productId === exact.productId)) continue; // dedup
          const row = blankRow();
          resolved.push({
            ...row,
            code: exact.sku,
            productId: exact.productId,
            clusterId: exact.clusterId,
            name: exact.name,
            netPrice: exact.netPrice,
            quantity: Math.max(exact.minQuantity, line.quantity),
            minQuantity: exact.minQuantity,
          });
        }
        if (resolved.length) {
          // Replace blank rows with the resolved ones, then a trailing blank row.
          setRows([...resolved, blankRow()]);
        }
        if (notFound.length) {
          setMissing(notFound);
          onMissingCodes?.(notFound);
        }
      } catch {
        setUploadError('Could not read the file');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [parseSpreadsheet, maxUploadBytes, maxUploadRows, searchProducts, onMissingCodes]
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const lines = rows
      .filter((r) => r.productId)
      .map((r) => ({ productId: r.productId!, quantity: r.quantity, clusterId: r.clusterId, code: r.code }));
    if (!lines.length) {
      setNotice(L('noItems', 'Add at least one product before submitting'));
      return;
    }
    const res = await submit(lines);
    if (res.success) {
      // Reset to a fresh pad.
      setRows(Array.from({ length: Math.max(1, initialRows) }, blankRow));
      setMissing([]);
      setNotice(null);
    } else {
      setNotice(res.error ?? 'Failed to add items to cart');
    }
  }, [rows, submit, initialRows, L]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={className ?? 'propeller-quick-order'}>
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Upload panel (only when a parser is supplied) */}
        {parseSpreadsheet ? (
          <div className="w-full lg:w-1/3">
            <h3 className="text-lg font-semibold mb-3 text-foreground">
              {L('uploadTitle', 'Upload Excel file')}
            </h3>
            {templateUrl ? (
              <a
                href={templateUrl}
                target="_blank"
                rel="noopener nofollow"
                className="text-primary hover:underline text-sm inline-block mb-4"
                onClick={() => props.onTemplateDownload?.()}
              >
                {L('downloadTemplate', 'Download XLSX template')}
              </a>
            ) : null}
            <p className="text-xs text-muted-foreground mb-3">
              {L('uploadHint', 'Column A: article no. / SKU — Column B: quantity. First two rows are ignored.')}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              onChange={(e) => onFileChosen(e.target.files?.[0])}
              disabled={uploading}
            />
            {uploading ? (
              <p className="text-sm text-muted-foreground mt-2">{L('upload', 'Uploading…')}</p>
            ) : null}
            {uploadError ? <p className="text-sm text-destructive mt-2">{uploadError}</p> : null}
          </div>
        ) : null}

        {/* Manual row pad */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-3 text-foreground">
            {L('title', 'Add your products manually')}
          </h3>

          {/* Header */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-2 pb-2 text-xs font-medium text-muted-foreground border-b border-border">
            <div className="col-span-3">{L('colCode', 'Article no. / SKU')}</div>
            <div className="col-span-3">{L('colName', 'Product name')}</div>
            <div className="col-span-2">{L('colPrice', 'excl. VAT')}</div>
            <div className="col-span-1">{L('colQuantity', 'Qty')}</div>
            <div className="col-span-2 text-right">{L('colTotal', 'Total')}</div>
            <div className="col-span-1" />
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.key} className="grid grid-cols-12 gap-2 items-center py-2 relative">
                {/* Code + typeahead */}
                <div className="col-span-12 md:col-span-3 relative">
                  <input
                    type="text"
                    value={r.code}
                    onChange={(e) => onCodeInput(r.key, e.target.value)}
                    readOnly={!!r.productId}
                    placeholder={L('colCode', 'Article no. / SKU')}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {(r.searching || r.matches.length > 0 || r.searched) && !r.productId ? (
                    <ul className="absolute z-20 mt-1 w-[320px] max-w-[90vw] bg-card border border-border rounded shadow-lg max-h-72 overflow-auto">
                      {r.searching ? (
                        <li className="px-3 py-2 text-sm text-muted-foreground">…</li>
                      ) : r.matches.length ? (
                        r.matches.map((m) => (
                          <li key={`${r.key}-${m.productId}`}>
                            <button
                              type="button"
                              onClick={() => selectMatch(r.key, m)}
                              className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-muted text-sm"
                            >
                              {m.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.imageUrl} alt="" width={32} height={32} className="rounded object-cover" />
                              ) : null}
                              <span className="flex-1">
                                <span className="block text-foreground">{m.name}</span>
                                {m.sku ? (
                                  <span className="block text-xs text-muted-foreground">SKU: {m.sku}</span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="px-3 py-2 text-sm text-muted-foreground">
                          {L('noResults', 'No results found')}
                        </li>
                      )}
                    </ul>
                  ) : null}
                </div>

                {/* Name */}
                <div className="col-span-6 md:col-span-3">
                  <input
                    type="text"
                    value={r.name}
                    disabled
                    className="w-full rounded border border-input bg-muted/40 px-2 py-1.5 text-sm text-muted-foreground"
                  />
                </div>

                {/* Net price */}
                <div className="col-span-3 md:col-span-2">
                  <input
                    type="text"
                    value={r.productId ? displayPrice(r.netPrice) : ''}
                    disabled
                    className="w-full rounded border border-input bg-muted/40 px-2 py-1.5 text-sm text-muted-foreground"
                  />
                </div>

                {/* Quantity */}
                <div className="col-span-3 md:col-span-1">
                  <input
                    type="number"
                    min={r.minQuantity}
                    step={1}
                    value={r.productId ? r.quantity : ''}
                    disabled={!r.productId}
                    onChange={(e) => setQuantity(r.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault();
                    }}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted/40"
                  />
                </div>

                {/* Line total */}
                <div className="col-span-9 md:col-span-2 text-right text-sm text-foreground whitespace-nowrap">
                  {r.productId ? displayPrice(r.netPrice * r.quantity) : ''}
                </div>

                {/* Remove */}
                <div className="col-span-3 md:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeRow(r.key)}
                    aria-label={L('remove', 'Remove')}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add row */}
          <button
            type="button"
            onClick={addRow}
            className="mt-3 text-primary hover:underline text-sm font-medium"
          >
            + {L('addRow', 'Add more rows')}
          </button>

          {/* Missing codes */}
          {missing.length ? (
            <p className="text-sm text-destructive mt-4">
              {L('missingCodes', 'The following products were not added:')} {missing.join(', ')}
            </p>
          ) : null}
          {notice ? <p className="text-sm text-destructive mt-2">{notice}</p> : null}

          {/* Submit */}
          <div className="flex items-center justify-end mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || resolvedCount === 0}
              className="bg-primary text-primary-foreground px-6 py-2.5 rounded font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? L('adding', 'Adding…') : L('addToCart', 'Add to cart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Resolves infra props (graphqlClient/user/companyId/language) from context. */
export default function QuickOrder(rawProps: QuickOrderProps) {
  const props = useInfraProps(rawProps) as QuickOrderProps;
  return <QuickOrderInner {...props} />;
}
