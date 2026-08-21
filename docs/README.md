# propeller-v2-react-ui documentation site

This directory is a self-contained [Docusaurus 3](https://docusaurus.io) app.
It is **not** published to npm and is **not** part of the package build — it
has its own `package.json` / lockfile and `node_modules`.

Intended to publish at
<https://propeller-commerce.github.io/propeller-v2-react-ui/> (GitHub Pages),
mirroring the [SDK docs](https://propeller-commerce.github.io/propeller-sdk-v2/)
setup. No deploy workflow is wired yet.

## Layout

```
docs/
  docusaurus.config.ts   site config (navbar, footer, branding, search)
  sidebars.ts            manual guide tree
  content/               documentation pages (Docusaurus docs root)
    index.mdx            site root (slug: /)
    *.mdx                hand-authored guides
  src/css/custom.css     theme overrides (brand color)
  static/img/            branding assets (reused from the SDK docs)
```

## Local development

In this directory:

```bash
npm install      # first time
npm start        # dev server at http://localhost:3000/propeller-v2-react-ui/
npm run build    # production build into docs/build
npm run serve    # serve the production build
npm run typecheck
```

## Why there is no auto-generated API reference

The SDK docs site generates an API reference with TypeDoc. This site
deliberately does **not**: the package's API reference is
[Storybook](https://storybook.js.org)'s per-component prop tables, which
`react-docgen-typescript` auto-generates from the TypeScript source. The
[Component reference](content/components.mdx) page is a curated catalogue
that links out to Storybook for the live preview and prop tables — it does
not duplicate them. This keeps the docs pipeline a plain
`docusaurus build` over the `content/` MDX, with no generation step.

## Search

Offline search via `@easyops-cn/docusaurus-search-local`. To switch to
Algolia DocSearch once credentials exist:

1. Remove the `@easyops-cn/docusaurus-search-local` plugin entry from
   `docusaurus.config.ts`.
2. Add `algolia: { appId, apiKey, indexName, contextualSearch: true }` to
   `themeConfig` (the classic preset ships the DocSearch component).

## Branding

`static/img/*` are the Propeller brand assets reused from the SDK docs. The
brand color (`--ifm-color-primary`) in `src/css/custom.css` is a placeholder
Propeller-blue — replace with the exact brand hex when known.
