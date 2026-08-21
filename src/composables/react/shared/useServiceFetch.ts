/**
 * useServiceFetch (React) — Generic async service call wrapper with state.
 */

import { useState, useCallback } from 'react';

/**
 * Async-call state returned by {@link useServiceFetch}.
 *
 * @typeParam T - the resolved data type.
 * @typeParam A - the tuple of arguments accepted by the wrapped fetch function.
 */
export interface ServiceFetchState<T, A extends unknown[]> {
  /** Latest resolved data, or the default value before the first successful call. */
  data: T;
  /** `true` while a call is in flight. */
  loading: boolean;
  /** Last error message, or `null`. */
  error: string | null;
  /** Runs the wrapped fetch function; resolves to its result, or `undefined` on error. */
  execute: (...args: A) => Promise<T | undefined>;
  /** Resets `data` to the default value and clears loading/error. */
  reset: () => void;
}

/**
 * useServiceFetch — generic async service-call wrapper with loading/error/data state.
 *
 * @typeParam T - the resolved data type.
 * @typeParam A - the tuple of arguments accepted by `fetchFn`.
 * @param fetchFn - the async function to wrap; its result is stored in `data`.
 * @param defaultValue - the initial `data` value, also restored by `reset`.
 * @returns the call state plus `execute` / `reset` actions — see {@link ServiceFetchState}.
 */
export function useServiceFetch<T, A extends unknown[]>(
  fetchFn: (...args: A) => Promise<T>,
  defaultValue: T
): ServiceFetchState<T, A> {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: A): Promise<T | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFn(...args);
        setData(result);
        return result;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'An error occurred';
        setError(msg);
        console.error('[useServiceFetch] error:', e);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [fetchFn]
  );

  const reset = useCallback(() => {
    setData(defaultValue);
    setLoading(false);
    setError(null);
  }, [defaultValue]);

  return { data, loading, error, execute, reset };
}
