import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Storybook configuration for propeller-v2-react-ui.
 *
 * Storybook is the component workbench: every public component has a story
 * that renders it in isolation against fixture data and a mock
 * PropellerProvider (see src/__mocks__/). This is *not* a substitute for the
 * consumer's e2e suite — it's for developing and visually reviewing
 * components without needing a running storefront or a live backend.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-docs',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Auto-generate prop tables from the TypeScript prop interfaces. The
  // `react-docgen-typescript` parser reads the exported `*Props` interfaces
  // and their JSDoc so the Docs tab shows real prop documentation.
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      // Only document props declared on the component's own interface,
      // not the dozens inherited from React.HTMLAttributes.
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
};

export default config;
