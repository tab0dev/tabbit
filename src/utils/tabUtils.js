export function normalizeUrl(urlStr) {
  try {
    const urlObj = new URL(urlStr);
    let cleanUrl = urlObj.toString();
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    return cleanUrl;
  } catch (e) {
    let cleanUrl = urlStr;
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    return cleanUrl;
  }
}

export function createTriageTab(tab) {
  return {
    id: tab.id,
    windowId: tab.windowId,
    groupId: tab.groupId ?? -1,
    index: tab.index,
    title: tab.title || '(Untitled)',
    url: tab.url || '',
    favIconUrl: tab.favIconUrl || '',
    pinned: tab.pinned || false,
    lastAccessed: tab.lastAccessed || null,
    openerTabId: tab.openerTabId ?? null,
    processed: false,
    gone: false,
    action: null,
    // Suspended tab fields (populated by triageLoader when includeSuspendedTabs is on)
    isSuspended: tab.isSuspended || false,
    suspendedUrl: tab.suspendedUrl || null,
  };
}
