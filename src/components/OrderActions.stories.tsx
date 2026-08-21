import type { Meta, StoryObj } from '@storybook/react';
import OrderActions from './OrderActions';
import { makeOrder } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * OrderActions renders the per-order action buttons — "Order confirmation
 * (PDF)" and "Order again". Infra-aware (re-order creates a cart).
 */
const meta: Meta<typeof OrderActions> = {
  title: 'Order/OrderActions',
  component: OrderActions,
  decorators: [withPropeller],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof OrderActions>;

/** Default — both actions available. */
export const Default: Story = {
  args: { order: makeOrder() },
};
