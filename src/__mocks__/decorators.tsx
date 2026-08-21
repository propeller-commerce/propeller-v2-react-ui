/**
 * Storybook decorators for propeller-v2-react-ui.
 *
 * Most components resolve infrastructure (`services`, `user`, `language`,
 * `currency`, …) from `<PropellerProvider>` via `useInfraProps()` /
 * `useServices()`. A story that renders such a component must therefore
 * mount it inside a provider. `withPropeller` is that wrapper: it supplies
 * a `PropellerInfra` value backed by the mock Services bundle and fixture
 * user, so the component renders without a real backend.
 *
 * Pure display components (ProductPrice, Breadcrumbs, …) take everything as
 * props and do not need this decorator — but applying it anyway is harmless,
 * so stories can use it uniformly.
 */
import * as React from 'react';
import type { Decorator } from '@storybook/react';
import {
  PropellerProvider,
  type PropellerInfra,
  type PropellerScope,
} from '../context/PropellerContext';
import { makeContact } from './fixtures';

/**
 * Subset of `PropellerInfra` that stories override per-case. We accept either
 * deps fields or scope fields; only scope fields reach `PropellerProvider`
 * (deps are read at component level via mock services).
 */
type StoryInfraOverrides = Partial<PropellerInfra>;

const SCOPE_KEYS: ReadonlyArray<keyof PropellerScope> = [
  'user',
  'companyId',
  'language',
  'includeTax',
  'portalMode',
  'shopMode',
];

function defaultScope(): PropellerScope {
  return {
    user: makeContact(),
    companyId: 3001,
    language: 'EN',
    includeTax: false,
    portalMode: 'open',
  };
}

/**
 * Wrap a story in `<PropellerProvider>` with a mock scope.
 *
 * Override individual scope fields per-story via the `propeller` parameter:
 *
 *   export const Anonymous: Story = {
 *     parameters: { propeller: { user: null } },
 *   };
 *
 * Non-scope keys (e.g. `services`) are accepted on the override object for
 * backward compatibility but ignored — components in stories pick up the
 * mock services bundle through `mockServices` directly, not via the provider.
 */
export const withPropeller: Decorator = (Story, context) => {
  const overrides = (context.parameters.propeller ?? {}) as StoryInfraOverrides;
  const scope: PropellerScope = { ...defaultScope() };
  const scopeRec = scope as unknown as Record<string, unknown>;
  const overridesRec = overrides as unknown as Record<string, unknown>;
  for (const key of SCOPE_KEYS) {
    if (key in overrides) {
      scopeRec[key] = overridesRec[key];
    }
  }
  return (
    <PropellerProvider value={scope}>
      <Story />
    </PropellerProvider>
  );
};

/**
 * Constrain a story's width — many components (cards, cart items) are built
 * to fill their container; an unconstrained Storybook canvas stretches them
 * edge to edge. Wrap with a sensible max-width.
 */
export function withMaxWidth(px: number): Decorator {
  const Wrapped: Decorator = (Story) => (
    <div style={{ maxWidth: px, margin: '1rem auto' }}>
      <Story />
    </div>
  );
  return Wrapped;
}
