# Tabbit Technical Documentation

Welcome to the internal documentation for Tabbit, an "Inbox Zero for Tabs" Chrome extension.

Tabbit forces you to look at every open tab you have across all windows, one by one, and make a decision: Keep, Close, Bookmark, or Group. It is built using **React** and **Vite**, employing a clean context-based architecture to manage a highly asynchronous browser environment.

This folder contains everything you need to grok the codebase, understand the powerful features under the hood, and start building safely.

## Reading Guide: Core Architecture

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — The high-level mental model. Read this first to understand how the React contexts (`TriageProvider`, `PickerProvider`) and the Chrome MV3 service worker interact.
2. **[DATA_MODEL.md](./DATA_MODEL.md)** — The source of truth. Explains the shape of our global state, the queue, and the `useTriageActions` architecture.
3. **[MODULES.md](./MODULES.md)** — The map of the codebase. A quick reference for the directory structure and what major components actually do.
4. **[UI.md](./UI.md)** — Overview of the design system, hotkey bindings, and CSS animations.

## Reading Guide: Advanced Features

Tabbit isn't just a triage tool. It comes with powerful built-in utilities:

- **[TAB_SORTER.md](./TAB_SORTER.md)** — How Tabbit natively sorts browser tabs across groups and windows.
- **[WATCH_LATER.md](./WATCH_LATER.md)** — The orchestration layer that automatically saves YouTube tabs to your Watch Later playlist.
- **[AUTO_CLOSER.md](./AUTO_CLOSER.md)** — The background worker that silently cleans up stale tabs over time.
- **[MUSIC_SYSTEM.md](./MUSIC_SYSTEM.md)** — Deep dive into the interactive 7-layer generative music engine.

## Reading Guide: Privacy & Security

- **[PERMISSIONS.md](./PERMISSIONS.md)** — A comprehensive breakdown of every Chrome permission Tabbit requires, why it requires it, and the strict privacy guarantees we provide.
