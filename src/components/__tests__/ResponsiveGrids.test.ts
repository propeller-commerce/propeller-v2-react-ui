/**
 * Responsive grids keep their columns when a host's own Tailwind sheet loads
 * after the package: each grid carries a BEM class whose breakpoints
 * styles.css restates outside the utilities layer.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) =>
  readFileSync(resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');
const css = read('../../styles.css');

const GRIDS: Array<{ file: string; cls: string; rules: Array<[string, number]> }> = [
  { file: 'CartCarriers.tsx', cls: 'propeller-cart-carriers__grid', rules: [['40rem', 3], ['64rem', 4]] },
  { file: 'CartPaymethods.tsx', cls: 'propeller-cart-paymethods__grid', rules: [['40rem', 3], ['64rem', 4]] },
  { file: 'MachineGrid.tsx', cls: 'propeller-machine-grid__grid', rules: [['40rem', 2], ['64rem', 4]] },
  { file: 'MachineGrid.tsx', cls: 'propeller-machine-children', rules: [['40rem', 2], ['64rem', 4]] },
  { file: 'OrderSummary.tsx', cls: 'propeller-order-summary__meta', rules: [['48rem', 2], ['64rem', 4]] },
  { file: 'OrderSummary.tsx', cls: 'propeller-order-summary__addresses', rules: [['48rem', 2]] },
  { file: 'OrderList.tsx', cls: 'propeller-order-list__filter-fields', rules: [['48rem', 2]] },
];

// Every `@media (min-width: X)` block's body, concatenated.
function mediaBodies(minWidth: string): string {
  const head = `@media (min-width: ${minWidth}) {`;
  let out = '';
  for (let i = css.indexOf(head); i !== -1; i = css.indexOf(head, i + 1)) {
    let depth = 0;
    for (let k = i + head.length - 1; k < css.length; k++) {
      if (css[k] === '{') depth++;
      else if (css[k] === '}' && --depth === 0) {
        out += css.slice(i, k) + '\n';
        break;
      }
    }
  }
  return out;
}

describe.each(GRIDS)('$file $cls', ({ file, cls, rules }) => {
  it('is on a grid element in the markup', () => {
    expect(read(`../${file}`)).toMatch(new RegExp(`"[^"]*${cls}[^"]*\\bgrid\\b[^"]*"`));
  });

  it.each(rules)('restates the columns at %s', (minWidth, cols) => {
    expect(mediaBodies(minWidth)).toMatch(
      new RegExp(`\\.${cls}\\b[^{]*\\{[^}]*grid-template-columns: repeat\\(${cols}, minmax\\(0, 1fr\\)\\)`),
    );
  });
});
