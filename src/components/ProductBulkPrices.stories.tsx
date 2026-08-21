import type { Meta, StoryObj } from '@storybook/react';
import ProductBulkPrices from './ProductBulkPrices';
import { makeProductPrice } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductBulkPrices renders a quantity-tiered price table. Pure display
 * component — takes the bulk-price array as a prop.
 */
const meta: Meta<typeof ProductBulkPrices> = {
  title: 'Product/ProductBulkPrices',
  component: ProductBulkPrices,
  decorators: [withMaxWidth(420)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductBulkPrices>;

/** A three-tier bulk-price table. */
export const Default: Story = {
  args: {
    bulkPrices: [
      makeProductPrice({ quantity: 1, gross: 49.95, net: 60.44 }),
      makeProductPrice({ quantity: 10, gross: 44.95, net: 54.39 }),
      makeProductPrice({ quantity: 50, gross: 39.95, net: 48.34 }),
    ],
  },
};

/** No bulk pricing — the component renders nothing. */
export const Empty: Story = {
  args: { bulkPrices: [] },
};
