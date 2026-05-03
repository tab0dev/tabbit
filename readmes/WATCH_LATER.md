# Watch Later Batch Automation

The Watch Later feature is one of Tabbit's most powerful productivity tools. It allows users to quickly stash a massive queue of open YouTube video tabs into their native YouTube "Watch Later" playlist automatically.

## How it Works

Because YouTube requires users to be authenticated to save a video, and the "Watch Later" action is deeply embedded in YouTube's single-page application (SPA) state, Tabbit cannot simply perform a headless HTTP POST request. It must interact with the live DOM of the actual YouTube page while the user is logged in.

### The Orchestration Layer (`watchLaterBatch.js`)

When a user triggers the "Watch Later" batch process from the `WatchLaterCard.jsx` interface, the UI delegates control to `src/utils/watchLaterBatch.js`.

This script acts as a stateful orchestrator that runs directly in the extension page (the triage tab) and drives the execution sequence:

1. **Focus Tab**: It iterates over each target YouTube tab and forcefully focuses it using `chrome.tabs.update(tabId, { active: true })`. This is crucial because modern browsers throttle Javascript execution on background tabs.
2. **Inject Automation**: Using `chrome.scripting.executeScript`, it dynamically injects the `watchLaterAutomation.js` payload directly into the active YouTube tab's execution context.
3. **Await Completion**: It waits for the script to execute, listening for the structured response (`{ ok: true, reason: '...', log: [] }`).
4. **Close & Continue**: Upon success, it closes the YouTube tab via `chrome.tabs.remove(tabId)` and proceeds to the next video in the queue, pausing briefly to prevent triggering rate limits.

### The Execution Payload (`watchLaterAutomation.js`)

This file resides in the `public/` directory so it is directly accessible as an injection payload. 

Once injected into a YouTube tab, it:
1. Waits for the DOM to settle by polling for the `ytd-watch-metadata` container.
2. Finds the "Save" action menu button.
3. Parses the pop-up modal to locate the specific checkbox representing the "Watch Later" playlist.
4. Reads the aria-checked state of the checkbox.
   - If it is already checked, it skips.
   - If not checked, it natively clicks the DOM element.
5. Emits a notification toast natively through YouTube's UI, validating the save.
6. Returns the execution log back to the Tabbit orchestrator.
