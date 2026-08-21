import type { Meta, StoryObj } from '@storybook/react';
import CategoryShortDescription from './CategoryShortDescription';
import { makeCategory } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * CategoryShortDescription renders a category's short description.
 * Pure display component.
 */
const meta: Meta<typeof CategoryShortDescription> = {
  title: 'Category/CategoryShortDescription',
  component: CategoryShortDescription,
  decorators: [withMaxWidth(480)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CategoryShortDescription>;

/** Default. */
export const Default: Story = {
  args: { category: makeCategory(), language: 'EN' },
};
