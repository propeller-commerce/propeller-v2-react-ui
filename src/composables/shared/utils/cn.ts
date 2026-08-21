/**
 * Merge class lists so the LAST conflicting utility wins.
 *
 * Every component here builds its class attribute by appending the host's
 * override to its own defaults. Attribute order does not decide CSS — the
 * cascade does — so `class="text-white text-cocoa"` rendered white, and
 * `iconClassName="text-cocoa"` looked like it did nothing. It appeared to work
 * on components whose baked-in default happened to lose the cascade anyway,
 * which is worse than a consistent failure.
 *
 * `twMerge` resolves the conflict properly: same utility group → later value
 * replaces the earlier one. Unknown classes (our BEM hooks, `propeller-*`) are
 * passed through untouched.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
