import type { Meta, StoryObj } from '@storybook/react';
import CartItem from './CartItem';
import { makeCartItem } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * CartItem renders one line of the cart — image, name, SKU, a quantity
 * stepper, line total and a remove control. Infra-aware (cart mutations go
 * through the resolved services), so stories wrap it with `withPropeller`.
 */
const meta: Meta<typeof CartItem> = {
  title: 'Cart/CartItem',
  component: CartItem,
  decorators: [withPropeller, withMaxWidth(640)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CartItem>;

/** Default — a cart line with quantity 2. */
export const Default: Story = {
  args: { cartItem: makeCartItem(), cartId: 'cart-9001' },
};

/** A single-unit line. */
export const SingleUnit: Story = {
  args: { cartItem: makeCartItem({ quantity: 1 }), cartId: 'cart-9001' },
};
