import type { Meta, StoryObj } from '@storybook/react';
import ItemStock from './ItemStock';
import { makeInventory } from '../__mocks__/fixtures';

/**
 * ItemStock renders a stock-availability badge from a ProductInventory.
 * Pure display component.
 */
const meta: Meta<typeof ItemStock> = {
  title: 'Display/ItemStock',
  component: ItemStock,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ItemStock>;

/** In stock — a healthy quantity. */
export const InStock: Story = {
  args: { inventory: makeInventory(42), showStock: true },
};

/** Low stock — a small quantity left. */
export const LowStock: Story = {
  args: { inventory: makeInventory(3), showStock: true },
};

/** Out of stock — zero quantity. */
export const OutOfStock: Story = {
  args: { inventory: makeInventory(0), showStock: true },
};

/** With the availability line shown as well as the stock badge. */
export const WithAvailability: Story = {
  args: { inventory: makeInventory(42), showStock: true, showAvailability: true },
};
