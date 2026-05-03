# Permissions and Privacy

Because Tabbit is designed to act as a powerful organizational orchestrator for your browser, it requires broad permissions. 

**However, Tabbit's architecture is explicitly designed to be 100% local, offline, and private.**
- No telemetry, analytics, or user tracking.
- No external servers are pinged with your tab data.
- The AI grouping feature utilizes **Gemini Nano**, which runs entirely on-device utilizing your local hardware, keeping your browsing history secure.
- No one ever sees your usage, or tab information. 100% safe. Hence the open source code! 

### Declared Permissions

#### `tabs`
Required to enumerate all open tabs across all windows to build the open tab triage queue.
- `chrome.tabs.query()`: Build the initial tab queue.
- `chrome.tabs.update()`: Activate and focus tabs when the user clicks a card.
- `chrome.tabs.remove()`: Close tabs when the user selects "Close".
- `chrome.tabs.create()`: Re-open tabs during an "Undo" action.
- `chrome.tabs.group()` & `ungroup()`: Assign or remove tabs from tab groups.
- `chrome.tabs.getCurrent()`: Exclude the extension's own tab from the queue.

#### `bookmarks`
Required to let users save tabs to bookmark folders during triage. 
- `chrome.bookmarks.getTree()`: Builds a searchable folder picker during initialization.
- `chrome.bookmarks.create()`: Saves a triaged tab's URL and title into the user's chosen folder.
- `chrome.bookmarks.remove()`: Reverses a bookmark action during an "Undo".

#### `tabGroups`
Required to manage existing Chrome tab groups and create new ones.
- `chrome.tabGroups.query()`: Populates the group picker with existing groups.
- `chrome.tabGroups.update()`: Sets titles on newly created groups. 

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

#### `contextMenus`
Tabbit's Tab Sorter feature lets users instantly sort all open tabs alphabetically. `contextMenus` is used to add two entries to the right-click menu on the extension's toolbar icon:
- *Sort all tabs by title*
- *Sort all tabs by URL*

This provides a standard, lightweight, one-click shortcut without needing to open the full Tabbit interface.

#### `scripting` & Host Permission (`*://*.youtube.com/*`)
Required exclusively for the **Watch Later Batch** feature. Tabbit uses `chrome.scripting.executeScript` to inject a standalone automation script into YouTube tabs to natively click the "Save to Watch Later" button on behalf of the user, requiring the host permission to interface securely with the DOM.
