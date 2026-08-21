import type { Meta, StoryObj } from '@storybook/react';
import ProductBundles from './ProductBundles';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductBundles renders the bundle offers for a product — add-the-set
 * deals. Infra-aware (bundle add-to-cart mutates the cart).
 */
const meta: Meta<typeof ProductBundles> = {
  title: 'Product/ProductBundles',
  component: ProductBundles,
  decorators: [withPropeller, withMaxWidth(640)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductBundles>;

/** Default — bundles for a product. */
export const Default: Story = {
  args: { productId: 1001, taxZone: 'NL' },
};
