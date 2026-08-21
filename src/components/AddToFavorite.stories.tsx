import type { Meta, StoryObj } from '@storybook/react';
import AddToFavorite from './AddToFavorite';
import { withPropeller } from '../__mocks__/decorators';

/**
 * AddToFavorite is the favourite toggle — a heart button that opens a
 * list-picker modal. It only renders for authenticated users.
 */
const meta: Meta<typeof AddToFavorite> = {
  title: 'Product/AddToFavorite',
  component: AddToFavorite,
  decorators: [withPropeller],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof AddToFavorite>;

/** Logged-in — the favourite button is shown. */
export const Default: Story = {
  args: { productId: 1001 },
};

/** Anonymous — the component renders nothing (no favourites without a user). */
export const Anonymous: Story = {
  args: { productId: 1001 },
  parameters: { propeller: { user: null } },
};
