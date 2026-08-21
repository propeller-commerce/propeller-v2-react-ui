import type { Meta, StoryObj } from '@storybook/react';
import ProductDownloads from './ProductDownloads';
import { makeDocuments } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductDownloads renders a product's downloadable documents
 * (datasheets, manuals). Pure display component.
 */
const meta: Meta<typeof ProductDownloads> = {
  title: 'Product/ProductDownloads',
  component: ProductDownloads,
  decorators: [withMaxWidth(420)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductDownloads>;

/** Default — two downloadable documents. */
export const Default: Story = {
  args: { downloads: makeDocuments(), language: 'EN' },
};

/** No documents — the component renders an empty state or nothing. */
export const Empty: Story = {
  args: {
    downloads: makeDocuments({ items: [], itemsFound: 0 }),
    language: 'EN',
  },
};
