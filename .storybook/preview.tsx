import type { Preview } from '@storybook/react';

/**
 * Global Storybook preview config.
 *
 * The package's styles are the precompiled stylesheet — the exact file
 * consumers import (`dist/styles.css`). Storybook loads it here so stories
 * render with the real component styling. If you change a Tailwind class in
 * a component, run `npm run build:css` to refresh `dist/styles.css`, then
 * reload Storybook (the `storybook` npm script does this for you).
 */
import '../dist/styles.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // The components paint on a white card surface; a light backdrop reads best.
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#f5f5f5' },
        { name: 'white', value: '#ffffff' },
        { name: 'dark', value: '#111111' },
      ],
    },
  },
};

export default preview;
