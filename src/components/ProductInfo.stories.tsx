import type { Meta, StoryObj } from '@storybook/react';
import ProductInfo from './ProductInfo';
import { makeProduct } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductInfo renders a product's headline block — name, SKU, price,
 * stock, short description. Infra-aware.
 */
const meta: Meta<typeof ProductInfo> = {
  title: 'Product/ProductInfo',
  component: ProductInfo,
  decorators: [withPropeller, withMaxWidth(560)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductInfo>;

/** Default. */
export const Default: Story = {
  args: { product: makeProduct() },
};
