import {
  isPeopleSearchPage,
  isProfilePage,
  normalizeLinkedInUrl,
  scrapeLinkedInProfile,
  scrapeSearchResults,
} from '../lib/linkedin'
import enLocale from '../locales/en.json'
import frLocale from '../locales/fr.json'
import jaLocale from '../locales/ja.json'

// Navigation API is stable in Chrome 102+/Firefox 126+ but not yet in TypeScript's default lib.
interface NavigateEvent extends Event {
  destination: { url: string }
}

export default defineContentScript({
  matches: ['*://www.linkedin.com/*'],
  main() {
    let lastCheckedUrl = ''

    // -----------------------------------------------------------------------
    // People-search list: inject a CRM presence badge next to each name.
    // Read-only indicator (green = in CRM, red = not yet). Refreshes on new
    // search / filter / page change. Independent from the toolbar-badge logic.
    // -----------------------------------------------------------------------
    const pageLang = (document.documentElement.lang || 'fr').toLowerCase()
    const badgeLabels = pageLang.startsWith('ja')
      ? jaLocale.searchBadge
      : pageLang.startsWith('en')
        ? enLocale.searchBadge
        : frLocale.searchBadge

    // Inlined BattleCRM logo (mirrors public/BattleCRM_logo.svg). Inlined rather than
    // referenced so it works in a content script without web_accessible_resources, and
    // CSP-safe (no eval, no external fetch). The gradient id is identical across instances
    // — that's fine, every instance defines the same gradient so url(#…) resolves identically.
    const BCRM_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block">
  <defs>
    <linearGradient id="bcrmLogoGrad" x1="2.2093" y1="21.5029" x2="21.7139" y2="2.5358" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ff1b6b"/>
      <stop offset="1" stop-color="#ff930f"/>
    </linearGradient>
  </defs>
  <g transform="matrix(1.1414556,0,0,1.1414556,-1.697467,-1.6974671)">
    <path style="fill:url(#bcrmLogoGrad);stroke:none" d="m 7.0086575,2.5357693 c 3.4043515,-0.4095461 6.7063165,-0.4095461 9.9058945,0 2.637333,0.3375786 4.496242,2.1578532 4.799367,4.799367 0.358353,3.1227887 0.358353,6.2455767 0,9.3683657 -0.303125,2.641514 -2.155018,4.522059 -4.799367,4.799367 -3.557931,0.373114 -6.859896,0.342618 -9.9058945,0 -2.6421873,-0.297196 -4.5821569,-2.149404 -4.799367,-4.799367 -0.2559663,-3.122789 -0.2559663,-6.245577 0,-9.3683658 0.21721,-2.6499621 2.1595511,-4.4817951 4.799367,-4.7993669 z"/>
    <g transform="translate(-0.00424034,-0.41817542)" fill="none" stroke="#ffffff" stroke-width="1.48321">
      <path d="m 18.67556,8.2908867 -2.628997,2.6289973 m -5.257995,5.257995 -2.6289974,2.628998 c -0.820606,0.811535 -2.1424927,0.808215 -2.9590126,-0.0074 -0.8185133,-0.819423 -0.8185133,-2.147006 0,-2.966429 l 2.6271433,-2.62717 M 13.081988,7.9515978 15.709131,5.324458"/>
      <path d="m 14.967525,4.5828508 4.449643,4.4496431"/>
      <path d="M 10.435496,16.530951 H 4.8853411"/>
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" transform="matrix(0.74160718,0,0,0.74160718,3.8434168,3.5667773)"/>
      <line x1="13.48431" x2="17.933952" y1="17.657314" y2="13.207671"/>
      <line x1="15.709131" x2="18.67556" y1="15.432492" y2="18.398922"/>
      <line x1="17.933952" x2="19.417168" y1="19.140528" y2="17.657314"/>
    </g>
  </g>
</svg>`

    function injectSearchBadge(anchor: HTMLAnchorElement, found: boolean) {
      // Idempotent: drop a previously-injected badge on this anchor before re-adding.
      const sibling = anchor.nextElementSibling
      if (sibling instanceof HTMLElement && sibling.hasAttribute('data-bcrm-badge')) {
        sibling.remove()
      }

      // Container: the BattleCRM logo with a small status dot (✓ / +) overlaid in the
      // bottom-right corner — same visual language as the toolbar icon + native badge.
      const badge = document.createElement('span')
      badge.setAttribute('data-bcrm-badge', found ? 'in' : 'out')
      badge.setAttribute('aria-hidden', 'true')
      badge.title = found ? badgeLabels.inCrm : badgeLabels.notInCrm
      badge.innerHTML = BCRM_LOGO_SVG
      Object.assign(badge.style, {
        position: 'relative',
        display: 'inline-flex',
        flex: 'none',
        width: '20px',
        height: '20px',
        marginLeft: '6px',
        verticalAlign: 'middle',
      } as Partial<CSSStyleDeclaration>)

      const dot = document.createElement('span')
      dot.setAttribute('aria-hidden', 'true')
      dot.textContent = found ? '✓' : '+'
      Object.assign(dot.style, {
        position: 'absolute',
        right: '-4px',
        bottom: '-4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '13px',
        height: '13px',
        borderRadius: '50%',
        background: found ? '#16a34a' : '#dc2626',
        color: '#fff',
        fontSize: '9px',
        fontWeight: '700',
        lineHeight: '1',
        border: '1.5px solid #fff',
        boxSizing: 'content-box',
        textDecoration: 'none',
      } as Partial<CSSStyleDeclaration>)
      badge.appendChild(dot)

      anchor.insertAdjacentElement('afterend', badge)
    }

    function scanSearchResults() {
      if (!isPeopleSearchPage(location.href)) return

      const entries = scrapeSearchResults()
      // Skip anchors already resolved or in-flight (avoids hammering the API on re-renders).
      const pending = entries.filter((e) => !e.nameAnchor.dataset.bcrmBadgeState)
      if (pending.length === 0) return

      for (const e of pending) e.nameAnchor.dataset.bcrmBadgeState = 'pending'
      const urls = [...new Set(pending.map((e) => e.canonicalUrl))]

      browser.runtime
        .sendMessage({ type: 'CHECK_PROSPECTS_BATCH', urls })
        .then((resp: { results?: Record<string, boolean> } | undefined) => {
          const results = resp?.results ?? {}
          for (const e of pending) {
            const found = results[e.canonicalUrl]
            if (found === undefined) {
              // Unknown (not logged in / error) — clear flag so a later scan can retry.
              e.nameAnchor.removeAttribute('data-bcrm-badge-state')
              continue
            }
            injectSearchBadge(e.nameAnchor, found)
            e.nameAnchor.dataset.bcrmBadgeState = found ? 'in' : 'out'
          }
        })
        .catch(() => {
          for (const e of pending) e.nameAnchor.removeAttribute('data-bcrm-badge-state')
        })
    }

    // LinkedIn re-renders the results list in bursts → debounce the scan.
    let scanTimer: ReturnType<typeof setTimeout> | undefined
    function scheduleScan() {
      if (!isPeopleSearchPage(location.href)) return
      if (scanTimer) clearTimeout(scanTimer)
      scanTimer = setTimeout(scanSearchResults, 400)
    }

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
          scheduleScan()
        },
      )
    }

    // Fallback: MutationObserver — catches edge cases the Navigation API misses,
    // and (debounced) re-scans the search list as LinkedIn re-renders results
    // (filters applied, async result loading, pagination without URL change).
    let observerUrl = location.href
    const observer = new MutationObserver(() => {
      if (location.href !== observerUrl) {
        observerUrl = location.href
        handleUrlChange(location.href)
      }
      scheduleScan()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('pagehide', () => observer.disconnect(), { once: true })

    handleUrlChange(location.href)
    scheduleScan()
  },
})
