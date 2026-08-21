import type { Meta, StoryObj } from '@storybook/react';
import OrderList from './OrderList';
import { makeContact } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * OrderList is the paginated order table with search and filtering.
 * Infra-aware — orders are fetched through the resolved services.
 */
const meta: Meta<typeof OrderList> = {
  title: 'Order/OrderList',
  component: OrderList,
  decorators: [withPropeller],
  tags: ['autodocs'],
  args: {
    onOrderClick: (orderId: number) => console.log('open order:', orderId),
  },
};
export default meta;

type Story = StoryObj<typeof OrderList>;

/** Default — the order table for a logged-in contact. */
export const Default: Story = {
  args: { user: makeContact() },
};

/** Embedded — flat, headerless table for embedding inside another card. */
export const Embedded: Story = {
  args: { user: makeContact(), flat: true, hideHeader: true },
};
