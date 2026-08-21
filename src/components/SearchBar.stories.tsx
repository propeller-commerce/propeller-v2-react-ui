import type { Meta, StoryObj } from '@storybook/react';
import SearchBar from './SearchBar';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * SearchBar is the product search input with a type-ahead results
 * dropdown. Infra-aware — search runs through the resolved services.
 */
const meta: Meta<typeof SearchBar> = {
  title: 'Navigation/SearchBar',
  component: SearchBar,
  decorators: [withPropeller, withMaxWidth(480)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof SearchBar>;

/** Default. */
export const Default: Story = {};

/** With a custom placeholder. */
export const CustomPlaceholder: Story = {
  args: { placeholder: 'Search tools, brands, SKUs…' },
};
