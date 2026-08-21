import type { Meta, StoryObj } from '@storybook/react';
import ProductCard from './ProductCard';
import { makeProduct, makeOutOfStockProduct, makeDiscountedPrice } from '../__mocks__/fixtures';
import { withPropeller, withMaxWidth } from '../__mocks__/decorators';

/**
 * ProductCard is the full product card — image, badges, name, SKU, price,
 * favourite toggle and an embedded AddToCart. It resolves infra (services,
 * user, currency, …) from PropellerProvider, so stories wrap it with the
 * `withPropeller` decorator.
 */
const meta: Meta<typeof ProductCard> = {
  title: 'Cards/ProductCard',
  component: ProductCard,
  decorators: [withPropeller, withMaxWidth(300)],
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof ProductCard>;

/** Default — a product in stock at list price. */
export const Default: Story = {
  args: { product: makeProduct() },
};

/** On discount — the price shows the struck-through was-price. */
export const Discounted: Story = {
  args: { product: makeProduct({ price: makeDiscountedPrice() }) },
};

/** Out of stock — the stock badge and AddToCart reflect zero inventory. */
export const OutOfStock: Story = {
  args: { product: makeOutOfStockProduct() },
};

/** Anonymous visitor in a semi-closed portal — price-dependent UI adapts. */
export const Anonymous: Story = {
  args: { product: makeProduct() },
  parameters: { propeller: { user: null, portalMode: 'semi-closed' } },
};
