import type { Meta, StoryObj } from '@storybook/react';
import UserDetails from './UserDetails';
import { makeContact, makeCustomer } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * UserDetails renders a user's profile block — name, contact info and,
 * for contacts, their company details. Pure display component.
 */
const meta: Meta<typeof UserDetails> = {
  title: 'Account/UserDetails',
  component: UserDetails,
  decorators: [withMaxWidth(480)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof UserDetails>;

/** A B2B contact — company info is shown. */
export const Contact: Story = {
  args: {
    user: makeContact(),
    activeCompany: { id: 3001, companyId: 3001, name: 'Analytical Engines Ltd' } as never,
    showCompanyInfo: true,
  },
};

/** A consumer customer — no company block. */
export const Customer: Story = {
  args: {
    user: makeCustomer(),
    activeCompany: null,
    showCompanyInfo: false,
  },
};
