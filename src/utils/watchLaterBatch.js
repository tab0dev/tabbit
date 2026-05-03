/**
 * watchLaterBatch.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure orchestration layer for the Watch Later batch automation.
 * Runs entirely in the extension-page context (no background worker needed).
 *
 * Usage:
 *   const controller = new AbortController();
 *   await runWatchLaterBatch(tabIds, {
 *     signal:     controller.signal,
 *     onProgress: ({ type, ...data }) => { ... },
 *   });
 *
 * Progress event shapes (discriminated union):
 *   { type: 'log',       line: string }
 *   { type: 'tabStatus', tabId: number, status: 'activating'|'saving'|'saved'|'failed' }
 *   { type: 'done',      succeeded: number, failed: number, stopped: boolean }
 */

import { sleep, waitForTabLoad } from './chromeUtils';

/**
 * @param {number[]} tabIds
 * @param {{ signal: AbortSignal, onProgress: (event: object) => void }} options
 */
export async function runWatchLaterBatch(tabIds, { signal, onProgress }) {
  const log  = (line)           => onProgress({ type: 'log', line });
  const stat = (tabId, status)  => onProgress({ type: 'tabStatus', tabId, status });

  let succeeded = 0;
  let failed    = 0;

  log(`▶ ${tabIds.length} tab(s) queued`);

  for (let i = 0; i < tabIds.length; i++) {
    if (signal.aborted) {
      log('⊘ Stopped');
      break;
    }

    const tabId = tabIds[i];
    log(`[${i + 1}/${tabIds.length}] tab#${tabId} — activating…`);
    stat(tabId, 'activating');

    try {
      // ── Focus the tab ─────────────────────────────────────────────────────
      await chrome.tabs.update(tabId, { active: true });
      log(`  → focused, waiting for page load…`);

      const loaded = await waitForTabLoad(tabId, 8000);
      if (!loaded) {
        log(`  ✕ load timed out`);
        stat(tabId, 'failed');
        failed++;
        continue;
      }

      // YouTube SPA: the automation's own SAVE_BTN_WAIT poll handles waiting
      // for the Save button to appear in the DOM after focus.
      log(`  → injecting automation…`);
      stat(tabId, 'saving');

      // Inject the standalone public/watchLaterAutomation.js file.
      // Edit that file to iterate on selectors — no rebuild needed.
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        files: ['watchLaterAutomation.js'],
      });

      const result = injection?.result ?? { ok: false, reason: 'no_result', log: [] };

      // Forward DOM-level log lines to the caller
      if (Array.isArray(result.log)) {
        result.log.forEach(line => log(`    [dom] ${line}`));
      }

      if (result.ok) {
        succeeded++;
        log(`  ✓ saved (${result.reason})`);
        stat(tabId, 'saved');

        // Brief pause so the ✓ badge is visible before the tab disappears
        await sleep(300);
        log(`  → closing tab…`);
        try {
          await chrome.tabs.remove(tabId);
          log(`  ✓ tab closed`);
        } catch (closeErr) {
          log(`  ⚠ tab close failed: ${closeErr.message}`);
        }
      } else {
        failed++;
        log(`  ✕ failed (${result.reason})`);
        stat(tabId, 'failed');
      }

    } catch (err) {
      failed++;
      log(`  ✕ error: ${err.message}`);
      stat(tabId, 'failed');
    }

    if (i < tabIds.length - 1 && !signal.aborted) {
      await sleep(400);
    }
  }

  const stopped = signal.aborted;
  log(`■ Done — ✓${succeeded} saved  ✕${failed} failed${stopped ? '  (stopped)' : ''}`);
  onProgress({ type: 'done', succeeded, failed, stopped });
}
