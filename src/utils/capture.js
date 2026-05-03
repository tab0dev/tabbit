// Tabbit — Tab Screenshot Capture
// Lazily captures screenshots of tabs via the background service worker.
// Caches results so each tab is only captured once.

/** @type {Map<number, string>} tabId → dataURL */
const cache = new Map();

/** @type {Set<number>} tabIds that failed capture (don't retry) */
const failed = new Set();

/** @type {Set<number>} tabs currently being captured (prevent double-capture) */
const inFlight = new Set();

/**
 * Get a cached screenshot for a tab, or null if not yet captured.
 * @param {number} tabId
 * @returns {string|null}
 */
export function getCachedCapture(tabId) {
    return cache.get(tabId) || null;
}

/**
 * Check if capture failed for this tab (so we don't show "loading" forever).
 * @param {number} tabId
 * @returns {boolean}
 */
export function didCaptureFail(tabId) {
    return failed.has(tabId);
}

/**
 * Capture a screenshot of the given tab. Works by:
 * 1. Activating the tab in its window (making it visible)
 * 2. Waiting briefly for render
 * 3. Sending a message to the background service worker to call captureVisibleTab
 * 4. Restoring the previously active tab
 *
 * @param {object} tab - QueueEntry
 * @param {function} onCaptured - callback(dataUrl|null) when capture completes or fails
 */
export async function captureTab(tab, onCaptured) {
    // Return cached immediately
    if (cache.has(tab.id)) {
        onCaptured(cache.get(tab.id));
        return;
    }

    // Don't retry failed captures or double-capture
    if (failed.has(tab.id)) { onCaptured(null); return; }
    if (inFlight.has(tab.id)) return;
    if (tab.gone) return;

    // Skip chrome:// and edge:// URLs — they always fail
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://'))) {
        failed.add(tab.id);
        onCaptured(null);
        return;
    }

    inFlight.add(tab.id);

    try {
        console.log(`[Tabbit] Sending capture msg (debugger) to background for tab ${tab.id}...`);

        // Capture via the background service worker using the new debugger API
        const response = await chrome.runtime.sendMessage({
            type: 'captureTab',
            tabId: tab.id,
        });

        console.log(`[Tabbit] Background response for tab ${tab.id}:`, response ? (response.ok ? 'SUCCESS' : `FAILED: ${response.error}`) : 'NO RESPONSE');

        if (!response?.ok) {
            console.warn('[Tabbit] Capture failed for tab', tab.id, tab.url, response?.error);
            failed.add(tab.id);
            onCaptured(null);
            return;
        }

        // Cache and deliver
        cache.set(tab.id, response.dataUrl);
        onCaptured(response.dataUrl);
    } catch (err) {
        console.warn('[Tabbit] Capture error for tab', tab.id, err.message);
        failed.add(tab.id);
        onCaptured(null);
    } finally {
        inFlight.delete(tab.id);
    }
}

/**
 * Clear the cache for a specific tab (e.g. after undo reopens it with a new ID).
 * @param {number} tabId
 */
export function clearCapture(tabId) {
    cache.delete(tabId);
    failed.delete(tabId);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
