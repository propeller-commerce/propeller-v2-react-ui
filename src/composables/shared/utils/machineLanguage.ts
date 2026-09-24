/**
 * Resolving a machine slug when the tree is only half-translated.
 *
 * `machine(slug:, language:)` resolves a slug ONLY in the language that slug
 * was authored in. `language` is also mandatory (omitting it is a validation
 * error, not a wildcard) and case-sensitive — `'nl'` misses where `'NL'` hits.
 *
 * That matters because the listing no longer narrows to one language: an
 * installation authored only in NL now appears in an EN tree and is linked by
 * its NL slug (PWP-993). Following that link then asked for
 * `machine(slug: "<NL slug>", language: "EN")`, which the API answers with
 * `SPARE_PARTS_MACHINE_NOT_FOUND_ERROR` — so the row came back but the page
 * behind it was empty, with a title derived from the slug and no error. The bug
 * moved one click deeper instead of going away.
 *
 * The URL carries no language, so the only thing a cold deep link can do is try
 * the languages the shop actually uses. `machine(id:)` is language-agnostic,
 * but an id is not what a shareable URL contains.
 */

/** The API's code for "this slug does not exist in this language". */
const MACHINE_NOT_FOUND = 'SPARE_PARTS_MACHINE_NOT_FOUND_ERROR';

/** Is this the API saying the slug/language pair does not exist? */
export function isMachineNotFound(error: unknown): boolean {
  const entries = (error as { errors?: Array<{ extensions?: { code?: string }; message?: string }> })
    ?.errors;
  if (!Array.isArray(entries)) return false;
  return entries.some(
    (e) =>
      e?.extensions?.code === MACHINE_NOT_FOUND ||
      /no machine found for slug and language/i.test(e?.message ?? '')
  );
}

/**
 * The languages to try, in order: the tree language first (the common case and
 * the only one that costs a request in a fully-translated shop), then the
 * storefront language, then any others the host declares.
 *
 * Upper-cased and de-duplicated — the API matches the case exactly.
 */
export function machineLanguageCandidates(
  machineLanguage: string | undefined,
  language: string | undefined,
  extra: string[] | undefined
): string[] {
  const ordered = [machineLanguage, language, ...(extra ?? [])];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ordered) {
    const value = raw?.trim().toUpperCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * Call `fetchOne` with each candidate language until one resolves.
 *
 * Returns `null` when every candidate reported "not found" — that is a real
 * answer (the slug exists in no language we know of), and the caller should say
 * so rather than render an empty listing. Any OTHER failure is rethrown
 * immediately: a network blip or an auth error must not be retried three times
 * and then reported as a missing machine.
 */
export async function resolveMachineAcrossLanguages<T>(
  candidates: string[],
  fetchOne: (language: string) => Promise<T>
): Promise<{ machine: T; language: string } | null> {
  for (const language of candidates) {
    try {
      return { machine: await fetchOne(language), language };
    } catch (error) {
      if (!isMachineNotFound(error)) throw error;
    }
  }
  return null;
}
