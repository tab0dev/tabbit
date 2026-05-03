<div align="center">

<br />

<img src="https://raw.githubusercontent.com/tab0dev/tabbit/main/public/icons/icon128.png" width="42" />
<img src="https://raw.githubusercontent.com/tab0dev/tabbit/main/public/brand-title.svg" height="42" />

<span>close your tabs!!</span>

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v0.1.1-f8b50a?logo=googlechrome&logoColor=white&style=flat-square)](https://chromewebstore.google.com/detail/tabbit-tab-closer-organiz/calbmnbhppoplenhgpfejepklainehko)

<br />

Tabbit is a Chrome extension that helps you triage your open tabs, one tab at a time. Use keyboard shortcuts or swipe on tab previews to decide if you want to keep, close, bookmark, or group the tab. Built with React, Chrome APIs, and carrots.

Install on the Google Chrome Web Store: 
https://chromewebstore.google.com/detail/tabbit-tab-closer-organiz/calbmnbhppoplenhgpfejepklainehko

<br />

</div>

## What is Tabbit?

A messy browser sucks. Tabbit turns your open tabs into a deck of cards so you can make fast decisions about what you need, and what needs to go. It also includes useful Tab organization features: tab sorting, auto-creating tab groups, bulk closing, automated cleanup based on tab age, smushing duplicate tabs, etc.

| Action | Hotkey | What it does |
|--------|--------|-------------|
| **Keep** | `→` | Tab stays open, move to next |
| **Close** | `←` | Tab is closed (and can be undone) |
| **Bookmark** | `↑` | Save to a bookmark folder, then close |
| **Group** | `↓` | Move into a Chrome tab group |

When the queue hits zero — confetti. Every action is fully undoable.


## 📚 Technical Documentation

If you are a developer looking to contribute or understand how Tabbit works under the hood, there are some technical guides to help explain the existing system:

- **[Architecture & Core Loop](./readmes/ARCHITECTURE.md)**
- **[Data Model & State Management](./readmes/DATA_MODEL.md)**
- **[Module Directory Map](./readmes/MODULES.md)**
- **[UI, Animation & Hotkeys](./readmes/UI.md)**
- **[Tab Sorter Engine](./readmes/TAB_SORTER.md)**
- **[Auto Tab Closer Worker](./readmes/AUTO_CLOSER.md)**
- **[Watch Later Batch Automation](./readmes/WATCH_LATER.md)**
- **[Permissions & Privacy Justifications](./readmes/PERMISSIONS.md)**
- **[Generative Music Engine](./readmes/MUSIC_SYSTEM.md)**


## ✨ Features & Product Outline

Tabbit is a simple toolkit to help you make decisions fast and get your browser back in order.

### 🃏 The Triage Flow
- **Swipe-to-sort**: Fly through tabs with your mouse, touch screen, or hotkeys
- **Rich previews**: See a visual snapshot of the page before you decide its fate
- **Smart context**: Flags stale tabs and duplicates so you can clear noise instantly
- **Instant Undo**: Hit `Cmd+Z` to bring back any tab exactly as it was

### 🧠 Smart Organization
- **AI Tab Grouping**: Clusters tabs into named groups using local on-device AI
- **Quick Pickers**: Fuzzy-search folders and groups in milliseconds when bookmarking or adding to tab groups
- **YouTube Batching**: Batch save YouTube videos into the native Youtube "Watch Later" folder

### 🧹 Background Cleaning
- **Auto Tab Closer**: Quietly prunes tabs of a certain age you set. Easy to recover pruned tabs.
- **One-Click Sorting**: Right click the Tabbit icon to sort your windows alphabetically or by URL
- **Tab Smusher**: Reduce duplicates down to a single copy (prioritizing recent interactions) in one click

### 🎮 QoL
- **Retro Monitor**: old CRT effect on the preview window
- **Generative Music**: A built-in rhythm game that evolves the music as you work
- **Inbox Zero**: Reach the end of your queue and celebrate with confetti


## 🔒 Permissions

Tabbit only asks for the permissions it needs to work. Everything stays local on your machine—I have no interest in your data, and I never see it.

| Permission | Why |
|-----------|-----|
| `tabs` | Enumerate and triage open tabs |
| `bookmarks` | Save tabs to bookmark folders |
| `tabGroups` | Move tabs into and create Chrome tab groups |
| `activeTab` | Switch focus to a tab when you click its card |
| `debugger` | Capture visual tab previews securely in the background |
| `alarms` | Run the Auto Tab Closer worker on a schedule |
| `storage` | Save preferences and the auto-closer graveyard |
| `contextMenus` | Add instant sorting shortcuts to the extension icon |
| `<all_urls>` / `*://*.youtube.com/*` *(optional)* | Required for "Watch Later" script injection and robust tab previews |

For the exhaustive breakdown required by the Chrome Web Store, see the **[Permissions & Privacy Justifications](./readmes/PERMISSIONS.md)**.

---

## Install from the Chrome Web Store

> **Easiest path.** No build required.

1. Visit the [Chrome Web Store listing](https://chromewebstore.google.com/detail/tabbit-tab-closer-organiz/calbmnbhppoplenhgpfejepklainehko)
2. Click **Add to Chrome**
3. Click the Tabbit icon in your toolbar to start your first triage session

---

## Run from Source

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)

### 1. Clone & install

```bash
git clone https://github.com/[your-username]/tabbit.git
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

## Keyboard shortcuts

Tabbit is designed to be navigated entirely from the keyboard.

| Key | Action |
|-----|--------|
| `→` | Keep tab |
| `←` | Close tab |
| `↑` then `↑` / `↓` | Open bookmark picker and navigate |
| `↓` then `↑` / `↓` | Open tab group picker and navigate |
| `Enter` | Confirm picker selection |
| `Esc` | Close picker / cancel |
| Type anything | Instantly searches the open picker |

Hotkeys are remappable via the **Hotkeys** panel inside the extension.

---


## Roadmap

Honestly, nothing much. Have a feature idea? Open an [issue](../../issues) or a discussion. Or at https://tabbit.website/feedback.

---

## Contributing

Pull requests are welcome. For significant changes, please open an issue first so we can discuss the approach.

```bash
# Fork, then:
git clone https://github.com/[your-username]/tabbit.git
cd tabbit
pnpm install
pnpm dev
```

Please keep PRs focused. One feature or fix per PR.

## License

don't be evil
