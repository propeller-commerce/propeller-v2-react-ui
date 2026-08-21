import type { Meta, StoryObj } from '@storybook/react';
import FavoriteLists from './FavoriteLists';
import { makeContact } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * FavoriteLists renders the user's favourite lists — read from the user
 * profile. Infra-aware.
 */
const meta: Meta<typeof FavoriteLists> = {
  title: 'Favorites/FavoriteLists',
  component: FavoriteLists,
  decorators: [withPropeller, withMaxWidth(480)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof FavoriteLists>;

// A contact with a couple of favourite lists.
const contactWithLists = makeContact({
  favoriteLists: {
    items: [
      { id: 'fl-1', name: 'Workshop wishlist', isDefault: true },
      { id: 'fl-2', name: 'Reorder soon', isDefault: false },
    ],
  },
} as Parameters<typeof makeContact>[0]);

/** A user with two favourite lists. */
export const Default: Story = {
  args: { user: contactWithLists },
};

/** A user with no lists yet. */
export const Empty: Story = {
  args: { user: makeContact() },
};
