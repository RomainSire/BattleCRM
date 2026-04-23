import { describe, expect, it } from 'vitest'
import { isProfilePage, normalizeLinkedInUrl } from './linkedin'

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
