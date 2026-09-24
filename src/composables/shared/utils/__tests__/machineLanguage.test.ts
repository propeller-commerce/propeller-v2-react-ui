/**
 * Slug resolution across a half-translated machine tree (PWP-993).
 *
 * The listing stopped narrowing to one language, so an NL-only installation now
 * appears in an EN tree and is linked by its NL slug. Opening it asked for
 * `machine(slug: "<NL slug>", language: "EN")`, which the API rejects — the row
 * came back but the page behind it was empty. These cover the fallback that
 * makes the link work, and the two ways it must NOT paper over a real failure.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  isMachineNotFound,
  machineLanguageCandidates,
  resolveMachineAcrossLanguages,
} from '../machineLanguage';

/** What `GraphQLOperationError` looks like for an unknown slug/language pair. */
const notFound = () =>
  Object.assign(new Error('GraphQL operation failed (machine)'), {
    errors: [
      {
        message: 'No machine found for slug and language',
        extensions: { code: 'SPARE_PARTS_MACHINE_NOT_FOUND_ERROR' },
      },
    ],
  });

describe('machineLanguageCandidates', () => {
  it('tries the tree language first, then the storefront language', () => {
    expect(machineLanguageCandidates('EN', 'NL', undefined)).toEqual(['EN', 'NL']);
  });

  it('upper-cases, because the API matches the case exactly', () => {
    expect(machineLanguageCandidates('en', 'nl', ['fr'])).toEqual(['EN', 'NL', 'FR']);
  });

  it('de-duplicates so a monolingual shop still costs one request', () => {
    expect(machineLanguageCandidates('EN', 'EN', ['EN', 'en'])).toEqual(['EN']);
  });

  it('drops empty and whitespace-only entries', () => {
    expect(machineLanguageCandidates(undefined, 'NL', ['', '  ', 'DE'])).toEqual(['NL', 'DE']);
  });
});

describe('isMachineNotFound', () => {
  it('recognises the API error code', () => {
    expect(isMachineNotFound(notFound())).toBe(true);
  });

  it('recognises the message when the code is missing', () => {
    const err = Object.assign(new Error('x'), {
      errors: [{ message: 'No machine found for slug and language' }],
    });
    expect(isMachineNotFound(err)).toBe(true);
  });

  it('does not treat an arbitrary error as a missing machine', () => {
    expect(isMachineNotFound(new Error('network down'))).toBe(false);
    expect(
      isMachineNotFound(
        Object.assign(new Error('x'), { errors: [{ message: 'Unauthorized' }] })
      )
    ).toBe(false);
  });
});

describe('resolveMachineAcrossLanguages', () => {
  it('returns the first language that resolves, and stops there', async () => {
    const fetchOne = vi.fn(async (language: string) => {
      if (language !== 'NL') throw notFound();
      return { id: '1' };
    });
    const result = await resolveMachineAcrossLanguages(['EN', 'NL', 'FR'], fetchOne);
    expect(result).toEqual({ machine: { id: '1' }, language: 'NL' });
    expect(fetchOne).toHaveBeenCalledTimes(2);
  });

  it('costs exactly one request when the tree language is right', async () => {
    const fetchOne = vi.fn(async () => ({ id: '1' }));
    await resolveMachineAcrossLanguages(['EN', 'NL', 'FR'], fetchOne);
    expect(fetchOne).toHaveBeenCalledTimes(1);
  });

  it('returns null when the slug exists in no candidate language', async () => {
    const fetchOne = vi.fn(async () => {
      throw notFound();
    });
    expect(await resolveMachineAcrossLanguages(['EN', 'NL'], fetchOne)).toBeNull();
    expect(fetchOne).toHaveBeenCalledTimes(2);
  });

  // The API does not always THROW its "not found". For a wrong-language slug it
  // answers with a partial response — `machine: null` plus the error — and the
  // SDK's `runOperation` returns that rather than throwing unless the client
  // opts into `throwOnPartialErrors`. No boilerplate does, so in production
  // "not found" arrives here as a null return, not as a rejection.
  it('treats a null machine as not-found and tries the next language', async () => {
    const fetchOne = vi.fn(async (language: string) => (language === 'NL' ? { id: '1' } : null));
    const result = await resolveMachineAcrossLanguages(['EN', 'NL'], fetchOne);
    expect(result).toEqual({ machine: { id: '1' }, language: 'NL' });
    expect(fetchOne).toHaveBeenCalledTimes(2);
  });

  it('returns null when every language answers with a null machine', async () => {
    const fetchOne = vi.fn(async () => null);
    expect(await resolveMachineAcrossLanguages(['EN', 'NL'], fetchOne)).toBeNull();
    expect(fetchOne).toHaveBeenCalledTimes(2);
  });

  it('rethrows anything that is not a missing machine, without retrying', async () => {
    const boom = new Error('network down');
    const fetchOne = vi.fn(async () => {
      throw boom;
    });
    await expect(resolveMachineAcrossLanguages(['EN', 'NL'], fetchOne)).rejects.toBe(boom);
    expect(fetchOne).toHaveBeenCalledTimes(1);
  });
});
