import type { Meta, StoryObj } from '@storybook/react';
import CompanySwitcher from './CompanySwitcher';
import { makeContact } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * CompanySwitcher lets a B2B contact switch the active company when their
 * account is linked to more than one.
 */
const meta: Meta<typeof CompanySwitcher> = {
  title: 'Account/CompanySwitcher',
  component: CompanySwitcher,
  decorators: [withPropeller],
  tags: ['autodocs'],
  args: {
    onCompanyChange: (c) => console.log('company change:', c.companyId),
  },
};
export default meta;

type Story = StoryObj<typeof CompanySwitcher>;

// A contact linked to two companies.
const multiCompanyContact = makeContact({
  companies: {
    items: [
      { id: 3001, companyId: 3001, name: 'Analytical Engines Ltd' },
      { id: 3002, companyId: 3002, name: 'Babbage & Co' },
    ],
  },
});

/** A contact with two companies to switch between. */
export const Default: Story = {
  args: { user: multiCompanyContact, selectedCompanyId: 3001 },
};
