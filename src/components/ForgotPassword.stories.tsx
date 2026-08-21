import type { Meta, StoryObj } from '@storybook/react';
import ForgotPassword from './ForgotPassword';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * ForgotPassword is the password-reset request form.
 */
const meta: Meta<typeof ForgotPassword> = {
  title: 'Auth/ForgotPassword',
  component: ForgotPassword,
  decorators: [withPropeller, withMaxWidth(420)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ForgotPassword>;

/** Default. */
export const Default: Story = {};

/** With custom heading copy. */
export const CustomCopy: Story = {
  args: {
    title: 'Reset your password',
    subtitle: 'Enter your email and we will send a reset link.',
  },
};
