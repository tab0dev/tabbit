# Tab Sorter Engine

The Tab Sorter is a utility integrated into Tabbit that allows users to instantly organize their browser by sorting all open tabs alphabetically by Title or URL.

This utility is exposed in two ways:
1. Through the `TabSorterCard.jsx` interface within the Tabbit dashboard.
2. Natively through Chrome's right-click context menu via the extension icon.

## How it Works

Because sorting requires querying, moving, and grouping all tabs in the active window, the core logic is entirely housed within the `public/background.js` Service Worker. The UI merely sends a `chrome.runtime.sendMessage({ type: 'sortTabs' })` to trigger the engine.

### The Execution Flow

When `runTabSorter()` executes in the background worker, it performs the following steps:

1. **Read Settings**: It retrieves the user's persistent preferences from `chrome.storage.local` (e.g., sort by URL vs Title, include pinned tabs, handle suspended tabs).
2. **Handle Pinned Tabs**: If the user chose to include pinned tabs, it sorts them first. Pinned tabs always remain pinned and at the very front of the browser window.
3. **Handle Existing Groups**: Tabbit respects the user's existing organizational structure. It first sorts the Tab Groups themselves alphabetically by their group name. Then, it iterates into each group and sorts the individual tabs *within* that group.
4. **Handle Ungrouped Tabs**: Finally, all remaining ungrouped tabs are sorted and placed at the end of the window.

### Suspended Tab Parsing

Tab suspender extensions (like "Tiny Suspender" or "The Great Suspender") unload the active memory of a tab by redirecting its URL to a local `chrome-extension://...` page. 

If Tabbit sorted by URL natively, all suspended tabs would be grouped together under `chrome-extension://` rather than their actual underlying website. 

To fix this, the Tab Sorter Engine intercepts the URL comparison:
- It checks if `groupSuspendedTabs` is active.
- If true, it extracts the target `extensionId`.
- It parses the `chrome-extension://` URL, decodes the base64 or URI-encoded query string containing the *original* website URL, and uses that original URL for the alphabetized comparison.

This ensures that a suspended GitHub tab is sorted perfectly next to an active GitHub tab.
