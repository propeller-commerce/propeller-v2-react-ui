/**
 * Resolver slot-precedence tests.
 *
 * useResolvedProps doesn't care about the *type* of value being resolved — it
 * just compares `undefined`/`null` against any other defined value. These tests
 * confirm the same precedence rule that governs `show*` booleans also governs
 * component-slot values (`priceComponent`, etc.) for the extension API.
 *
 * Vitest runs in `environment: 'node'` (no jsdom). We can't invoke a real React
 * hook here, but the resolver is shaped as a pure function over context lookups
 * — we mock the two context hooks and call the resolver directly inside the
 * mocked module scope.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock both context hooks BEFORE importing the resolver. The mocks return
// state that each test can mutate via the `__set*` helpers.
let mockGridConfig: Record<string, unknown> | null = null;
let mockInfra: Record<string, unknown> = {};

vi.mock('../../../context/ProductGridContext', () => ({
  useProductGridConfig: () => mockGridConfig,
}));
vi.mock('../useInfraProps', () => ({
  useInfraProps: () => mockInfra,
}));

import { useResolvedProps, type ResolveSpec } from '../useResolvedProps';

interface TestProps {
  priceComponent?: unknown;
  stockComponent?: unknown;
  showStock?: boolean;
}

const SPEC: ResolveSpec<TestProps> = {
  priceComponent: { grid: 'priceComponent' as never },
  stockComponent: { grid: 'stockComponent' as never },
  showStock: { grid: 'showStock' },
};

describe('useResolvedProps — component-slot resolution', () => {
  beforeEach(() => {
    mockGridConfig = null;
    mockInfra = {};
  });

  it('returns explicit priceComponent prop when provided', () => {
    const Local = { name: 'Local' };
    const resolved = useResolvedProps<TestProps>({ priceComponent: Local }, SPEC);
    expect(resolved.priceComponent).toBe(Local);
  });

  it('falls back to grid priceComponent when no explicit prop', () => {
    const GridPrice = { name: 'GridPrice' };
    mockGridConfig = { priceComponent: GridPrice };
    const resolved = useResolvedProps<TestProps>({}, SPEC);
    expect(resolved.priceComponent).toBe(GridPrice);
  });

  it('explicit prop wins over grid context (component-slot)', () => {
    const Local = { name: 'Local' };
    const GridPrice = { name: 'GridPrice' };
    mockGridConfig = { priceComponent: GridPrice };
    const resolved = useResolvedProps<TestProps>({ priceComponent: Local }, SPEC);
    expect(resolved.priceComponent).toBe(Local);
  });

  it('returns undefined when neither explicit nor grid slot is set', () => {
    const resolved = useResolvedProps<TestProps>({}, SPEC);
    expect(resolved.stockComponent).toBeUndefined();
  });

  it('resolves component slots alongside boolean flags consistently', () => {
    const GridPrice = { name: 'GridPrice' };
    mockGridConfig = { priceComponent: GridPrice, showStock: true };
    const resolved = useResolvedProps<TestProps>({}, SPEC);
    expect(resolved.priceComponent).toBe(GridPrice);
    expect(resolved.showStock).toBe(true);
  });
});
