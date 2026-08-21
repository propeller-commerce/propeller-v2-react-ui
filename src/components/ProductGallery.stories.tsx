import type { Meta, StoryObj } from '@storybook/react';
import ProductGallery from './ProductGallery';
import { PLACEHOLDER_IMAGE } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductGallery renders a product's image gallery — main image plus
 * optional thumbnails, zoom and lightbox. Pure display component: it takes
 * a plain array of image URLs.
 */
const meta: Meta<typeof ProductGallery> = {
  title: 'Product/ProductGallery',
  component: ProductGallery,
  decorators: [withMaxWidth(480)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductGallery>;

const imgs = [PLACEHOLDER_IMAGE, PLACEHOLDER_IMAGE, PLACEHOLDER_IMAGE];

/** Default — multiple images with a thumbnail strip. */
export const Default: Story = {
  args: { images: imgs, showThumbnails: true },
};

/** A single image — no thumbnail strip. */
export const SingleImage: Story = {
  args: { images: [PLACEHOLDER_IMAGE], showThumbnails: true },
};

/** No images — the gallery's empty state. */
export const NoImages: Story = {
  args: { images: [] },
};
