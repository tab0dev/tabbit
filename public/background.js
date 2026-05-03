// Tabbit — Service Worker (background.js)
// Opens or focuses the triage tab when the extension icon is clicked.
// Also handles captureVisibleTab requests via message passing.
// Also runs the auto-closer background worker via chrome.alarms.

console.log("[Tabbit SW] ── Service worker script executing ──");

// ─── Storage keys ────────────────────────────────────────────────────────────
const SETTINGS_KEY = "tabbit_autoclose_settings";
const GRAVEYARD_KEY = "tabbit_graveyard";
const GRAVEYARD_MAX = 200;

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
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[Tabbit SW] runtime.onStartup fired");
  setupAlarm();
  warmupAiModel();
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
  console.log("[Tabbit SW] runSmushDuplicates() called");
  try {
    const allTabs = await chrome.tabs.query({});
    const urlMap = new Map();
    const toClose = [];

    for (const tab of allTabs) {
      if (!tab.url) continue;

      if (urlMap.has(tab.url)) {
        const existingTab = urlMap.get(tab.url);
        // If we already have this URL, but the current tab is pinned and the 
        // existing one is not, we swap them to keep the pinned one.
        if (tab.pinned && !existingTab.pinned) {
          toClose.push(existingTab.id);
          urlMap.set(tab.url, tab);
        } else {
          toClose.push(tab.id);
        }
      } else {
        urlMap.set(tab.url, tab);
      }
    }

    if (toClose.length > 0) {
      console.log(`[Tabbit SW] Smushing ${toClose.length} duplicate tabs`);
      await chrome.tabs.remove(toClose);
    } else {
      console.log("[Tabbit SW] No duplicate tabs found to smush");
    }
  } catch (err) {
    console.error("[Tabbit SW] runSmushDuplicates FAILED:", err);
  }
}

// ─── Tab Sorter Engine ────────────────────────────────────────────────────────

const TAB_SORTER_SETTINGS_KEY = 'tabbit_tabsorter_settings';
const DEFAULT_SORTER_SETTINGS = {
  sortBy: "url", // "url" or "title"
  groupSuspendedTabs: false,
  tabSuspenderExtensionId: "bbomjaikkcabgmfaomdichgcodnaeecf",
  sortPinnedTabs: false
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
        sortTabsList(pinnedTabs, pinnedTabs[0].groupId, settings);
    }

    let tabGroups = await chrome.tabGroups.query({ windowId: currentWindow.id });
    tabGroups.sort(function (a, b) {
        return b.title.localeCompare(a.title);
    });

    for (let i = 0; i < tabGroups.length; i++) {
        let groupId = tabGroups[i].id;
        chrome.tabGroups.move(groupId, { index: groupOffset });
        let tabs = await chrome.tabs.query({ windowId: currentWindow.id, groupId: groupId });
        groupOffset += tabs.length;
        sortTabsList(tabs, groupId, settings);
    }

    let ungroupedTabs = await chrome.tabs.query({ windowId: currentWindow.id, pinned: false, groupId: -1 });
    sortTabsList(ungroupedTabs, -1, settings);
}

function sortTabsList(tabs, groupId, settings) {
    if (tabs.length === 0) return;
    
    let firstTabIndex = tabs[0].index;
    
    console.log(`[TabSorter] Before sort (Group ${groupId}):`, tabs.map(t => ({ id: t.id, title: t.title, url: t.url, pinned: t.pinned })));
    
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

    console.log(`[TabSorter] After sort (Group ${groupId}):`, tabs.map(t => ({ id: t.id, title: t.title, url: t.url, pinned: t.pinned })));

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
  }
});
