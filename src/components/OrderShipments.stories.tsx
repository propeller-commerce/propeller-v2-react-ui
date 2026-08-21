import type { Meta, StoryObj } from '@storybook/react';
import OrderShipments from './OrderShipments';
import { makeOrder } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * OrderShipments renders an order's shipment/tracking information.
 * Pure display component.
 */
const meta: Meta<typeof OrderShipments> = {
  title: 'Order/OrderShipments',
  component: OrderShipments,
  decorators: [withMaxWidth(560)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof OrderShipments>;

/** Default — an order with shipment info. */
export const Default: Story = {
  args: { order: makeOrder() },
};
