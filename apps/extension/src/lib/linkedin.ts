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
  const name = document.querySelector('h1')?.textContent?.trim() ?? ''

  const headline =
    document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ??
    document.querySelector('[data-generated-suggestion-target]')?.textContent?.trim() ??
    ''

  // Company: first experience section item — wrapped in try/catch, falls back to '' on any failure.
  // LinkedIn DOM is fragile and changes without notice — empty string is correct per AC10.
  let company = ''
  try {
    const expSection = document.querySelector(
      '#experience ~ .pvs-list, #experience + * .pvs-list__item--line-separated',
    )
    if (!expSection) {
      const expHeading = Array.from(document.querySelectorAll('section')).find((s) =>
        s.querySelector('div[id="experience"]'),
      )
      const firstItem = expHeading?.querySelector('.pvs-list__paged-list-item:first-child')
      const companyEl =
        firstItem?.querySelector('.t-14.t-normal .visually-hidden') ??
        firstItem?.querySelector('.t-14.t-normal span[aria-hidden="true"]')
      company = companyEl?.textContent?.trim() ?? ''
    } else {
      const companyEl = expSection.querySelector(
        '.pvs-list__item--line-separated:first-child span[aria-hidden="true"]:nth-child(2)',
      )
      company = companyEl?.textContent?.trim() ?? ''
    }
  } catch {
    company = ''
  }

  return {
    name,
    headline,
    company,
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
