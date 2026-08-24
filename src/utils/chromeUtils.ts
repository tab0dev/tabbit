/**
 * chromeUtils.js
 * Shared Chrome extension utilities used across extension-page contexts.
 * These run in the EXTENSION PAGE context, NOT injected into YouTube.
 */

import { TabId } from '../types';

/** Simple sleep helper */
export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Waits for a tab to reach status 'complete', with a timeout.
 * Returns true if the tab loaded, false if it timed out or doesn't exist.
 */
export function waitForTabLoad(tabId: TabId, timeoutMs = 8000) {
  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(loaded);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    chrome.tabs
      .get(tabId)
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

    const onUpdated = (id: number, changeInfo: Partial<chrome.tabs.Tab>) => {
      if (id !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timer);
      finish(true);
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

/**
 * Returns true if the given tab is a YouTube /watch page with a video ID.
 */
export function isYouTubeWatchTab(tab: Partial<chrome.tabs.Tab> | { url?: string }): boolean {
  try {
    const url = new URL(tab.url || '');
    return (
      url.hostname === 'www.youtube.com' && url.pathname === '/watch' && url.searchParams.has('v')
    );
  } catch {
    return false;
  }
}
