import type { Meta, StoryObj } from '@storybook/react';
import ProductVideos from './ProductVideos';
import { makeVideos } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductVideos renders a product's embedded videos (YouTube/Vimeo).
 * Pure display component.
 */
const meta: Meta<typeof ProductVideos> = {
  title: 'Product/ProductVideos',
  component: ProductVideos,
  decorators: [withMaxWidth(560)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductVideos>;

/** Default — one embedded video. */
export const Default: Story = {
  args: { videos: makeVideos(), language: 'EN' },
};
