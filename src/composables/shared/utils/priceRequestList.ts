/**
 * The price-request list: products whose price is quoted rather than published.
 *
 * A parallel basket, deliberately not the cart. A quoted product has no price
 * to total, cannot be paid for and must not reach checkout, so mixing the two
 * would put an unpriced line into a payable order. Items are collected here,
 * then sent as one request.
 *
 * Pure list operations over a plain array — persistence and delivery belong to
 * the host (see `usePriceRequest`).
 */

/** One product on the list. Mirrors what the request form needs to render. */
export interface PriceRequestItem {
  /** Product id — the identity used for add/remove. */
  productId: number;
  /** SKU, shown in the form's code column. */
  code: string;
  /** Localized product name. */
  name: string;
  /** Requested quantity, never below `minQuantity`. */
  quantity: number;
  /** Minimum order quantity (defaults to 1). */
  minQuantity: number;
  /** Order unit/step (defaults to 1). */
  unit: number;
}

/** Is this product already on the list? Identity is the SKU, as in the form. */
export function containsItem(list: PriceRequestItem[], code: string): boolean {
  return list.some((i) => i.code === code);
}

/** Add a product unless its code is already listed. Returns a new list. */
export function addItem(list: PriceRequestItem[], item: PriceRequestItem): PriceRequestItem[] {
  if (containsItem(list, item.code)) return list;
  return [...list, { ...item, quantity: Math.max(item.quantity, item.minQuantity) }];
}

/** Drop a product by code. Returns a new list. */
export function removeItem(list: PriceRequestItem[], code: string): PriceRequestItem[] {
  return list.filter((i) => i.code !== code);
}

/** Set a quantity, floored at the item's minimum. Returns a new list. */
export function setItemQuantity(
  list: PriceRequestItem[],
  code: string,
  quantity: number
): PriceRequestItem[] {
  return list.map((i) =>
    i.code === code ? { ...i, quantity: Math.max(quantity, i.minQuantity) } : i
  );
}

/** Parse a stored list, tolerating absent or corrupt JSON. */
export function parseStoredList(raw: string | null | undefined): PriceRequestItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i) => i && typeof i.code === 'string' && typeof i.productId === 'number'
    );
  } catch {
    return [];
  }
}
