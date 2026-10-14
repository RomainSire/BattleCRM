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
 * always `https://linkedin.com/…`, as LinkedIn reads a profile whatever its case. `null` when the
 * text is no LinkedIn address.
 */
export function normalizeLinkedInUrl(address: string): string | null {
  // Copied from the address bar or typed by hand: without a scheme, it is the web.
  const match = WEB_ADDRESS.exec(address.trim());
  if (!match) return null;
  const [, host = '', path = ''] = match;
  if (!LINKEDIN_HOST.test(host.toLowerCase())) return null;
  return `https://linkedin.com${path.toLowerCase().replace(/\/+$/u, '')}`;
}

/** An e-mail address, case and spaces aside. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/** A phone number, its digits and the `+` that opens an international one; spaces, dots and dashes aside. */
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/gu, '');
  return phone.trim().startsWith('+') ? `+${digits}` : digits;
};
