# Auto Tab Grouper: Technical Implementation

> **Note:** This document covers the background **Auto Tab Grouper** daemon that continuously organizes tabs based on user-defined rules. For the on-demand, domain-based "Tab Grouper" wizard, see [Tab Grouper (AUTO_TAB_GROUPING.md)](./AUTO_TAB_GROUPING.md).

The Auto Tab Grouper is a robust, persistent service worker daemon that silently organizes incoming tabs in real-time according to custom user-defined match rules.

## Core Grouping Strategy

The system evaluates all tabs actively against a compiled registry of rules immediately upon tab creation or navigation (`chrome.tabs.onCreated`, `chrome.tabs.onUpdated`).

1. **Rule Compilation**: Rules are defined by the user in the extension UI, saved to `chrome.storage.local`, and eagerly loaded by the service worker.
2. **Multiple Patterns**: A single rule (e.g., "Social Media") can comprise an array of distinct URL match conditions. 
3. **Match Types**: Patterns can be defined using one of four modes. To maintain maximum performance, the daemon uses an interwoven evaluation architecture:
    - **Simple Domain**: Automatically converts a plain string like `youtube.com` into a Chrome match pattern (`*://*.youtube.com/*`), seamlessly encompassing subdomains while stripping away any path or protocol formatting. 
    - **URL Pattern**: Standard Chrome match patterns with wildcards (e.g., `*://*.github.com/*`).
    - **Regex**: Full regular expressions for complex conditional matching.
    *(Note: The above three modes are transparently compiled into highly-performant regular expressions by the `generateMatcherRegex` utility and tested solely against the tab's URL.)*
    - **Rough Match**: A structural matching strategy that evaluates specific target properties of the tab object itself (Hostname, Full URL, Page Title, Page Title [ignore case]) using built-in Javascript comparators (`includes`, `startsWith`, `endsWith`, `equals`). This mode requires the daemon to listen for both URL and Title change events.
4. **Race Condition Prevention**: Since users may rapidly restore dozens of tabs simultaneously or open multiple links in quick succession, the daemon uses a `groupCreationTracker` (`Map<string, Promise>`). This intercepts simultaneous requests that hit the same rule, waiting for the first tab to definitively create the tab group before appending the subsequent tabs to the exact same group ID, preventing duplicate group creation.

## Group Modes

Each rule can be configured with specific behavioral modifiers:

### Strict Mode
If `strict` is enabled, the daemon enforces the group boundary rigorously. If a user navigates a grouped tab away from the rule's matching domain (e.g., from `github.com` to `reddit.com`), the daemon actively detects the mismatch and strips the tab from the group, preventing groups from becoming polluted with unrelated content.

### Merge Mode
By default, Chrome Tab Groups are inherently constrained to a single window. If a user opens a YouTube tab in Window A and Window B, they will form two independent "YouTube" groups. If `merge` is enabled, the daemon ignores the `windowId` boundary during the group lookup, forcing tabs into the group regardless of the window they originated in. Note that this requires the browser to actively move the tab across windows if it matches a group in a different window.

## Architecture & Integration

The auto-grouper operates natively within the monolithic `public/background.js` service worker. This architectural decision prevents isolated worker contexts from colliding over global scope declarations or causing Service Worker registration errors in Chrome (`Failed to execute 'importScripts'`).

**UI Synchronization**: 
The React UI operates exclusively via a unidirectional data flow to the background daemon. 
- The UI writes rule schemas to `chrome.storage.local`.
- The `background.js` daemon listens to `chrome.storage.onChanged`.
- When changes are detected, the daemon automatically recompiles its internal rule representation and instantly sweeps all existing tabs in the background to enforce the new rule configurations.

### Template System

To simplify the onboarding experience, the extension ships with a massive, localized dictionary of predefined grouping rules in `templates.js`. Instead of forcing users to manually input dozens of domains, they can select a template to automatically generate a fully populated rule.

1. **Data Dictionary (`templates.js`)**: 
   - Defines a vast array of `PRESET_TEMPLATES` categorized by industry (e.g., `Finance`, `News`, `Shopping`) and region (e.g., `Global`, `na.ca`, `eastasia.japan`).
   - Contains a rigid `REGION_COVERAGE_MAP` that defines which templates exist for which regions, allowing the UI to accurately toggle available options.
   - Includes visual metadata (icons, Tab Group colors) and structural pattern matching arrays designed specifically for the daemon's "Simple Domain" matching mode.

2. **Hierarchical Selection (`TemplateSelect.jsx`)**:
   - The UI parses the flat template array into a relational tree structure, grouping regional variants underneath their global parent categories.
   - It provides a two-tier region filter (e.g., selecting "Europe" reveals "UK", "Germany", "France").
   - **Merge Capability**: A critical feature of the `TemplateSelect` component is its ability to automatically combine rules. If a user clicks a regional variant (like *🇨🇦 Finance*), the component utilizes `handleAddMerged` to simultaneously extract the domains from the base *Global Finance* template and merge them with the *Canadian Finance* template. This generates a single, hyper-comprehensive list of URLs that covers both global standard platforms and local champions.

## Suspended Tab Support

The auto-grouper is fully aware of tabs paused by a tab-suspender extension (e.g. Tiny Suspender). The behaviour is governed by the **Exclude Suspended Tabs** toggle in Settings, which is stored in both `localStorage` (for the React UI) and `chrome.storage.local` (as `tabbit_excludeSuspendedTabs_remote`) so the service worker daemon can read it directly.

### Preview Panel (`AutoTabGrouperWorkerPanel`)

`previewTabs` pre-filters `state.tabs` against `excludeSuspendedTabs` (read from `TabProcessingProvider`) before running any rule matching. Because `triageLoader.js` already decodes the real URL, title, and favicon out of each suspender URL and stamps `isSuspended: true` on the tab object, the panel only needs a single guard:

```
const visibleTabs = excludeSuspendedTabs
  ? state.tabs.filter(tab => !tab.isSuspended)
  : state.tabs;
```

No new state or plumbing is required — the flag and the field both already existed.

### Background Daemon (`background.js`)

The service worker receives raw Chrome tab objects where a suspended tab's `tab.url` is a `chrome-extension://…` suspender URL, not the real page URL. Two helpers decode it before matching:

- **`decodeSuspendedUrl(rawUrl)`** — extracts the real URL from the `?url=` query param used by virtually all popular suspenders.
- **`getTabRealUrl(tab)`** — wraps the decoder, returning `{ realUrl, isSuspended }` for any tab.

`processTab()` now calls `getTabRealUrl()` first, then:
1. **If `isSuspended && ag_excludeSuspended`** → returns early (tab is skipped entirely).
2. **Otherwise** → runs all regex and rough-match rules against `realUrl` instead of the raw suspender URL, so patterns like `*://*.github.com/*` correctly match a suspended GitHub tab.

The `ag_excludeSuspended` flag is loaded from `chrome.storage.local` in `initAutoGrouper()` and kept live via the existing `chrome.storage.onChanged` listener. `TabProcessingProvider` mirrors the setting into `chrome.storage.local` on every toggle and on first mount.

| Exclude Setting | Tab State | Preview Shows? | Daemon Groups? |
|-----------------|-----------|---------------|----------------|
| **OFF** (include) | Suspended, matches rule | ✅ Yes | ✅ Yes |
| **OFF** (include) | Suspended, no rule match | ❌ No | ❌ No |
| **ON** (exclude) | Suspended, any | ❌ No | ❌ No |
| Either | Regular tab, matches rule | ✅ Yes | ✅ Yes |

## UI Behaviors

### Preview Panel Filtering

The preview panel only surfaces tabs that are **actionable** — i.e., tabs that match a rule but are not already sitting in a Chrome tab group whose title matches that rule's `groupName`. A tab with `groupId === g.id` where `g.title === rule.groupName` is considered already correctly grouped and is silently excluded. This filter runs in the same `useMemo` as the match logic and reacts to `state.tabGroups` changes in real time.

### Apply on Save

After clicking **Save & Apply**, if the auto-grouper is being left **enabled** and the filtered preview contains at least one actionable tab, a confirmation modal (`ApplyTabsModal`) is presented. The user can choose to immediately move those tabs into their target groups, or skip. 

On confirm, tabs are processed per-rule: if a Chrome tab group with the matching name already exists, tabs are merged into it via `chrome.tabs.group`; otherwise a new group is created via `chrome.tabs.group` + `chrome.tabGroups.update`. Each tab action goes through `groupAction` from `useTriageActions`, which pushes a `{ type: 'group' }` entry onto `globalChromeUndoStack` and dispatches `PROCESS_TAB` — making the operation fully undoable and properly reflected in the triage deck.

### Rule List Tab Count

Each rule row in `RuleList` displays a live count of tabs currently in the matching Chrome tab group (e.g., `· 20 tabs`), derived from a `groupTabCountMap` useMemo in `AutoTabGrouperWorkerPanel`. The count is only shown when greater than zero and updates reactively with `state.tabs` and `state.tabGroups`.

### Auto Grouper Shortcut in Tab Group Picker

The `TabGroupPickerPanel` header includes a `Magnet` icon button that navigates directly to the Auto Grouper card (`autotabgrouperworker` view), mirroring the same entry point exposed in the `CardActionMenu`. This gives users a fast path from the group picker to rule configuration without opening the full settings menu.