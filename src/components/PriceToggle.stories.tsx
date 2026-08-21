import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import PriceToggle from './PriceToggle';

/**
 * PriceToggle is a controlled switch for incl./excl. VAT pricing. The
 * consumer owns the `value` and handles `onChange` — wire it to the
 * PropellerProvider's `includeTax` field.
 */
const meta: Meta<typeof PriceToggle> = {
  title: 'Display/PriceToggle',
  component: PriceToggle,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof PriceToggle>;

/** Controlled — a small wrapper holds the toggle state. */
export const Default: Story = {
  render: (args) => {
    const [on, setOn] = useState(false);
    return <PriceToggle {...args} value={on} onChange={setOn} />;
  },
};

/** Starts in the "incl. VAT" position. */
export const TaxInclusive: Story = {
  render: (args) => {
    const [on, setOn] = useState(true);
    return <PriceToggle {...args} value={on} onChange={setOn} />;
  },
};
