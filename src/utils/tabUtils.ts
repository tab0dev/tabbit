import { TriageTab, TabId, WindowId, GroupId } from '../types';

export function normalizeUrl(urlStr: string): string {
  try {
    const urlObj = new URL(urlStr);
    let cleanUrl = urlObj.toString();
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    return cleanUrl;
  } catch {
    let cleanUrl = urlStr;
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    return cleanUrl;
  }
}

export function createTriageTab(
  tab: chrome.tabs.Tab & { isSuspended?: boolean; suspendedUrl?: string | null },
): TriageTab {
  return {
    id: tab.id as TabId,
    windowId: tab.windowId as WindowId,
    groupId: (tab.groupId ?? -1) as GroupId,
    index: tab.index,
    title: tab.title || '(Untitled)',
    url: tab.url || '',
    favIconUrl: tab.favIconUrl || '',
    pinned: tab.pinned || false,
    lastAccessed: tab.lastAccessed || null,
    openerTabId: (tab.openerTabId ?? null) as TabId | null,
    processed: false,
    gone: false,
    action: null,
    // Suspended tab fields (populated by triageLoader when includeSuspendedTabs is on)
    isSuspended: tab.isSuspended || false,
    suspendedUrl: tab.suspendedUrl || null,
  };
}
