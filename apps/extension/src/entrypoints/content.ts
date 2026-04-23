import { isProfilePage, normalizeLinkedInUrl, scrapeLinkedInProfile } from '../lib/linkedin'

// Navigation API is stable in Chrome 102+/Firefox 126+ but not yet in TypeScript's default lib.
interface NavigateEvent extends Event {
  destination: { url: string }
}

export default defineContentScript({
  // Broader pattern (not just /in/*) so the MutationObserver fallback can catch SPA navigations
  // that start on non-profile LinkedIn pages. URL filtering is done in isProfilePage().
  matches: ['*://www.linkedin.com/*'],
  main() {
    let lastCheckedUrl = ''

    function handleUrlChange(rawUrl: string) {
      const normalizedUrl = normalizeLinkedInUrl(rawUrl)

      if (!isProfilePage(rawUrl)) {
        if (lastCheckedUrl) {
          browser.runtime
            .sendMessage({ type: 'CLEAR_BADGE', previousUrl: lastCheckedUrl })
            .catch(() => {})
          lastCheckedUrl = ''
        }
        return
      }

      // Deduplicate — Navigation API can fire multiple times for the same URL
      if (normalizedUrl === lastCheckedUrl) return

      // Clear badge immediately so the user never sees a stale result while the check is in progress
      browser.runtime
        .sendMessage({ type: 'CLEAR_BADGE', previousUrl: lastCheckedUrl || undefined })
        .catch(() => {})
      lastCheckedUrl = normalizedUrl

      // Delay scraping to allow LinkedIn's React renderer time to mount the profile DOM.
      // 800ms covers 99% of connections — too short risks stale data from the previous profile.
      setTimeout(() => {
        const scrapedData = scrapeLinkedInProfile(normalizedUrl)
        browser.runtime
          .sendMessage({ type: 'CHECK_PROSPECT', linkedinUrl: normalizedUrl, scrapedData })
          .catch(() => {})
      }, 800)
    }

    // Primary: Navigation API (stable Chrome 102+/Firefox 126+)
    if ('navigation' in window) {
      ;(window as Window & { navigation: EventTarget }).navigation.addEventListener(
        'navigate',
        (event) => {
          handleUrlChange((event as NavigateEvent).destination.url)
        },
      )
    }

    // Fallback: MutationObserver — catches edge cases the Navigation API misses
    let observerUrl = location.href
    const observer = new MutationObserver(() => {
      if (location.href !== observerUrl) {
        observerUrl = location.href
        handleUrlChange(location.href)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true })

    // Re-check triggered by background after auth state change (e.g. login)
    browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'DO_CHECK') {
        lastCheckedUrl = ''
        handleUrlChange(location.href)
      }
    })

    // Initial load — handle direct navigation to a profile page
    handleUrlChange(location.href)
  },
})
