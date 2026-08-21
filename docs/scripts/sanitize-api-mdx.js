// Post-processes typedoc-plugin-markdown output so it is MDX-safe.
//
// Hand-authored JSDoc contains prose like
//   @returns Promise<Address[]> The addresses array
//   @returns Promise<boolean> Success status of the deletion
//   Defaults to [{ boost: 1 }] if not provided.
// TypeDoc emits that verbatim into markdown. MDX v3 (acorn) then reads
// `<Address[]>` / `<boolean>` as JSX and `{ boost: 1 }` as an expression and
// the build dies. `sanitizeComments` only escapes some `{...}`, not bare
// `<Type>` written in description text, so we neutralize the remaining hostile
// tokens here — line by line, leaving fenced code blocks, inline code spans
// and front-matter untouched.
//
// Strategy for `<`: escape EVERY `<` that is not the start of a small,
// known-safe allowlist of structural HTML tags that typedoc-docusaurus-theme
// itself emits. This is conservative (it never tries to "recognise types"),
// so primitives (`<boolean>`, `<string>`), generics (`<Foo<Bar>>`), unions
// (`<A | B>`) and arrays (`<Foo[]>`) are all escaped, while real `<br>`,
// `</...>`, `<details>`, `<summary>`, `<a ...>`, `<img ...>` survive.
//
// Run from the `docs/` directory; defaults to docs/content/api.
const fs = require('fs');
const path = require('path');

const API_DIR = path.resolve(
  __dirname,
  '..',
  process.argv[2] || 'content/api',
);

// Tags the markdown/docusaurus theme legitimately emits. Anything else after
// `<` is treated as prose and escaped.
const SAFE_TAG =
  /^<\/?(br|hr|a|img|abbr|kbd|code|pre|sub|sup|b|i|em|strong|span|div|p|ul|ol|li|table|thead|tbody|tr|td|th|details|summary|blockquote|h[1-6])(\s|\/?>|$)/i;

function escapeTextSegment(seg) {
  let out = '';
  for (let i = 0; i < seg.length; i++) {
    const ch = seg[i];
    if (ch === '<') {
      if (SAFE_TAG.test(seg.slice(i)) || /^<https?:/.test(seg.slice(i))) {
        out += ch; // real HTML tag or autolink — keep
      } else {
        out += '&lt;';
      }
    } else if (ch === '{') {
      out += '&#123;';
    } else if (ch === '}') {
      out += '&#125;';
    } else {
      out += ch;
    }
  }
  return out;
}

/** Process one line, preserving inline `code` spans. */
function processLine(line) {
  const parts = line.split(/(`[^`]*`)/g);
  return parts
    .map((p) => (p.startsWith('`') && p.endsWith('`') ? p : escapeTextSegment(p)))
    .join('');
}

function sanitizeFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let inFence = false;
  let inFrontmatter = false;
  const out = lines.map((line, idx) => {
    if (idx === 0 && line.trim() === '---') { inFrontmatter = true; return line; }
    if (inFrontmatter) { if (line.trim() === '---') inFrontmatter = false; return line; }
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; return line; }
    if (inFence) return line;
    return processLine(line);
  });
  const result = out.join('\n');
  if (result !== src) { fs.writeFileSync(file, result, 'utf8'); return true; }
  return false;
}

function walk(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += walk(full);
    else if (entry.isFile() && /\.mdx?$/.test(entry.name) && sanitizeFile(full)) count++;
  }
  return count;
}

if (!fs.existsSync(API_DIR)) {
  console.error(`[sanitize-api-mdx] not found: ${API_DIR} (run gen-api first)`);
  process.exit(1);
}
const changed = walk(API_DIR);
console.log(`[sanitize-api-mdx] sanitized ${changed} file(s) under ${path.relative(process.cwd(), API_DIR)}`);
