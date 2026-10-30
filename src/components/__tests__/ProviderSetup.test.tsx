/**
 * Pins the provider setup the README documents: deps app-wide via
 * `PropellerDepsProvider`, per-scope state via `PropellerProvider`.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { GraphQLClient } from '@propeller-commerce/propeller-sdk-v2';
import {
  PropellerDepsProvider,
  PropellerProvider,
  createServices,
  useServices,
  usePropellerContext,
} from '../../index';

const graphqlClient = new GraphQLClient({ endpoint: 'https://example.test/graphql' });
const services = createServices(graphqlClient);

function Probe() {
  const s = useServices();
  const infra = usePropellerContext();
  return <span>{`${s === services}|${infra?.language}|${infra?.currency}`}</span>;
}

describe('documented provider setup', () => {
  it('exposes services and scope through the two providers', () => {
    const html = renderToString(
      <PropellerDepsProvider value={{ graphqlClient, services, currency: '€', configuration: {} }}>
        <PropellerProvider
          value={{ user: null, companyId: undefined, language: 'EN', includeTax: false, portalMode: 'open' }}
        >
          <Probe />
        </PropellerProvider>
      </PropellerDepsProvider>,
    );
    expect(html).toContain('true|EN|€');
  });

  it('throws when only PropellerProvider is mounted', () => {
    expect(() =>
      renderToString(
        <PropellerProvider
          value={{ user: null, companyId: undefined, language: 'EN', includeTax: false, portalMode: 'open' }}
        >
          <Probe />
        </PropellerProvider>,
      ),
    ).toThrow();
  });
});
