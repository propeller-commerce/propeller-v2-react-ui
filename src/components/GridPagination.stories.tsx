import type { Meta, StoryObj } from '@storybook/react';
import GridPagination from './GridPagination';
import { makeProductsResponse } from '../__mocks__/fixtures';

/**
 * GridPagination renders a pagination bar driven by a ProductsResponse —
 * compact (Prev / Page X of Y / Next) or full (numbered buttons).
 */
const meta: Meta<typeof GridPagination> = {
  title: 'Grid/GridPagination',
  component: GridPagination,
  tags: ['autodocs'],
  args: {
    onPageChange: (page: number) => console.log('page change:', page),
  },
};
export default meta;

type Story = StoryObj<typeof GridPagination>;

/** Compact style — 60 items across 5 pages, currently on page 2. */
export const Compact: Story = {
  args: {
    products: makeProductsResponse({ itemsFound: 60, pages: 5, offset: 12, page: 2 }),
    variant: 'compact',
  },
};

/** Full style — numbered page buttons, 120 items across 10 pages. */
export const Full: Story = {
  args: {
    products: makeProductsResponse({ itemsFound: 120, pages: 10, offset: 12, page: 4 }),
    variant: 'full',
  },
};

/** A single page — pagination collapses or hides. */
export const SinglePage: Story = {
  args: {
    products: makeProductsResponse({ itemsFound: 3, pages: 1, offset: 12, page: 1 }),
  },
};
