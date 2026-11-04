/** The active tab, as the sidebar follows it. */
export type ActiveTab = { id: number; url: string };

/**
 * Follows the active tab of the sidebar's window and its address (spec extension §2, §3): given at
 * once, then at each change of tab or of address. `undefined` for a tab the extension may not read:
 * without the `tabs` permission, Firefox gives the address of a LinkedIn tab only. Returns what stops
 * it.
 */
export type WatchActiveTab = (onTab: (tab: ActiveTab | undefined) => void) => () => void;

const activeTabOf = ({ id, url }: browser.tabs.Tab): ActiveTab | undefined =>
  id === undefined || url === undefined ? undefined : { id, url };

export const watchActiveTab: WatchActiveTab = (onTab) => {
  let active: { tabId: number | undefined; windowId: number } | undefined;
  const read = async () => {
    // `currentWindow` is the window of the sidebar.
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId === undefined) return;
    active = { tabId: tab.id, windowId: tab.windowId };
    onTab(activeTabOf(tab));
  };
  const activated = ({ windowId }: { windowId: number }) => {
    if (active === undefined || windowId === active.windowId) void read();
  };
  // LinkedIn's `pushState` changes the address; a load elsewhere ends with `complete`, without one.
  const updated = (
    tabId: number,
    change: browser.tabs._OnUpdatedChangeInfo,
    tab: browser.tabs.Tab,
  ) => {
    if (tabId === active?.tabId && (change.url !== undefined || change.status === 'complete'))
      onTab(activeTabOf(tab));
  };
  browser.tabs.onActivated.addListener(activated);
  browser.tabs.onUpdated.addListener(updated);
  void read();
  return () => {
    browser.tabs.onActivated.removeListener(activated);
    browser.tabs.onUpdated.removeListener(updated);
  };
};
