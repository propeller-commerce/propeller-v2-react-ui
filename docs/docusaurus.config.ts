import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import {themes as prismThemes} from 'prism-react-renderer';

// Docs site for propeller-v2-react-ui. It is a thin presentation layer over
// the package's own markdown docs and Storybook — it does NOT host an
// auto-generated API reference. The package's "API reference" is Storybook's
// per-component prop tables (auto-generated from the TypeScript source by
// react-docgen-typescript); this site links out to it rather than duplicating.
// That is why, unlike the SDK docs, there is no TypeDoc pipeline here.

const config: Config = {
  title: 'Propeller React UI',
  tagline: 'React component library for Propeller Commerce storefronts',
  favicon: 'img/favicon.png',

  // GitHub Pages project site — mirrors the SDK docs setup.
  url: 'https://propeller-commerce.github.io',
  baseUrl: '/propeller-v2-react-ui/',
  organizationName: 'propeller-commerce',
  projectName: 'propeller-v2-react-ui',
  trailingSlash: false,

  // `warn` not `throw`: the TypeDoc-generated API pages contain many
  // cross-reference links and the occasional fragile anchor; a broken link
  // there should not fail the whole docs build.
  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',
  markdown: {hooks: {onBrokenMarkdownLinks: 'warn'}},

  i18n: {defaultLocale: 'en', locales: ['en']},

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'content', // docs live in docs/content (config files sit in docs/)
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {customCss: './src/css/custom.css'},
        sitemap: {changefreq: 'weekly', priority: 0.5},
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
      disableSwitch: false,
    },
    navbar: {
      title: '',
      logo: {
        alt: 'Propeller',
        src: 'img/logo.png',
        srcDark: 'img/logo-dark.png',
        height: 30,
      },
      items: [
        {to: '/getting-started', label: 'Getting started', position: 'left'},
        {to: '/guides/api/overview', label: 'API integration', position: 'left'},
        {to: '/components', label: 'Components', position: 'left'},
        {to: '/api', label: 'API reference', position: 'left'},
        {to: '/contributing', label: 'Contributing', position: 'left'},
        {
          href: 'https://gitlab.com/propellor-eu/propeller-v2-react-ui',
          label: 'GitLab',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {label: 'Getting started', to: '/getting-started'},
            {label: 'The SDK seam', to: '/sdk-seam'},
            {label: 'Styling', to: '/styling'},
            {label: 'Server Components', to: '/server-components'},
          ],
        },
        {
          title: 'Reference',
          items: [
            {label: 'API integration', to: '/guides/api/overview'},
            {label: 'Component reference', to: '/components'},
            {label: 'API reference', to: '/api'},
            {label: 'Storybook', to: '/storybook'},
            {label: 'Contributing', to: '/contributing'},
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'GitLab',
              href: 'https://gitlab.com/propellor-eu/propeller-v2-react-ui',
            },
            {
              label: 'SDK docs',
              href: 'https://propeller-commerce.github.io/propeller-sdk-v2/',
            },
            {
              label: 'Propeller Commerce',
              href: 'https://propeller-commerce.com',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Propeller Commerce.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,

  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: '/',
      },
    ],
  ],
};

export default config;
