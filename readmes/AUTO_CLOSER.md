# Auto Tab Closer Worker

The Auto Tab Closer is a background daemon that silently prunes stale tabs over time, ensuring your browser remains performant and decluttered even if you forget to open the Tabbit triage interface.

## How it Works

Because this feature must run reliably without user intervention, it executes entirely within the Chrome MV3 Service Worker (`public/background.js`). 

### The Engine (`chrome.alarms`)

Unlike persistent background pages in MV2, Chrome MV3 Service Workers are heavily aggressively suspended by the browser when idle. `setTimeout` and `setInterval` are unreliable and will be terminated.

To keep the Auto-Closer ticking, we use the `chrome.alarms` API:
1. When the user enables the Auto-Closer from the `AutoTabCloserWorkerPanel` UI, the React app writes the configuration (e.g., threshold and interval) to `chrome.storage.local`.
2. The Service Worker listens to `chrome.storage.onChanged`. When it detects a new configuration, it evaluates the settings.
3. If enabled, it creates an alarm (`chrome.alarms.create("tabbit-auto-close", { periodInMinutes })`).
4. Chrome guarantees that the Service Worker will be woken up when the alarm fires, executing the `runAutoClose()` function.

### Execution Logic (`runAutoClose`)

When the daemon wakes up, it executes the following sequence:

1. **Query Active State**: It fetches the total pool of open tabs using `chrome.tabs.query({})`.
2. **Evaluate Staleness**: It iterates through every tab and compares the current `Date.now()` against the native `tab.lastAccessed` property (provided securely by Chrome).
3. **Filter Exceptions**: It explicitly ignores tabs that are:
   - Pinned by the user (`t.pinned`).
   - The Tabbit extension page itself (`chrome-extension://${chrome.runtime.id}/`).
   - Recently active (age < user's `thresholdMs`).
4. **Pruning**: It executes a bulk closure using `chrome.tabs.remove([idsToClose])`.
5. **Tombstoning**: Tabbit records the metadata (URL, Title, Favicon) of the closed tabs into an array of "Tombstones".
6. **Session Storage**: These Tombstones are prepended to `chrome.storage.session`. This is a specialized storage area that persists across extension reloads but clears when the browser completely closes, preventing endless bloat. 

When the user later opens the Tabbit Dashboard, the `AutoTabCloserWorkerPanel` queries this `chrome.storage.session` graveyard to proudly display a visual log of how many tabs the background worker saved them from.
