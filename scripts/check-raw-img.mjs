#!/usr/bin/env node
/**
 * Fail the build when a component renders a raw `<img>` instead of
 * `<PropellerImg>`.
 *
 * Bare `<img>` links the media CDN directly, which sends no `X-Robots-Tag`,
 * so those images escape the storefront's crawler directives. The seam only
 * holds if new components use it.
 *
 * PSP logos are exempt — their domains are outside the host's image allowlist.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Files allowed a raw `<img>`, with the reason. */
const ALLOWED = new Map([
  ['src/components/PropellerImg.tsx', 'the primitive itself — this IS the fallback'],
  ['src/components/CartCarriers.tsx', 'carrier logos: PSP domains, outside the host image allowlist'],
  ['src/components/CartPaymethods.tsx', 'paymethod logos: PSP domains, outside the host image allowlist'],
]);

const files = execFileSync('git', ['ls-files', 'src/**/*.tsx'], { cwd: root, encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean)
  // Tests render a raw <img> as a stand-in for the host's image component.
  .filter((f) => !f.includes('__tests__'));

const failures = [];

for (const rel of files) {
  if (ALLOWED.has(rel.replace(/\\/g, '/'))) continue;
  const source = readFileSync(path.join(root, rel), 'utf8');
  const lines = source.split(/\r?\n/);
  lines.forEach((line, i) => {
    // Skip comment lines: several components describe their markup in prose.
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
    if (/<img[\s>]/.test(line)) {
      failures.push(`${rel}:${i + 1}  ${trimmed.slice(0, 80)}`);
    }
  });
}

if (failures.length > 0) {
  console.error('\nRaw <img> found. Use <PropellerImg as={Img} …> instead:\n');
  for (const f of failures) console.error('  ' + f);
  console.error(
    '\n  Client components:  const Img = useImgComponent();\n' +
      '  RSC-safe components: take `imgComponent` as a prop and pass `as={props.imgComponent}`.\n' +
      '\n  If the image is genuinely not a catalog image (e.g. a PSP logo), add the\n' +
      '  file to ALLOWED in scripts/check-raw-img.mjs with the reason.\n'
  );
  process.exit(1);
}

console.log(`check-raw-img: OK (${files.length} files scanned, ${ALLOWED.size} allowlisted)`);
