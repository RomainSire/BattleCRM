// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isProfilePage, normalizeLinkedInUrl, scrapeLinkedInProfile } from './linkedin'

// ---------------------------------------------------------------------------
// Helpers to build minimal LinkedIn-like DOM structures for scraper tests.
// ---------------------------------------------------------------------------

function buildTopcard(opts: {
  name?: string
  degree?: string
  headline?: string
  company?: string
  hasCompanyLink?: boolean
}) {
  const { name = '', degree = '', headline = '', company = '', hasCompanyLink = false } = opts
  return `
    <section componentkey="com.linkedin.sdui.profile.card.refABCTopcard">
      <h2>${name}</h2>
      ${degree ? `<p>${degree}</p>` : ''}
      ${headline ? `<p>${headline}</p>` : ''}
      ${
        company
          ? hasCompanyLink
            ? `<a href="/company/123/"><p>${company}</p></a>`
            : `<p>${company}</p>`
          : ''
      }
      <p>Toulouse, Occitanie, France</p>
      <!-- Company block (role=button) — should be excluded from headline/company parsing -->
      <div role="button"><p>Inside Button Corp</p></div>
    </section>
  `
}

function buildExpSection(opts: { company?: string; hasCurrent?: boolean }) {
  const { company = '', hasCurrent = true } = opts
  return `
    <section componentkey="com.linkedin.sdui.profile.card.refABCExperienceTopLevelSection">
      <h2>Expérience</h2>
      <div componentkey="entity-collection-item-abc">
        <a href="/company/123/">
          <figure><!-- logo --></figure>
        </a>
        <a href="/company/123/">
          <p>${company}</p>
          <p>3 ans 2 mois</p>
        </a>
        ${hasCurrent ? "<p>févr. 2022 - aujourd'hui · 3 ans</p>" : '<p>janv. 2020 - déc. 2021</p>'}
      </div>
    </section>
  `
}

// ---------------------------------------------------------------------------

describe('scrapeLinkedInProfile', () => {
  const CANONICAL_URL = 'https://www.linkedin.com/in/jean-dupont'

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('extracts name from topcard h2', () => {
    document.body.innerHTML = buildTopcard({ name: 'Jean Dupont', headline: 'Ingénieur' })
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.name).toBe('Jean Dupont')
  })

  it('extracts headline — skips connection-degree paragraph starting with ·', () => {
    document.body.innerHTML = buildTopcard({
      name: 'Jean Dupont',
      degree: '· 1er',
      headline: 'Ingénieur logiciel',
      company: 'Acme Corp',
    })
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.headline).toBe('Ingénieur logiciel')
  })

  it('ignores paragraphs inside role=button for headline', () => {
    document.body.innerHTML = buildTopcard({
      name: 'Jean Dupont',
      headline: 'Chef de projet',
    })
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    // "Inside Button Corp" inside [role=button] must not be picked as headline
    expect(result.headline).toBe('Chef de projet')
    expect(result.company).not.toBe('Inside Button Corp')
  })

  it('extracts company from experience section (company link with <p>)', () => {
    document.body.innerHTML =
      buildTopcard({ name: 'Jean Dupont', headline: 'Ingénieur' }) +
      buildExpSection({ company: 'Acme Corp' })
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.company).toBe('Acme Corp')
  })

  it('falls back to topcard company link when experience section is absent', () => {
    document.body.innerHTML = buildTopcard({
      name: 'Marie Martin',
      headline: 'Directrice',
      company: 'Globex',
      hasCompanyLink: true,
    })
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.company).toBe('Globex')
  })

  it('falls back to second clean p in topcard when no company link exists', () => {
    document.body.innerHTML = buildTopcard({
      name: 'Paul Blanc',
      degree: '· 2e',
      headline: 'Consultant',
      company: 'Freelance',
    })
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.company).toBe('Freelance')
  })

  it('returns empty strings gracefully when topcard is absent', () => {
    document.body.innerHTML = '<main><p>Aucun profil</p></main>'
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.name).toBe('')
    expect(result.headline).toBe('')
    expect(result.company).toBe('')
    expect(result.canonicalUrl).toBe(CANONICAL_URL)
  })

  it('falls back to aria-label on invite button for name when h2 is missing', () => {
    document.body.innerHTML = `
      <section componentkey="com.linkedin.sdui.profile.card.refABCTopcard">
        <p>Ingénieur</p>
      </section>
      <a aria-label="Inviter Sophie Leclerc à rejoindre votre réseau">Se connecter</a>
    `
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.name).toBe('Sophie Leclerc')
  })

  it('falls back to legacy h1 for name when everything else fails', () => {
    document.body.innerHTML = '<h1>Pierre Durand</h1>'
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.name).toBe('Pierre Durand')
  })

  it('always sets canonicalUrl to the argument passed', () => {
    document.body.innerHTML = ''
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.canonicalUrl).toBe(CANONICAL_URL)
  })

  it('does not pick location paragraph as company', () => {
    // No company in topcard, second p after headline is location
    document.body.innerHTML = `
      <section componentkey="com.linkedin.sdui.profile.card.refABCTopcard">
        <h2>Anne Robert</h2>
        <p>Chargée RH</p>
        <p>Coordonnées</p>
      </section>
    `
    const result = scrapeLinkedInProfile(CANONICAL_URL)
    expect(result.headline).toBe('Chargée RH')
    expect(result.company).toBe('')
  })
})

describe('normalizeLinkedInUrl', () => {
  it('removes query parameters', () => {
    expect(
      normalizeLinkedInUrl('https://www.linkedin.com/in/john?trk=nav_responsive_tab_profile'),
    ).toBe('https://www.linkedin.com/in/john')
  })

  it('removes hash fragment', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/john#experience')).toBe(
      'https://www.linkedin.com/in/john',
    )
  })

  it('removes trailing slash', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/john/')).toBe(
      'https://www.linkedin.com/in/john',
    )
  })

  it('removes query, hash, and trailing slash together', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/john/?trk=nav#about')).toBe(
      'https://www.linkedin.com/in/john',
    )
  })

  it('returns a clean URL unchanged', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/john-doe')).toBe(
      'https://www.linkedin.com/in/john-doe',
    )
  })

  it('is idempotent — normalizing twice gives the same result', () => {
    const url = 'https://www.linkedin.com/in/john/?trk=nav'
    expect(normalizeLinkedInUrl(normalizeLinkedInUrl(url))).toBe(normalizeLinkedInUrl(url))
  })

  it('falls back gracefully on an invalid URL string', () => {
    expect(normalizeLinkedInUrl('not-a-url?foo=bar#baz')).toBe('not-a-url')
  })

  it('handles a URL with only a hash', () => {
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/john#')).toBe(
      'https://www.linkedin.com/in/john',
    )
  })
})

describe('isProfilePage', () => {
  it('returns true for a standard profile URL', () => {
    expect(isProfilePage('https://www.linkedin.com/in/john-doe')).toBe(true)
  })

  it('returns true for a profile URL with a trailing slash', () => {
    expect(isProfilePage('https://www.linkedin.com/in/john-doe/')).toBe(true)
  })

  it('returns true for a profile sub-page (/details/skills)', () => {
    expect(isProfilePage('https://www.linkedin.com/in/john-doe/details/skills/')).toBe(true)
  })

  it('returns true for a profile URL with query params', () => {
    expect(isProfilePage('https://www.linkedin.com/in/john-doe?trk=nav')).toBe(true)
  })

  it('returns false for the LinkedIn feed', () => {
    expect(isProfilePage('https://www.linkedin.com/feed/')).toBe(false)
  })

  it('returns false for a company page', () => {
    expect(isProfilePage('https://www.linkedin.com/company/acme-corp')).toBe(false)
  })

  it('returns false for search results', () => {
    expect(isProfilePage('https://www.linkedin.com/search/results/people/')).toBe(false)
  })

  it('returns false for messaging', () => {
    expect(isProfilePage('https://www.linkedin.com/messaging/thread/123/')).toBe(false)
  })

  it('returns false for /in/ with no username', () => {
    // pathname is /in/ — regex requires at least one non-slash char after /in/
    expect(isProfilePage('https://www.linkedin.com/in/')).toBe(false)
  })

  it('returns false for the LinkedIn home page', () => {
    expect(isProfilePage('https://www.linkedin.com/')).toBe(false)
  })

  it('returns false for an invalid URL string', () => {
    expect(isProfilePage('not-a-url')).toBe(false)
  })
})
