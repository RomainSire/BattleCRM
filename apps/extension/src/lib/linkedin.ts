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
 *
 * LinkedIn obfuscates all CSS class names (e.g. `_9e348bbd`) — never rely on them.
 * Instead we use `componentkey` attributes (semantic, tied to LinkedIn's component
 * architecture) and structural heuristics as fallbacks.
 */
export function scrapeLinkedInProfile(
  canonicalUrl = normalizeLinkedInUrl(location.href),
): LinkedInScrapedData {
  const topcardSection = document.querySelector('section[componentkey*="Topcard"]')
  const expSection = document.querySelector('section[componentkey*="ExperienceTopLevelSection"]')

  // --- NAME ---
  // Primary: first h2 in the Topcard section.
  // Fallback 1: aria-label on "Inviter/Invite" connect buttons.
  // Fallback 2: legacy h1 (old LinkedIn UI, kept for resilience).
  let name = topcardSection?.querySelector('h2')?.textContent?.trim() ?? ''

  if (!name) {
    const inviteEl =
      document.querySelector('[aria-label*="rejoindre votre réseau"]') ??
      document.querySelector('[aria-label*="join your network"]')
    const label = inviteEl?.getAttribute('aria-label') ?? ''
    const m = label.match(/Inviter (.+?) à rejoindre/) ?? label.match(/Invite (.+?) to connect/)
    if (m) name = m[1].trim()
  }

  if (!name) name = document.querySelector('h1')?.textContent?.trim() ?? ''

  // --- HEADLINE ---
  // In the topcard text-info area, <p> elements appear in order:
  //   connection-degree (starts with "·")  →  headline  →  company  →  location
  // We exclude <p> elements inside [role="button"] or <button> (the company-logo block
  // and action CTAs), then take the first remaining paragraph that is not a degree marker.
  let headline = ''

  if (topcardSection) {
    const paras = Array.from(topcardSection.querySelectorAll<HTMLParagraphElement>('p')).filter(
      (p) => !p.closest('[role="button"]') && !p.closest('button'),
    )

    headline =
      paras
        .find((p) => {
          const t = p.textContent?.trim() ?? ''
          return (
            t.length > 2 &&
            !t.startsWith('·') &&
            !t.startsWith('•') &&
            !/^\d/.test(t) &&
            !/abonné|follower|Coordonnées|Contact info/i.test(t)
          )
        })
        ?.textContent?.trim() ?? ''
  }

  // Legacy fallback (old LinkedIn DOM with semantic class names)
  if (!headline) {
    headline = document.querySelector('.text-body-medium.break-words')?.textContent?.trim() ?? ''
  }

  // --- COMPANY ---
  // Strategy 1: Experience section — first entity-collection-item = most recent employer.
  //   Within that item, find links to /company/ or /school/ pages; the one that has a <p>
  //   child (not just a logo <figure>) contains the company name.
  // Strategy 2: Topcard company-block — link to /company/ or /school/ in the topcard.
  // Strategy 3: Second clean <p> in topcard text-info area (right after the headline).
  let company = ''

  try {
    if (expSection) {
      const firstItem = expSection.querySelector('[componentkey*="entity-collection-item"]')
      if (firstItem) {
        const companyLinks = Array.from(
          firstItem.querySelectorAll<HTMLAnchorElement>(
            'a[href*="/company/"], a[href*="/school/"]',
          ),
        )
        for (const link of companyLinks) {
          const text = link.querySelector('p')?.textContent?.trim() ?? ''
          if (text.length > 0 && !/^\d/.test(text)) {
            company = text
            break
          }
        }
      }
    }

    if (!company && topcardSection) {
      company =
        topcardSection
          .querySelector<HTMLElement>('a[href*="/company/"] p, a[href*="/school/"] p')
          ?.textContent?.trim() ?? ''
    }

    if (!company && topcardSection && headline) {
      const paras = Array.from(topcardSection.querySelectorAll<HTMLParagraphElement>('p')).filter(
        (p) => !p.closest('[role="button"]') && !p.closest('button'),
      )

      const hi = paras.findIndex((p) => p.textContent?.trim() === headline)
      if (hi >= 0 && hi + 1 < paras.length) {
        const candidate = paras[hi + 1].textContent?.trim() ?? ''
        if (
          candidate.length > 1 &&
          !candidate.startsWith('·') &&
          !candidate.startsWith('•') &&
          !/Coordonnées|Contact info/i.test(candidate)
        ) {
          company = candidate
        }
      }
    }
  } catch {
    company = ''
  }

  return { name, headline, company, canonicalUrl }
}

/**
 * Returns true if the given URL points to a LinkedIn member profile page (/in/<username>).
 * Used in both content.ts (navigation filtering) and tests.
 */
export function isProfilePage(url: string): boolean {
  try {
    const path = new URL(url).pathname
    return /^\/in\/[^/]/.test(path)
  } catch {
    return false
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
