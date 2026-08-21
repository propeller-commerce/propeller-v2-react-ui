/**
 * `pickPreselected` — what a checkout grid starts on.
 *
 * The reported bug: a fresh cart stores no payment method / carrier, so the
 * grid rendered with nothing selected and Continue rejected the step until the
 * user clicked. The restore-the-stored-value path was never broken; the
 * fall-back-to-first path did not exist.
 */

import { describe, it, expect } from 'vitest';
import { pickPreselected } from '../preselect';

const METHODS = [{ code: 'ideal' }, { code: 'on_account' }, { code: 'paypal' }];
const codeOf = (m: { code: string }) => m.code;

describe('pickPreselected', () => {
  it('restores what the cart stores', () => {
    expect(pickPreselected(METHODS, 'paypal', codeOf)).toEqual({ code: 'paypal' });
  });

  it('falls back to the first option on a fresh cart', () => {
    // The regression: an empty/absent stored value left nothing selected.
    expect(pickPreselected(METHODS, undefined, codeOf)).toEqual({ code: 'ideal' });
    expect(pickPreselected(METHODS, '', codeOf)).toEqual({ code: 'ideal' });
    expect(pickPreselected(METHODS, null, codeOf)).toEqual({ code: 'ideal' });
  });

  it('falls back when the stored value is no longer offered', () => {
    // e.g. "on account" is filtered out for guests, or the backend dropped it.
    expect(pickPreselected(METHODS, 'bitcoin', codeOf)).toEqual({ code: 'ideal' });
  });

  it('selects nothing when there is nothing to select', () => {
    // The cart arrives after mount, and some carts offer no carriers at all —
    // the caller must be able to tell "not yet" from "first one".
    expect(pickPreselected([], 'ideal', codeOf)).toBeUndefined();
    expect(pickPreselected(undefined, 'ideal', codeOf)).toBeUndefined();
  });
});
