/**
 * watchLaterAutomation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Injected into a YouTube /watch tab via:
 *   chrome.scripting.executeScript({ target: { tabId }, files: ['watchLaterAutomation.js'] })
 *
 * Targets YouTube's NEW view-model UI (2025+):
 *   yt-sheet-view-model
 *   └── yt-list-view-model
 *       └── toggleable-list-item-view-model
 *           └── yt-list-item-view-model[aria-label="Watch later, Private, Not selected"]
 *               └── button.ytListItemViewModelButtonOrAnchor  ← CLICK THIS
 *
 * Returns: Promise<{ ok: boolean, reason: string, log: string[] }>
 * executeScript() awaits the returned Promise automatically (MV3).
 *
 * ── HOW TO UPDATE ────────────────────────────────────────────────────────────
 * • SAVE_SELECTORS — if the Save button aria-label or wrapping element changes
 * • WL_ITEM_SEL    — if the Watch Later item's aria-label prefix changes
 * • BTN_SEL        — if the clickable button class inside the item changes
 * ─────────────────────────────────────────────────────────────────────────────
 */
(async function watchLaterAutomation() {

  // ── Timing ─────────────────────────────────────────────────────────────────
  const POLL_MS       = 80;
  const SAVE_BTN_WAIT = 6000;  // max wait for the Save button after injection
  const PANEL_WAIT    = 5000;  // max wait for the playlist panel items
  const CONFIRM_WAIT  = 600;   // brief window to catch DOM signal; click is reliable without it
  const SETTLE_MS     = 150;   // pause after each simulated click

  // ── Log collector ──────────────────────────────────────────────────────────
  const log = [];
  const L = (msg) => log.push(msg);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function poll(checkFn, timeoutMs) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const id = setInterval(() => {
        try {
          const v = checkFn();
          if (v) { clearInterval(id); resolve(v); return; }
        } catch (_) {}
        if (Date.now() > deadline) { clearInterval(id); resolve(null); }
      }, POLL_MS);
    });
  }

  const waitMs = (ms) => new Promise(r => setTimeout(r, ms));

  /**
   * Simulate a real user click through the full pointer/mouse event chain.
   * `composed: true` ensures events cross any shadow-DOM boundaries.
   */
  function simulateClick(el) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    const opts = { bubbles: true, cancelable: true, composed: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown',    { ...opts, button: 0 }));
    el.dispatchEvent(new PointerEvent('pointerup',  opts));
    el.dispatchEvent(new MouseEvent('mouseup',      { ...opts, button: 0 }));
    el.dispatchEvent(new MouseEvent('click',        { ...opts, button: 0 }));
  }

  function escapeKey() {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, composed: true })
    );
  }

  // ==========================================================================
  // STEP 1 — Find and click the Save button
  // ==========================================================================
  // UPDATE SAVE_SELECTORS if the button's aria-label or wrapping element changes.
  // Confirmed HTML: <button aria-label="Save to playlist"> inside yt-button-view-model
  const SAVE_SELECTORS = [
    'button[aria-label="Save to playlist"]',         // ✓ confirmed (2025 layout)
    'yt-button-view-model button',                   // wrapper-based fallback
    'button[aria-label*="Save to"]',                 // label-prefix fallback
    'button[aria-label*="save"]',                    // case-insensitive fallback
  ];

  let saveBtn = null;
  const saveBudget = SAVE_BTN_WAIT / SAVE_SELECTORS.length;

  for (const sel of SAVE_SELECTORS) {
    L(`step1: trying "${sel}"`);
    saveBtn = await poll(() => {
      const el = document.querySelector(sel);
      return (el && el.offsetParent !== null) ? el : null;
    }, saveBudget);
    if (saveBtn) { L(`step1: ✓ found via "${sel}"`); break; }
    L(`step1: not found`);
  }

  if (!saveBtn) {
    // Dump all button labels for debugging
    const labels = Array.from(document.querySelectorAll('button[aria-label]'))
      .map(b => b.getAttribute('aria-label'))
      .filter(Boolean).slice(0, 20);
    L(`step1: ✕ not found. Buttons in DOM: [${labels.join(' | ')}]`);
    return { ok: false, reason: 'save_button_not_found', log };
  }

  L(`step1: clicking Save button…`);
  simulateClick(saveBtn);
  await waitMs(SETTLE_MS);

  // ==========================================================================
  // STEP 2 — Wait for the Save panel to appear
  // ==========================================================================
  // YouTube's new UI renders a yt-sheet-view-model containing yt-list-view-model
  // with individual yt-list-item-view-model entries (one per playlist).
  //
  // We wait until the Watch Later item specifically is in the DOM — this is the
  // most reliable signal that the panel is ready, no intermediate wait needed.
  //
  // UPDATE WL_ITEM_SEL if the aria-label prefix for Watch Later changes.
  const WL_ITEM_SEL = 'yt-list-item-view-model[aria-label*="Watch later"]';

  L(`step2: waiting for Watch Later item in panel (up to ${PANEL_WAIT}ms)…`);
  const wlItem = await poll(() => document.querySelector(WL_ITEM_SEL), PANEL_WAIT);

  if (!wlItem) {
    // Debug: what yt-list-item-view-model elements exist?
    const items = Array.from(document.querySelectorAll('yt-list-item-view-model'))
      .map(el => el.getAttribute('aria-label') || '(no label)').slice(0, 10);
    L(`step2: ✕ Watch Later item not found. Visible items: [${items.join(' | ')}]`);

    // Also check if the old Polymer panel appeared instead
    const oldPanel = document.querySelectorAll('ytd-playlist-add-to-option-renderer').length;
    if (oldPanel > 0) L(`step2: NOTE: old Polymer panel detected (${oldPanel} items) — selectors need updating`);

    escapeKey();
    return { ok: false, reason: 'panel_did_not_open', log };
  }

  L(`step2: ✓ Watch Later item found — aria-label="${wlItem.getAttribute('aria-label')}"`);

  // ==========================================================================
  // STEP 3 — Check if already saved
  // ==========================================================================
  // aria-pressed="true" means the video is already in Watch Later.
  const ariaPressed = wlItem.getAttribute('aria-pressed');
  L(`step3: Watch Later aria-pressed="${ariaPressed}"`);

  if (ariaPressed === 'true') {
    L('step3: already saved — closing panel');
    escapeKey();
    return { ok: true, reason: 'already_saved', log };
  }

  // ==========================================================================
  // STEP 4 — Click the Watch Later button
  // ==========================================================================
  // The actual clickable element is the <button> inside yt-list-item-view-model.
  // UPDATE BTN_SEL if YouTube changes the button class.
  const BTN_SEL = 'button.ytListItemViewModelButtonOrAnchor, button.ytButtonOrAnchorButton, button';

  const wlBtn = wlItem.querySelector(BTN_SEL);
  if (!wlBtn) {
    L(`step4: ✕ no button found inside Watch Later item`);
    L(`step4: item innerHTML snippet: ${wlItem.innerHTML.slice(0, 300)}`);
    escapeKey();
    return { ok: false, reason: 'watch_later_button_not_found', log };
  }

  L(`step4: clicking Watch Later button (class="${wlBtn.className.trim().split(' ')[0]}")…`);
  simulateClick(wlBtn);
  await waitMs(SETTLE_MS);

  // ==========================================================================
  // STEP 5 — Confirm the save (best-effort)
  // ==========================================================================
  // The click is reliably dispatched. YouTube fires the save network request
  // regardless of whether aria-pressed or the panel DOM update in the isolated
  // world. Poll briefly for any visual signal, but treat the click itself as
  // success if nothing is detected.
  L(`step5: polling briefly for confirmation…`);

  const confirmSignal = await poll(() => {
    // Signal A: WL item left the DOM (panel closed)
    if (!document.querySelector(WL_ITEM_SEL)) return 'panel_closed';

    // Signal B: snackbar appeared
    const sb = document.querySelector('snackbar-container');
    if (sb && sb.children.length > 0) return 'snackbar';

    // Signal C: aria-pressed flipped
    const el = document.querySelector(WL_ITEM_SEL);
    if (el && el.getAttribute('aria-pressed') === 'true') return 'aria_pressed';

    return null;
  }, CONFIRM_WAIT);

  if (confirmSignal) {
    L(`step5: ✓ confirmed via "${confirmSignal}"`);
    if (document.querySelector(WL_ITEM_SEL)) escapeKey();
    return { ok: true, reason: confirmSignal, log };
  }

  // No DOM signal detected — but the click was dispatched to the correct button
  // and saves have been proven reliable in this flow. Close the panel and
  // return success. The "click_dispatched" reason distinguishes this from a
  // fully confirmed save in the debug log.
  const finalPressed = document.querySelector(WL_ITEM_SEL)?.getAttribute('aria-pressed');
  const snackKids    = document.querySelector('snackbar-container')?.children.length ?? '?';
  L(`step5: no DOM signal (aria-pressed="${finalPressed}" snackbar-children=${snackKids}) — click was dispatched, treating as success`);
  escapeKey();
  return { ok: true, reason: 'click_dispatched', log };

})();
