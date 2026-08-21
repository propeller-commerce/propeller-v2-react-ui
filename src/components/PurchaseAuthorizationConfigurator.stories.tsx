import type { Meta, StoryObj } from '@storybook/react';
import PurchaseAuthorizationConfigurator from './PurchaseAuthorizationConfigurator';
import { makeContact } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * PurchaseAuthorizationConfigurator manages a company's purchase-
 * authorization rules — who can purchase, spending limits, who approves.
 * Infra-aware.
 */
const meta: Meta<typeof PurchaseAuthorizationConfigurator> = {
  title: 'Purchase Authorization/Configurator',
  component: PurchaseAuthorizationConfigurator,
  decorators: [withPropeller],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof PurchaseAuthorizationConfigurator>;

/** Default — PA config for a company. */
export const Default: Story = {
  args: { user: makeContact(), companyId: 3001 },
};
