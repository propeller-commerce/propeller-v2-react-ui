import type { Meta, StoryObj } from '@storybook/react';
import ProductGrid from './ProductGrid';
import { makeProduct } from '../__mocks__/fixtures';
import { withPropeller } from '../__mocks__/decorators';

/**
 * ProductGrid is the responsive product/cluster grid. It can fetch its own
 * data (category/search/brand) or — as these stories do — render a supplied
 * `products` array directly, which keeps the story deterministic.
 */
const meta: Meta<typeof ProductGrid> = {
  title: 'Grid/ProductGrid',
  component: ProductGrid,
  decorators: [withPropeller],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductGrid>;

const products = [
  makeProduct({ productId: 1001 }),
  makeProduct({ productId: 1002, names: [{ language: 'EN', value: 'Impact Driver 18V' }] }),
  makeProduct({ productId: 1003, names: [{ language: 'EN', value: 'Circular Saw 18V' }] }),
  makeProduct({ productId: 1004, names: [{ language: 'EN', value: 'Angle Grinder 18V' }] }),
];

/** Default — a grid of supplied products. */
export const Default: Story = {
  args: { products, language: 'EN' },
};

/** Empty — no products, the grid's empty state. */
export const Empty: Story = {
  args: { products: [], language: 'EN' },
};
