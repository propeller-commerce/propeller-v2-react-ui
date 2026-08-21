import type { Meta, StoryObj } from '@storybook/react';
import AddressSelector from './AddressSelector';
import { makeContact, makeCustomer, makeAddress } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * AddressSelector is a modal address picker for logged-in users — a
 * "Choose address" button opens a modal listing the user's addresses
 * filtered by type. Addresses are read from the user's profile.
 */
const meta: Meta<typeof AddressSelector> = {
  title: 'Address/AddressSelector',
  component: AddressSelector,
  decorators: [withMaxWidth(360)],
  tags: ['autodocs'],
  args: {
    onAddressSelected: (a) => console.log('selected address:', a.id),
  },
};
export default meta;

type Story = StoryObj<typeof AddressSelector>;

// A contact whose company carries a couple of delivery addresses.
const contactWithAddresses = makeContact({
  company: {
    id: 3001,
    companyId: 3001,
    name: 'Analytical Engines Ltd',
    addresses: [
      makeAddress({ id: 4001, city: 'Amsterdam' }),
      makeAddress({ id: 4002, city: 'Rotterdam', street: 'Coolsingel', number: '40' }),
    ],
  },
});

/** A contact with company delivery addresses to choose from. */
export const ContactWithAddresses: Story = {
  args: { user: contactWithAddresses, companyId: 3001 },
};

/** A customer with personal addresses. */
export const Customer: Story = {
  args: {
    user: makeCustomer({
      addresses: [makeAddress({ id: 4003, city: 'Utrecht' })],
    }),
  },
};

/** A user with no saved addresses — the modal shows an empty state. */
export const NoAddresses: Story = {
  args: { user: makeContact() },
};
