import type { Meta, StoryObj } from '@storybook/react';
import PurchaseAuthorizationRequests from './PurchaseAuthorizationRequests';
import { makeContact } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * PurchaseAuthorizationRequests lists the carts awaiting authorization —
 * an approver accepts or rejects each. Infra-aware.
 */
const meta: Meta<typeof PurchaseAuthorizationRequests> = {
  title: 'Purchase Authorization/Requests',
  component: PurchaseAuthorizationRequests,
  decorators: [withPropeller],
  tags: ['autodocs'],
  args: {
    onAcceptRequest: (cartId: string) => console.log('accept request:', cartId),
  },
};
export default meta;

type Story = StoryObj<typeof PurchaseAuthorizationRequests>;

/** Default — the pending-requests view for an approver. */
export const Default: Story = {
  args: { user: makeContact(), companyId: 3001 },
};

/** Limited — only the most recent requests, e.g. for a dashboard summary card. */
export const Limited: Story = {
  args: { user: makeContact(), companyId: 3001, limit: 3 },
};

/** Dashboard — compact read-only summary: date, requester, total. No actions. */
export const Dashboard: Story = {
  args: {
    user: makeContact(),
    companyId: 3001,
    columns: ['date', 'requestedBy', 'total'],
    showActions: false,
    limit: 3,
  },
};

/** Embedded — flat, headerless table for embedding inside another card. */
export const Embedded: Story = {
  args: {
    user: makeContact(),
    companyId: 3001,
    columns: ['date', 'requestedBy', 'total'],
    showActions: false,
    limit: 3,
    flat: true,
    hideHeader: true,
  },
};
