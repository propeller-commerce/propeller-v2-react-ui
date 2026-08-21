/**
 * ProductSpecifications — localized labels and values.
 *
 * A localized list returns only the languages that were authored; asking for a
 * language nobody wrote yields NOTHING, not a fallback. Matching strictly on
 * `language === props.language` therefore had two user-visible failures on a
 * partially-translated catalogue:
 *
 *  - the label fell through to `attributeDescription.name`, printing the raw
 *    PIM code (`QUANTORE_70001706`) at the user;
 *  - the value resolved to `''`, and `getAttributes()` drops rows whose value
 *    is empty — so the whole spec table vanished in the other language.
 *
 * Fixture shapes are the real payload from the Quantore tenant: most
 * attributes are Dutch-only, `GENERAL_SOORT_STICKER` is fully translated.
 */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import ProductSpecifications from '../ProductSpecifications';
import type { AttributeResult } from '@propeller-commerce/propeller-sdk-v2';

/** Dutch-only label and value — the majority case on a real catalogue. */
const DUTCH_ONLY = {
  attributeDescription: {
    id: 'a1',
    name: 'QUANTORE_70001706',
    group: 'GENERAL',
    isPublic: true,
    type: 'TEXT',
    descriptions: [{ language: 'NL', value: 'Soort zelfzorg' }],
  },
  value: {
    type: 'TEXT',
    textValues: [{ language: 'NL', values: ['Neusspray'] }],
  },
};

/** Fully translated, plus an empty FR row the backend really does return. */
const TRANSLATED = {
  attributeDescription: {
    id: 'a2',
    name: 'GENERAL_SOORT_STICKER',
    group: 'GENERAL',
    isPublic: true,
    type: 'TEXT',
    descriptions: [
      { language: 'NL', value: 'Soort sticker' },
      { language: 'EN', value: 'Sticker type' },
    ],
  },
  value: {
    type: 'TEXT',
    textValues: [
      { language: 'FR', values: [] },
      { language: 'NL', values: ['Recycled NL'] },
      { language: 'EN', values: ['Recycled'] },
    ],
  },
};

const attrs = [DUTCH_ONLY, TRANSLATED] as unknown as AttributeResult[];

/** `renderToString` splits interpolated text with `<!-- -->` markers. */
const render = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

describe('ProductSpecifications localization', () => {
  it('uses the active language when the attribute is translated', () => {
    const html = render(
      <ProductSpecifications attributes={attrs} language="EN" graphqlClient={undefined as never} />,
    );
    expect(html).toContain('Sticker type');
    expect(html).toContain('Recycled');
  });

  it('keeps the Dutch label rather than printing the raw PIM code', () => {
    const html = render(
      <ProductSpecifications attributes={attrs} language="EN" graphqlClient={undefined as never} />,
    );
    expect(html).toContain('Soort zelfzorg');
    // The regression: no translation → the attribute's internal name on screen.
    expect(html).not.toContain('QUANTORE_70001706');
  });

  it('still renders an untranslated row instead of dropping it', () => {
    // `getAttributes()` filters out empty values, so a value that fails to
    // resolve removes the entire row — the spec table emptied out in EN.
    const html = render(
      <ProductSpecifications attributes={attrs} language="EN" graphqlClient={undefined as never} />,
    );
    expect(html).toContain('Neusspray');
  });

  it('is not case-sensitive about the language code', () => {
    const html = render(
      <ProductSpecifications attributes={attrs} language="en" graphqlClient={undefined as never} />,
    );
    expect(html).toContain('Sticker type');
    expect(html).toContain('Recycled');
  });

  it('renders Dutch unchanged', () => {
    const html = render(
      <ProductSpecifications attributes={attrs} language="NL" graphqlClient={undefined as never} />,
    );
    expect(html).toContain('Soort zelfzorg');
    expect(html).toContain('Neusspray');
    expect(html).toContain('Soort sticker');
    expect(html).toContain('Recycled NL');
  });
});
