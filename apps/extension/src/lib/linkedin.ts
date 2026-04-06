export interface LinkedInScrapedData {
  /** Full name from profile h1 — split on last space for firstName/lastName in Stories 7.5/7.6 */
  name: string
  /** Headline / poste under the name */
  headline: string
  /** Current company from experience section — empty string if extraction fails (NEVER populate with wrong value) */
  company: string
  /** Normalized canonical LinkedIn URL — no tracking params, no trailing slash */
  canonicalUrl: string
}

/**
 * Scrape visible LinkedIn profile data from the current DOM.
 * Only called from the content script — never from service worker.
 * Returns empty strings for any field that cannot be safely extracted.
 */
export function scrapeLinkedInProfile(): LinkedInScrapedData {
  // TODO: implement in Story 7.5
  return {
    name: '',
    headline: '',
    company: '',
    canonicalUrl: normalizeLinkedInUrl(location.href),
  }
}

/**
 * Normalize a LinkedIn profile URL — strips query params, hash, and trailing slash.
 * Used in both content.ts (before sending CHECK_PROSPECT) and background.ts (before API call).
 * Must stay in sync with the backend normalizeLinkedinUrl in extension_prospects_controller.ts.
 */
export function normalizeLinkedInUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return url
      .replace(/[?#].*$/, '')
      .trim()
      .replace(/\/$/, '')
  }
}
