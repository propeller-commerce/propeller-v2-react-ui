import type { Meta, StoryObj } from '@storybook/react';
import CategoryDescription from './CategoryDescription';
import { makeCategory } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * CategoryDescription renders a category's long description, with an
 * optional collapsed/expand affordance. Pure display component.
 */
const meta: Meta<typeof CategoryDescription> = {
  title: 'Category/CategoryDescription',
  component: CategoryDescription,
  decorators: [withMaxWidth(640)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CategoryDescription>;

/** Default — full description. */
export const Default: Story = {
  args: { category: makeCategory(), language: 'EN' },
};

/** Collapsed. */
export const Collapsed: Story = {
  args: { category: makeCategory(), language: 'EN', collapsed: true },
};
