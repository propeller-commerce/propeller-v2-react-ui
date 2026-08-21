import type { Meta, StoryObj } from '@storybook/react';
import GridFilters from './GridFilters';
import { makeFilters } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * GridFilters is the accordion filter sidebar — a price-range slider and
 * attribute checkbox facets, collapsed by default.
 */
const meta: Meta<typeof GridFilters> = {
  title: 'Grid/GridFilters',
  component: GridFilters,
  decorators: [withMaxWidth(280)],
  tags: ['autodocs'],
  args: {
    onFilterChange: (filter, value) => console.log('filter change:', filter.id, value),
  },
};
export default meta;

type Story = StoryObj<typeof GridFilters>;

/** Default — colour + brand facets with a price range. */
export const Default: Story = {
  args: {
    filters: makeFilters(),
    priceMin: 0,
    priceMax: 200,
    language: 'EN',
  },
};

/** Disabled — every input is locked while a fetch is in flight. */
export const Loading: Story = {
  args: {
    filters: makeFilters(),
    priceMin: 0,
    priceMax: 200,
    language: 'EN',
    isLoading: true,
  },
};

/** No filters available — the empty state. */
export const NoFilters: Story = {
  args: { filters: [], language: 'EN' },
};

export const AvailabilityHiddenByDefault: Story = {
  args: {
    ...Default.args,
  },
};

export const AvailabilityShown: Story = {
  args: {
    ...Default.args,
    showAvailabilityFilter: true,
  },
};

export const AvailabilityInStockSelected: Story = {
  args: {
    ...Default.args,
    showAvailabilityFilter: true,
    activeAvailability: 'in-stock',
  },
};

/** In stock with a raised quantity threshold. */
export const AvailabilityInStockRaisedQuantity: Story = {
  args: {
    ...Default.args,
    showAvailabilityFilter: true,
    activeAvailability: 'in-stock',
    activeMinStock: 5,
  },
};
