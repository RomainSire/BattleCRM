/**
 * The oldest Firefox extension the API still serves (spec stack §9, ST-92): the first version of the app
 * that ships it. Raised only when a “contract” step breaks the extension; the N-1 rule stays the only window.
 */
export const MIN_EXTENSION_VERSION = '0.7.0';

/** The prefix of `X-Client` the Firefox extension sends, followed by its version. */
const EXTENSION = /^extension\/(.*)$/;

/** The client a request names in `X-Client`: the Firefox extension, or null for the SPA, which sends none. */
export function clientOf(header: string | null | undefined): 'extension' | null {
  return EXTENSION.test(header ?? '') ? 'extension' : null;
}
const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Whether `X-Client` names an extension older than `minimum`, which answers 426. One whose version
 * cannot be read is outdated too; without `X-Client` (the SPA), or for another client, nothing is checked.
 */
export function isOutdatedClient(client: string | undefined, minimum: string): boolean {
  const version = EXTENSION.exec(client ?? '')?.[1];
  if (version === undefined) return false;
  const sent = numbersOf(version);
  const oldest = numbersOf(minimum);
  if (!sent || !oldest) return true;
  const differing = sent.findIndex((number, index) => number !== oldest[index]);
  return differing !== -1 && sent[differing]! < oldest[differing]!;
}

function numbersOf(version: string): number[] | undefined {
  return VERSION.exec(version)?.slice(1).map(Number);
}
