import type { Meta, StoryObj } from '@storybook/react';
import ActionCode from './ActionCode';
import { makeCart } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * ActionCode is the promo-/action-code input — apply a code to the cart and
 * remove an applied one. Infra-aware (it mutates the cart), so stories use
 * `withPropeller`.
 */
const meta: Meta<typeof ActionCode> = {
  title: 'Cart/ActionCode',
  component: ActionCode,
  decorators: [withPropeller, withMaxWidth(420)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ActionCode>;

/** Default — empty code input. */
export const Default: Story = {
  args: { cart: makeCart() },
};

/** With the remove-applied-code affordance enabled. */
export const WithRemove: Story = {
  args: { cart: makeCart(), showRemoveCode: true },
};
