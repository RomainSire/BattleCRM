/**
 * Follows the address of the active tab of the sidebar's window (spec extension §2, §3): given at once,
 * then at each change of tab or of address. `undefined` for a tab the extension may not read: without
 * the `tabs` permission, Firefox gives the address of a LinkedIn tab only. Returns what stops it.
 */
export type WatchActiveTab = (onAddress: (url: string | undefined) => void) => () => void;

export const watchActiveTab: WatchActiveTab = (onAddress) => {
  let active: { tabId: number | undefined; windowId: number } | undefined;
  const read = async () => {
    // `currentWindow` is the window of the sidebar.
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId === undefined) return;
    active = { tabId: tab.id, windowId: tab.windowId };
    onAddress(tab.url);
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
      onAddress(tab.url);
  };
  browser.tabs.onActivated.addListener(activated);
  browser.tabs.onUpdated.addListener(updated);
  void read();
  return () => {
    browser.tabs.onActivated.removeListener(activated);
    browser.tabs.onUpdated.removeListener(updated);
  };
};
