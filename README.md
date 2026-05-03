<div align="center">

<br />

# 🐇 Tabbit

**Close your tabs!!**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v0.2-4285F4?logo=googlechrome&logoColor=white&style=flat-square)](https://chromewebstore.google.com/detail/tabbit-tab-closer-organiz/calbmnbhppoplenhgpfejepklainehko)
[![Built with React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![Built with Vite](https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white&style=flat-square)](https://vitejs.dev)


Tabbit is a Chrome extension that helps you triage your open tabs, one tab at a time. Use keyboard shortcuts or swipe on tab previews to decide if you want to keep, close, bookmark, or group the tab. Built with React, Vite, Chrome MV3, Chrome APIs, and carrots.


</div>

## What is Tabbit?

You know that feeling. You open Chrome and there are 87 tabs staring back at you. Some important. Most not. All of them quietly draining your focus.

Tabbit turns that chaos into a session. It surfaces every tab as a card and gives you four decisions:

| Action | Hotkey | What it does |
|--------|--------|-------------|
| **Keep** | `→` | Tab stays open, move to next |
| **Close** | `←` | Tab is closed (and can be undone) |
| **Bookmark** | `↑` | Save to a bookmark folder, then close |
| **Group** | `↓` | Move into a Chrome tab group |

When the queue hits zero — confetti. Every action is fully undoable.


## 📚 Technical Documentation

If you are a developer looking to contribute or understand how Tabbit works under the hood, we have a comprehensive set of technical guides:

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

Tabbit is a comprehensive suite of utilities designed to keep your decisions fast and focused.

### 🃏 The Triage Flow
- **Tinder-style swipe cards**: Swipe left or right with your mouse, drag them on a touch screen, or use lightning-fast keyboard shortcuts (`K`, `X`, `B`, `G`) to fly through your queue.
- **Rich previews**: See the tab's title, URL, favicon, and a visual screenshot preview of the page itself before making a decision.
- **Contextual metadata**: "Last visited X weeks ago" pills make stale tabs obvious, while duplicate-tab detection lets you batch-close redundant pages instantly.
- **Full Undo Stack**: Every action is completely reversible (`Cmd+Z` / `Ctrl+Z`), seamlessly recreating closed tabs via Chrome APIs and patching the UI queue in sync.

### 🧠 Smart Organization
- **Auto Tab Group Wizard**: Uses on-device AI (Gemini Nano) to cluster your open tabs by underlying intent, letting you create named Chrome Tab Groups with a single click.
- **Fuzzy-search Pickers**: Save tabs to specific Bookmark folders or existing Tab Groups using a fast, keyboard-first fuzzy search interface (powered by [uFuzzy](https://github.com/leeoniya/uFuzzy)).
- **Watch Later Automation**: Instantly clear out your backlog of YouTube tabs. Tabbit injects an automation script to natively click the "Save to Watch Later" button on each tab and closes them for you.

### 🧹 Background Utilities
- **Auto Tab Closer**: A completely silent background daemon that prunes tabs you haven't looked at in a while (e.g., older than 7 days). Review everything it closed in the built-in "Graveyard".
- **Tab Sorter Engine**: Right-click the extension icon to instantly sort all of your open tabs alphabetically by Title or URL. Tabbit intelligently maintains your existing pinned tabs and tab groups.

### 🎮 Quality of Life
- **Retro Monitor**: A built-in pixel-art status monitor that tracks your actions.
- **Generative Music Game**: Turn on the music and play an integrated rhythm game while you triage, unlocking more layers of the track as you progress.
- **Confetti**: Reaching inbox zero is an achievement. We celebrate it.


## 🔒 Permissions

Tabbit requests only what it needs. Everything is local, and I do not want your data.

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