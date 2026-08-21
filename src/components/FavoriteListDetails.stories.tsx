import type { Meta, StoryObj } from '@storybook/react';
import FavoriteListDetails from './FavoriteListDetails';
import { makeContact } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * FavoriteListDetails renders the contents of one favourite list — its
 * items, with paginated removal. Infra-aware.
 */
const meta: Meta<typeof FavoriteListDetails> = {
  title: 'Favorites/FavoriteListDetails',
  component: FavoriteListDetails,
  decorators: [withPropeller],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof FavoriteListDetails>;

/** Default — a list resolved by id from the user's profile. */
export const Default: Story = {
  args: {
    favoriteListId: 'fl-1',
    user: makeContact({
      favoriteLists: { items: [{ id: 'fl-1', name: 'Workshop wishlist', isDefault: true }] },
    } as Parameters<typeof makeContact>[0]),
  },
};
