import type { Meta, StoryObj } from '@storybook/react';
import ProductPrice from './ProductPrice';
import { makeProductPrice, makeDiscountedPrice } from '../__mocks__/fixtures';
import { withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductPrice renders a product's price — gross/net, discounts, and
 * tax-inclusive toggling. It is a pure display component: everything comes
 * in as props, so no PropellerProvider is needed.
 */
const meta: Meta<typeof ProductPrice> = {
  title: 'Display/ProductPrice',
  component: ProductPrice,
  decorators: [withMaxWidth(320)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductPrice>;

/** Default — a plain price, gross (excl. VAT) leading. */
export const Default: Story = {
  args: {
    price: makeProductPrice(),
    currency: '€',
  },
};

/** Tax-inclusive — net (incl. VAT) is the leading price. */
export const TaxInclusive: Story = {
  args: {
    price: makeProductPrice(),
    currency: '€',
    includeTax: true,
  },
};

/** Discounted — `list` is the struck-through was-price. */
export const Discounted: Story = {
  args: {
    price: makeDiscountedPrice(),
    currency: '€',
  },
};

/** Semi-closed portal, anonymous visitor — the price is hidden. */
export const HiddenForAnonymous: Story = {
  args: {
    price: makeProductPrice(),
    currency: '€',
    portalMode: 'semi-closed',
    user: null,
  },
};
