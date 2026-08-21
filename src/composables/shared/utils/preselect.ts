/**
 * Pick what a selectable list should start on.
 *
 * Checkout must never render a payment method / carrier grid with nothing
 * selected: the user should be able to hit Continue straight away. Prefer what
 * the cart already stores; when it stores nothing — a fresh cart — or stores a
 * value the backend no longer offers, fall back to the first option.
 *
 * Kept separate from the components because both packages test pure logic in
 * `node` and cannot mount an SFC / run an effect.
 */
export function pickPreselected<T>(
  items: T[] | null | undefined,
  stored: string | null | undefined,
  keyOf: (item: T) => string,
): T | undefined {
  const list = items || [];
  return (stored ? list.find((item) => keyOf(item) === stored) : undefined) || list[0];
}
