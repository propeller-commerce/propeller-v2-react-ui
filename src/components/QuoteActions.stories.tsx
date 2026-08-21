import type { Meta, StoryObj } from '@storybook/react';
import QuoteActions from './QuoteActions';
import { makeOrder } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * QuoteActions renders the accept-quotation button with an optional
 * terms-and-conditions checkbox. Infra-aware.
 */
const meta: Meta<typeof QuoteActions> = {
  title: 'Quote/QuoteActions',
  component: QuoteActions,
  decorators: [withPropeller, withMaxWidth(420)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof QuoteActions>;

/** Default — accept button with the T&C checkbox. */
export const Default: Story = {
  args: { quote: makeOrder({ status: 'QUOTE' }) },
};

/** Without the terms-and-conditions checkbox. */
export const WithoutTerms: Story = {
  args: { quote: makeOrder({ status: 'QUOTE' }), showTermsAndConditions: false },
};
