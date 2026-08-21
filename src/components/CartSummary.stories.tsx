import type { Meta, StoryObj } from '@storybook/react';
import CartSummary from './CartSummary';
import { makeCart } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * CartSummary renders the cart totals panel — subtotal, discount,
 * shipping, VAT, grand total — plus checkout/quote actions.
 */
const meta: Meta<typeof CartSummary> = {
  title: 'Cart/CartSummary',
  component: CartSummary,
  decorators: [withPropeller, withMaxWidth(360)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CartSummary>;

/** Default — all totals lines shown. */
export const Default: Story = {
  args: { cart: makeCart() },
};

/** A trimmed summary — totals only. */
export const TotalsOnly: Story = {
  args: {
    cart: makeCart(),
    showSubtotal: false,
    showDiscount: false,
    showShippingCosts: false,
    showVATs: false,
  },
};
