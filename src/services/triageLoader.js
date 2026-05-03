import { Mode } from '../store/TriageProvider';
import { createTriageTab, normalizeUrl } from '../utils/tabUtils';

// ─── Known tab-suspender extensions ──────────────────────────────────────────
// Tiny Suspender encodes the original URL in the ?url= query param of its
// suspension page. any user-configured suspender uses the same
// convention (most popular suspenders do). The decode function is therefore
// shared — only the extension ID (and thus the URL prefix) differs.
const TINY_SUSPENDER_ID = 'bbomjaikkcabgmfaomdichgcodnaeecf';

function buildSuspenderEntry(extensionId) {
  return {
    prefix: `chrome-extension://${extensionId}/`,
    decode(url) {
      try {
        const params = new URLSearchParams(new URL(url).search);
        const originalUrl = params.get('url');
        if (!originalUrl) return null;
        return {
          url:        decodeURIComponent(originalUrl),
          favIconUrl: params.get('favIconUrl') ? decodeURIComponent(params.get('favIconUrl')) : null,
        };
      } catch {
        return null;
      }
    },
  };
}

/**
 * Build the active suspender list at call time so it picks up any
 * custom extension ID the user has configured in Settings.
 */
function getActiveSuspenders() {
  const customId = localStorage.getItem('suspenderExtensionId');
  const suspenders = [buildSuspenderEntry(TINY_SUSPENDER_ID)];
  if (customId && customId !== TINY_SUSPENDER_ID) {
    suspenders.unshift(buildSuspenderEntry(customId));
  }
  return suspenders;
}

/** Returns the matching suspender entry if the URL belongs to a known suspender, else null. */
function getSuspender(url, suspenders) {
  if (!url) return null;
  return suspenders.find(s => url.startsWith(s.prefix)) ?? null;
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads all triage data from Chrome APIs and dispatches it to state.
 * Exported as a plain async function so it can be called from both
 * useChromeApis (on init) and PermissionBanner (after permission grant).
 *
 * @param {function} dispatch - TriageProvider dispatch
 * @param {{ silent?: boolean }} [options]
 *   silent: if true, skips the SET_MODE:LOADING dispatch so the current
 *   view stays mounted while data refreshes in the background (used when
 *   toggling settings mid-session).
 */
export async function loadTriageData(dispatch, { silent = false } = {}) {
  try {
    if (!silent) {
      dispatch({ type: 'SET_MODE', payload: Mode.LOADING });
    }

    const selfTab = await chrome.tabs.getCurrent();
    const selfTabId = selfTab?.id || null;

    const allTabs = await chrome.tabs.query({});
    const activeSuspenders = getActiveSuspenders();
    const windowIds = [...new Set(allTabs.map(t => t.windowId))];
    const windows = new Map();
    windowIds.forEach((wid, i) => windows.set(wid, `Window ${i + 1}`));

    const mappedTabs = allTabs
      .filter(t => t.id !== selfTabId)
      .map(t => {
        const suspender = getSuspender(t.url, activeSuspenders);
        if (suspender) {
          const decoded = suspender.decode(t.url);
          if (decoded) {
            return createTriageTab({
              ...t,
              url: decoded.url,
              favIconUrl: t.favIconUrl || decoded.favIconUrl || '',
              isSuspended: true,
              suspendedUrl: t.url,
            });
          }
        }
        return createTriageTab(t);
      });

    const seenUrls = new Map();
    const tabs = [];

    for (const tab of mappedTabs) {
      const normalized = normalizeUrl(tab.url);
      if (seenUrls.has(normalized)) {
        const primaryTab = seenUrls.get(normalized);
        if (!primaryTab.duplicates) primaryTab.duplicates = [];
        primaryTab.duplicates.push(tab);
      } else {
        seenUrls.set(normalized, tab);
        tabs.push(tab);
      }
    }

    let bookmarkFolders = [];
    let bookmarkTree = [];
    try {
      const tree = await chrome.bookmarks.getTree();

      // Build recursive tree (folders only, exclude synthetic root id "0").
      const buildTree = (nodes, path = '') =>
        nodes
          .filter(n => !n.url && n.id !== '0')
          .map(n => {
            const newPath = path ? `${path} / ${n.title}` : n.title;
            return {
              id: n.id,
              title: n.title,
              path: newPath,
              children: n.children ? buildTree(n.children, newPath) : [],
            };
          });

      // Chrome's root (id "0") has children: Bookmarks Bar, Other Bookmarks, Mobile Bookmarks.
      // skip id "0" itself and expose its children as the top-level roots.
      const rootNode = tree[0];
      bookmarkTree = rootNode?.children ? buildTree(rootNode.children) : [];

      // Build flat list for keyboard nav and fuzzy search by flattening the computed tree.
      // This ensures items in bookmarkFolders are explicit references to the exact same nodes
      // in bookmarkTree, automatically providing the `.children` property for free.
      const flattenComputed = (nodes) => {
        let result = [];
        for (const node of nodes) {
          result.push(node);
          if (node.children?.length > 0) {
            result = result.concat(flattenComputed(node.children));
          }
        }
        return result;
      };
      bookmarkFolders = flattenComputed(bookmarkTree);
    } catch { }

    let tabGroups = [];
    try {
      const groups = await chrome.tabGroups.query({});
      tabGroups = groups.map(g => ({
        id: g.id,
        title: g.title || '',
        color: g.color || 'grey',
        windowId: g.windowId,
      }));
    } catch { }

    dispatch({
      type: 'SET_INITIAL_DATA',
      payload: { tabs, selfTabId, windows, bookmarkFolders, bookmarkTree, tabGroups },
    });
  } catch (err) {
    console.error('[Tabbit] loadTriageData failed:', err);
  }
}
