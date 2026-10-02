/** The image seam: plain `<img>` by default, the host's component when injected. */

import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { ImgComponentProps } from '@propeller-commerce/propeller-v2-core-ui';
import { PropellerImg } from '../PropellerImg';

const render = (el: React.ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

/** Stand-in for a host's `next/image` wrapper. */
function HostImage(props: ImgComponentProps): React.JSX.Element {
  return <img data-host="1" src={`/_next/image?url=${encodeURIComponent(props.src)}`} alt={props.alt} className={props.className} />;
}

describe('PropellerImg', () => {
  it('renders a plain <img> when nothing is injected', () => {
    const html = render(<PropellerImg src="https://media/x.webp" alt="Hose" className="h-full" />);
    expect(html).toContain('src="https://media/x.webp"');
    expect(html).toContain('alt="Hose"');
    expect(html).toContain('class="h-full"');
    expect(html).not.toContain('data-host');
  });

  it('renders the injected component instead, and routes the URL through it', () => {
    const html = render(<PropellerImg as={HostImage} src="https://media/x.webp" alt="Hose" />);
    expect(html).toContain('data-host="1"');
    expect(html).toContain('/_next/image?url=https%3A%2F%2Fmedia%2Fx.webp');
    // The raw CDN URL must no longer be the src — that is the whole point.
    expect(html).not.toContain('src="https://media/x.webp"');
  });

  it('forwards sizing and loading hints', () => {
    const html = render(<PropellerImg src="/a.webp" alt="" width={32} height={32} loading="lazy" />);
    expect(html).toContain('width="32"');
    expect(html).toContain('height="32"');
    expect(html).toContain('loading="lazy"');
  });

  it('keeps an empty alt for decorative images rather than dropping it', () => {
    const html = render(<PropellerImg src="/a.webp" alt="" />);
    expect(html).toContain('alt=""');
  });
});
