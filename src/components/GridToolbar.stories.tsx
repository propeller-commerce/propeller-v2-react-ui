import type { Meta, StoryObj } from '@storybook/react';
import GridToolbar from './GridToolbar';

/**
 * GridToolbar is the grid's control bar — sort field/order selects, a
 * per-page select, a grid/list view toggle, and active-filter badges.
 */
const meta: Meta<typeof GridToolbar> = {
  title: 'Grid/GridToolbar',
  component: GridToolbar,
  tags: ['autodocs'],
  args: {
    onSortChange: (field: string, order: string) => console.log('sort:', field, order),
    onOffsetChange: (offset: number) => console.log('per page:', offset),
    onViewChange: (mode: string) => console.log('view:', mode),
  },
};
export default meta;

type Story = StoryObj<typeof GridToolbar>;

/** Default — grid view, default sort, 24 items found. */
export const Default: Story = {
  args: {
    viewMode: 'grid',
    defaultOffset: 12,
    itemsFound: 24,
  },
};

/** List view selected. */
export const ListView: Story = {
  args: {
    viewMode: 'list',
    defaultOffset: 12,
    itemsFound: 24,
  },
};

/** With active text filters shown as removable badges. */
export const WithActiveFilters: Story = {
  args: {
    viewMode: 'grid',
    defaultOffset: 12,
    itemsFound: 9,
    activeTextFilters: { Colour: ['Black'], Brand: ['Makita'] },
  },
};
