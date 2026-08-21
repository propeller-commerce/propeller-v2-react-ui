import type { Meta, StoryObj } from '@storybook/react';
import CartPaymethods from './CartPaymethods';
import { makeCart, makeContact } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * CartPaymethods renders the payment-method tiles for a cart, preselecting
 * from `cart.paymentData.method` when present.
 */
const meta: Meta<typeof CartPaymethods> = {
  title: 'Checkout/CartPaymethods',
  component: CartPaymethods,
  decorators: [withMaxWidth(560)],
  tags: ['autodocs'],
  args: {
    onPaymethodSelect: (m) => console.log('paymethod:', m),
  },
};
export default meta;

type Story = StoryObj<typeof CartPaymethods>;

/** Logged-in contact. */
export const Default: Story = {
  args: { cart: makeCart(), user: makeContact() },
};

/** Guest checkout — on-account may be hidden depending on the flag. */
export const Guest: Story = {
  args: { cart: makeCart(), user: null, showOnAccountForGuests: false },
};
