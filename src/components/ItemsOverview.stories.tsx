import type { Meta, StoryObj } from '@storybook/react';
import ItemsOverview from './ItemsOverview';
import { makeCart } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * ItemsOverview renders a read-only list of a cart's items — used on
 * order-confirmation and review screens. Pure display component.
 */
const meta: Meta<typeof ItemsOverview> = {
  title: 'Cart/ItemsOverview',
  component: ItemsOverview,
  decorators: [withMaxWidth(640)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ItemsOverview>;

/** Default — a cart with two items. */
export const Default: Story = {
  args: { cart: makeCart() },
};

/** An empty cart. */
export const Empty: Story = {
  args: { cart: makeCart({ items: [] }) },
};
