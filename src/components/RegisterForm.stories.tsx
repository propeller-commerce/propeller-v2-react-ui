import type { Meta, StoryObj } from '@storybook/react';
import RegisterForm from './RegisterForm';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * RegisterForm is the account-registration form.
 */
const meta: Meta<typeof RegisterForm> = {
  title: 'Auth/RegisterForm',
  component: RegisterForm,
  decorators: [withPropeller, withMaxWidth(480)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof RegisterForm>;

/** Default. */
export const Default: Story = {};

/** With custom heading copy. */
export const CustomCopy: Story = {
  args: {
    title: 'Create an account',
    subtitle: 'Join us — it only takes a minute.',
  },
};
