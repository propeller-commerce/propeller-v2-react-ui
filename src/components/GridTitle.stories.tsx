import type { Meta, StoryObj } from '@storybook/react';
import GridTitle from './GridTitle';

/**
 * GridTitle renders a category/search heading. Pure display component.
 */
const meta: Meta<typeof GridTitle> = {
  title: 'Grid/GridTitle',
  component: GridTitle,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof GridTitle>;

/** Default heading. */
export const Default: Story = {
  args: { title: 'Power Tools', language: 'EN' },
};

/** Rendered at a different heading level. */
export const AsH2: Story = {
  args: { title: 'Search results', language: 'EN', headingLevel: 'h2' },
};
