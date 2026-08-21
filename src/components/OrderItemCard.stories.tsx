import type { Meta, StoryObj } from '@storybook/react';
import OrderItemCard from './OrderItemCard';
import { makeOrderItem } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * OrderItemCard renders one line of an order — image, name, SKU, quantity,
 * price. Pure display component.
 */
const meta: Meta<typeof OrderItemCard> = {
  title: 'Order/OrderItemCard',
  component: OrderItemCard,
  decorators: [withMaxWidth(560)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof OrderItemCard>;

/** Default — image, SKU, quantity and price all shown. */
export const Default: Story = {
  args: { orderItem: makeOrderItem() },
};

/** A compact variant — image and SKU hidden. */
export const Compact: Story = {
  args: {
    orderItem: makeOrderItem(),
    showImage: false,
    showSku: false,
  },
};
