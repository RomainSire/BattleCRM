const sources = import.meta.glob<string>('./*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The anonymized copies of LinkedIn profiles (spec extension §10). */
export const PROFILES = [
  'profile-contract-type.html',
  'profile-accented-slug.html',
  'profile-accented-slug-contact-info.html',
  'profile-no-experience.html',
  'profile-out-of-network.html',
] as const;

/** A fresh `Document` of an anonymized page: each test may change it at will. */
export function pageOf(fixture: string): Document {
  const source = sources[`./${fixture}`];
  if (source === undefined) throw new Error(`No anonymized page ${fixture}`);
  return new DOMParser().parseFromString(source, 'text/html');
}
