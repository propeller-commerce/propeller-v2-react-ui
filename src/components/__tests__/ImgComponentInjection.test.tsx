/** One `imgComponent` on the provider must reach components never passed a prop. */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { ImgComponentProps } from '@propeller-commerce/propeller-v2-core-ui';
import { PropellerDepsProvider } from '../../context/PropellerContext';
import { DefaultProductImage } from '../defaults/DefaultProductImage';

const clean = (html: string) => html.replace(/<!-- -->/g, '');

/** Stand-in for a host's `next/image` wrapper. */
function HostImage(props: ImgComponentProps): React.JSX.Element {
  return <img data-host="1" src={`/_next/image?url=${encodeURIComponent(props.src)}`} alt={props.alt} />;
}

/** A product whose media resolves to a CDN URL via the NL variant. */
const PRODUCT = {
  name: [{ language: 'NL', value: 'Slang' }],
  media: {
    images: {
      items: [{ imageVariants: [{ language: 'NL', url: 'https://media.helice.cloud/x.webp' }] }],
    },
  },
} as never;

const Shop = ({ children, inject }: { children: React.ReactNode; inject?: boolean }) => (
  <PropellerDepsProvider value={{ currency: '€', ...(inject ? { imgComponent: HostImage } : {}) } as never}>
    {children}
  </PropellerDepsProvider>
);

describe('provider-level imgComponent injection', () => {
  it('links the CDN directly when the host injects nothing', () => {
    const html = clean(renderToString(<Shop><DefaultProductImage product={PRODUCT} language="NL" /></Shop>));
    expect(html).toContain('src="https://media.helice.cloud/x.webp"');
    expect(html).not.toContain('data-host');
  });

  it('routes through the host component when injected once on the provider', () => {
    const html = clean(renderToString(<Shop inject><DefaultProductImage product={PRODUCT} language="NL" /></Shop>));
    expect(html).toContain('data-host="1"');
    expect(html).toContain('/_next/image?url=');
    // The bare CDN URL is what escapes the storefront's crawler directives.
    expect(html).not.toContain('src="https://media.helice.cloud/x.webp"');
  });

  it('still renders the placeholder, not an image, when the product has no media', () => {
    const html = clean(renderToString(<Shop inject><DefaultProductImage product={{} as never} /></Shop>));
    expect(html).not.toContain('data-host');
    expect(html).toContain('svg');
  });
});
