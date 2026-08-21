// Generates the propeller-v2-react-ui API reference as Markdown into
// docs/content/api/**.
//
// IMPORTANT — TypeDoc is run as a STANDALONE step here, NOT as the
// `docusaurus-plugin-typedoc` build plugin. The plugin regenerates on every
// `docusaurus build` (overwriting the on-disk MDX sanitize pass) and MDX fails
// to parse the raw output before any remark plugin can fix it. Decoupling lets
// the pipeline be: gen-api -> sanitize-api-mdx -> docusaurus build, with the
// API treated as ordinary pre-sanitized static markdown.
//
// Run from the `docs/` directory (npm scripts set cwd there).
const {spawnSync} = require('child_process');
const path = require('path');
const fs = require('fs');

// TypeDoc treats `entryPoints` as globs and rejects Windows `\` separators
// ("escapes a non-special character"). Always hand it POSIX `/` paths.
const toPosix = (p) => p.replace(/\\/g, '/');

const docsDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(docsDir, '..');

// Single entry point: src/index.ts. The package's other public entry,
// src/shared.ts, is a strict SUBSET of index.ts (createServices, toPlain, the
// pure formatters/helpers and all types are re-exported from both), so
// documenting index.ts covers the entire public API with nothing lost.
// Using one entry also keeps TypeDoc's output flat — a second entry named
// `index`/`shared` would create an `api/index/` module folder that collides
// with the `api/index.md` landing page. The /shared vs / entry distinction
// (an RSC-boundary packaging concern) is covered in the hand-written guides.
const entryIndex = toPosix(path.join(repoRoot, 'src', 'index.ts'));
// Dedicated tsconfig that excludes test / mock / story files — those import
// dev-only deps (vitest, @storybook/react) that are not package dependencies,
// so including them in the TypeDoc program fails type resolution on CI.
const tsconfig = toPosix(path.join(repoRoot, 'tsconfig.typedoc.json'));
const out = toPosix(path.join(docsDir, 'content', 'api'));

fs.rmSync(out, {recursive: true, force: true});

const args = [
  'typedoc',
  '--plugin', 'typedoc-plugin-markdown',
  '--plugin', 'typedoc-docusaurus-theme',
  '--entryPoints', entryIndex,
  '--tsconfig', tsconfig,
  '--out', out,
  // typedoc-docusaurus-theme computes sidebar doc IDs relative to this; it
  // MUST equal the Docusaurus `docs.path` (we use `content`) so IDs come out
  // as `api/...` not `../content/api/...`. Default is `./docs`.
  '--docsPath', './content',
  '--readme', 'none',
  '--exclude', '**/__tests__/**',
  '--exclude', '**/__mocks__/**',
  '--exclude', '**/*.test.ts',
  '--exclude', '**/*.test.tsx',
  '--exclude', '**/*.stories.tsx',
  '--excludeInternal',
  '--excludeExternals',
  '--excludePrivate',
  '--sanitizeComments',
  '--sourceLinkTemplate',
  'https://gitlab.com/propellor-eu/cloud/frontend/ui/propeller-v2-react-ui/-/blob/{gitRevision}/{path}#L{line}',
  '--gitRevision', 'master',
];

const res = spawnSync('npx', args, {
  cwd: docsDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (res.status !== 0) {
  console.error(`[gen-api] typedoc failed with exit code ${res.status}`);
  process.exit(res.status ?? 1);
}
console.log('[gen-api] API markdown generated at docs/content/api');
