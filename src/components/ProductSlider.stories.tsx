import type { Meta, StoryObj } from '@storybook/react';
import ProductSlider from './ProductSlider';
import { makeProduct } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * ProductSlider is a horizontal carousel of products — used for
 * cross-sells, related items and CMS product rows. Renders a supplied
 * `products` array directly in these stories.
 */
const meta: Meta<typeof ProductSlider> = {
  title: 'Product/ProductSlider',
  component: ProductSlider,
  decorators: [withPropeller],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductSlider>;

/** Default — a slider of supplied products. */
export const Default: Story = {
  args: {
    products: [
      makeProduct({ productId: 1001 }),
      makeProduct({ productId: 1002, names: [{ language: 'EN', value: 'Impact Driver 18V' }] }),
      makeProduct({ productId: 1003, names: [{ language: 'EN', value: 'Circular Saw 18V' }] }),
      makeProduct({ productId: 1004, names: [{ language: 'EN', value: 'Angle Grinder 18V' }] }),
    ],
  },
};
