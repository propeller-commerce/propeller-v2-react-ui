import type { Meta, StoryObj } from '@storybook/react';
import DeliveryDate from './DeliveryDate';
import { makeCart } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * DeliveryDate renders the expected delivery date for a cart, optionally
 * with a date picker. Pure display component.
 */
const meta: Meta<typeof DeliveryDate> = {
  title: 'Cart/DeliveryDate',
  component: DeliveryDate,
  decorators: [withMaxWidth(420)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof DeliveryDate>;

/** Default — computed delivery date. */
export const Default: Story = {
  args: { cart: makeCart() },
};

/** With the date picker shown. */
export const WithDatePicker: Story = {
  args: { cart: makeCart(), showDatePicker: true },
};
