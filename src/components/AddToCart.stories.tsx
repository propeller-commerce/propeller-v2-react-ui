import type { Meta, StoryObj } from '@storybook/react';
import AddToCart from './AddToCart';
import { makeProduct, makeOutOfStockProduct } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * AddToCart is the quantity-input + add-button block. It creates/updates a
 * cart through the resolved services, so stories use `withPropeller`.
 */
const meta: Meta<typeof AddToCart> = {
  title: 'Cart/AddToCart',
  component: AddToCart,
  decorators: [withPropeller, withMaxWidth(360)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof AddToCart>;

/** Default — in-stock product, quantity stepper + add button. */
export const Default: Story = {
  args: { product: makeProduct(), createCart: true },
};

/** Out of stock — the add button reflects zero inventory. */
export const OutOfStock: Story = {
  args: {
    product: makeOutOfStockProduct(),
    createCart: true,
    enableStockValidation: true,
  },
};
