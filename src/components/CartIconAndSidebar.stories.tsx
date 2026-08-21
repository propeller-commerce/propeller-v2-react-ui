import type { Meta, StoryObj } from '@storybook/react';
import CartIconAndSidebar from './CartIconAndSidebar';
import { makeCart } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * CartIconAndSidebar is the header cart icon with an item-count badge and a
 * slide-out sidebar showing the cart contents.
 */
const meta: Meta<typeof CartIconAndSidebar> = {
  title: 'Cart/CartIconAndSidebar',
  component: CartIconAndSidebar,
  decorators: [withPropeller],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CartIconAndSidebar>;

/** Default — icon with a count badge. */
export const Default: Story = {
  args: { cart: makeCart(), showBadge: true },
};

/** An empty cart — the badge is hidden or zero. */
export const EmptyCart: Story = {
  args: { cart: makeCart({ items: [], total: { totalGross: 0, totalNet: 0 } }), showBadge: true },
};
