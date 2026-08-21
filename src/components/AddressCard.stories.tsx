import type { Meta, StoryObj } from '@storybook/react';
import AddressCard from './AddressCard';
import { makeAddress } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * AddressCard renders a single address — company, name, street, postal
 * code, city, country — with per-field show/hide toggles.
 */
const meta: Meta<typeof AddressCard> = {
  title: 'Address/AddressCard',
  component: AddressCard,
  decorators: [withMaxWidth(320)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof AddressCard>;

/** Default — a full delivery address. */
export const Default: Story = {
  args: { address: makeAddress() },
};

/** Company name hidden — a personal address. */
export const WithoutCompany: Story = {
  args: { address: makeAddress({ company: undefined }), showCompanyName: false },
};

/** No address — the empty/placeholder state. */
export const Empty: Story = {
  args: { address: null },
};
