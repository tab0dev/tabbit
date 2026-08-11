// Tabbit — Service Worker (background.js)
// Opens or focuses the triage tab when the extension icon is clicked.
// Also handles captureVisibleTab requests via message passing.
// Also runs the auto-closer background worker via chrome.alarms.

console.log("[Tabbit SW] ── Service worker script executing ──");

// ─── Storage keys ────────────────────────────────────────────────────────────
const SETTINGS_KEY = "tabbit_autoclose_settings";
const GRAVEYARD_KEY = "tabbit_graveyard";
const GRAVEYARD_MAX = 200;

// ─── Auto Smusher storage keys ───────────────────────────────────────────────
const SMUSH_SETTINGS_KEY = 'tabbit_autosmush_settings';
const DEFAULT_SMUSH_SETTINGS = {
  enabled: false,
  skipPinned: true,
  ignoreFragments: false,
  ignoreQueryStrings: false,
};

// In-memory smusher state (populated by initAutoSmusher on load)
let smush_enabled = false;
let smush_skipPinned = true;
let smush_ignoreFragments = false;
let smush_ignoreQueryStrings = false;
// Track tabs that have already been processed to avoid double-firing
const smush_processedTabIds = new Set();

// ─── Auto Sorter in-memory state ──────────────────────────────────────────────
let autoSort_enabled = false;
let autoSort_debounceTimer = null;

const DEFAULT_SETTINGS = {
  enabled: false,
  thresholdMs: 1000 * 60 * 60 * 24 * 7, // 7 days
  intervalMinutes: 30,
};

// ─── Triage tab tracking ─────────────────────────────────────────────────────
let triageTabId = null;
console.log("[Tabbit SW] triageTabId initialised to null (fresh SW instance)");

chrome.action.onClicked.addListener(async () => {
  console.log("[Tabbit SW] action.onClicked — triageTabId =", triageTabId);
  if (triageTabId !== null) {
    try {
      const tab = await chrome.tabs.get(triageTabId);
      await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.tabs.update(triageTabId, { active: true });
      console.log("[Tabbit SW] Focused existing triage tab", triageTabId);
      return;
    } catch {
      console.log(
        "[Tabbit SW] Stored triageTabId",
        triageTabId,
        "no longer exists — will open a new tab",
      );
      triageTabId = null;
    }
  }

  const tab = await chrome.tabs.create({
    url: chrome.runtime.getURL("index.html"),
  });
  triageTabId = tab.id;
  console.log("[Tabbit SW] Opened new triage tab, id =", triageTabId);
});

// Clear stored ID when the triage tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === triageTabId) {
    console.log("[Tabbit SW] Triage tab closed, clearing triageTabId");
    triageTabId = null;
  }
});

// Handle messages from the triage page
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "captureTab") {
    (async () => {
      const target = { tabId: msg.tabId };
      try {
        await chrome.debugger.attach(target, "1.3");
        const result = await chrome.debugger.sendCommand(
          target,
          "Page.captureScreenshot",
          { format: "jpeg", quality: 60 },
        );
        await chrome.debugger.detach(target);
        const dataUrl = `data:image/jpeg;base64,${result.data}`;
        sendResponse({ ok: true, dataUrl });
      } catch (err) {
        chrome.debugger.detach(target).catch(() => {});
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
  
  if (msg.type === 'sortTabs') {
    runTabSorter()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// ─── Auto-Closer Engine ───────────────────────────────────────────────────────

/**
 * Reads persisted settings and creates or clears the auto-close alarm.
 * Also fires an immediate runAutoClose() when enabling so the first sweep
 * is not delayed by the full intervalMinutes.
 * Called on install, startup, and whenever the settings storage key changes.
 */
async function setupAlarm() {
  console.log("[Tabbit SW] setupAlarm() called");
  try {
    const raw = await chrome.storage.local.get(SETTINGS_KEY);
    const stored = raw[SETTINGS_KEY];
    console.log(
      "[Tabbit SW] setupAlarm — raw storage value:",
      JSON.stringify(stored),
    );

    const settings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
    console.log(
      "[Tabbit SW] setupAlarm — merged settings:",
      JSON.stringify(settings),
    );

    // Always clear first to avoid duplicate alarms
    const wasCleared = await chrome.alarms.clear("tabbit-auto-close");
    console.log("[Tabbit SW] setupAlarm — previous alarm cleared?", wasCleared);

    if (!settings.enabled) {
      console.log(
        "[Tabbit SW] setupAlarm — auto-closer is DISABLED, alarm cleared, nothing to do",
      );
      return;
    }

    console.log(
      "[Tabbit SW] setupAlarm — auto-closer ENABLED, creating alarm with periodInMinutes =",
      settings.intervalMinutes,
      "| thresholdMs =",
      settings.thresholdMs,
      "(~",
      (settings.thresholdMs / 3600000).toFixed(1),
      "hours)",
    );

    chrome.alarms.create("tabbit-auto-close", {
      periodInMinutes: settings.intervalMinutes,
    });

    // Verify the alarm was actually registered
    const alarm = await chrome.alarms.get("tabbit-auto-close");
    console.log(
      "[Tabbit SW] setupAlarm — alarm after create:",
      JSON.stringify(alarm),
    );

    // Run an immediate sweep so tabs that already exceed the threshold are
    // closed right away — chrome.alarms always waits one full period before
    // the first fire, so without this the user would wait up to intervalMinutes
    // before anything happened.
    console.log(
      "[Tabbit SW] setupAlarm — kicking off immediate runAutoClose()",
    );
    await runAutoClose();
    console.log("[Tabbit SW] setupAlarm — immediate runAutoClose() complete");
  } catch (err) {
    console.error("[Tabbit SW] setupAlarm FAILED:", err);
  }
}

/**
 * The core worker. Queries all open tabs, closes any that exceed the configured
 * age threshold (excluding pinned tabs and the triage tab itself), and writes
 * tombstones to chrome.storage.session for the graveyard UI.
 */
async function runAutoClose() {
  console.log("[Tabbit SW] runAutoClose() called — triageTabId =", triageTabId);
  try {
    const raw = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = { ...DEFAULT_SETTINGS, ...(raw[SETTINGS_KEY] ?? {}) };
    console.log(
      "[Tabbit SW] runAutoClose — settings:",
      JSON.stringify(settings),
    );

    if (!settings.enabled) {
      console.warn(
        "[Tabbit SW] runAutoClose — bailing early: settings.enabled is false",
      );
      return;
    }

    const allTabs = await chrome.tabs.query({});
    const now = Date.now();
    console.log(
      "[Tabbit SW] runAutoClose — total tabs from query:",
      allTabs.length,
      "| now =",
      now,
    );

    // Log every tab's key fields so we can see exactly why each is included/excluded
    allTabs.forEach((t, i) => {
      const age =
        typeof t.lastAccessed === "number" ? now - t.lastAccessed : null;
      const ageHours = age !== null ? (age / 3600000).toFixed(2) : "N/A";
      const wouldClose =
        !t.pinned &&
        !t.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) &&
        typeof t.lastAccessed === "number" &&
        now - t.lastAccessed >= settings.thresholdMs;

      let skipReason = null;
      if (t.pinned) skipReason = "pinned";
      else if (t.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`))
        skipReason = "is this extension";
      else if (typeof t.lastAccessed !== "number")
        skipReason = `lastAccessed not a number (type=${typeof t.lastAccessed}, value=${t.lastAccessed})`;
      else if (now - t.lastAccessed < settings.thresholdMs)
        skipReason = `too young: ${ageHours}h old, threshold=${(settings.thresholdMs / 3600000).toFixed(1)}h`;

      console.log(
        `[Tabbit SW]   tab[${i}] id=${t.id} pinned=${t.pinned}`,
        `lastAccessed=${t.lastAccessed} (${ageHours}h ago)`,
        `url=${t.url?.slice(0, 60)}`,
        wouldClose ? "→ WILL CLOSE" : `→ skip (${skipReason})`,
      );
    });

    const toClose = allTabs.filter(
      (t) =>
        !t.pinned &&
        !t.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) &&
        typeof t.lastAccessed === "number" &&
        now - t.lastAccessed >= settings.thresholdMs,
    );

    console.log("[Tabbit SW] runAutoClose — tabs to close:", toClose.length);

    if (toClose.length === 0) {
      console.log(
        "[Tabbit SW] runAutoClose — nothing to close, returning early",
      );
      return;
    }

    const idsToClose = toClose.map((t) => t.id);
    console.log("[Tabbit SW] runAutoClose — closing tab ids:", idsToClose);

    await chrome.tabs.remove(idsToClose);
    console.log(
      "[Tabbit SW] runAutoClose — chrome.tabs.remove() resolved successfully",
    );

    // Build tombstones for the graveyard UI
    const tombstones = toClose.map((t, i) => ({
      id: `${now}_${i}`,
      url: t.url || "",
      title: t.title || "(Untitled)",
      favIconUrl: t.favIconUrl || "",
      closedAt: now,
    }));
    console.log(
      "[Tabbit SW] runAutoClose — tombstones built:",
      tombstones.length,
    );

    // Prepend to existing graveyard and cap at GRAVEYARD_MAX
    const stored = await chrome.storage.session.get(GRAVEYARD_KEY);
    const current = stored[GRAVEYARD_KEY] ?? [];
    console.log(
      "[Tabbit SW] runAutoClose — existing graveyard entries:",
      current.length,
    );

    const updated = [...tombstones, ...current].slice(0, GRAVEYARD_MAX);
    await chrome.storage.session.set({ [GRAVEYARD_KEY]: updated });
    console.log(
      "[Tabbit SW] runAutoClose — graveyard updated, total entries now:",
      updated.length,
    );
  } catch (err) {
    console.error("[Tabbit SW] runAutoClose FAILED:", err);
  }
}

// ─── Auto-Closer Event Listeners ─────────────────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Tabbit SW] runtime.onInstalled — reason:", details.reason);
  setupAlarm();
  warmupAiModel();
  initAutoSmusher();
  initAutoSorter();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'tabbit-sort-tabs-title',
      title: 'Sort all tabs by title',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'tabbit-sort-tabs-url',
      title: 'Sort all tabs by URL',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'tabbit-smush-duplicates',
      title: 'Smush duplicate tabs',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'tabbit-merge-windows',
      title: 'Merge all tabs into one window',
      contexts: ['action']
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[Tabbit SW] runtime.onStartup fired");
  setupAlarm();
  warmupAiModel();
  initAutoSmusher();
  initAutoSorter();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  console.log(
    "[Tabbit SW] alarms.onAlarm fired — name:",
    alarm.name,
    "| scheduledTime:",
    alarm.scheduledTime,
  );
  if (alarm.name === "tabbit-auto-close") {
    runAutoClose();
  }
  // Safety-net catch-up sort — re-reads settings fresh from storage each fire
  if (alarm.name === 'tabbit-auto-sort-keepalive') {
    chrome.storage.local.get(TAB_SORTER_SETTINGS_KEY).then((raw) => {
      if (raw[TAB_SORTER_SETTINGS_KEY]?.autoSortEnabled) {
        runTabSorter().catch((err) => console.warn('[AutoSorter] keepalive sort error:', err));
      }
    });
  }
  // wl-keepalive: no-op — the alarm firing itself resets the SW idle timer
});

// Re-arm automatically whenever the React page saves new settings.
// This is the only "coordination" needed — no message passing required.
chrome.storage.onChanged.addListener((changes, area) => {
  console.log(
    "[Tabbit SW] storage.onChanged — area:",
    area,
    "| keys changed:",
    Object.keys(changes).join(", "),
  );

  if (area === "local" && SETTINGS_KEY in changes) {
    const { oldValue, newValue } = changes[SETTINGS_KEY];
    console.log("[Tabbit SW] storage.onChanged — settings key changed");
    console.log("[Tabbit SW]   oldValue:", JSON.stringify(oldValue));
    console.log("[Tabbit SW]   newValue:", JSON.stringify(newValue));
    setupAlarm();
  }

  // Auto Smusher — update in-memory flags when React saves settings
  if (area === "local" && SMUSH_SETTINGS_KEY in changes) {
    const next = { ...DEFAULT_SMUSH_SETTINGS, ...(changes[SMUSH_SETTINGS_KEY].newValue ?? {}) };
    smush_enabled = next.enabled;
    smush_skipPinned = next.skipPinned;
    smush_ignoreFragments = next.ignoreFragments;
    smush_ignoreQueryStrings = next.ignoreQueryStrings;
    console.log('[Tabbit SW] Auto Smusher settings updated:', JSON.stringify(next));
    // Hide manual smush menu item when the daemon is running
    setSmushMenuVisibility(!smush_enabled);
  }

  // Auto Sorter — re-run full keepalive setup whenever settings change.
  // setupSortKeepalive() reads from storage, syncs menu visibility, and
  // creates/clears the alarm — no in-memory flag needed here.
  if (area === "local" && TAB_SORTER_SETTINGS_KEY in changes) {
    setupSortKeepalive();
  }
});

// ─── AI Model Pre-download ──────────────────────────────────────────────────

/**
 * Eagerly trigger the Gemini Nano model download so it's ready before the
 * user opens the Auto Tab Group wizard. This runs on browser startup and
 * extension install. Chrome manages the download — no user prompt needed.
 * Fully non-fatal: logs status and silently bails if the API is unavailable.
 */
async function warmupAiModel() {
  console.log("[Tabbit SW] warmupAiModel() called");
  try {
    if (typeof LanguageModel === "undefined") {
      console.log("[Tabbit SW] LanguageModel API not available in this Chrome version");
      return;
    }

    const status = await LanguageModel.availability();
    console.log("[Tabbit SW] AI model status:", status);

    if (status === "available") {
      console.log("[Tabbit SW] AI model already downloaded and ready");
      return;
    }

    if (status === "unavailable") {
      console.log("[Tabbit SW] AI model unavailable on this device (hw/os requirements not met)");
      return;
    }

    // status is "downloadable" or "downloading" — trigger the download
    console.log("[Tabbit SW] Triggering AI model download...");
    const session = await LanguageModel.create({
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          console.log(`[Tabbit SW] AI model download: ${(e.loaded * 100).toFixed(1)}%`);
        });
      },
    });
    session.destroy(); // release memory, model stays cached by Chrome
    console.log("[Tabbit SW] AI model download complete");
  } catch (err) {
    console.warn("[Tabbit SW] warmupAiModel failed (non-fatal):", err.message);
  }
}

console.log("[Tabbit SW] ── All event listeners registered ──");
/**
 * Smush Duplicates: Finds all tabs with the exact same URL and closes all but one.
 * Prioritizes keeping pinned tabs and tabs with lower indices (usually older).
 */
async function runSmushDuplicates() {
  console.log('[Tabbit SW] runSmushDuplicates() called');
  try {
    const allTabs = await chrome.tabs.query({});
    const groups = smushBuildGroups(allTabs);
    const toClose = [];

    for (const tabs of groups.values()) {
      // Keep tabs[0] (first/oldest); close the rest
      for (let i = 1; i < tabs.length; i++) toClose.push(tabs[i].id);
    }

    if (toClose.length > 0) {
      console.log(`[Tabbit SW] Smushing ${toClose.length} duplicate tabs`);
      await chrome.tabs.remove(toClose);
    } else {
      console.log('[Tabbit SW] No duplicate tabs found to smush');
    }
  } catch (err) {
    console.error('[Tabbit SW] runSmushDuplicates FAILED:', err);
  }
}

// ─── Tab Sorter Engine ────────────────────────────────────────────────────────

const TAB_SORTER_SETTINGS_KEY = 'tabbit_tabsorter_settings';
const DEFAULT_SORTER_SETTINGS = {
  sortBy: 'url', // 'url' or 'title'
  groupSuspendedTabs: false,
  tabSuspenderExtensionId: 'bbomjaikkcabgmfaomdichgcodnaeecf',
  sortPinnedTabs: false,
  autoSortEnabled: false,
};

// Return whether tab is currently suspended
function isSuspended(tab, extensionId) {
    const prefix = 'chrome-extension://' + extensionId + '/suspended.html#';
    return tab.url.startsWith(prefix);
}

// Returns the tab's URL (or original URL if suspended and 'groupSuspendedTabs' is false)
function tabToUrl(tab, groupSuspendedTabs, extensionId) {
    if (groupSuspendedTabs) {
        return new URL(tab.url);
    } else {
        const prefix = 'chrome-extension://' + extensionId + '/suspended.html#';
        const suspendedSuffix = tab.url.slice(prefix.length);
        if (tab.url.startsWith(prefix) && suspendedSuffix) {
            var params = new URLSearchParams(suspendedSuffix);
            for (let [param, val] of params) {
                if (param === 'uri') {
                    return new URL(val);
                }
            }
        }
        return new URL(tab.pendingUrl || tab.url);
    }
}

// Compare URLs ignoring protocol and leading 'www.'
function compareByUrlComponents(urlA, urlB) {
    var keyA = urlA.hostname.replace(/^www\./i, "") + urlA.pathname + urlA.search + urlA.hash;
    var keyB = urlB.hostname.replace(/^www\./i, "") + urlB.pathname + urlB.search + urlB.hash;
    return keyA.localeCompare(keyB);
}

async function runTabSorter(forceSortMode = null) {
    let result = await chrome.storage.local.get(TAB_SORTER_SETTINGS_KEY);
    let settings = { ...DEFAULT_SORTER_SETTINGS, ...(result[TAB_SORTER_SETTINGS_KEY] ?? {}) };

    if (forceSortMode) {
        settings.sortBy = forceSortMode;
    }

    let currentWindow = await chrome.windows.getLastFocused();

    let pinnedTabs = await chrome.tabs.query({
        windowId: currentWindow.id,
        pinned: true,
        currentWindow: true,
    });
    var groupOffset = pinnedTabs.length;

    if (pinnedTabs.length > 0 && settings.sortPinnedTabs) {
        sortTabsList(pinnedTabs, pinnedTabs[0].groupId, settings, 'pinned tabs');
    }

    let tabGroups = await chrome.tabGroups.query({ windowId: currentWindow.id });
    tabGroups.sort(function (a, b) {
        return b.title.localeCompare(a.title);
    });

    for (let i = 0; i < tabGroups.length; i++) {
        let group = tabGroups[i];
        chrome.tabGroups.move(group.id, { index: groupOffset });
        let tabs = await chrome.tabs.query({ windowId: currentWindow.id, groupId: group.id });
        groupOffset += tabs.length;
        const groupLabel = group.title ? `'${group.title}' tab group (id ${group.id})` : `unnamed tab group (id ${group.id})`;
        sortTabsList(tabs, group.id, settings, groupLabel);
    }

    let ungroupedTabs = await chrome.tabs.query({ windowId: currentWindow.id, pinned: false, groupId: -1 });
    sortTabsList(ungroupedTabs, -1, settings, 'ungrouped tabs');
}

function sortTabsList(tabs, groupId, settings, label = `group id ${groupId}`) {
    if (tabs.length === 0) return;

    let firstTabIndex = tabs[0].index;

    console.log(`[TabSorter] Before sort — ${label}:`, tabs.map(t => ({ id: t.id, title: t.title, url: t.url, pinned: t.pinned })));

    tabs.sort(function (a, b) {
        if (!settings.sortPinnedTabs && (a.pinned || b.pinned)) {
            return 0;
        }

        if (settings.groupSuspendedTabs) {
            let aSusp = isSuspended(a, settings.tabSuspenderExtensionId);
            let bSusp = isSuspended(b, settings.tabSuspenderExtensionId);
            if (aSusp && !bSusp) return -1;
            if (!aSusp && bSusp) return 1;
        }

        if (settings.sortBy == "title") {
            return a.title.localeCompare(b.title);
        } else {
            var urlA = tabToUrl(a, settings.groupSuspendedTabs, settings.tabSuspenderExtensionId);
            var urlB = tabToUrl(b, settings.groupSuspendedTabs, settings.tabSuspenderExtensionId);
            return compareByUrlComponents(urlA, urlB);
        }
    });

    console.log(`[TabSorter] After sort — ${label}:`, tabs.map(t => ({ id: t.id, title: t.title, url: t.url, pinned: t.pinned })));

    const tabIds = tabs.map(tab => tab.id);
    chrome.tabs.move(tabIds, { index: firstTabIndex });
    if (groupId > -1) {
        chrome.tabs.group({ groupId: groupId, tabIds: tabIds });
    }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'tabbit-sort-tabs-title') {
    runTabSorter('title');
  } else if (info.menuItemId === 'tabbit-sort-tabs-url') {
    runTabSorter('url');
  } else if (info.menuItemId === 'tabbit-sort-tabs') {
    runTabSorter();
  } else if (info.menuItemId === 'tabbit-smush-duplicates') {
    runSmushDuplicates();
  } else if (info.menuItemId === 'tabbit-merge-windows') {
    runMergeWindows();
  }
});

/**
 * Merge all tabs into one window.
 * Moves every tab from every other window into the most recently focused
 * non-extension window, then focuses that window.
 */
async function runMergeWindows() {
  console.log('[Tabbit SW] runMergeWindows() called');
  try {
    // Get the focused window to use as the target.
    const targetWindow = await chrome.windows.getLastFocused({ populate: false });
    const targetWindowId = targetWindow.id;

    // Query all tabs across all windows.
    const allTabs = await chrome.tabs.query({});

    // Collect tabs that belong to OTHER windows, preserving document order.
    const tabsToMove = allTabs
      .filter(t => t.windowId !== targetWindowId)
      .sort((a, b) => a.index - b.index);

    if (tabsToMove.length === 0) {
      console.log('[Tabbit SW] runMergeWindows — all tabs already in one window, nothing to do');
      return;
    }

    const tabIds = tabsToMove.map(t => t.id);
    console.log(`[Tabbit SW] runMergeWindows — moving ${tabIds.length} tabs into window ${targetWindowId}`);

    // Move all foreign tabs to the end of the target window.
    await chrome.tabs.move(tabIds, { windowId: targetWindowId, index: -1 });

    // Focus the target window.
    await chrome.windows.update(targetWindowId, { focused: true });

    console.log('[Tabbit SW] runMergeWindows — done');
  } catch (err) {
    console.error('[Tabbit SW] runMergeWindows FAILED:', err);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Auto Tab Grouper Daemon
───────────────────────────────────────────────────────────────────────────── */

function sanitizeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateMatcherRegex(matcher, isRegex, matchType = null) {
  if (!matcher) return null;
  const type = matchType || (isRegex ? 'regex' : 'pattern');
  if (type === 'simple') {
    let cleaned = matcher.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    matcher = `*://*.${cleaned}/*`;
  }
  if (type === 'regex' || isRegex) {
    try {
      if (matcher.startsWith('/') && matcher.lastIndexOf('/') > 0) {
        const lastSlash = matcher.lastIndexOf('/');
        const flags = matcher.substring(lastSlash + 1);
        const pattern = matcher.substring(1, lastSlash);
        return new RegExp(pattern, flags);
      }
      return new RegExp(matcher);
    } catch (e) {
      return null;
    }
  }
  if (matcher === '*') return /^.*$/i;
  const splitPattern = matcher.split("://");
  let scheme = splitPattern[0];
  let rest = splitPattern.slice(1).join("://");
  if (!rest) { rest = scheme; scheme = "*"; }
  let schemePattern = scheme === "*" ? "https?" : sanitizeRegex(scheme);
  const pathIdx = rest.indexOf("/");
  let host = pathIdx > -1 ? rest.substring(0, pathIdx) : rest;
  let path = pathIdx > -1 ? rest.substring(pathIdx) : "/*";
  let hostPattern;
  if (host === "*") hostPattern = "[^/]+";
  else if (host.startsWith("*.")) hostPattern = "(?:[^/]+\\.)?" + sanitizeRegex(host.slice(2));
  else hostPattern = sanitizeRegex(host);
  if (!/:[0-9]+$/.test(host)) hostPattern += "(?::[0-9]+)?";
  let pathPattern;
  if (path === "/*") pathPattern = "(?:/.*)?";
  else pathPattern = path.split('*').map(sanitizeRegex).join('.*');
  try { return new RegExp(`^${schemePattern}://${hostPattern}${pathPattern}$`, 'i'); }
  catch (e) { return null; }
}

function evaluateRoughMatch(pattern, tab) {
  if (!pattern || pattern.type !== 'rough') return false;
  
  const { target, method, value } = pattern;
  if (!value) return false;
  
  let subject = '';
  if (target === 'hostname' || target === 'href') {
    if (!tab.url) return false;
    try {
      const urlObj = new URL(tab.url);
      subject = target === 'hostname' ? urlObj.hostname : urlObj.href;
    } catch { return false; }
  } else if (target === 'title' || target === 'title_ignorecase') {
    subject = tab.title || '';
  }

  let checkVal = value || '';
  let subj = subject;
  if (target === 'title_ignorecase') {
    subj = subject.toLowerCase();
    checkVal = checkVal.toLowerCase();
  }

  switch (method) {
    case 'includes': return subj.includes(checkVal);
    case 'startsWith': return subj.startsWith(checkVal);
    case 'endsWith': return subj.endsWith(checkVal);
    case 'equals': return subj === checkVal;
    default: return false;
  }
}

/* ─── Suspended tab URL decoder ─────────────────────────────────────────────
   Mirrors the logic in triageLoader.js. Most tab suspenders (Tiny Suspender,
   The Marvellous Suspender, etc.) encode the original URL in the ?url= query
   param of their chrome-extension:// suspension page.
──────────────────────────────────────────────────────────────────────────── */
function decodeSuspendedUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const realUrl = u.searchParams.get('url');
    if (realUrl) return decodeURIComponent(realUrl);
  } catch { /* ignore */ }
  return null;
}

/**
 * Returns the effective URL for matching and whether the tab is suspended.
 * For suspended tabs the real URL is decoded from the suspender's query param;
 * for regular tabs it's just tab.url / tab.pendingUrl.
 */
function getTabRealUrl(tab) {
  const raw = tab.url || tab.pendingUrl || '';
  if (raw.startsWith('chrome-extension://')) {
    const decoded = decodeSuspendedUrl(raw);
    if (decoded) return { realUrl: decoded, isSuspended: true };
  }
  return { realUrl: raw, isSuspended: false };
}

const AG_SETTINGS_KEY = "tabbit_autogrouper_settings";
const AG_RULES_KEY = "tabbit_autogrouper_rules";
// Mirrors TabProcessingProvider's chrome.storage.local write so the SW
// can honour the user's "Exclude Suspended Tabs" preference.
const AG_SUSPEND_STORAGE_KEY = "tabbit_excludeSuspendedTabs_remote";

let ag_enabled = false;
let ag_rules = [];
let ag_compiledRules = [];
let ag_excludeSuspended = false;

// Track inflight group creations to avoid race conditions: "windowId_ruleId" -> Promise
const groupCreationTracker = new Map();

async function initAutoGrouper() {
  const data = await chrome.storage.local.get([AG_SETTINGS_KEY, AG_RULES_KEY, AG_SUSPEND_STORAGE_KEY]);
  ag_enabled = data[AG_SETTINGS_KEY]?.enabled || false;
  ag_rules = data[AG_RULES_KEY] || [];
  ag_excludeSuspended = data[AG_SUSPEND_STORAGE_KEY] ?? false;
  compileRules();
}

function compileRules() {
  ag_compiledRules = ag_rules.map(r => {
    // Migrate old format to new format on the fly if needed
    const patterns = r.patterns || [{ value: r.pattern, isRegex: r.isRegex }];
    const regexPatterns = patterns.filter(p => p.type !== 'rough');
    const roughPatterns = patterns.filter(p => p.type === 'rough');
    return {
      ...r,
      patterns: patterns,
      compiledRegexes: regexPatterns.map(p => generateMatcherRegex(p.value, p.isRegex, p.type)).filter(Boolean),
      roughMatchers: roughPatterns
    };
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    let changed = false;
    if (changes[AG_SETTINGS_KEY]) {
      ag_enabled = changes[AG_SETTINGS_KEY].newValue?.enabled || false;
      changed = true;
    }
    if (changes[AG_RULES_KEY]) {
      ag_rules = changes[AG_RULES_KEY].newValue || [];
      compileRules();
      changed = true;
    }
    if (changes[AG_SUSPEND_STORAGE_KEY]) {
      ag_excludeSuspended = changes[AG_SUSPEND_STORAGE_KEY].newValue ?? false;
    }
    
    // If rules changed and we're enabled, sweep all tabs
    if (changed && ag_enabled) {
      sweepAllTabs();
    }
  }
});

async function sweepAllTabs() {
  console.log(`[AutoGrouperWorker] sweepAllTabs called. ag_enabled: ${ag_enabled}`);
  if (!ag_enabled) return;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    await processTab(tab);
  }
}

async function processTab(tab) {
  const tabId = tab.id;
  // Decode the real URL for matching — suspended tabs have a chrome-extension://
  // URL that would never match the user's rules without decoding.
  const { realUrl: url, isSuspended } = getTabRealUrl(tab);
  const windowId = tab.windowId;
  const currentGroupId = tab.groupId;

  console.log(`[AutoGrouperWorker] processTab called for tabId: ${tabId}, url: ${url}, suspended: ${isSuspended}, currentGroupId: ${currentGroupId}`);
  console.log(`[AutoGrouperWorker] ag_enabled is: ${ag_enabled}`);
  
  if (!ag_enabled || !url) return;

  // Skip suspended tabs when the user has opted out of including them.
  if (isSuspended && ag_excludeSuspended) {
    console.log(`[AutoGrouperWorker] Skipping suspended tab ${tabId} (excludeSuspended=true)`);
    return;
  }
  
  // Find matching rule — url is already the decoded real URL, so regex patterns
  // like *://*.github.com/* will correctly match suspended github tabs.
  let matchedRule = null;
  for (const rule of ag_compiledRules) {
    let isMatch = rule.compiledRegexes && rule.compiledRegexes.some(regex => regex.test(url));
    if (!isMatch && rule.roughMatchers && rule.roughMatchers.length > 0) {
      // For rough matching pass a tab-like object with the decoded URL so
      // hostname/href targets resolve correctly for suspended tabs.
      const tabForMatch = isSuspended ? { ...tab, url } : tab;
      isMatch = rule.roughMatchers.some(p => evaluateRoughMatch(p, tabForMatch));
    }
    if (isMatch) {
      matchedRule = rule;
      break;
    }
  }

  console.log(`[AutoGrouperWorker] matchedRule:`, matchedRule);

  // If tab is in a group but no longer matches a rule, and the group belongs to a STRICT rule...
  if (!matchedRule && currentGroupId > 0) {
    console.log(`[AutoGrouperWorker] No match found, but tab is in group ${currentGroupId}. Checking strict mode.`);
    try {
      const group = await chrome.tabGroups.get(currentGroupId);
      const groupRule = ag_rules.find(r => r.groupName === group.title && r.groupColor === group.color);
      if (groupRule && groupRule.strict) {
        console.log(`[AutoGrouperWorker] Strict mode active, ungrouping tab ${tabId}.`);
        await chrome.tabs.ungroup(tabId);
      }
    } catch (e) {
      // Group might not exist anymore
    }
    return;
  }

  // If we found a matching rule, ensure it's in the correct group
  if (matchedRule) {
    const ruleId = matchedRule.id;
    const title = matchedRule.groupName;
    const color = matchedRule.groupColor;
    
    // Check if it's already in the *right* group
    if (currentGroupId > 0) {
      try {
        const group = await chrome.tabGroups.get(currentGroupId);
        if (group.title === title && group.color === color) {
            console.log(`[AutoGrouperWorker] Tab is already in the correct group (${currentGroupId}).`);
            // Already in right group.
            return;
        }
      } catch (e) {}
    }

    console.log(`[AutoGrouperWorker] Tab needs to be grouped. Rule: ${title} (${color}). Merge: ${matchedRule.merge}`);

    // Need to group the tab
    const trackerKey = matchedRule.merge ? `merged_${ruleId}` : `${windowId}_${ruleId}`;

    // Wait for any in-flight group creation for this rule
    if (groupCreationTracker.has(trackerKey)) {
        try {
            const existingGroupId = await groupCreationTracker.get(trackerKey);
            await chrome.tabs.group({ tabIds: [tabId], groupId: existingGroupId });
            return;
        } catch (e) {}
    }

    // Start a new group creation promise
    const groupPromise = (async () => {
        // Query existing groups
        const queryParams = { title, color };
        if (!matchedRule.merge) {
            queryParams.windowId = windowId;
        }
        
        const existingGroups = await chrome.tabGroups.query(queryParams);
        let targetGroupId;

        if (existingGroups.length > 0) {
            targetGroupId = existingGroups[0].id;
            await chrome.tabs.group({ tabIds: [tabId], groupId: targetGroupId });
        } else {
            // Create new group
            // We group it into the tab's current window even if merge is true, 
            // since this will be the first group.
            targetGroupId = await chrome.tabs.group({ tabIds: [tabId], createProperties: { windowId } });
            await chrome.tabGroups.update(targetGroupId, { title, color });
        }
        return targetGroupId;
    })();

    groupCreationTracker.set(trackerKey, groupPromise);
    try {
        await groupPromise;
    } finally {
        // Clean up the tracker after a short delay to batch any immediate concurrent navigations
        setTimeout(() => {
            if (groupCreationTracker.get(trackerKey) === groupPromise) {
                groupCreationTracker.delete(trackerKey);
            }
        }, 100);
    }
  }
}

chrome.tabs.onCreated.addListener((tab) => {
  console.log(`[AutoGrouperWorker] tabs.onCreated fired for tabId: ${tab.id}, url: ${tab.url || tab.pendingUrl}`);
  const url = tab.url || tab.pendingUrl;
  if (url && url !== "chrome://newtab/") {
    processTab(tab);
  }
  // Auto Smusher — check for duplicates on new tab open
  smushNewTab(tab);
  // Auto Sorter — re-sort on new tab
  runAutoSort();
});

// Initialize on load
initAutoGrouper();

/* ─────────────────────────────────────────────────────────────────────────────
   Auto Smusher Daemon
   Listens for newly created or navigated tabs and closes duplicates in real
   time, refocusing the user on the original copy.
───────────────────────────────────────────────────────────────────────────── */

/**
 * Reads persisted Auto Smusher settings and populates in-memory flags.
 * Called on install, startup, and when storage changes.
 */
async function initAutoSmusher() {
  console.log('[Tabbit SW] initAutoSmusher() called');
  try {
    const raw = await chrome.storage.local.get(SMUSH_SETTINGS_KEY);
    const settings = { ...DEFAULT_SMUSH_SETTINGS, ...(raw[SMUSH_SETTINGS_KEY] ?? {}) };
    smush_enabled = settings.enabled;
    smush_skipPinned = settings.skipPinned;
    smush_ignoreFragments = settings.ignoreFragments;
    smush_ignoreQueryStrings = settings.ignoreQueryStrings;
    console.log('[Tabbit SW] initAutoSmusher — settings loaded:', JSON.stringify(settings));
    // Sync menu visibility with persisted state on startup
    setSmushMenuVisibility(!smush_enabled);
  } catch (err) {
    console.error('[Tabbit SW] initAutoSmusher FAILED:', err);
  }
}

/**
 * Shows or hides the manual "Smush duplicate tabs" context menu item.
 * Hidden when the Auto Smusher daemon is running — a manual smush would
 * be immediately re-applied by the daemon on the next tab event anyway.
 */
function setSmushMenuVisibility(visible) {
  chrome.contextMenus.update('tabbit-smush-duplicates', { visible }).catch(() => {});
}

/**
 * Builds a Map<normUrl, tab[]> from a list of tabs, applying the current
 * in-memory smusher settings (skipPinned, ignoreFragments, ignoreQueryStrings)
 * and suspended-tab URL decoding. Only groups with 2+ tabs are included.
 * Shared by both runSmushDuplicates() and smushNewTab().
 */
function smushBuildGroups(tabs) {
  const map = new Map();
  for (const tab of tabs) {
    const rawUrl = tab.url || tab.pendingUrl || '';
    if (!rawUrl || rawUrl.startsWith('chrome://')) continue;
    if (smush_skipPinned && tab.pinned) continue;
    const key = smushNormaliseUrl(rawUrl);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(tab);
  }
  // Discard groups with only one tab (no duplicate)
  for (const [key, tabs] of map) {
    if (tabs.length < 2) map.delete(key);
  }
  return map;
}

/**
 * Normalises a URL for duplicate comparison according to user settings.
 * Strips hash and/or query string when the relevant flags are enabled.
 * Decodes suspended-tab real URLs encoded in ?url= query params.
 */
function smushNormaliseUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const realUrlParam = u.searchParams.get('url');
    const base = realUrlParam ? new URL(decodeURIComponent(realUrlParam)) : u;
    let href = base.origin + base.pathname;
    if (!smush_ignoreQueryStrings) href += base.search;
    if (!smush_ignoreFragments)   href += base.hash;
    return href;
  } catch {
    return rawUrl;
  }
}

/**
 * Called whenever a tab is created. If the smusher is enabled and another tab
 * with the same normalised URL already exists, closes the new tab and focuses
 * the original.
 */
async function smushNewTab(tab) {
  if (!smush_enabled) return;

  const rawUrl = tab.url || tab.pendingUrl || '';
  if (!rawUrl || rawUrl === 'chrome://newtab/' || rawUrl.startsWith('chrome://')) return;

  // Avoid double-processing the same tab across onCreated + onUpdated
  if (smush_processedTabIds.has(tab.id)) return;

  const normUrl = smushNormaliseUrl(rawUrl);
  if (smush_skipPinned && tab.pinned) return;
  console.log(`[AutoSmusher] smushNewTab — tabId: ${tab.id}, normUrl: ${normUrl}`);

  try {
    const allTabs = await chrome.tabs.query({});
    // Find an existing tab with the same normalised URL that is NOT this new tab
    const original = allTabs.find(t => {
      if (t.id === tab.id) return false;
      if (smush_skipPinned && t.pinned) return false;
      return smushNormaliseUrl(t.url || t.pendingUrl || '') === normUrl;
    });

    if (!original) {
      console.log(`[AutoSmusher] No duplicate found for tabId ${tab.id}`);
      return;
    }

    console.log(`[AutoSmusher] Duplicate detected — closing tabId ${tab.id}, focusing original tabId ${original.id}`);
    smush_processedTabIds.add(tab.id);

    // Close the newly opened duplicate
    await chrome.tabs.remove(tab.id);

    // Focus the original tab's window then the tab itself
    await chrome.windows.update(original.windowId, { focused: true });
    await chrome.tabs.update(original.id, { active: true });

    console.log(`[AutoSmusher] Done — refocused original tabId ${original.id}`);
  } catch (err) {
    console.warn('[Tabbit SW] smushNewTab error (non-fatal):', err.message);
    smush_processedTabIds.delete(tab.id);
  } finally {
    // Clean up the tracking set after a short delay
    setTimeout(() => smush_processedTabIds.delete(tab.id), 2000);
  }
}

// Also intercept the pendingUrl → url transition so tabs opened via address bar
// (which often start with an empty url at onCreated) are caught on first navigation.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Auto Grouper handling (existing)
  console.log(`[AutoGrouperWorker] tabs.onUpdated fired for tabId: ${tabId}, changeInfo:`, changeInfo);
  if (changeInfo.url || changeInfo.title) {
    processTab(tab);
  }
  // Auto Smusher — catch the first real URL assignment (pendingUrl → url)
  if (changeInfo.url && !smush_processedTabIds.has(tabId)) {
    smushNewTab(tab);
  }
  // Auto Sorter — re-sort when a tab navigates to a new URL
  if (changeInfo.url) {
    runAutoSort();
  }
});

// Auto Sorter — re-sort when a user manually drags a tab to a new position
chrome.tabs.onMoved.addListener(() => runAutoSort());

// Auto Sorter — re-sort when a tab is dragged in from another window
chrome.tabs.onAttached.addListener(() => runAutoSort());

/* ─────────────────────────────────────────────────────────────────────────────
   Auto Sorter Daemon
   Re-sorts tabs in the focused window after every tab-creation or navigation
   event, using the existing runTabSorter() engine.

   Reliability architecture (three layers):
   1. runAutoSort() reads autoSortEnabled from storage on every call — the
      in-memory flag is never trusted, so SW suspension never breaks sorting.
   2. chrome.idle.onStateChanged fires a catch-up sort the moment the user
      returns to Chrome after a period of inactivity.
   3. A silent 1-min chrome.alarms keepalive acts as a belt-and-suspenders
      safety net for any edge case not caught by the above two.
───────────────────────────────────────────────────────────────────────────── */

/**
 * Shows or hides the two manual sort context menu items.
 * Hidden when the Auto Sorter daemon is running (they'd be immediately undone);
 * restored when the daemon is disabled.
 */
function setSortMenuVisibility(visible) {
  chrome.contextMenus.update('tabbit-sort-tabs-title', { visible }).catch(() => {});
  chrome.contextMenus.update('tabbit-sort-tabs-url',   { visible }).catch(() => {});
}

/**
 * Reads persisted Auto Sorter settings, syncs menu visibility, and manages
 * the 'tabbit-auto-sort-keepalive' alarm lifecycle.
 * Called on install, startup, and whenever TAB_SORTER_SETTINGS_KEY changes.
 */
async function setupSortKeepalive() {
  console.log('[Tabbit SW] setupSortKeepalive() called');
  try {
    const raw = await chrome.storage.local.get(TAB_SORTER_SETTINGS_KEY);
    const settings = { ...DEFAULT_SORTER_SETTINGS, ...(raw[TAB_SORTER_SETTINGS_KEY] ?? {}) };
    const enabled = settings.autoSortEnabled ?? false;
    console.log('[Tabbit SW] setupSortKeepalive — autoSortEnabled:', enabled);

    // Sync context menu visibility
    setSortMenuVisibility(!enabled);

    // Always clear first to avoid duplicate alarms
    await chrome.alarms.clear('tabbit-auto-sort-keepalive');

    if (!enabled) return;

    // Create the silent 1-min safety-net keepalive (Chrome minimum)
    chrome.alarms.create('tabbit-auto-sort-keepalive', { periodInMinutes: 1 });

    // Immediate catch-up sort so tabs sort the moment the user enables
    await runTabSorter();
  } catch (err) {
    console.error('[Tabbit SW] setupSortKeepalive FAILED:', err);
  }
}

// Back-compat alias — onInstalled and onStartup call initAutoSorter()
function initAutoSorter() { return setupSortKeepalive(); }

/**
 * Debounced sort trigger. Reads autoSortEnabled from storage on every call
 * so the check is always correct even after the SW was suspended and the
 * in-memory autoSort_enabled flag was reset to false.
 *
 * Multiple rapid tab events (e.g., session restore) collapse into a single
 * runTabSorter() call after 500 ms of quiet.
 */
async function runAutoSort() {
  const raw = await chrome.storage.local.get(TAB_SORTER_SETTINGS_KEY);
  if (!raw[TAB_SORTER_SETTINGS_KEY]?.autoSortEnabled) return;
  if (autoSort_debounceTimer) clearTimeout(autoSort_debounceTimer);
  autoSort_debounceTimer = setTimeout(() => {
    autoSort_debounceTimer = null;
    console.log('[AutoSorter] Running debounced sort');
    runTabSorter().catch((err) => console.warn('[AutoSorter] runTabSorter error:', err));
  }, 500);
}

// ─── chrome.idle: catch-up sort when the user returns after inactivity ────────
// 60s of no mouse/keyboard input transitions the state to "idle".
// When the user returns ("active"), we run a catch-up sort in case any tab
// events were missed while the SW was suspended.
chrome.idle.setDetectionInterval(60);

chrome.idle.onStateChanged.addListener((newState) => {
  console.log('[AutoSorter] idle state changed to:', newState);
  if (newState !== 'active') return;
  chrome.storage.local.get(TAB_SORTER_SETTINGS_KEY).then((raw) => {
    if (raw[TAB_SORTER_SETTINGS_KEY]?.autoSortEnabled) {
      console.log('[AutoSorter] idle→active catch-up sort triggered');
      runTabSorter().catch((err) => console.warn('[AutoSorter] idle catch-up error:', err));
    }
  });
});
