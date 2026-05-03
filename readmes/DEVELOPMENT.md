# Development

This extension has been migrated to a modern React architecture powered by Vite.

## Setup
Ensure you have `pnpm` installed.

```bash
pnpm install
```

## Running & Testing locally
Because this is a Chrome Extension requiring host permissions and background workers, you cannot fully run it in a typical browser tab via `vite dev` using hot-module-reloading (HMR).

Instead, use the build system and load it directly into Chrome:

```bash
pnpm build
```

Then, follow these steps:
1. Open `chrome://extensions/`
2. Turn on **Developer mode** in the top right.
3. Click **Load unpacked** in the top left.
4. Select the root folder of this repository (which incorporates both the `manifest.json`, the `background.js` Service Worker, and the generated `dist/` directory from Vite).
5. Click the extension badge in your Chrome toolbar to launch the Tabbit React application.

## Modifying UI
The layout uses CSS Modules (`.module.css`). Global configurations reside in `src/styles/global.css`. Component state and side-effects are heavily orchestrated around global contexts (`src/store/TriageProvider.jsx`).
