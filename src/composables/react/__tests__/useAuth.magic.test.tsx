/**
 * useAuth — magic-token login + create.
 *
 * Drives the REAL `MagicTokenService` + `createServices` through a fake
 * GraphQLClient that implements the `execute`/`getConfig`/`updateConfig` seam
 * (the same seam every SDK service calls). No module mocking — the test proves
 * the wiring end to end at the data layer.
 *
 * The hook's `useCallback` actions are captured from a server render
 * (`renderToString`); they're invoked afterwards. Node env has no reconciler, so
 * the post-render `setLoading/setError` dispatches are inert no-ops — only the
 * awaited `Result` matters. Runs in vitest's Node env (per vitest.config.ts).
 */

import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { useAuth, type UseAuthReturn } from '../useAuth';

const SESSION = {
  accessToken: 'AT',
  refreshToken: 'RT',
  expirationTime: '2099-01-01T00:00:00.000Z',
  isAnonymous: false,
};

function makeFakeClient() {
  let config: Record<string, unknown> = { headers: {} };
  const calls: Array<{ operationName: string; variables: unknown }> = [];
  const execute = vi.fn(async ({ operationName, variables }: { operationName: string; variables: unknown }): Promise<any> => {
    calls.push({ operationName, variables });
    switch (operationName) {
      case 'magicTokenLogin':
        return { data: { magicTokenLogin: { providerId: 'p', operationType: 'signIn', session: SESSION } } };
      case 'viewer':
        return { data: { viewer: { __typename: 'Contact', contactId: 7, marker: 'VIEWER', primaryLanguage: 'EN' } } };
      case 'magicTokenCreate':
        return { data: { magicTokenCreate: { id: 'new-token-id', oneTimeUse: true } } };
      default:
        return { data: {} };
    }
  });
  const client = {
    execute,
    getConfig: () => config,
    updateConfig: (patch: Record<string, unknown>) => { config = { ...config, ...patch }; },
  };
  return { client, execute, calls, headers: () => config.headers as Record<string, unknown> };
}

/** Capture the hook's returned actions from a server render. */
function renderUseAuth(client: unknown): UseAuthReturn {
  let captured: UseAuthReturn | undefined;
  function Probe() {
    captured = useAuth({ graphqlClient: client as never });
    return null;
  }
  renderToString(React.createElement(Probe));
  if (!captured) throw new Error('useAuth did not render');
  return captured;
}

describe('useAuth — magicLogin', () => {
  it('exposes magicLogin + createMagicToken as functions', () => {
    const { client } = makeFakeClient();
    const auth = renderUseAuth(client);
    expect(typeof auth.magicLogin).toBe('function');
    expect(typeof auth.createMagicToken).toBe('function');
  });

  it('exchanges the token for a session, sets an in-memory Bearer, and returns the viewer', async () => {
    const { client, calls, headers } = makeFakeClient();
    const auth = renderUseAuth(client);

    const res = await auth.magicLogin('tok-123');

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.accessToken).toBe('AT');
    expect(res.data.refreshToken).toBe('RT');
    expect(res.data.expiresAt).toBe('2099-01-01T00:00:00.000Z');
    expect((res.data.user as { marker?: string }).marker).toBe('VIEWER');
    // Bearer set in-memory via updateConfig — NOT persisted (no setAccessToken).
    expect(headers().Authorization).toBe('Bearer AT');
    // The token is passed as `id`, then the viewer is loaded.
    expect(calls[0]).toMatchObject({ operationName: 'magicTokenLogin', variables: { id: 'tok-123' } });
    expect(calls.some((c) => c.operationName === 'viewer')).toBe(true);
  });

  it('returns err (not throw) when the exchange fails', async () => {
    const { client, execute } = makeFakeClient();
    execute.mockResolvedValueOnce({ errors: [{ message: 'invalid token' }] });
    const auth = renderUseAuth(client);

    const res = await auth.magicLogin('bad');

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(typeof res.error).toBe('string');
    expect(res.error.length).toBeGreaterThan(0);
  });
});

describe('useAuth — createMagicToken', () => {
  it('passes the input to magicTokenCreate and returns the token', async () => {
    const { client, calls } = makeFakeClient();
    const auth = renderUseAuth(client);
    const input = { contactId: 42, oneTimeUse: true, expiresAt: '2099-01-01T00:00:00.000Z' };

    const res = await auth.createMagicToken(input);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.id).toBe('new-token-id');
    expect(calls.find((c) => c.operationName === 'magicTokenCreate')?.variables).toMatchObject({ input });
  });
});
