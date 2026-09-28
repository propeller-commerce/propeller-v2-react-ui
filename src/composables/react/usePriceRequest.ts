'use client';
/**
 * usePriceRequest — the price-request list plus its submission.
 *
 * Products whose price is quoted (`priceData.display === 'ON_REQUEST'`) cannot
 * be ordered, so they collect here instead of in the cart and are sent as one
 * request.
 *
 * There is no SDK mutation behind this: delivery is the host's, supplied as
 * `onSubmit` (an email endpoint, a ticket, a CRM call). Without it the list
 * still works and `submit` reports the omission rather than silently
 * succeeding.
 *
 * Backed by useSyncExternalStore rather than state+effect: localStorage IS the
 * store, and it gives a server snapshot (empty) for free, so hydration matches
 * without a post-mount setState.
 */
import { useCallback, useState, useSyncExternalStore } from 'react';
import {
  addItem,
  containsItem,
  parseStoredList,
  removeItem,
  setItemQuantity,
  type PriceRequestItem,
} from '../shared/utils/priceRequestList';

export const PRICE_REQUEST_STORAGE_KEY = 'propeller_price_request';

const EMPTY: PriceRequestItem[] = [];

// The parsed list, re-created only when the raw string changes — getSnapshot
// must return a referentially stable value or React re-renders forever.
let cachedRaw: string | null = null;
let cachedItems: PriceRequestItem[] = EMPTY;

function getSnapshot(key: string): PriceRequestItem[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = parseStoredList(raw);
  }
  return cachedItems;
}

/** Server (and hydration) snapshot: no storage, so nothing is listed yet. */
function getServerSnapshot(): PriceRequestItem[] {
  return EMPTY;
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // `storage` only fires in OTHER tabs; same-tab writes notify through the set.
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

function write(key: string, next: PriceRequestItem[]): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // A full or blocked store must not break the list in memory.
  }
  listeners.forEach((l) => l());
}

export interface UsePriceRequestOptions {
  /**
   * Sends the finished request. Receives the list and the shopper's comment;
   * resolve to report success. Supplied by the host — the API has no mutation
   * for this.
   */
  onSubmit?: (items: PriceRequestItem[], comment: string) => Promise<void> | void;
  /** Overrides the localStorage key, for hosts running several shops per origin. */
  storageKey?: string;
}

export interface UsePriceRequestReturn {
  items: PriceRequestItem[];
  /** False on the server and during hydration, so callers can hold their label. */
  ready: boolean;
  count: number;
  /** Adds a product unless its code is already listed. Returns false when it was. */
  add: (item: PriceRequestItem) => boolean;
  remove: (code: string) => void;
  setQuantity: (code: string, quantity: number) => void;
  clear: () => void;
  has: (code: string) => boolean;
  /** Sends the list via `onSubmit`, clearing it only on success. */
  submit: (comment: string) => Promise<boolean>;
  submitting: boolean;
  error: string | null;
}

export function usePriceRequest(options: UsePriceRequestOptions = {}): UsePriceRequestReturn {
  const storageKey = options.storageKey ?? PRICE_REQUEST_STORAGE_KEY;
  const items = useSyncExternalStore(
    subscribe,
    () => getSnapshot(storageKey),
    getServerSnapshot
  );
  // Distinguishes "server/hydrating" from "read and genuinely empty".
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    (item: PriceRequestItem): boolean => {
      const current = getSnapshot(storageKey);
      if (containsItem(current, item.code)) return false;
      write(storageKey, addItem(current, item));
      return true;
    },
    [storageKey]
  );

  const remove = useCallback(
    (code: string) => write(storageKey, removeItem(getSnapshot(storageKey), code)),
    [storageKey]
  );

  const setQuantity = useCallback(
    (code: string, quantity: number) =>
      write(storageKey, setItemQuantity(getSnapshot(storageKey), code, quantity)),
    [storageKey]
  );

  const clear = useCallback(() => write(storageKey, []), [storageKey]);

  const has = useCallback((code: string) => containsItem(items, code), [items]);

  const submit = useCallback(
    async (comment: string): Promise<boolean> => {
      const current = getSnapshot(storageKey);
      if (!current.length) {
        setError('empty');
        return false;
      }
      if (!options.onSubmit) {
        setError('unsupported');
        return false;
      }
      setSubmitting(true);
      setError(null);
      try {
        await options.onSubmit(current, comment);
        write(storageKey, []);
        return true;
      } catch (e) {
        setError((e as Error)?.message || 'failed');
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [options, storageKey]
  );

  return {
    items,
    ready,
    count: items.length,
    add,
    remove,
    setQuantity,
    clear,
    has,
    submit,
    submitting,
    error,
  };
}
