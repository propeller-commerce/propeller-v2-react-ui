import type { Meta, StoryObj } from '@storybook/react';
import ProductShortDescription from './ProductShortDescription';
import { makeProduct } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductShortDescription renders a product's (or cluster's) short
 * description — the one-line summary. Pure display component.
 */
const meta: Meta<typeof ProductShortDescription> = {
  title: 'Product/ProductShortDescription',
  component: ProductShortDescription,
  decorators: [withMaxWidth(480)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductShortDescription>;

/** Default. */
export const Default: Story = {
  args: { product: makeProduct(), language: 'EN' },
};
