# AutoTab Group Wizard Overhaul: Parity & Beyond

To elevate our current "brand-first" interactive AutoTab Group Wizard into a complete, automated, and robust tab management suite. We will retain our beautiful interactive wizard for manual grouping while implementing powerful rule-based background automation, true Public Suffix List parsing, and session snapshots to surpass our primary non-AI competitors.

## User Review Required

> [!IMPORTANT]
> The architectural shift from purely interactive grouping to **Background Automation** will require expanding our extension's footprint.
> - We will need to request additional permissions in `manifest.json`, potentially including `alarms`, `contextMenus`, and `unlimitedStorage` (for snapshots).
> - We will be adding persistent service worker logic to monitor `chrome.tabs.onUpdated` and `onCreated`, which increases the background responsibilities of the extension.

## Open Questions

> [!WARNING]
> 1. **Rule UI location**: Should the new UI for managing automated Rules and viewing Saved Snapshots live in a new dedicated Chrome Options page, or should we build them as new tabs/views inside our existing Dashboard SPA component?
> 2. **AI Synergy**: Since we are focusing on NON-AI tab groupings for this overhaul, should we still provide a bridge? For example, when the user uses the AI to group tabs, should we offer a "Save as Rule" button to turn that AI suggestion into a permanent deterministic rule?

## Proposed Changes

### Phase 1: Robust Domain Parsing (PSL Integration)

Upgrade our fragile `domainUtils.js` (which currently relies on a hardcoded list of suffixes and brands) to use a true Public Suffix List logic for correct eTLD+1 extraction, matching the accuracy of "Tab Groups Extension".

#### [NEW] `src/utils/publicSuffixList.js`
#### [MODIFY] `src/utils/domainUtils.js`
- Integrate a lightweight PSL parser (or a compiled trie structure) to correctly handle complex ccTLDs (e.g., `bbc.co.uk`) flawlessly.

### Phase 2: Rule-Based Background Automation

Implement a reactive routing engine similar to "Auto-Group Tabs" to automatically group tabs as the user browses, rather than waiting for them to open the Wizard.

#### [NEW] `src/background/ruleEngine.js`
- Compiles user rules into RegEx patterns (handling both URL match patterns and Title matches).
- Hooks into `chrome.tabs.onCreated` and `chrome.tabs.onUpdated` to evaluate tabs dynamically.
- Implements "Strict Mode" (ungroups a tab if it's dragged out of its assigned group) and "Merge Mode" (merges across multiple Chrome windows).

#### [NEW] `src/background/groupCreationTracker.js`
- A promise-based queue system to safely handle race conditions when multiple tabs load concurrently and match the same rule, ensuring only one Chrome Tab Group is created.

#### [NEW] `src/background/stateSync.js`
- Listens to `chrome.tabGroups.onUpdated` to detect when a user manually renames a group in the Chrome UI and bi-directionally syncs the change back to the corresponding saved rule.

#### [MODIFY] `src/utils/domainPreferences.js`
- Expand the schema to support robust rule definitions (`urlMatches`, `titleMatches`, `strictMode`, `mergeWindowMode`) alongside the existing `split` preference.

### Phase 3: Session Snapshot & Restoration

Introduce a new feature to save tab groups to local storage and restore them later, directly inspired by "Tab Groups Extension".

#### [NEW] `src/services/snapshotService.js`
- API to serialize a Tab Group (title, color, tab URLs, favicons) to `chrome.storage.local`.
- Include deduplication and max-snapshot trimming logic.

#### [NEW] `src/components/Dashboard/Snapshots/SnapshotView.jsx` (and related components)
- New UI components for users to browse, restore (re-open tabs and regroup), edit, and delete their saved snapshots.

### Phase 4: Keyboard Commands & Shortcuts

#### [MODIFY] `manifest.json`
- Add new `commands` for common actions (e.g., "Group all ungrouped tabs by domain", "Save current group").

#### [NEW] `src/background/shortcutHandler.js`
- Centralized router for `chrome.commands.onCommand` to dispatch actions.

### Phase 5: Upgrading the Interactive Wizard

#### [MODIFY] `src/components/Dashboard/AutoTabGroupWizard/useWizardState.js`
- Integrate the new Rules. When users confirm grouping in the Wizard, prompt them if they want to save their groupings as persistent auto-grouping rules.

## Verification Plan

### Automated Tests
- **Domain Logic**: Extend `src/tests/domainGrouping.test.js` to thoroughly test the new PSL logic against complex international edge cases (eTLDs and IDNs).
- **Rule Compilation**: Create unit tests for the Rule Engine to verify that Chrome match patterns correctly compile into valid RegEx.

### Manual Verification
- **Race Conditions**: Open 10 matching tabs simultaneously and verify the `GroupCreationTracker` creates only a single group.
- **Bi-Directional Sync**: Rename a tab group natively in Chrome's tab strip and ensure the background script syncs the new name back to the saved rule.
- **Snapshots**: Save a tab group as a snapshot, close the entire group, and trigger a restore to ensure all tabs re-open in a properly recreated group.
