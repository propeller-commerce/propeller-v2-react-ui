import type { Meta, StoryObj } from '@storybook/react';
import OrderSummary from './OrderSummary';
import { makeOrder } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * OrderSummary renders an order's headline facts — number, date, status,
 * total. Pure display component.
 */
const meta: Meta<typeof OrderSummary> = {
  title: 'Order/OrderSummary',
  component: OrderSummary,
  decorators: [withMaxWidth(420)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof OrderSummary>;

/** Default — all summary fields shown. */
export const Default: Story = {
  args: { order: makeOrder() },
};

/** A pending order. */
export const Pending: Story = {
  args: { order: makeOrder({ status: 'PENDING' }) },
};
