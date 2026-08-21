import type { Meta, StoryObj } from '@storybook/react';
import CartOverview from './CartOverview';
import { makeCart } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * CartOverview renders the full editable cart — the line items plus
 * optional notes and reference fields.
 */
const meta: Meta<typeof CartOverview> = {
  title: 'Cart/CartOverview',
  component: CartOverview,
  decorators: [withPropeller, withMaxWidth(760)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CartOverview>;

/** Default — a cart with two items. */
export const Default: Story = {
  args: { cart: makeCart() },
};

/** An empty cart. */
export const Empty: Story = {
  args: { cart: makeCart({ items: [] }) },
};
