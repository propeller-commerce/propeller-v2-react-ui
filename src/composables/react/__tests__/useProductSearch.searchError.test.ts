/**
 * useProductSearch — a failed search-bar request is reported as an error, not
 * as "no results".
 *
 * Node env has no DOM renderer, so React's hooks are swapped for a tiny
 * slot-based stand-in and the hook is called directly between "renders".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const harness = vi.hoisted(() => {
  let slots: unknown[] = [];
  let i = 0;
  const hooks = {
    useState(init: unknown) {
      const k = i++;
      if (!(k in slots)) slots[k] = typeof init === 'function' ? (init as () => unknown)() : init;
      return [
        slots[k],
        (v: unknown) => {
          slots[k] = typeof v === 'function' ? (v as (p: unknown) => unknown)(slots[k]) : v;
        },
      ];
    },
    useRef(init: unknown) {
      const k = i++;
      if (!(k in slots)) slots[k] = { current: init };
      return slots[k];
    },
    useCallback: (fn: unknown) => fn,
    useMemo: (fn: () => unknown) => fn(),
    useEffect: () => {},
  };
  return {
    hooks,
    reset() {
      slots = [];
      i = 0;
    },
    begin() {
      i = 0;
    },
  };
});

const getCategory = vi.hoisted(() => vi.fn());

vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), ...harness.hooks }));
vi.mock('@propeller-commerce/propeller-v2-core-ui', async (orig) => ({
  ...(await orig<typeof import('@propeller-commerce/propeller-v2-core-ui')>()),
  createServices: () => ({ category: { getCategory } }),
}));

import { useProductSearch } from '../useProductSearch';

const OPTIONS = {
  graphqlClient: {} as never,
  language: 'EN',
  configuration: { baseCategoryId: 1 },
};

function render() {
  harness.begin();
  return useProductSearch(OPTIONS);
}

const okResponse = {
  products: { items: [{ productId: 7, names: [{ language: 'EN', value: 'Drill' }] }], itemsFound: 1 },
};

describe('useProductSearch — search-bar errors', () => {
  beforeEach(() => {
    harness.reset();
    getCategory.mockReset();
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sets searchError when the search request fails', async () => {
    getCategory.mockRejectedValueOnce(new Error('network down'));
    render().search('drill');
    await vi.advanceTimersByTimeAsync(300);

    const r = render();
    expect(r.searchError).toBe(true);
    expect(r.searchResults).toEqual([]);
    expect(r.searchLoading).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('clears searchError when the next search succeeds', async () => {
    getCategory.mockRejectedValueOnce(new Error('network down'));
    render().search('drill');
    await vi.advanceTimersByTimeAsync(300);
    expect(render().searchError).toBe(true);

    getCategory.mockResolvedValueOnce(okResponse);
    render().search('drills');
    await vi.advanceTimersByTimeAsync(300);

    const r = render();
    expect(r.searchError).toBe(false);
    expect(r.searchResults).toHaveLength(1);
  });

  it('ignores a failure from a search that a newer one superseded', async () => {
    let rejectFirst: (e: Error) => void = () => {};
    getCategory.mockImplementationOnce(() => new Promise((_, rej) => { rejectFirst = rej; }));
    render().search('dri');
    await vi.advanceTimersByTimeAsync(300);

    getCategory.mockResolvedValueOnce(okResponse);
    render().search('drill');
    await vi.advanceTimersByTimeAsync(300);
    rejectFirst(new Error('late failure'));
    await vi.advanceTimersByTimeAsync(0);

    const r = render();
    expect(r.searchError).toBe(false);
    expect(r.searchResults).toHaveLength(1);
  });

  it('clears searchError when the term is cleared', async () => {
    getCategory.mockRejectedValueOnce(new Error('network down'));
    render().search('drill');
    await vi.advanceTimersByTimeAsync(300);
    render().search('');
    expect(render().searchError).toBe(false);
  });
});
