import type { Meta, StoryObj } from '@storybook/react';
import ProductSpecifications from './ProductSpecifications';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductSpecifications renders a product's attribute/spec table.
 * Infra-aware — specs are fetched through the resolved services.
 */
const meta: Meta<typeof ProductSpecifications> = {
  title: 'Product/ProductSpecifications',
  component: ProductSpecifications,
  decorators: [withPropeller, withMaxWidth(560)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductSpecifications>;

/** Default — specifications for a product. */
export const Default: Story = {
  args: { productId: 1001 },
};
