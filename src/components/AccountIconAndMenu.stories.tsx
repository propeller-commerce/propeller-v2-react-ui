import type { Meta, StoryObj } from '@storybook/react';
import AccountIconAndMenu from './AccountIconAndMenu';
import { makeContact, makeCustomer } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * AccountIconAndMenu is the header account control — an icon that opens the
 * account menu, or a sidebar variant for account pages.
 */
const meta: Meta<typeof AccountIconAndMenu> = {
  title: 'Account/AccountIconAndMenu',
  component: AccountIconAndMenu,
  decorators: [withPropeller],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof AccountIconAndMenu>;

/** Logged-in contact. */
export const Contact: Story = {
  args: { user: makeContact() },
};

/** Logged-in customer. */
export const Customer: Story = {
  args: { user: makeCustomer() },
};

/** Anonymous — the menu offers login/register. */
export const Anonymous: Story = {
  args: { user: null },
  parameters: { propeller: { user: null } },
};
