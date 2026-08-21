import type { Meta, StoryObj } from '@storybook/react';
import Menu from './Menu';
import { withPropeller } from '../__mocks__/decorators';

/**
 * Menu renders the category navigation tree, fetched from a root category.
 * Infra-aware.
 */
const meta: Meta<typeof Menu> = {
  title: 'Navigation/Menu',
  component: Menu,
  decorators: [withPropeller],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Menu>;

/** Default — menu built from a root category id. */
export const Default: Story = {
  args: { categoryId: 17 },
};
