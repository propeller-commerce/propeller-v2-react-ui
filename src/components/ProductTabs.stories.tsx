import type { Meta, StoryObj } from '@storybook/react';
import ProductTabs from './ProductTabs';
import { makeProduct } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductTabs is the tab bar wrapping Description / Specifications /
 * Downloads / Videos for a product.
 */
const meta: Meta<typeof ProductTabs> = {
  title: 'Product/ProductTabs',
  component: ProductTabs,
  decorators: [withPropeller, withMaxWidth(720)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductTabs>;

/** Default — all tabs shown. */
export const Default: Story = {
  args: { product: makeProduct() },
};

/** Description tab only. */
export const DescriptionOnly: Story = {
  args: {
    product: makeProduct(),
    showSpecifications: false,
    showDownloads: false,
  },
};
