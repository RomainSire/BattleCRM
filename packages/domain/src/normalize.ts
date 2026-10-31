// What makes two values the same for the User (ST-30, ST-64): shared by the unique indexes of the API
// and the duplicate checks of the SPA, so that both always agree.

/** A name, case, accents and spaces aside: “Cap Gémini” is “capgemini”. */
export const normalizeName = (name: string): string =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s/gu, '');

/** A web address: its scheme if any, its host (with a port, if any), then its path, parameters and fragment. */
const WEB_ADDRESS =
  /^(?:https?:\/\/)?([a-z\d-]+(?:\.[a-z\d-]+)+)(?::\d+)?(\/[^?#\s]*)?(?:[?#]\S*)?$/iu;

/** LinkedIn, on its own site or on that of a country (`fr.linkedin.com`), `www` included. */
const LINKEDIN_HOST = /^(?:[a-z\d-]+\.)?linkedin\.com$/u;

/**
 * A LinkedIn address, its scheme, subdomain, case, final slashes, parameters and fragment aside:
 * always `https://linkedin.com/…`, as LinkedIn reads a profile whatever its case. Its `%xx` decoded and
 * its accents in one form (NFC), a profile cut to `/in/<slug>` (ST-93). `null` when the text is no
 * LinkedIn address.
 */
export function normalizeLinkedInUrl(address: string): string | null {
  // Copied from the address bar or typed by hand: without a scheme, it is the web.
  const match = WEB_ADDRESS.exec(address.trim());
  if (!match) return null;
  const [, host = '', path = ''] = match;
  if (!LINKEDIN_HOST.test(host.toLowerCase())) return null;
  const page = decodePath(path).toLowerCase().normalize('NFC');
  // A profile's sub-pages (`/fr`, `/overlay/contact-info`, `/details/…`) are the profile itself.
  const profile = PROFILE_PATH.exec(page)?.[0];
  return `https://linkedin.com${profile ?? page.replace(/\/+$/u, '')}`;
}

/** A profile: `/in/` and its slug. */
const PROFILE_PATH = /^\/in\/[^/]+/u;

/** A path with the `%xx` of each segment decoded, as the browser shows it. */
const decodePath = (path: string): string => path.split('/').map(decodeSegment).join('/');

/**
 * A segment of a path, decoded. As written when one of its `%xx` encodes nothing, or encodes what a
 * segment cannot hold as such (`/`, `?`, `#`, `%`, a space, a control character): read again, the
 * decoded segment would be another address. The migration `0047_linkedin_url_renormalized` does the same.
 */
function decodeSegment(segment: string): string {
  try {
    const decoded = decodeURIComponent(segment);
    return /[/?#%\s\p{Cc}]/u.test(decoded) ? segment : decoded;
  } catch {
    return segment;
  }
}

/** An e-mail address, case and spaces aside. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** A phone number, its digits and the `+` that opens an international one; spaces, dots and dashes aside. */
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/gu, '');
  return phone.trim().startsWith('+') ? `+${digits}` : digits;
};
