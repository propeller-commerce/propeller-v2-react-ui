import type { Meta, StoryObj } from '@storybook/react';
import CartCarriers from './CartCarriers';
import { makeCart } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * CartCarriers renders the shipping-carrier tiles for a cart, preselecting
 * from `cart.postageData.carrier` when present.
 */
const meta: Meta<typeof CartCarriers> = {
  title: 'Checkout/CartCarriers',
  component: CartCarriers,
  decorators: [withMaxWidth(560)],
  tags: ['autodocs'],
  args: {
    onCarrierSelect: (c) => console.log('carrier:', c),
  },
};
export default meta;

type Story = StoryObj<typeof CartCarriers>;

/** Default — carrier tiles with prices. */
export const Default: Story = {
  args: { cart: makeCart(), showPrice: true },
};

/** Carrier logos hidden — text-only tiles. */
export const NoLogos: Story = {
  args: { cart: makeCart(), showCarrierLogo: false, showPrice: true },
};
