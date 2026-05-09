# Permissions and Privacy

Because Tabbit is designed to act as a powerful organizational orchestrator for your browser, it requires broad permissions. 

**However, Tabbit's architecture is explicitly designed to be 100% local, offline, and private.**
- No telemetry, analytics, or user tracking.
- No external servers are pinged with your tab data.
- The AI grouping feature utilizes **Gemini Nano**, which runs entirely on-device utilizing your local hardware, keeping your browsing history secure.
- No one ever sees your usage, or tab information. 100% safe. Hence the open source code! 

### Declared Permissions

#### `tabs`
Required to enumerate and manage all open tabs across all windows.
- `chrome.tabs.query()`: Build the initial tab queue; sweep all tabs when Auto Grouper rules change; find duplicate URLs for Smush Duplicates; enumerate all tabs for Merge Windows.
- `chrome.tabs.update()`: Activate and focus tabs when the user clicks a card; focus each YouTube tab in sequence during a Watch Later batch run.
- `chrome.tabs.remove()`: Close tabs when the user selects "Close"; close duplicate copies during Smush Duplicates; close each YouTube tab after a successful Watch Later save.
- `chrome.tabs.create()`: Re-open tabs during an "Undo" action.
- `chrome.tabs.move()`: Relocate all foreign-window tabs into the target window during Merge Windows.
- `chrome.tabs.group()` & `ungroup()`: Assign or remove tabs from tab groups during triage, in Auto Grouper real-time enforcement, and in Tab List View bulk-group actions.
- `chrome.tabs.getCurrent()`: Exclude the extension's own tab from the queue.

#### `bookmarks`
Required to let users save tabs to bookmark folders during triage. 
- `chrome.bookmarks.getTree()`: Builds a searchable folder picker during initialization.
- `chrome.bookmarks.create()`: Saves a triaged tab's URL and title into the user's chosen folder.
- `chrome.bookmarks.remove()`: Reverses a bookmark action during an "Undo".

#### `tabGroups`
Required to manage existing Chrome tab groups and create new ones.
- `chrome.tabGroups.query()`: Populates the group picker with existing groups; locates target groups by name/color for the Auto Grouper daemon (respecting the merge-across-windows flag).
- `chrome.tabGroups.update()`: Sets titles and colors on newly created groups.
- `chrome.tabGroups.move()`: Repositions tab groups in alphabetical order during a Tab Sorter run.
- `chrome.tabGroups.get()`: Reads a group's current title and color in Auto Grouper Strict Mode to determine whether a navigated-away tab should be ungrouped.

#### `activeTab`
Required as a baseline permission for the `chrome.debugger`-based tab screenshot feature to implement a preview window for tabs. When the user views the active triage item, the background service worker attaches the Chrome DevTools Protocol to capture a JPEG preview of that tab via `Page.captureScreenshot`. `activeTab` scopes this access specifically to tabs the user is actively triaging. 

#### `debugger`
Required to capture visual screenshot previews of tabs during triage without needing to focus or navigate to them. The background service worker uses:
- `chrome.debugger.attach()`
- `chrome.debugger.sendCommand('Page.captureScreenshot')`
- `chrome.debugger.detach()`

*Note: This approach replaces `captureVisibleTab` to explicitly avoid requesting the highly-privileged `<all_urls>` host permission.*

#### `alarms`
Tabbit includes an opt-in Auto Tab Closer that automatically closes tabs the user hasn't visited in a configurable period (e.g. 7 days).
- Because service workers are ephemeral and cannot use `setInterval` across restarts, a single periodic alarm (`tabbit-auto-close`) wakes the service worker at the user-set check interval.
- It then queries all open tabs, compares the `lastAccessed` time against the threshold, and closes qualifying tabs.
- The alarm is dynamically cleared and re-created whenever the user changes settings.

#### `storage`
Required to persist state across two isolated contexts (the UI and the background service worker).
- **Auto Tab Closer**: `chrome.storage.local` persists settings (enabled flag, inactivity threshold, check interval). `chrome.storage.session` holds a temporary graveyard log of recently auto-closed tabs so users can review and restore them.
- **Tab Sorter**: `chrome.storage.local` persists user sort preferences (by URL vs Title, pinned tabs, suspended tab handling) so they survive browser sessions.
- **Auto Tab Grouper**: `chrome.storage.local` persists the full rule set (match patterns, group names, colors, strict/merge flags) under a dedicated key. The daemon listens to `chrome.storage.onChanged` and instantly recompiles its rule registry when the UI saves changes. A second key persists the daemon's enabled/disabled state. A third key (`tabbit_excludeSuspendedTabs_remote`) mirrors the UI's "Exclude Suspended Tabs" preference into storage so the daemon can read it directly without message passing.

#### `contextMenus`
Tabbit adds four entries to the right-click menu on the extension's toolbar icon, each triggering a heavyweight background action without opening the full Tabbit interface:
- *Sort all tabs by title*
- *Sort all tabs by URL*
- *Smush duplicate tabs* — scans all open tabs for exact URL duplicates, closes the extras (pinned tabs are always kept, lowest-index instance is preferred).
- *Merge all tabs into one window* — moves all tabs from every browser window into the last-focused window.

All four items are registered once on `chrome.runtime.onInstalled` and dispatched through a single `chrome.contextMenus.onClicked` listener.

#### `scripting` & Host Permission (`*://*.youtube.com/*`)
Required exclusively for the **Watch Later Batch** feature. Tabbit uses `chrome.scripting.executeScript` to inject a standalone automation script into YouTube tabs to natively click the "Save to Watch Later" button on behalf of the user, requiring the host permission to interface securely with the DOM. The injected script reads the aria-checked state of the Watch Later playlist checkbox and clicks it only if unchecked, then emits a native YouTube toast notification to confirm the save.

#### `windows`
Required by the **Merge Windows** feature.
- `chrome.windows.getLastFocused()`: Identifies the target window that all other tabs will be consolidated into.
- `chrome.windows.update()`: Brings the target window to the foreground after the merge so the user can immediately see the result.
