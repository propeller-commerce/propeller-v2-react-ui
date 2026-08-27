import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for propeller-v2-react-ui.
 *
 * Phase G (0.1.0 hardening) covers the *pure-logic* surface: `src/lib/`
 * (createServices, toPlain) and `src/composables/shared/utils/` (formatters,
 * truncation, attribute extraction, etc.). These are framework-free
 * functions — no React, no DOM, no SDK calls — so the `node` environment
 * is sufficient and fast.
 *
 * Component tests (which need a mock-SDK + a PropellerProvider wrapper, and
 * therefore the `jsdom` environment) are intentionally NOT in scope here —
 * see the project notes on the deferred F2 / component-test work.
 */
export default defineConfig({
  // Match the build (tsup sets `jsx: 'automatic'`). Vitest's esbuild default is
  // the classic runtime, which needs `React` in scope — so a source file that
  // imports only named hooks, as the context providers do, threw
  // "React is not defined" under test while building and shipping fine.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/**/*.ts',
        'src/composables/shared/utils/**/*.ts',
      ],
      // The shared cart helpers (cartInit/fetchActiveCart/mergeAnonymousCart)
      // orchestrate SDK service calls — they need a mock Services bundle to
      // test meaningfully, which belongs with the deferred component-test
      // work, not this pure-logic pass.
      exclude: [
        'src/composables/shared/utils/cartInit.ts',
        'src/composables/shared/utils/fetchActiveCart.ts',
        'src/composables/shared/utils/mergeAnonymousCart.ts',
      ],
    },
  },
});
