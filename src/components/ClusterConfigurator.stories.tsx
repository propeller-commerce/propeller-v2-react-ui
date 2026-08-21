import type { Meta, StoryObj } from '@storybook/react';
import ClusterConfigurator from './ClusterConfigurator';
import { makeProduct } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * ClusterConfigurator lets the shopper pick a configuration of a cluster —
 * narrowing the candidate products by attribute selections.
 */
const meta: Meta<typeof ClusterConfigurator> = {
  title: 'Cluster/ClusterConfigurator',
  component: ClusterConfigurator,
  decorators: [withPropeller, withMaxWidth(560)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ClusterConfigurator>;

/** Default — a small set of candidate products. */
export const Default: Story = {
  args: {
    clusterId: 2001,
    products: [
      makeProduct({ productId: 1001 }),
      makeProduct({ productId: 1002 }),
      makeProduct({ productId: 1003 }),
    ],
  },
};
