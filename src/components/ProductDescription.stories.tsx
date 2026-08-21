import type { Meta, StoryObj } from '@storybook/react';
import ProductDescription from './ProductDescription';
import { makeProduct } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductDescription renders a product's (or cluster's) long description,
 * with an optional collapsed/expand affordance. Pure display component.
 */
const meta: Meta<typeof ProductDescription> = {
  title: 'Product/ProductDescription',
  component: ProductDescription,
  decorators: [withMaxWidth(640)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductDescription>;

/** Default — full description. */
export const Default: Story = {
  args: { product: makeProduct(), language: 'EN' },
};

/** Collapsed — description is truncated with an expand control. */
export const Collapsed: Story = {
  args: { product: makeProduct(), language: 'EN', collapsed: true },
};
