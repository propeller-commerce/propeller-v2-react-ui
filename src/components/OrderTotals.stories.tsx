import type { Meta, StoryObj } from '@storybook/react';
import OrderTotals from './OrderTotals';
import { makeOrder } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * OrderTotals renders the totals block of an order — subtotal, discount,
 * shipping, VAT lines, grand total. Pure display component.
 */
const meta: Meta<typeof OrderTotals> = {
  title: 'Order/OrderTotals',
  component: OrderTotals,
  decorators: [withMaxWidth(360)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof OrderTotals>;

/** Default — every totals line shown. */
export const Default: Story = {
  args: { order: makeOrder() },
};

/** A trimmed totals block — just the grand total. */
export const TotalOnly: Story = {
  args: {
    order: makeOrder(),
    showSubtotal: false,
    showDiscount: false,
    showShippingCosts: false,
    showVATs: false,
  },
};
