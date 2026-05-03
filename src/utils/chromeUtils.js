/**
 * chromeUtils.js
 * Shared Chrome extension utilities used across extension-page contexts.
 * These run in the EXTENSION PAGE context, NOT injected into YouTube.
 */

/** Simple sleep helper */
export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Waits for a tab to reach status 'complete', with a timeout.
 * Returns true if the tab loaded, false if it timed out or doesn't exist.
 */
export function waitForTabLoad(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (loaded) => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(loaded);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    chrome.tabs.get(tabId)
      .then((tab) => {
        if (tab.status === 'complete') {
          clearTimeout(timer);
          finish(true);
        }
      })
      .catch(() => {
        clearTimeout(timer);
        finish(false);
      });

    function onUpdated(id, changeInfo) {
      if (id !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timer);
      finish(true);
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

/**
 * Returns true if the given tab is a YouTube /watch page with a video ID.
 */
export function isYouTubeWatchTab(tab) {
  try {
    const url = new URL(tab.url || '');
    return (
      url.hostname === 'www.youtube.com' &&
      url.pathname === '/watch' &&
      url.searchParams.has('v')
    );
  } catch {
    return false;
  }
}
