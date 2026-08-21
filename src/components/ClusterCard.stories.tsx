import type { Meta, StoryObj } from '@storybook/react';
import ClusterCard from './ClusterCard';
import { makeCluster } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * ClusterCard is the product-cluster card — default-product image, name,
 * SKU, price, stock badge, favourite toggle and a "View cluster" button.
 */
const meta: Meta<typeof ClusterCard> = {
  title: 'Cards/ClusterCard',
  component: ClusterCard,
  decorators: [withPropeller, withMaxWidth(300)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ClusterCard>;

/** Default — a cluster showing its default product. */
export const Default: Story = {
  args: { cluster: makeCluster() },
};

/** Name and SKU hidden — image-and-price-only variant. */
export const Minimal: Story = {
  args: { cluster: makeCluster(), showName: false, showSku: false },
};
