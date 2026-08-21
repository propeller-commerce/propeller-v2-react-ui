import type { Meta, StoryObj } from '@storybook/react';
import FavoriteListItem from './FavoriteListItem';
import { makeProduct } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * FavoriteListItem renders one row of a favourites list — a product or
 * cluster with image, name, stock and a remove control.
 */
const meta: Meta<typeof FavoriteListItem> = {
  title: 'Favorites/FavoriteListItem',
  component: FavoriteListItem,
  decorators: [withPropeller, withMaxWidth(640)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof FavoriteListItem>;

/** Default — a favourited product. */
export const Default: Story = {
  args: { item: makeProduct() },
};
