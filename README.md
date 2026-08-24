<div align="center">

<br />

<img src="https://raw.githubusercontent.com/tab0dev/tabbit/main/public/icons/icon128.png" width="42" />
<img src="https://raw.githubusercontent.com/tab0dev/tabbit/main/public/brand-title.svg" height="42" />

<span>close your tabs!!</span>
<br />
<br />
Tabbit is the tab toolbox you've been missing.  Use Tabbit to triage your open tabs, one tab at a time. Keep, close, bookmark, or group tabs and get back to a clean browser. 100% offline, privacy respecting, open source, free to use.   <br /><br /> Tabbit includes powerful browser-cleaning utilities to help manage huge sessions. Use Tabbit to:  **sort tabs** (manually, or automatically), **group tabs** (manually, or automatically, or manually with AI), **remove tabs based on age** (manually, or automatically), **smush duplicate tabs** (manually, or automatically), **consolidate tabs into a single window**, and  **clean up old bookmarks**.

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v0.3.1-f8b50a?logo=googlechrome&logoColor=white&style=flat-square)](https://chromewebstore.google.com/detail/tabbit-tab-closer-organiz/calbmnbhppoplenhgpfejepklainehko)

Install it on the Google Chrome Web store: 
https://chromewebstore.google.com/detail/tabbit-tab-closer-organiz/calbmnbhppoplenhgpfejepklainehko


</div>

## 🐰 What is Tabbit?

Tab and browser window sprawl is real, and it can quickly become overwhelming. Tabbit helps you (1) **handle your open tabs** quickly without distractions, (2) **bulk manage remaining tabs**, and (3) **automatically keep new tabs organized**. 

### 1. Triage

Tabbit turns your open tabs into a deck of cards so you can make fast decisions about what you need to keep, and what needs to go. Preview your tabs in a single interface, and use helpful hotkeys to stay in the zone.

| Action | Hotkey | What it does |
|--------|--------|-------------|
| **Keep** | `→` | Tab stays open, move to next |
| **Close** | `←` | Tab is closed (and can be undone) |
| **Bookmark** | `↑` | Save to a bookmark folder, then close |
| **Group** | `↓` | Move into a Chrome tab group |
| **Undo** | `z` | Undo last action |
| **Open** | `Space` | Open the current tab in its window, keep it in the queue |

**[❗️] All hotkeys are fully re-mappable in the bottom bar!**

---

### 2. Organize and Clean

After using the triage stack to prune your unwanted tabs, Tabbit can help you organize your remaining tabs.

- Group into Tab Groups (by URL, or with AI intent detection via Chrome's Gemini APIs - free and 100% local)
- Bulk bookmark, group, or close tabs across all open windows in a list view
- Consolidate tabs in a single window
- Smush duplicates
- Sort tabs by URL or name

---

### 3. Auto-Organize and Clean

Tabbit can also automatically clean and manage your tabs while you browse: 

- Auto-sorting by name or URL
- Auto grouping tabs by simple domain match, URL patterns, or fully-featured Regex matching
    - Includes template URL sets for media, news, sports, etc. with region variants for each category. 
- Auto-duplicate smushing
- Auto-closing tabs of a certain age (retreivable via a tab graveyard)

## ✨ Features & Product, enumerated

1. **Tab Triage Stack**: Keep, close, bookmark, group, smush, or reopen tabs
    - Rich previews: See a visual snapshot of the page before you decide its fate
    - Configurable stack ordering
    - Can filter out suspended tabs (Tiny Suspender, not Google Tab Suspender _yet?_)
    - Every action is undo-able
2. **Tab List View**: See all your tabs as a list instead of a deck of cards. Filter, sort, and group tabs across windows into a single list. 
    - Select tabs with click, Shift+click ranges, or rubber-band drag
3. **Tab Closer**: Remove all tabs (minus selections) above an age threshold.
4. **Auto Tab Closer**: Quietly prunes tabs of a certain age you set.
    - Automatic removals are tracked in the Tab Graveyard and are easy to recover.
5. **Tab Grouper**: Group tabs by URL or with AI intent detection via Chrome's Gemini APIs
    - AI usage is **opt-in**, **optional**, **free**, and **100% local**. Can remove permissions after grant from Settings.
6. **Auto Tab Grouper**: Persistent background worker that moves new tabs into Chrome tab groups the moment they open, based on your custom URL/regex rules. 
    - Supports removing from a group when the URL changes, moving tabs into other window's tab groups, suspended tab awareness
    - Includes a template library covering 20+ categories with regional variants
7. **Tab Smusher**: Right click the Tabbit extension icon to instantly smush all duplicate tabs.
8. **Auto Tab Smusher**: Persistent background worker that smushes new duplicates of tabs and refocuses the original. 
9. **Tab Sorting**: Right click the Tabbit extension icon to instantly sort tabs by URL or title.
10. **Auto Tab Sorter**: Sort all tabs alphabetically by title or URL, and automatically maintain order when opening new tabs.
11. **Merge all tabs in one window**: when you need to reduce sprawl and top-down view of your 500 tabs.
11. **YouTube Bulk "Add to Watch Later"**: Select which open YouTube videos you would like to put in the native YouTube Watch Later playlist, and let the worker handle clicking the right buttons and closing the tabs for you.
12. **Bookmark Cleaner**: Search and sort your bookmarks by last used, and creation date, to help surface useless bookmarks. 
    -  Multi-select with click, Shift+click, and rubber-band drag
    - Supports nested-folder actions and multi-folder cascading selection with partial deselect. 
13. **Bookmark Cold Storage (Needs Work)**: Archive bookmarks out of Chrome and into a local JSON file, which can be easily restored later. Not really sure if I should be encouraging likely-nostalgic tab hoarding but hey a tool's a tool. 
14. **First-class Suspended Tab Support**: Fully supports TinySuspender (and custom suspender extensions) by automatically decoding `chrome-extension://` placeholder URLs back into their original URLs. This ensures that when you bookmark a suspended tab (in triage view or via bulk actions), you correctly bookmark the actual webpage instead of the extension's suspension page. Additionally, you can configure the Auto Sorter to cluster all suspended tabs away from your active tabs, or choose to exclude them from the triage stack entirely.
15. **Fast Fuzzy Search everywhere**: Search tabs, bookmarks, tab groups, etc super quick!
16. **Dark Mode** 😎
17. **Actually useful quick-tutorials** 😇 
18. **A nice UI that is easy to use** 🤞🏼

## 📚 Technical Documentation

If you are a developer looking to contribute or understand how Tabbit works under the hood, there are some technical guides to help explain the existing system:

- **[Architecture & Core Loop](./readmes/ARCHITECTURE.md)**
- **[Data Model & State Management](./readmes/DATA_MODEL.md)**
- **[Module Directory Map](./readmes/MODULES.md)**
- **[UI, Animation & Hotkeys](./readmes/UI.md)**
- **[Bookmark & Tab Group Picker](./readmes/PICKER_HISTORY.md)**
- **[Auto Tab Sorter Worker](./readmes/AUTO_TAB_SORTER.md)**
- **[Auto Tab Closer Worker](./readmes/AUTO_CLOSER.md)**
- **[Auto Tab Grouper Worker](./readmes/AUTO_TAB_GROUPER.md)**
- **[Tab Grouper Wizard (AI / Domain)](./readmes/TAB_GROUPER.md)**
- **[Tab List View (Batch Triage)](./readmes/TAB_LIST_VIEW.md)**
- **[Bookmark Cleaner & Cold Storage](./readmes/BOOKMARK_CLEANER.md)**
- **[Watch Later Batch Automation](./readmes/YT_WATCH_LATER.md)**
- **[Permissions & Privacy Justifications](./readmes/PERMISSIONS.md)**
- **[Generative Music Engine](./readmes/MUSIC_SYSTEM.md)**
- **[Development Guide](./readmes/DEVELOPMENT.md)**


## 🔒 Permissions

Tabbit only asks for the permissions it needs to work. Everything stays local on your machine. We have no interest in your data, and we never see it. Check out our [Privacy Policy](https://tabbit.website/privacy/) for more details. 

Trust is a fragile thing. It is one thing to ask a user to install a basic extension, it's another to install an extension like Tabbit, with its sprawling permissions access and browser debugging mode. This repo is meant to help bridge the trust-gap: the source code is open to all, it's verified by Google before being published and all permissions justifications are kept up to date.

| Permission | Why |
|-----------|-----|
| `tabs` | Enumerate and triage open tabs |
| `bookmarks` | Save tabs to bookmark folders |
| `tabGroups` | Move tabs into and create Chrome tab groups |
| `activeTab` | Switch focus to a tab when you click its card |
| `debugger` | Capture visual tab previews securely in the background |
| `alarms` | Run the Auto Tab Closer worker on a schedule; keep the Auto Tab Sorter daemon alive across service worker suspensions |
| `storage` | Save preferences and the auto-closer graveyard |
| `contextMenus` | Add right-click shortcuts to the extension icon: sort by title, sort by URL, smush duplicates, merge windows |
| `scripting` + `*://*.youtube.com/*` | Inject the Watch Later automation script into live YouTube tabs |
| `windows` | Identify and focus the target window during Merge Windows |
| `idle` | Detect when the user returns to their computer to trigger Auto Tab Sort and immediately organize tabs |

For the exhaustive breakdown required by the Chrome Web Store, see the **[Permissions & Privacy Justifications README](./readmes/PERMISSIONS.md)**.

---

## Install from the Chrome Web Store

> **Easiest path.** No build required.

1. Visit the [Chrome Web Store listing](https://chromewebstore.google.com/detail/tabbit-tab-closer-organiz/calbmnbhppoplenhgpfejepklainehko)
2. Click **Add to Chrome**
3. Click the Tabbit icon in your toolbar to start your first triage session

---

## Build & Run from Source

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)

### 1. Clone & install

```bash
git clone https://github.com/tab0dev/tabbit.git
cd tabbit
pnpm install
```

### 2. Build the extension

```bash
pnpm build
```

This compiles the React source and outputs a ready-to-load extension into the `dist/` directory.

> **Tip:** Run `pnpm build:zip` to also produce a `Tabbit-vX.X.X.zip` suitable for Chrome Web Store submission.

### 3. Load into Chrome

1. Navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the **`dist/`** folder inside this repository

> ⚠️ Point Chrome at `dist/`, not the repo root. The unpacked extension lives in `dist/`.

Click the Tabbit icon in your toolbar — you're triaging.


### Tech stack

| Layer | Choice |
|-------|--------|
| UI framework | React 18 |
| Bundler | Vite 5 |
| Animation | Framer Motion |
| Drag-and-drop | dnd-kit |
| Icons | Phosphor Icons |
| Fuzzy search | uFuzzy |
| Extension API | Chrome MV3 |

---

## Roadmap

Honestly, not much. Have a feature idea? Open an [issue](../../issues) or a discussion. Or if you're just a bit shy, consider using the anonymous feedback form on the [website](https://tabbit.website).

---

## Contributing

Pull requests are welcome. For significant changes, please open an issue if you'd like to discuss before submitting. Please keep PRs focused: one feature or fix per PR.

---

## License

don't be evil
