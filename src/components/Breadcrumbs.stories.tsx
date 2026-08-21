import type { Meta, StoryObj } from '@storybook/react';
import Breadcrumbs from './Breadcrumbs';
import { makeCategoryPath } from '../__mocks__/fixtures';

/**
 * Breadcrumbs renders the category trail from a category/product/cluster
 * response. Pure display component — takes the path as a prop.
 */
const meta: Meta<typeof Breadcrumbs> = {
  title: 'Display/Breadcrumbs',
  component: Breadcrumbs,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Breadcrumbs>;

/** Default — full category path, last crumb is the current page. */
export const Default: Story = {
  args: {
    categoryPath: makeCategoryPath(),
  },
};

/** With `showCurrent` off — the last path item is omitted. */
export const WithoutCurrent: Story = {
  args: {
    categoryPath: makeCategoryPath(),
    showCurrent: false,
  },
};

/** A single-level path. */
export const ShallowPath: Story = {
  args: {
    categoryPath: makeCategoryPath().slice(0, 1),
  },
};
