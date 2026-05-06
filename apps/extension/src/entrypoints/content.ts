import { isProfilePage, normalizeLinkedInUrl, scrapeLinkedInProfile } from '../lib/linkedin'

// Navigation API is stable in Chrome 102+/Firefox 126+ but not yet in TypeScript's default lib.
interface NavigateEvent extends Event {
  destination: { url: string }
}

export default defineContentScript({
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

      if (normalizedUrl === lastCheckedUrl) return

      browser.runtime
        .sendMessage({ type: 'CLEAR_BADGE', previousUrl: lastCheckedUrl || undefined })
        .catch(() => {})
      lastCheckedUrl = normalizedUrl

      // Small delay so the API check doesn't fire during transient SPA navigations.
      // No DOM scraping here — scraping is done on-demand when the popup opens,
      // at which point the profile page is guaranteed to be fully loaded.
      setTimeout(() => {
        browser.runtime
          .sendMessage({ type: 'CHECK_PROSPECT', linkedinUrl: normalizedUrl })
          .catch(() => {})
      }, 300)
    }

    // On-demand scraping: called by the popup via browser.tabs.sendMessage.
    // At popup-open time the profile DOM is always fully mounted — no timing issues.
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'SCRAPE_PROFILE') {
        sendResponse(scrapeLinkedInProfile(normalizeLinkedInUrl(location.href)))
        return true
      }
      if (message.type === 'DO_CHECK') {
        lastCheckedUrl = ''
        handleUrlChange(location.href)
      }
    })

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

    handleUrlChange(location.href)
  },
})
