import type { Meta, StoryObj } from '@storybook/react';
import ClusterOptions from './ClusterOptions';
import { makeClusterOptions } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * ClusterOptions renders the selectable option groups of a cluster
 * (colour, battery, …). Pure display component.
 */
const meta: Meta<typeof ClusterOptions> = {
  title: 'Cluster/ClusterOptions',
  component: ClusterOptions,
  decorators: [withMaxWidth(480)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ClusterOptions>;

/** Default — a required colour group and an optional battery group. */
export const Default: Story = {
  args: { clusterId: 2001, options: makeClusterOptions() },
};
